import { Router } from 'express'
import { z } from 'zod'
import { UAParser } from 'ua-parser-js'
import { prisma } from '../db.js'
import { HttpError } from '../middleware/error.js'
import { streamRncPdf } from '../lib/rnc-pdf-loader.js'
import {
  notificarRespostaCiencia,
  solicitarAnaliseRecusa,
  registrarAnaliseRecusa,
  solicitarAcoesContingencia,
  registrarAcoesContingencia,
  salvarCausaRaiz,
  ISHIKAWA_CATEGORIAS,
} from '../lib/rnc-ciencia.js'

/**
 * Acesso público (link por token) para o contato do fornecedor registrar a
 * ciência de uma RNC já assinada internamente: aceitar (reconhecer) ou
 * recusar/questionar, com justificativa.
 */
export const cienciaRouter = Router()

const responderSchema = z
  .object({
    aceita: z.boolean({ required_error: 'Informe o aceite ou a recusa.' }),
    nome: z.string().trim().max(160).optional().nullable(),
    justificativa: z.string().trim().max(4000).optional().nullable(),
  })
  .superRefine((d, ctx) => {
    // Recusar exige justificativa: é o questionamento do fornecedor.
    if (!d.aceita && !d.justificativa) {
      ctx.addIssue({
        code: 'custom',
        path: ['justificativa'],
        message: 'Informe o motivo da recusa ou o questionamento.',
      })
    }
  })

/** URL pública do app a partir da requisição (respeitando o proxy/nginx). */
function baseUrlPublica(req: {
  headers: Record<string, unknown>
  protocol?: string
  get?: (h: string) => string | undefined
}): string {
  const fwdProto = (req.headers['x-forwarded-proto'] as string | undefined)
    ?.split(',')[0]
    ?.trim()
  const fwdHost = (req.headers['x-forwarded-host'] as string | undefined)
    ?.split(',')[0]
    ?.trim()
  const proto = fwdProto || req.protocol || 'https'
  const host = fwdHost || req.get?.('host') || ''
  return host ? `${proto}://${host}` : ''
}

function ipDaRequisicao(req: { headers: Record<string, unknown>; ip?: string }): string {
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim()
  return req.ip ?? ''
}

async function carregarPorToken(token: string) {
  const rnc = await prisma.relatorioNaoConformidade.findUnique({
    where: { cienciaToken: token },
    select: {
      id: true,
      numero: true,
      dataIdentificacao: true,
      descricaoDefeito: true,
      quantidadeDefeito: true,
      cienciaStatus: true,
      cienciaPrazoEm: true,
      cienciaRespondidaEm: true,
      cienciaRespondidaPor: true,
      cienciaJustificativa: true,
      cienciaAnaliseEm: true,
      cienciaAnaliseJustificativa: true,
      contingenciaStatus: true,
      contingenciaPrazoEm: true,
      contingenciaSolicitadaEm: true,
      contingenciaRespondidaEm: true,
      contingenciaRespondidaPor: true,
      contingenciaAnalisadaEm: true,
      acoesContingencia: {
        select: {
          id: true,
          ordem: true,
          descricao: true,
          responsavel: true,
          prazo: true,
          status: true,
          analisadaEm: true,
          parecer: true,
        },
        orderBy: { ordem: 'asc' },
      },
      causaRaizStatus: true,
      causaRaizSolicitadaEm: true,
      causaRaizEnviadaEm: true,
      causaRaizEnviadaPor: true,
      causaRaizAnalisadaEm: true,
      causaRaizParecer: true,
      causaOQue: true,
      causaPorQue: true,
      causaOnde: true,
      causaQuando: true,
      causaQuem: true,
      causaComo: true,
      causaQuantoCusta: true,
      causasIshikawa: {
        orderBy: [{ categoria: 'asc' }, { ordem: 'asc' }],
        select: { id: true, categoria: true, ordem: true, descricao: true },
      },
      eficaciaStatus: true,
      eficaciaVerificadaEm: true,
      eficaciaParecer: true,
      filial: { select: { codigo: true, nome: true } },
      fornecedor: { select: { razaoSocial: true, cnpj: true } },
      tipoNaoConformidade: { select: { codigo: true, descricao: true } },
      produto: { select: { codigo: true, descricao: true, unidadeMedida: true } },
      severidade: { select: { nivel: true, nome: true } },
      disposicaoMaterial: { select: { descricao: true } },
      origem: { select: { nome: true } },
      lotes: { select: { numero: true, quantidade: true } },
    },
  })
  if (!rnc) throw new HttpError(404, 'Link de ciência inválido ou expirado.')
  return rnc
}

// Dados da RNC para a página pública do fornecedor.
cienciaRouter.get('/:token', async (req, res, next) => {
  try {
    res.json(await carregarPorToken(req.params.token))
  } catch (err) {
    next(err)
  }
})

// PDF da RNC associada ao token (visualizar ou baixar).
cienciaRouter.get('/:token/pdf', async (req, res, next) => {
  try {
    const rnc = await prisma.relatorioNaoConformidade.findUnique({
      where: { cienciaToken: req.params.token },
      select: { id: true },
    })
    if (!rnc) throw new HttpError(404, 'Link de ciência inválido ou expirado.')
    const disposition = req.query.inline === '1' ? 'inline' : 'attachment'
    const ok = await streamRncPdf(rnc.id, res, disposition)
    if (!ok) throw new HttpError(404, 'Relatório não encontrado')
  } catch (err) {
    next(err)
  }
})

// Registra o aceite ou a recusa do fornecedor.
cienciaRouter.post('/:token/responder', async (req, res, next) => {
  try {
    const { aceita, nome, justificativa } = responderSchema.parse(req.body)

    const rnc = await prisma.relatorioNaoConformidade.findUnique({
      where: { cienciaToken: req.params.token },
      select: { id: true, cienciaStatus: true, cienciaPrazoEm: true },
    })
    if (!rnc) throw new HttpError(404, 'Link de ciência inválido ou expirado.')
    if (rnc.cienciaStatus !== 'PENDENTE') {
      throw new HttpError(
        409,
        'Esta não conformidade já teve a ciência registrada.',
      )
    }

    const ua = req.headers['user-agent'] ?? ''
    const r = UAParser(ua)
    const navegador = [r.browser.name, r.browser.version]
      .filter(Boolean)
      .join(' ')

    // updateMany com a condição de status evita duas respostas simultâneas
    // (ou uma corrida com o aceite automático do agendador).
    const atualizado = await prisma.relatorioNaoConformidade.updateMany({
      where: { id: rnc.id, cienciaStatus: 'PENDENTE' },
      data: {
        cienciaStatus: aceita ? 'ACEITA' : 'RECUSADA',
        cienciaRespondidaEm: new Date(),
        cienciaRespondidaPor: nome?.trim() || null,
        cienciaJustificativa: justificativa?.trim() || null,
        cienciaIp: ipDaRequisicao(req).slice(0, 64) || null,
        cienciaNavegador: navegador.slice(0, 160) || null,
      },
    })
    if (atualizado.count === 0) {
      throw new HttpError(
        409,
        'Esta não conformidade já teve a ciência registrada.',
      )
    }

    // Avisa os aprovadores marcados (não bloqueia a resposta do fornecedor).
    void notificarRespostaCiencia(prisma, rnc.id, { porDecurso: false })
    if (aceita) {
      // Não conformidade confirmada: pede as ações de contingência e abre
      // o prazo parametrizado para a devolutiva.
      await solicitarAcoesContingencia(prisma, rnc.id, baseUrlPublica(req))
    } else {
      // Recusa: abre a segunda instância — o aprovador marcado decide entre
      // acatar a recusa ou negá-la (tornando a RNC definitiva).
      void solicitarAnaliseRecusa(prisma, rnc.id, baseUrlPublica(req))
    }

    res.json(await carregarPorToken(req.params.token))
  } catch (err) {
    next(err)
  }
})

// ── Ações de contingência do fornecedor ─────────────────────────────

const contingenciaSchema = z.object({
  acoes: z
    .array(
      z.object({
        descricao: z
          .string({ required_error: 'Descreva a ação de contingência.' })
          .trim()
          .min(1, 'Descreva a ação de contingência.')
          .max(2000),
        responsavel: z.string().trim().max(160).optional().nullable(),
        prazo: z
          .union([z.coerce.date({ invalid_type_error: 'Prazo inválido' }), z.literal('')])
          .optional()
          .nullable()
          .transform((v) => (v === '' || v === undefined ? null : v)),
      }),
    )
    .min(1, 'Informe ao menos uma ação de contingência.')
    .max(50, 'Máximo de 50 ações por plano'),
  nome: z.string().trim().max(160).optional().nullable(),
})

// Registra o plano de ações de contingência informado pelo fornecedor.
cienciaRouter.post('/:token/contingencia', async (req, res, next) => {
  try {
    const { acoes, nome } = contingenciaSchema.parse(req.body)

    const rnc = await prisma.relatorioNaoConformidade.findUnique({
      where: { cienciaToken: req.params.token },
      select: { id: true, contingenciaStatus: true },
    })
    if (!rnc) throw new HttpError(404, 'Link de ciência inválido ou expirado.')
    // Só cabe enviar quando o plano ainda é devido: nunca enviado, ou
    // devolvido pelo aprovador para correção.
    if (
      rnc.contingenciaStatus !== 'PENDENTE' &&
      rnc.contingenciaStatus !== 'AJUSTE_SOLICITADO'
    ) {
      throw new HttpError(
        409,
        rnc.contingenciaStatus === 'EM_ANALISE'
          ? 'O plano de ações já foi enviado e está em análise.'
          : rnc.contingenciaStatus === 'APROVADA'
            ? 'O plano de ações já foi aprovado.'
            : 'Ainda não há ações de contingência a informar para esta RNC.',
      )
    }

    const ua = req.headers['user-agent'] ?? ''
    const r = UAParser(ua)
    const navegador = [r.browser.name, r.browser.version]
      .filter(Boolean)
      .join(' ')

    try {
      await registrarAcoesContingencia(prisma, rnc.id, {
        acoes,
        respondidoPor: nome,
        ip: ipDaRequisicao(req),
        navegador,
        baseUrl: baseUrlPublica(req),
      })
    } catch (err) {
      throw new HttpError(
        409,
        err instanceof Error ? err.message : 'Não foi possível registrar.',
      )
    }

    res.json(await carregarPorToken(req.params.token))
  } catch (err) {
    next(err)
  }
})

// ── Análise de causa: Ishikawa + 5W2H ───────────────────────────────

const causaRaizSchema = z.object({
  causas: z
    .array(
      z.object({
        categoria: z.enum(ISHIKAWA_CATEGORIAS, {
          errorMap: () => ({ message: 'Categoria do Ishikawa inválida.' }),
        }),
        descricao: z.string().trim().max(2000),
      }),
    )
    .max(60, 'Máximo de 60 causas no diagrama')
    .default([]),
  oQue: z.string().trim().max(4000).optional().nullable(),
  porQue: z.string().trim().max(4000).optional().nullable(),
  onde: z.string().trim().max(4000).optional().nullable(),
  quando: z.string().trim().max(4000).optional().nullable(),
  quem: z.string().trim().max(4000).optional().nullable(),
  como: z.string().trim().max(4000).optional().nullable(),
  quantoCusta: z.string().trim().max(4000).optional().nullable(),
  /** false grava rascunho; true valida a completude e manda para aprovação. */
  enviar: z.boolean().default(false),
  nome: z.string().trim().max(160).optional().nullable(),
})

// Salva (rascunho) ou envia a análise de causa preenchida pelo fornecedor.
cienciaRouter.put('/:token/causa-raiz', async (req, res, next) => {
  try {
    const dados = causaRaizSchema.parse(req.body)

    const rnc = await prisma.relatorioNaoConformidade.findUnique({
      where: { cienciaToken: req.params.token },
      select: { id: true, causaRaizStatus: true },
    })
    if (!rnc) throw new HttpError(404, 'Link de ciência inválido ou expirado.')
    if (
      rnc.causaRaizStatus !== 'PENDENTE' &&
      rnc.causaRaizStatus !== 'AJUSTE_SOLICITADO'
    ) {
      throw new HttpError(
        409,
        rnc.causaRaizStatus === 'EM_ANALISE'
          ? 'A análise de causa já foi enviada e está aguardando aprovação.'
          : rnc.causaRaizStatus === 'APROVADA'
            ? 'A análise de causa já foi aprovada.'
            : 'A análise de causa ainda não foi aberta para esta RNC.',
      )
    }

    const ua = req.headers['user-agent'] ?? ''
    const r = UAParser(ua)
    const navegador = [r.browser.name, r.browser.version]
      .filter(Boolean)
      .join(' ')

    try {
      await salvarCausaRaiz(prisma, rnc.id, {
        causas: dados.causas,
        cinco2h: dados,
        enviar: dados.enviar,
        respondidoPor: dados.nome,
        ip: ipDaRequisicao(req),
        navegador,
        baseUrl: baseUrlPublica(req),
      })
    } catch (err) {
      throw new HttpError(
        409,
        err instanceof Error ? err.message : 'Não foi possível registrar.',
      )
    }

    res.json(await carregarPorToken(req.params.token))
  } catch (err) {
    next(err)
  }
})

// ── Análise da recusa pelo aprovador marcado ────────────────────────

const analiseSchema = z
  .object({
    acatarRecusa: z.boolean({
      required_error: 'Informe se a recusa é acatada ou negada.',
    }),
    nome: z.string().trim().max(160).optional().nullable(),
    justificativa: z.string().trim().max(4000).optional().nullable(),
  })
  .superRefine((d, ctx) => {
    // Negar a recusa torna a RNC definitiva: exige parecer.
    if (!d.acatarRecusa && !d.justificativa) {
      ctx.addIssue({
        code: 'custom',
        path: ['justificativa'],
        message: 'Informe o parecer que fundamenta a negativa da recusa.',
      })
    }
  })

async function carregarAnalisePorToken(token: string) {
  const rnc = await prisma.relatorioNaoConformidade.findUnique({
    where: { cienciaAnaliseToken: token },
    select: {
      id: true,
      numero: true,
      dataIdentificacao: true,
      descricaoDefeito: true,
      cienciaStatus: true,
      cienciaRespondidaEm: true,
      cienciaRespondidaPor: true,
      cienciaJustificativa: true,
      cienciaAnaliseEm: true,
      cienciaAnalisePor: true,
      cienciaAnaliseJustificativa: true,
      filial: { select: { codigo: true, nome: true } },
      fornecedor: { select: { razaoSocial: true, cnpj: true } },
      tipoNaoConformidade: { select: { codigo: true, descricao: true } },
      severidade: { select: { nivel: true, nome: true } },
    },
  })
  if (!rnc) throw new HttpError(404, 'Link de análise inválido ou expirado.')
  return rnc
}

// Dados da recusa para a página de análise do aprovador.
cienciaRouter.get('/analise/:token', async (req, res, next) => {
  try {
    res.json(await carregarAnalisePorToken(req.params.token))
  } catch (err) {
    next(err)
  }
})

// PDF da RNC pelo token de análise.
cienciaRouter.get('/analise/:token/pdf', async (req, res, next) => {
  try {
    const rnc = await prisma.relatorioNaoConformidade.findUnique({
      where: { cienciaAnaliseToken: req.params.token },
      select: { id: true },
    })
    if (!rnc) throw new HttpError(404, 'Link de análise inválido ou expirado.')
    const disposition = req.query.inline === '1' ? 'inline' : 'attachment'
    const ok = await streamRncPdf(rnc.id, res, disposition)
    if (!ok) throw new HttpError(404, 'Relatório não encontrado')
  } catch (err) {
    next(err)
  }
})

// Registra a análise: acatar a recusa ou negá-la (RNC definitiva).
cienciaRouter.post('/analise/:token/decidir', async (req, res, next) => {
  try {
    const { acatarRecusa, nome, justificativa } = analiseSchema.parse(req.body)
    const rnc = await prisma.relatorioNaoConformidade.findUnique({
      where: { cienciaAnaliseToken: req.params.token },
      select: { id: true, cienciaStatus: true },
    })
    if (!rnc) throw new HttpError(404, 'Link de análise inválido ou expirado.')
    if (rnc.cienciaStatus !== 'RECUSADA') {
      throw new HttpError(409, 'Esta recusa já foi analisada.')
    }
    try {
      await registrarAnaliseRecusa(prisma, rnc.id, {
        acatarRecusa,
        analisadoPor: nome,
        justificativa,
        baseUrl: baseUrlPublica(req),
      })
    } catch (err) {
      throw new HttpError(
        409,
        err instanceof Error ? err.message : 'Não foi possível registrar.',
      )
    }
    res.json(await carregarAnalisePorToken(req.params.token))
  } catch (err) {
    next(err)
  }
})
