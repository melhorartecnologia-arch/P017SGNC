import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { HttpError } from '../middleware/error.js'
import { raqCreateSchema, raqQuerySchema, raqUpdateSchema } from '../schemas/raq.js'
import { montarMatrizAprovadores } from '../lib/rnc-aprovadores.js'
import { enviarDocumentoAoFornecedor } from '../lib/rnc-workflow.js'
import { includeRefs } from './rnc.js'

/**
 * RAQ — Relatório de Alerta de Qualidade. Compartilha a tabela e o
 * workflow de assinatura da RNC (as rotas de fotos, envio para
 * assinatura, lembrete, escalonamento e PDF de /api/rnc servem os dois
 * tipos); aqui ficam o CRUD, a numeração própria por filial e o vínculo
 * com RAQs relacionados. A matriz de aprovação usa apenas os aprovadores
 * configurados para o tipo de relatório RAQ.
 */
export const raqRouter = Router()

/** Payload do RAQ: o da RNC mais os RAQs relacionados. */
const includeRefsRaq = {
  ...includeRefs,
  raqRelacionados: {
    select: {
      id: true,
      numero: true,
      titulo: true,
      createdAt: true,
      produto: { select: { id: true, codigo: true, descricao: true } },
      lotes: { select: { numero: true }, orderBy: { createdAt: 'asc' } },
    },
  },
} as const

/** Confere que os relacionados existem e são RAQs (não RNCs). */
async function validarRelacionados(
  ids: string[] | undefined,
  proprioId?: string,
): Promise<void> {
  if (!ids || ids.length === 0) return
  if (proprioId && ids.includes(proprioId)) {
    throw new HttpError(400, 'Um RAQ não pode ser relacionado a si mesmo.')
  }
  const achados = await prisma.relatorioNaoConformidade.count({
    where: { id: { in: ids }, tipoDocumento: 'RAQ' },
  })
  if (achados !== ids.length) {
    throw new HttpError(400, 'RAQ relacionado inexistente ou de outro tipo.')
  }
}

raqRouter.get('/', async (req, res, next) => {
  try {
    const { fornecedorId, filialId, severidadeId, status, page, pageSize } =
      raqQuerySchema.parse(req.query)
    const where: Prisma.RelatorioNaoConformidadeWhereInput = {
      tipoDocumento: 'RAQ',
    }
    if (fornecedorId) where.fornecedorId = fornecedorId
    if (filialId) where.filialId = filialId
    if (severidadeId) where.severidadeId = severidadeId
    if (status) where.status = status

    const [total, items] = await Promise.all([
      prisma.relatorioNaoConformidade.count({ where }),
      prisma.relatorioNaoConformidade.findMany({
        where,
        include: includeRefsRaq,
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

raqRouter.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.relatorioNaoConformidade.findUnique({
      where: { id: req.params.id },
      include: includeRefsRaq,
    })
    if (!item || item.tipoDocumento !== 'RAQ') {
      throw new HttpError(404, 'RAQ não encontrado')
    }
    res.json(item)
  } catch (err) {
    next(err)
  }
})

raqRouter.post('/', async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Não autenticado')
    const data = raqCreateSchema.parse(req.body)
    const criadoPorId = req.user.sub

    const filial = await prisma.filial.findUnique({
      where: { id: data.filialId },
      select: { codigo: true, raqNumeroInicial: true },
    })
    if (!filial) throw new HttpError(400, 'Filial inválida')
    await validarRelacionados(data.raqRelacionadosIds)

    const ano4 = data.dataIdentificacao.getUTCFullYear()
    const mes2 = String(data.dataIdentificacao.getUTCMonth() + 1).padStart(2, '0')
    const ano2 = String(ano4).slice(-2)
    const codigoFilial = filial.codigo.trim().toUpperCase()

    const { lotes, notasFiscais, raqRelacionadosIds, ...raqData } = data
    // Prefixo "RAQ" no número: distingue a sequência do RAQ da sequência
    // da RNC na mesma filial (a coluna de número é única para os dois).
    const prefixo = 'RAQ' + codigoFilial + mes2 + ano2
    const montarNumero = (seq: number) => prefixo + String(seq).padStart(3, '0')

    const criarComNumeracao = () =>
      prisma.$transaction(async (tx) => {
        // Lock advisory por filial+tipo — evita corrida entre dois POSTs.
        await tx.$executeRawUnsafe(
          'SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',
          `raq:${data.filialId}`,
        )
        // Numeração contínua por filial, na sequência própria do RAQ.
        const agg = await tx.relatorioNaoConformidade.aggregate({
          where: { filialId: data.filialId, tipoDocumento: 'RAQ' },
          _max: { sequencialFilial: true },
          _count: { _all: true },
        })
        const usados = new Set(
          (
            await tx.relatorioNaoConformidade.findMany({
              where: { numero: { startsWith: prefixo }, tipoDocumento: 'RAQ' },
              select: { numero: true },
            })
          ).map((r) => r.numero),
        )
        let sequencial =
          Math.max(
            filial.raqNumeroInicial ?? 0,
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
            ...raqData,
            tipoDocumento: 'RAQ',
            numero,
            sequencialFilial: sequencial,
            criadoPorId,
            lotes: {
              create: lotes.map((l) => ({
                numero: l.numero,
                quantidade: l.quantidade,
              })),
            },
            notasFiscais: {
              create: notasFiscais.map((n) => ({
                numero: n.numero,
                dataFabricacao: n.dataFabricacao,
                dataValidade: n.dataValidade,
                dataRecebimento: n.dataRecebimento,
              })),
            },
            ...(raqRelacionadosIds && raqRelacionadosIds.length > 0
              ? { raqRelacionados: { connect: raqRelacionadosIds.map((id) => ({ id })) } }
              : {}),
          },
          select: { id: true },
        })
        // Matriz de aprovação: só os aprovadores configurados para o tipo
        // de relatório RAQ (sem vínculo de tipo = assina todos).
        await montarMatrizAprovadores(tx, novo.id, data.filialId, null, 'RAQ')
        return tx.relatorioNaoConformidade.findUniqueOrThrow({
          where: { id: novo.id },
          include: includeRefsRaq,
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

raqRouter.patch('/:id', async (req, res, next) => {
  try {
    const { lotes, notasFiscais, raqRelacionadosIds, ...rest } =
      raqUpdateSchema.parse(req.body)

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
    if (!atual || atual.tipoDocumento !== 'RAQ') {
      throw new HttpError(404, 'RAQ não encontrado')
    }
    // Documento encerrado é imutável: já foi assinado e comunicado.
    if (atual.status === 'CLOSED') {
      throw new HttpError(
        409,
        'O RAQ está encerrado (assinado e enviado ao fornecedor) e não pode mais ser alterado.',
      )
    }
    // O encerramento é do fluxo de assinaturas, nunca do PATCH.
    if (rest.status === 'CLOSED') {
      throw new HttpError(409, 'O RAQ é encerrado pelo fluxo de assinaturas.')
    }
    // Trocar a filial remonta a matriz do zero — proibido depois que
    // alguém já assinou, senão as assinaturas coletadas seriam apagadas.
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
    await validarRelacionados(raqRelacionadosIds, req.params.id)

    const updated = await prisma.$transaction(async (tx) => {
      if (lotes !== undefined) {
        await tx.rncLote.deleteMany({ where: { rncId: req.params.id } })
        if (lotes.length > 0) {
          await tx.rncLote.createMany({
            data: lotes.map((l) => ({
              rncId: req.params.id,
              numero: l.numero,
              quantidade: l.quantidade,
            })),
          })
        }
      }
      if (notasFiscais !== undefined) {
        await tx.rncNotaFiscal.deleteMany({ where: { rncId: req.params.id } })
        if (notasFiscais.length > 0) {
          await tx.rncNotaFiscal.createMany({
            data: notasFiscais.map((n) => ({
              rncId: req.params.id,
              numero: n.numero,
              dataFabricacao: n.dataFabricacao,
              dataValidade: n.dataValidade,
              dataRecebimento: n.dataRecebimento,
            })),
          })
        }
      }
      const salvo = await tx.relatorioNaoConformidade.update({
        where: { id: req.params.id },
        data: {
          ...rest,
          ...(raqRelacionadosIds !== undefined
            ? { raqRelacionados: { set: raqRelacionadosIds.map((id) => ({ id })) } }
            : {}),
        },
        include: includeRefsRaq,
      })
      // Filial alterada muda quem deve assinar — remonta a matriz (só
      // chega aqui sem nenhuma assinatura coletada).
      if (rest.filialId !== undefined && rest.filialId !== atual.filialId) {
        await montarMatrizAprovadores(tx, salvo.id, salvo.filialId, null, 'RAQ')
        return tx.relatorioNaoConformidade.findUniqueOrThrow({
          where: { id: salvo.id },
          include: includeRefsRaq,
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
 * Reenvio manual do RAQ assinado ao fornecedor — para quando o envio
 * automático da conclusão falhou (SMTP fora, contato sem e-mail).
 * Recusa se o RAQ ainda não está concluído ou se já foi enviado.
 */
raqRouter.post('/:id/enviar-fornecedor', async (req, res, next) => {
  try {
    const raq = await prisma.relatorioNaoConformidade.findUnique({
      where: { id: req.params.id },
      select: {
        tipoDocumento: true,
        assinaturasConcluidasEm: true,
        enviadoFornecedorEm: true,
      },
    })
    if (!raq || raq.tipoDocumento !== 'RAQ') {
      throw new HttpError(404, 'RAQ não encontrado')
    }
    if (!raq.assinaturasConcluidasEm) {
      throw new HttpError(
        409,
        'O RAQ só é enviado ao fornecedor depois de todas as assinaturas.',
      )
    }
    if (raq.enviadoFornecedorEm) {
      throw new HttpError(409, 'O RAQ já foi enviado ao fornecedor.')
    }

    const r = await enviarDocumentoAoFornecedor(prisma, req.params.id)
    if (!r.enviado) {
      throw new HttpError(400, r.motivo ?? 'Não foi possível enviar o RAQ.')
    }
    const atualizado = await prisma.relatorioNaoConformidade.findUniqueOrThrow({
      where: { id: req.params.id },
      include: includeRefsRaq,
    })
    res.json({ raq: atualizado, email: r.email })
  } catch (err) {
    next(err)
  }
})
