import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { HttpError } from '../middleware/error.js'
import { rvtCreateSchema, rvtQuerySchema, rvtUpdateSchema } from '../schemas/rvt.js'
import { montarMatrizAprovadores } from '../lib/rnc-aprovadores.js'
import { enviarDocumentoAoFornecedor } from '../lib/rnc-workflow.js'
import { includeRefs } from './rnc.js'

/**
 * RVT — Relatório de Visita Técnica. Mesmo desenho do RAQ: compartilha a
 * tabela e o workflow de assinatura da RNC (fotos, envio para assinatura,
 * lembrete, escalonamento e PDF de /api/rnc servem todos os tipos); aqui
 * ficam o CRUD, a numeração própria por filial e os participantes. A
 * matriz de aprovação usa os aprovadores configurados para o tipo RVT, e
 * o fluxo termina com as assinaturas e o envio do PDF ao fornecedor.
 */
export const rvtRouter = Router()

/** Payload do RVT: o compartilhado mais os participantes da visita. */
const includeRefsRvt = {
  ...includeRefs,
  participantes: {
    select: { id: true, ordem: true, nome: true },
    orderBy: { ordem: 'asc' },
  },
} as const

rvtRouter.get('/', async (req, res, next) => {
  try {
    const { fornecedorId, filialId, status, page, pageSize } =
      rvtQuerySchema.parse(req.query)
    const where: Prisma.RelatorioNaoConformidadeWhereInput = {
      tipoDocumento: 'RVT',
    }
    if (fornecedorId) where.fornecedorId = fornecedorId
    if (filialId) where.filialId = filialId
    if (status) where.status = status

    const [total, items] = await Promise.all([
      prisma.relatorioNaoConformidade.count({ where }),
      prisma.relatorioNaoConformidade.findMany({
        where,
        include: includeRefsRvt,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])
    res.json({ items, page, pageSize, total })
  } catch (err) {
    next(err)
  }
})

rvtRouter.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.relatorioNaoConformidade.findUnique({
      where: { id: req.params.id },
      include: includeRefsRvt,
    })
    if (!item || item.tipoDocumento !== 'RVT') {
      throw new HttpError(404, 'RVT não encontrado')
    }
    res.json(item)
  } catch (err) {
    next(err)
  }
})

rvtRouter.post('/', async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Não autenticado')
    const data = rvtCreateSchema.parse(req.body)
    const criadoPorId = req.user.sub

    const filial = await prisma.filial.findUnique({
      where: { id: data.filialId },
      select: { codigo: true, rvtNumeroInicial: true },
    })
    if (!filial) throw new HttpError(400, 'Filial inválida')

    const ano4 = data.dataIdentificacao.getUTCFullYear()
    const mes2 = String(data.dataIdentificacao.getUTCMonth() + 1).padStart(2, '0')
    const ano2 = String(ano4).slice(-2)
    const codigoFilial = filial.codigo.trim().toUpperCase()

    const { participantes, ...rvtData } = data
    // Prefixo "RVT" no número: sequência própria, sem colidir com RNC/RAQ
    // (a coluna de número é única para todos os tipos).
    const prefixo = 'RVT' + codigoFilial + mes2 + ano2
    const montarNumero = (seq: number) => prefixo + String(seq).padStart(3, '0')

    const criarComNumeracao = () =>
      prisma.$transaction(async (tx) => {
        // Lock advisory por filial+tipo — evita corrida entre dois POSTs.
        await tx.$executeRawUnsafe(
          'SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',
          `rvt:${data.filialId}`,
        )
        const agg = await tx.relatorioNaoConformidade.aggregate({
          where: { filialId: data.filialId, tipoDocumento: 'RVT' },
          _max: { sequencialFilial: true },
          _count: { _all: true },
        })
        const usados = new Set(
          (
            await tx.relatorioNaoConformidade.findMany({
              where: { numero: { startsWith: prefixo }, tipoDocumento: 'RVT' },
              select: { numero: true },
            })
          ).map((r) => r.numero),
        )
        let sequencial =
          Math.max(
            filial.rvtNumeroInicial ?? 0,
            agg._max.sequencialFilial ?? 0,
            agg._count._all ?? 0,
          ) + 1
        let numero = montarNumero(sequencial)
        while (usados.has(numero)) {
          sequencial += 1
          numero = montarNumero(sequencial)
        }
        const novo = await tx.relatorioNaoConformidade.create({
          data: {
            ...rvtData,
            tipoDocumento: 'RVT',
            numero,
            sequencialFilial: sequencial,
            criadoPorId,
            participantes: {
              create: participantes.map((p, i) => ({
                ordem: i + 1,
                nome: p.nome,
              })),
            },
          },
          select: { id: true },
        })
        // Matriz de aprovação: só os aprovadores configurados para o tipo
        // RVT (sem vínculo de tipo = assina todos).
        await montarMatrizAprovadores(tx, novo.id, data.filialId, null, 'RVT')
        return tx.relatorioNaoConformidade.findUniqueOrThrow({
          where: { id: novo.id },
          include: includeRefsRvt,
        })
      })

    // Rede de segurança contra colisão de número (dado legado/integração).
    let created
    for (let tentativa = 1; ; tentativa++) {
      try {
        created = await criarComNumeracao()
        break
      } catch (err) {
        const colisaoDeNumero =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          (err.meta?.target as string[] | undefined)?.includes('numero')
        if (!colisaoDeNumero || tentativa >= 5) throw err
      }
    }
    res.status(201).json(created)
  } catch (err) {
    next(err)
  }
})

rvtRouter.patch('/:id', async (req, res, next) => {
  try {
    const { participantes, ...rest } = rvtUpdateSchema.parse(req.body)

    const atual = await prisma.relatorioNaoConformidade.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        tipoDocumento: true,
        status: true,
        filialId: true,
        aprovadores: { select: { assinadoEm: true } },
      },
    })
    if (!atual || atual.tipoDocumento !== 'RVT') {
      throw new HttpError(404, 'RVT não encontrado')
    }
    // Documento encerrado é imutável: já foi assinado e comunicado.
    if (atual.status === 'CLOSED') {
      throw new HttpError(
        409,
        'O RVT está encerrado (assinado e enviado ao fornecedor) e não pode mais ser alterado.',
      )
    }
    // O encerramento é do fluxo de assinaturas, nunca do PATCH.
    if (rest.status === 'CLOSED') {
      throw new HttpError(409, 'O RVT é encerrado pelo fluxo de assinaturas.')
    }
    // Trocar a filial remonta a matriz do zero — proibido depois que
    // alguém já assinou.
    const temAssinatura = atual.aprovadores.some((a) => a.assinadoEm)
    if (
      rest.filialId !== undefined &&
      rest.filialId !== atual.filialId &&
      temAssinatura
    ) {
      throw new HttpError(
        409,
        'A filial não pode ser alterada depois que há assinaturas coletadas.',
      )
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (participantes !== undefined) {
        await tx.rvtParticipante.deleteMany({ where: { rncId: req.params.id } })
        if (participantes.length > 0) {
          await tx.rvtParticipante.createMany({
            data: participantes.map((p, i) => ({
              rncId: req.params.id,
              ordem: i + 1,
              nome: p.nome,
            })),
          })
        }
      }
      const salvo = await tx.relatorioNaoConformidade.update({
        where: { id: req.params.id },
        data: rest,
        include: includeRefsRvt,
      })
      // Filial alterada muda quem deve assinar — remonta a matriz (só
      // chega aqui sem nenhuma assinatura coletada).
      if (rest.filialId !== undefined && rest.filialId !== atual.filialId) {
        await montarMatrizAprovadores(tx, salvo.id, salvo.filialId, null, 'RVT')
        return tx.relatorioNaoConformidade.findUniqueOrThrow({
          where: { id: salvo.id },
          include: includeRefsRvt,
        })
      }
      return salvo
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

/**
 * Reenvio manual do RVT assinado ao fornecedor — para quando o envio
 * automático da conclusão falhou (SMTP fora, contato sem e-mail).
 */
rvtRouter.post('/:id/enviar-fornecedor', async (req, res, next) => {
  try {
    const rvt = await prisma.relatorioNaoConformidade.findUnique({
      where: { id: req.params.id },
      select: {
        tipoDocumento: true,
        assinaturasConcluidasEm: true,
        enviadoFornecedorEm: true,
      },
    })
    if (!rvt || rvt.tipoDocumento !== 'RVT') {
      throw new HttpError(404, 'RVT não encontrado')
    }
    if (!rvt.assinaturasConcluidasEm) {
      throw new HttpError(
        409,
        'O RVT só é enviado ao fornecedor depois de todas as assinaturas.',
      )
    }
    if (rvt.enviadoFornecedorEm) {
      throw new HttpError(409, 'O RVT já foi enviado ao fornecedor.')
    }

    const r = await enviarDocumentoAoFornecedor(prisma, req.params.id)
    if (!r.enviado) {
      throw new HttpError(400, r.motivo ?? 'Não foi possível enviar o RVT.')
    }
    const atualizado = await prisma.relatorioNaoConformidade.findUniqueOrThrow({
      where: { id: req.params.id },
      include: includeRefsRvt,
    })
    res.json({ rvt: atualizado, email: r.email })
  } catch (err) {
    next(err)
  }
})
