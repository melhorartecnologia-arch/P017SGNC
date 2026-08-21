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
    // Recusa: abre a segunda instância — o aprovador marcado decide entre
    // acatar a recusa ou negá-la (tornando a RNC definitiva).
    if (!aceita) {
      void solicitarAnaliseRecusa(prisma, rnc.id, baseUrlPublica(req))
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
