import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { HttpError } from '../middleware/error.js'
import {
  rheCreateSchema,
  rheHomologacaoFinalSchema,
  rheQuerySchema,
  rheUpdateSchema,
} from '../schemas/rhe.js'
import {
  montarMatrizAprovadores,
  anexarRepresentantesRhe,
} from '../lib/rnc-aprovadores.js'
import { enviarDocumentoAoFornecedor } from '../lib/rnc-workflow.js'
import { includeRefs } from './rnc.js'

/**
 * RHE — Relatório de Homologação de Embalagem. Compartilha a tabela e o
 * workflow de assinatura dos demais tipos, com uma diferença: os
 * representantes técnicos do fornecedor entram na matriz como
 * signatários avulsos — o fornecedor não tem devolução, apenas assina.
 * Concluídas todas as assinaturas, o PDF vai por e-mail ao fornecedor.
 */
export const rheRouter = Router()

/** Payload do RHE: o compartilhado mais os representantes do fornecedor. */
const includeRefsRhe = {
  ...includeRefs,
  representantes: {
    select: { id: true, ordem: true, nome: true, email: true },
    orderBy: { ordem: 'asc' },
  },
} as const

rheRouter.get('/', async (req, res, next) => {
  try {
    const { fornecedorId, filialId, status, homologacaoInicial, page, pageSize } =
      rheQuerySchema.parse(req.query)
    const where: Prisma.RelatorioNaoConformidadeWhereInput = {
      tipoDocumento: 'RHE',
    }
    if (fornecedorId) where.fornecedorId = fornecedorId
    if (filialId) where.filialId = filialId
    if (status) where.status = status
    if (homologacaoInicial) where.homologacaoInicial = homologacaoInicial

    const [total, items] = await Promise.all([
      prisma.relatorioNaoConformidade.count({ where }),
      prisma.relatorioNaoConformidade.findMany({
        where,
        include: includeRefsRhe,
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

rheRouter.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.relatorioNaoConformidade.findUnique({
      where: { id: req.params.id },
      include: includeRefsRhe,
    })
    if (!item || item.tipoDocumento !== 'RHE') {
      throw new HttpError(404, 'RHE não encontrado')
    }
    res.json(item)
  } catch (err) {
    next(err)
  }
})

rheRouter.post('/', async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Não autenticado')
    const data = rheCreateSchema.parse(req.body)
    const criadoPorId = req.user.sub

    const filial = await prisma.filial.findUnique({
      where: { id: data.filialId },
      select: { codigo: true, rheNumeroInicial: true },
    })
    if (!filial) throw new HttpError(400, 'Filial inválida')

    const ano4 = data.dataIdentificacao.getUTCFullYear()
    const mes2 = String(data.dataIdentificacao.getUTCMonth() + 1).padStart(2, '0')
    const ano2 = String(ano4).slice(-2)
    const codigoFilial = filial.codigo.trim().toUpperCase()

    const { lotes, notaFiscal, representantes, ...rheData } = data
    // Prefixo "RHE" no número: sequência própria por filial.
    const prefixo = 'RHE' + codigoFilial + mes2 + ano2
    const montarNumero = (seq: number) => prefixo + String(seq).padStart(3, '0')

    const criarComNumeracao = () =>
      prisma.$transaction(async (tx) => {
        // Lock advisory por filial+tipo — evita corrida entre dois POSTs.
        await tx.$executeRawUnsafe(
          'SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',
          `rhe:${data.filialId}`,
        )
        const agg = await tx.relatorioNaoConformidade.aggregate({
          where: { filialId: data.filialId, tipoDocumento: 'RHE' },
          _max: { sequencialFilial: true },
          _count: { _all: true },
        })
        const usados = new Set(
          (
            await tx.relatorioNaoConformidade.findMany({
              where: { numero: { startsWith: prefixo }, tipoDocumento: 'RHE' },
              select: { numero: true },
            })
          ).map((r) => r.numero),
        )
        let sequencial =
          Math.max(
            filial.rheNumeroInicial ?? 0,
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
            ...rheData,
            tipoDocumento: 'RHE',
            numero,
            sequencialFilial: sequencial,
            criadoPorId,
            ...(lotes.length > 0
              ? { lotes: { create: lotes.map((l) => ({ numero: l.numero })) } }
              : {}),
            ...(notaFiscal
              ? { notasFiscais: { create: [{ numero: notaFiscal }] } }
              : {}),
            representantes: {
              create: representantes.map((r, i) => ({
                ordem: i + 1,
                nome: r.nome,
                email: r.email,
              })),
            },
          },
          select: { id: true },
        })
        // Matriz: aprovadores internos do tipo RHE + representantes do
        // fornecedor como signatários avulsos.
        await montarMatrizAprovadores(tx, novo.id, data.filialId, null, 'RHE')
        await anexarRepresentantesRhe(tx, novo.id)
        return tx.relatorioNaoConformidade.findUniqueOrThrow({
          where: { id: novo.id },
          include: includeRefsRhe,
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

rheRouter.patch('/:id', async (req, res, next) => {
  try {
    const { lotes, notaFiscal, representantes, ...rest } =
      rheUpdateSchema.parse(req.body)

    const atual = await prisma.relatorioNaoConformidade.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        tipoDocumento: true,
        status: true,
        filialId: true,
        aprovadores: { select: { assinadoEm: true } },
        representantes: {
          select: { nome: true, email: true },
          orderBy: { ordem: 'asc' },
        },
      },
    })
    if (!atual || atual.tipoDocumento !== 'RHE') {
      throw new HttpError(404, 'RHE não encontrado')
    }
    // O front reenvia os representantes em todo save; um payload idêntico
    // aos dados atuais NÃO remonta a matriz (remontar apaga os tokens e
    // senhas já enviados por e-mail, matando os links de assinatura).
    const repsMudaram =
      representantes !== undefined &&
      (representantes.length !== atual.representantes.length ||
        representantes.some(
          (r, i) =>
            r.nome !== atual.representantes[i].nome ||
            r.email !== atual.representantes[i].email,
        ))
    // Documento encerrado é imutável (exceto a homologação final, que
    // tem rota própria).
    if (atual.status === 'CLOSED') {
      throw new HttpError(
        409,
        'O RHE está encerrado (assinado e enviado ao fornecedor) e não pode mais ser alterado. A homologação final tem registro próprio.',
      )
    }
    if (rest.status === 'CLOSED') {
      throw new HttpError(409, 'O RHE é encerrado pelo fluxo de assinaturas.')
    }
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
    // Trocar os signatários do fornecedor depois de alguém assinar
    // remontaria a matriz e apagaria assinaturas — proibido.
    if (repsMudaram && temAssinatura) {
      throw new HttpError(
        409,
        'Os representantes técnicos não podem ser alterados depois que há assinaturas coletadas.',
      )
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (lotes !== undefined) {
        await tx.rncLote.deleteMany({ where: { rncId: req.params.id } })
        if (lotes.length > 0) {
          await tx.rncLote.createMany({
            data: lotes.map((l) => ({ rncId: req.params.id, numero: l.numero })),
          })
        }
      }
      if (notaFiscal !== undefined) {
        await tx.rncNotaFiscal.deleteMany({ where: { rncId: req.params.id } })
        if (notaFiscal) {
          await tx.rncNotaFiscal.createMany({
            data: [{ rncId: req.params.id, numero: notaFiscal }],
          })
        }
      }
      if (repsMudaram && representantes !== undefined) {
        await tx.rheRepresentante.deleteMany({ where: { rncId: req.params.id } })
        await tx.rheRepresentante.createMany({
          data: representantes.map((r, i) => ({
            rncId: req.params.id,
            ordem: i + 1,
            nome: r.nome,
            email: r.email,
          })),
        })
      }
      const salvo = await tx.relatorioNaoConformidade.update({
        where: { id: req.params.id },
        data: rest,
        include: includeRefsRhe,
      })
      // Filial ou representantes REALMENTE alterados mudam quem assina —
      // remonta a matriz. A guarda de temAssinatura foi lida fora desta
      // transação; a revalidação final (assinatura em corrida) fica em
      // montarMatrizAprovadores, que aborta se houver linha assinada.
      if (
        (rest.filialId !== undefined && rest.filialId !== atual.filialId) ||
        repsMudaram
      ) {
        await montarMatrizAprovadores(tx, salvo.id, salvo.filialId, null, 'RHE')
        await anexarRepresentantesRhe(tx, salvo.id)
        return tx.relatorioNaoConformidade.findUniqueOrThrow({
          where: { id: salvo.id },
          include: includeRefsRhe,
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
 * Registra a homologação FINAL — decisão que costuma vir depois do
 * período de acompanhamento, com o RHE já encerrado. Uma única vez.
 */
rheRouter.post('/:id/homologacao-final', async (req, res, next) => {
  try {
    const { resultado, data } = rheHomologacaoFinalSchema.parse(req.body)
    const rhe = await prisma.relatorioNaoConformidade.findUnique({
      where: { id: req.params.id },
      select: {
        tipoDocumento: true,
        homologacaoFinal: true,
        homologacaoInicialData: true,
        assinaturasConcluidasEm: true,
      },
    })
    if (!rhe || rhe.tipoDocumento !== 'RHE') {
      throw new HttpError(404, 'RHE não encontrado')
    }
    if (rhe.homologacaoFinal) {
      throw new HttpError(409, 'A homologação final já foi registrada.')
    }
    // Decisão definitiva e irreversível: só depois do documento assinado
    // (o formulário deixa o campo em aberto até o fim do acompanhamento).
    if (!rhe.assinaturasConcluidasEm) {
      throw new HttpError(
        409,
        'A homologação final só pode ser registrada depois de concluídas as assinaturas do RHE.',
      )
    }
    if (
      rhe.homologacaoInicialData &&
      data.getTime() < rhe.homologacaoInicialData.getTime()
    ) {
      throw new HttpError(
        400,
        'A data da homologação final não pode ser anterior à da homologação inicial.',
      )
    }
    // Condicionado a ainda não existir: evita duas decisões em corrida.
    const r = await prisma.relatorioNaoConformidade.updateMany({
      where: { id: req.params.id, homologacaoFinal: null },
      data: { homologacaoFinal: resultado, homologacaoFinalData: data },
    })
    if (r.count === 0) {
      throw new HttpError(409, 'A homologação final já foi registrada.')
    }
    const atualizado = await prisma.relatorioNaoConformidade.findUniqueOrThrow({
      where: { id: req.params.id },
      include: includeRefsRhe,
    })
    res.json(atualizado)
  } catch (err) {
    next(err)
  }
})

/**
 * Reenvio manual do RHE assinado ao fornecedor — para quando o envio
 * automático da conclusão falhou.
 */
rheRouter.post('/:id/enviar-fornecedor', async (req, res, next) => {
  try {
    const rhe = await prisma.relatorioNaoConformidade.findUnique({
      where: { id: req.params.id },
      select: {
        tipoDocumento: true,
        assinaturasConcluidasEm: true,
        enviadoFornecedorEm: true,
      },
    })
    if (!rhe || rhe.tipoDocumento !== 'RHE') {
      throw new HttpError(404, 'RHE não encontrado')
    }
    if (!rhe.assinaturasConcluidasEm) {
      throw new HttpError(
        409,
        'O RHE só é enviado ao fornecedor depois de todas as assinaturas.',
      )
    }
    if (rhe.enviadoFornecedorEm) {
      throw new HttpError(409, 'O RHE já foi enviado ao fornecedor.')
    }

    const r = await enviarDocumentoAoFornecedor(prisma, req.params.id)
    if (!r.enviado) {
      throw new HttpError(400, r.motivo ?? 'Não foi possível enviar o RHE.')
    }
    const atualizado = await prisma.relatorioNaoConformidade.findUniqueOrThrow({
      where: { id: req.params.id },
      include: includeRefsRhe,
    })
    res.json({ rhe: atualizado, email: r.email })
  } catch (err) {
    next(err)
  }
})
