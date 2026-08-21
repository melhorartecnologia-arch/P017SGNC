import { randomBytes } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { criarTransporteSmtp } from './smtp.js'
import {
  montarEmailCiencia,
  montarEmailRespostaCiencia,
  montarEmailAnaliseRecusa,
  montarEmailCienciaDefinitiva,
} from './rnc-email.js'

/**
 * Ciência do fornecedor.
 *
 * Quando todas as assinaturas internas de uma RNC são concluídas, o
 * documento é enviado ao contato do fornecedor, que pode aceitar (reconhecer)
 * ou recusar/questionar a não conformidade. Sem manifestação dentro do prazo,
 * o aceite é registrado automaticamente por decurso de prazo.
 */

/** Prazo (horas) para o fornecedor responder antes do aceite automático. */
export const PRAZO_CIENCIA_HORAS = 48

/** Seleciona o e-mail do fornecedor: o principal tem precedência. */
export function escolherEmailFornecedor(
  contatos: { tipo: string; valor: string; nome: string | null; principal: boolean }[],
): { email: string; nome: string | null } | null {
  const emails = contatos.filter(
    (c) => c.tipo === 'EMAIL' && c.valor.trim() !== '',
  )
  if (emails.length === 0) return null
  const escolhido = emails.find((c) => c.principal) ?? emails[0]
  return { email: escolhido.valor.trim(), nome: escolhido.nome }
}

const rncCienciaSelect = {
  id: true,
  numero: true,
  dataIdentificacao: true,
  descricaoDefeito: true,
  quantidadeDefeito: true,
  cienciaStatus: true,
  cienciaToken: true,
  cienciaEnviadaEm: true,
  cienciaPrazoEm: true,
  filial: { select: { nome: true } },
  fornecedor: {
    select: {
      razaoSocial: true,
      contatos: {
        select: { tipo: true, valor: true, nome: true, principal: true },
      },
    },
  },
  tipoNaoConformidade: { select: { codigo: true, descricao: true } },
  severidade: { select: { nivel: true, nome: true } },
  criadoPor: { select: { email: true } },
  aprovadores: { select: { email: true } },
} as const

export type ResultadoCiencia = {
  enviado: boolean
  motivo?: string
  email?: string
}

/**
 * Envia a RNC concluída ao contato do fornecedor e abre o prazo de ciência.
 * Idempotente: não reenvia se a ciência já foi iniciada.
 */
export async function enviarCienciaFornecedor(
  prisma: PrismaClient,
  rncId: string,
  baseUrl?: string,
): Promise<ResultadoCiencia> {
  const rnc = await prisma.relatorioNaoConformidade.findUnique({
    where: { id: rncId },
    select: rncCienciaSelect,
  })
  if (!rnc) return { enviado: false, motivo: 'RNC não encontrada' }
  if (rnc.cienciaStatus) {
    return { enviado: false, motivo: 'Ciência do fornecedor já iniciada' }
  }

  const contato = escolherEmailFornecedor(rnc.fornecedor?.contatos ?? [])
  if (!contato) {
    return {
      enviado: false,
      motivo:
        'Fornecedor sem contato de e-mail cadastrado — a ciência não pôde ser enviada.',
    }
  }

  const transporte = await criarTransporteSmtp()
  if (!transporte) {
    return { enviado: false, motivo: 'SMTP não configurado' }
  }

  const token = randomBytes(24).toString('hex')
  const prazoEm = new Date(Date.now() + PRAZO_CIENCIA_HORAS * 3600_000)

  const { subject, text, html } = montarEmailCiencia({
    numero: rnc.numero,
    filialNome: rnc.filial?.nome ?? '',
    fornecedorNome: rnc.fornecedor?.razaoSocial ?? '',
    contatoNome: contato.nome,
    tipoNc: rnc.tipoNaoConformidade
      ? `${rnc.tipoNaoConformidade.codigo} — ${rnc.tipoNaoConformidade.descricao}`
      : '',
    severidade: rnc.severidade
      ? `Nível ${rnc.severidade.nivel} — ${rnc.severidade.nome}`
      : null,
    dataIdentificacao: rnc.dataIdentificacao,
    descricaoDefeito: rnc.descricaoDefeito,
    quantidadeDefeito: rnc.quantidadeDefeito,
    token,
    prazoEm,
    baseUrl,
  })

  try {
    await transporte.transporter.sendMail({
      from: transporte.remetente,
      to: contato.email,
      subject,
      text,
      html,
    })
  } catch (err) {
    return {
      enviado: false,
      motivo: err instanceof Error ? err.message : 'Falha no envio do e-mail',
    }
  }

  // Só abre o prazo depois do envio bem-sucedido: sem e-mail entregue não
  // faz sentido contar o decurso contra o fornecedor.
  await prisma.relatorioNaoConformidade.update({
    where: { id: rnc.id },
    data: {
      cienciaStatus: 'PENDENTE',
      cienciaToken: token,
      cienciaEmail: contato.email,
      cienciaEnviadaEm: new Date(),
      cienciaPrazoEm: prazoEm,
    },
  })

  return { enviado: true, email: contato.email }
}

/**
 * Destinatários da resposta do fornecedor: os aprovadores da filial
 * marcados no cadastro como receptores desse fluxo. Sem nenhum marcado,
 * cai no emitente + aprovadores da matriz para a resposta não se perder.
 */
export async function destinatariosRespostaFornecedor(
  prisma: PrismaClient,
  rnc: {
    filialId: string
    criadoPor?: { email: string | null } | null
    aprovadores: { email: string | null }[]
  },
): Promise<string[]> {
  const marcados = await prisma.aprovador.findMany({
    where: {
      filialId: rnc.filialId,
      ativo: true,
      recebeRespostaFornecedor: true,
    },
    select: { email: true },
  })
  const emails = new Set<string>()
  for (const m of marcados) if (m.email) emails.add(m.email)
  if (emails.size > 0) return [...emails]

  // Nenhum aprovador marcado: fallback para não perder a resposta.
  if (rnc.criadoPor?.email) emails.add(rnc.criadoPor.email)
  for (const a of rnc.aprovadores) if (a.email) emails.add(a.email)
  return [...emails]
}

/** Avisa os aprovadores marcados sobre a resposta do fornecedor. */
export async function notificarRespostaCiencia(
  prisma: PrismaClient,
  rncId: string,
  opts: { porDecurso: boolean },
): Promise<void> {
  const rnc = await prisma.relatorioNaoConformidade.findUnique({
    where: { id: rncId },
    select: {
      numero: true,
      filialId: true,
      cienciaStatus: true,
      cienciaRespondidaEm: true,
      cienciaRespondidaPor: true,
      cienciaJustificativa: true,
      fornecedor: { select: { razaoSocial: true } },
      criadoPor: { select: { email: true } },
      aprovadores: { select: { email: true } },
    },
  })
  if (!rnc) return

  const transporte = await criarTransporteSmtp()
  if (!transporte) return

  const destinatarios = await destinatariosRespostaFornecedor(prisma, rnc)
  if (destinatarios.length === 0) return

  const { subject, text, html } = montarEmailRespostaCiencia({
    numero: rnc.numero,
    fornecedorNome: rnc.fornecedor?.razaoSocial ?? '',
    aceita: rnc.cienciaStatus !== 'RECUSADA',
    porDecurso: opts.porDecurso,
    respondidaPor: rnc.cienciaRespondidaPor,
    respondidaEm: rnc.cienciaRespondidaEm ?? new Date(),
    justificativa: rnc.cienciaJustificativa,
  })

  try {
    await transporte.transporter.sendMail({
      from: transporte.remetente,
      to: destinatarios.join(', '),
      subject,
      text,
      html,
    })
  } catch {
    // best-effort: a resposta já está registrada
  }
}

/**
 * Aceite automático por decurso de prazo: RNCs com ciência pendente cujo
 * prazo expirou passam a ACEITA_POR_DECURSO. Roda no agendador.
 */
export async function processarCienciaFornecedor(
  prisma: PrismaClient,
): Promise<{ aceitesAutomaticos: number }> {
  const vencidas = await prisma.relatorioNaoConformidade.findMany({
    where: {
      cienciaStatus: 'PENDENTE',
      cienciaPrazoEm: { lte: new Date() },
    },
    select: { id: true },
  })

  let aceitesAutomaticos = 0
  for (const { id } of vencidas) {
    // Condição no update evita corrida com uma resposta que chegue agora.
    const r = await prisma.relatorioNaoConformidade.updateMany({
      where: { id, cienciaStatus: 'PENDENTE' },
      data: {
        cienciaStatus: 'ACEITA_POR_DECURSO',
        cienciaRespondidaEm: new Date(),
      },
    })
    if (r.count === 0) continue
    aceitesAutomaticos++
    await notificarRespostaCiencia(prisma, id, { porDecurso: true })
  }
  return { aceitesAutomaticos }
}

// ── Análise da recusa (segunda instância) ───────────────────────────

/**
 * Após a recusa do fornecedor, o aprovador marcado analisa: acata a recusa
 * (encerra a favor do fornecedor) ou a nega — e nesse caso a RNC é enviada
 * em definitivo ao fornecedor, sem possibilidade de nova recusa.
 * O fornecedor pode recusar uma única vez.
 */
export async function registrarAnaliseRecusa(
  prisma: PrismaClient,
  rncId: string,
  opts: {
    acatarRecusa: boolean
    analisadoPor?: string | null
    justificativa?: string | null
    baseUrl?: string
  },
): Promise<{ status: 'RECUSA_ACEITA' | 'MANTIDA_DEFINITIVA' }> {
  const rnc = await prisma.relatorioNaoConformidade.findUnique({
    where: { id: rncId },
    select: {
      id: true,
      numero: true,
      cienciaStatus: true,
      cienciaToken: true,
      fornecedor: {
        select: {
          razaoSocial: true,
          contatos: {
            select: { tipo: true, valor: true, nome: true, principal: true },
          },
        },
      },
    },
  })
  if (!rnc) throw new Error('RNC não encontrada')
  if (rnc.cienciaStatus !== 'RECUSADA') {
    throw new Error(
      'A análise só é possível quando o fornecedor recusou a não conformidade.',
    )
  }

  const novoStatus = opts.acatarRecusa ? 'RECUSA_ACEITA' : 'MANTIDA_DEFINITIVA'
  const agora = new Date()

  // Condicionado ao status atual: evita duas análises simultâneas.
  const r = await prisma.relatorioNaoConformidade.updateMany({
    where: { id: rnc.id, cienciaStatus: 'RECUSADA' },
    data: {
      cienciaStatus: novoStatus,
      cienciaAnaliseEm: agora,
      cienciaAnalisePor: opts.analisadoPor?.trim() || null,
      cienciaAnaliseJustificativa: opts.justificativa?.trim() || null,
      ...(opts.acatarRecusa ? {} : { cienciaDefinitivaEm: agora }),
    },
  })
  if (r.count === 0) {
    throw new Error('Esta recusa já foi analisada.')
  }

  // Recusa negada: comunica o fornecedor em definitivo.
  if (!opts.acatarRecusa) {
    const contato = escolherEmailFornecedor(rnc.fornecedor?.contatos ?? [])
    const transporte = await criarTransporteSmtp()
    if (contato && transporte && rnc.cienciaToken) {
      const { subject, text, html } = montarEmailCienciaDefinitiva({
        numero: rnc.numero,
        fornecedorNome: rnc.fornecedor?.razaoSocial ?? '',
        contatoNome: contato.nome,
        justificativaAnalise: opts.justificativa?.trim() || null,
        token: rnc.cienciaToken,
        baseUrl: opts.baseUrl,
      })
      try {
        await transporte.transporter.sendMail({
          from: transporte.remetente,
          to: contato.email,
          subject,
          text,
          html,
        })
      } catch {
        // best-effort: a decisão já está registrada
      }
    }
  }

  return { status: novoStatus }
}

/**
 * Envia ao(s) aprovador(es) marcado(s) o pedido de análise da recusa,
 * com o link onde decidem entre acatar ou negar.
 */
export async function solicitarAnaliseRecusa(
  prisma: PrismaClient,
  rncId: string,
  baseUrl?: string,
): Promise<void> {
  const rnc = await prisma.relatorioNaoConformidade.findUnique({
    where: { id: rncId },
    select: {
      id: true,
      numero: true,
      filialId: true,
      cienciaStatus: true,
      cienciaAnaliseToken: true,
      cienciaRespondidaEm: true,
      cienciaRespondidaPor: true,
      cienciaJustificativa: true,
      fornecedor: { select: { razaoSocial: true } },
      criadoPor: { select: { email: true } },
      aprovadores: { select: { email: true } },
    },
  })
  if (!rnc || rnc.cienciaStatus !== 'RECUSADA') return

  const transporte = await criarTransporteSmtp()
  if (!transporte) return

  const destinatarios = await destinatariosRespostaFornecedor(prisma, rnc)
  if (destinatarios.length === 0) return

  let token = rnc.cienciaAnaliseToken
  if (!token) {
    token = randomBytes(24).toString('hex')
    await prisma.relatorioNaoConformidade.update({
      where: { id: rnc.id },
      data: { cienciaAnaliseToken: token },
    })
  }

  const { subject, text, html } = montarEmailAnaliseRecusa({
    numero: rnc.numero,
    fornecedorNome: rnc.fornecedor?.razaoSocial ?? '',
    respondidaPor: rnc.cienciaRespondidaPor,
    respondidaEm: rnc.cienciaRespondidaEm ?? new Date(),
    justificativa: rnc.cienciaJustificativa,
    token,
    baseUrl,
  })

  try {
    await transporte.transporter.sendMail({
      from: transporte.remetente,
      to: destinatarios.join(', '),
      subject,
      text,
      html,
    })
  } catch {
    // best-effort
  }
}
