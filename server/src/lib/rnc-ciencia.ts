import { randomBytes } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { criarTransporteSmtp } from './smtp.js'
import { montarEmailCiencia, montarEmailRespostaCiencia } from './rnc-email.js'

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

/** Avisa a equipe interna sobre a resposta do fornecedor (best-effort). */
export async function notificarRespostaCiencia(
  prisma: PrismaClient,
  rncId: string,
  opts: { porDecurso: boolean },
): Promise<void> {
  const rnc = await prisma.relatorioNaoConformidade.findUnique({
    where: { id: rncId },
    select: {
      numero: true,
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

  const destinatarios = new Set<string>()
  if (rnc.criadoPor?.email) destinatarios.add(rnc.criadoPor.email)
  for (const a of rnc.aprovadores) if (a.email) destinatarios.add(a.email)
  if (destinatarios.size === 0) return

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
      to: [...destinatarios].join(', '),
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
