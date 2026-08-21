import { randomBytes } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { criarTransporteSmtp } from './smtp.js'
import {
  montarEmailCiencia,
  montarEmailRespostaCiencia,
  montarEmailAnaliseRecusa,
  montarEmailCienciaDefinitiva,
  montarEmailContingencia,
  montarEmailAlertaContingencia,
  montarEmailContingenciaRecebida,
} from './rnc-email.js'
import {
  intervaloEntreAlertasMs,
  obterParametrosWorkflow,
} from './workflow-config.js'

/**
 * Ciência do fornecedor.
 *
 * Quando todas as assinaturas internas de uma RNC são concluídas, o
 * documento é enviado ao contato do fornecedor, que pode aceitar (reconhecer)
 * ou recusar/questionar a não conformidade. Sem manifestação dentro do prazo,
 * o aceite é registrado automaticamente por decurso de prazo.
 */

/**
 * Prazo (horas) para o fornecedor responder antes do aceite automático.
 * Padrão de fábrica — o valor em uso vem dos parâmetros do workflow.
 */
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

  const parametros = await obterParametrosWorkflow(prisma)
  const token = randomBytes(24).toString('hex')
  const prazoEm = new Date(
    Date.now() + parametros.cienciaPrazoHoras * 3600_000,
  )

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
  baseUrl?: string,
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
    // Confirmada a não conformidade, abre o prazo das ações de contingência.
    await solicitarAcoesContingencia(prisma, id, baseUrl)
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

    // RNC mantida em definitivo: o fornecedor precisa devolver as ações
    // de contingência dentro do prazo parametrizado.
    await solicitarAcoesContingencia(prisma, rnc.id, opts.baseUrl)
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

// ── Ações de contingência do fornecedor ─────────────────────────────

/**
 * Situações em que a não conformidade está confirmada e o fornecedor
 * precisa devolver o plano de ações de contingência. RECUSA_ACEITA fica
 * de fora: nesse caso a recusa foi acatada e não há o que executar.
 */
const CONFIRMACAO_LABEL: Record<string, string> = {
  ACEITA: 'aceite do fornecedor',
  ACEITA_POR_DECURSO: 'aceite automático por decurso de prazo',
  MANTIDA_DEFINITIVA: 'decisão final após a análise da recusa',
}

export function cienciaConfirmaNaoConformidade(
  status: string | null | undefined,
): boolean {
  return !!status && status in CONFIRMACAO_LABEL
}

export type ResultadoContingencia = {
  solicitado: boolean
  motivo?: string
  email?: string
}

/**
 * Abre o prazo das ações de contingência e pede a devolutiva ao contato do
 * fornecedor. Idempotente: não reabre se o pedido já foi feito.
 */
export async function solicitarAcoesContingencia(
  prisma: PrismaClient,
  rncId: string,
  baseUrl?: string,
): Promise<ResultadoContingencia> {
  const rnc = await prisma.relatorioNaoConformidade.findUnique({
    where: { id: rncId },
    select: {
      id: true,
      numero: true,
      descricaoDefeito: true,
      cienciaStatus: true,
      cienciaToken: true,
      contingenciaStatus: true,
      fornecedor: {
        select: {
          razaoSocial: true,
          contatos: {
            select: { tipo: true, valor: true, nome: true, principal: true },
          },
        },
      },
      tipoNaoConformidade: { select: { codigo: true, descricao: true } },
    },
  })
  if (!rnc) return { solicitado: false, motivo: 'RNC não encontrada' }
  if (rnc.contingenciaStatus) {
    return { solicitado: false, motivo: 'Ações de contingência já solicitadas' }
  }
  if (!cienciaConfirmaNaoConformidade(rnc.cienciaStatus)) {
    return {
      solicitado: false,
      motivo: 'A não conformidade ainda não está confirmada pelo fornecedor.',
    }
  }
  if (!rnc.cienciaToken) {
    return { solicitado: false, motivo: 'RNC sem link de ciência do fornecedor' }
  }

  const contato = escolherEmailFornecedor(rnc.fornecedor?.contatos ?? [])
  if (!contato) {
    return {
      solicitado: false,
      motivo: 'Fornecedor sem contato de e-mail cadastrado.',
    }
  }

  const transporte = await criarTransporteSmtp()
  if (!transporte) return { solicitado: false, motivo: 'SMTP não configurado' }

  const parametros = await obterParametrosWorkflow(prisma)
  const prazoEm = new Date(
    Date.now() + parametros.contingenciaPrazoHoras * 3600_000,
  )

  const { subject, text, html } = montarEmailContingencia({
    numero: rnc.numero,
    fornecedorNome: rnc.fornecedor?.razaoSocial ?? '',
    contatoNome: contato.nome,
    tipoNc: rnc.tipoNaoConformidade
      ? `${rnc.tipoNaoConformidade.codigo} — ${rnc.tipoNaoConformidade.descricao}`
      : '',
    descricaoDefeito: rnc.descricaoDefeito,
    confirmacao: CONFIRMACAO_LABEL[rnc.cienciaStatus as string] ?? 'confirmada',
    prazoEm,
    alertasPorDia: parametros.contingenciaAlertasPorDia,
    token: rnc.cienciaToken,
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
      solicitado: false,
      motivo: err instanceof Error ? err.message : 'Falha no envio do e-mail',
    }
  }

  // Condicionado a ainda não haver pedido: evita abrir dois prazos.
  const r = await prisma.relatorioNaoConformidade.updateMany({
    where: { id: rnc.id, contingenciaStatus: null },
    data: {
      contingenciaStatus: 'PENDENTE',
      contingenciaSolicitadaEm: new Date(),
      contingenciaPrazoEm: prazoEm,
    },
  })
  if (r.count === 0) {
    return { solicitado: false, motivo: 'Ações de contingência já solicitadas' }
  }

  return { solicitado: true, email: contato.email }
}

/** Aviso interno com as ações de contingência enviadas pelo fornecedor. */
async function notificarContingenciaRecebida(
  prisma: PrismaClient,
  rncId: string,
): Promise<void> {
  const rnc = await prisma.relatorioNaoConformidade.findUnique({
    where: { id: rncId },
    select: {
      numero: true,
      filialId: true,
      contingenciaAcoes: true,
      contingenciaPrazoEm: true,
      contingenciaRespondidaEm: true,
      contingenciaRespondidaPor: true,
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

  const respondidaEm = rnc.contingenciaRespondidaEm ?? new Date()
  const { subject, text, html } = montarEmailContingenciaRecebida({
    numero: rnc.numero,
    fornecedorNome: rnc.fornecedor?.razaoSocial ?? '',
    respondidaPor: rnc.contingenciaRespondidaPor,
    respondidaEm,
    acoes: rnc.contingenciaAcoes ?? '',
    emAtraso: !!rnc.contingenciaPrazoEm && respondidaEm > rnc.contingenciaPrazoEm,
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
    // best-effort: a devolutiva já está registrada
  }
}

/** Registra a devolutiva do fornecedor e encerra os alertas. */
export async function registrarAcoesContingencia(
  prisma: PrismaClient,
  rncId: string,
  opts: {
    acoes: string
    respondidoPor?: string | null
    ip?: string | null
    navegador?: string | null
  },
): Promise<void> {
  const acoes = opts.acoes.trim()
  if (!acoes) throw new Error('Informe as ações de contingência.')

  // Condicionado ao status pendente: evita sobrescrever uma devolutiva
  // já registrada por outra sessão.
  const r = await prisma.relatorioNaoConformidade.updateMany({
    where: { id: rncId, contingenciaStatus: 'PENDENTE' },
    data: {
      contingenciaStatus: 'RESPONDIDA',
      contingenciaAcoes: acoes,
      contingenciaRespondidaEm: new Date(),
      contingenciaRespondidaPor: opts.respondidoPor?.trim() || null,
      contingenciaIp: opts.ip?.slice(0, 64) || null,
      contingenciaNavegador: opts.navegador?.slice(0, 160) || null,
    },
  })
  if (r.count === 0) {
    throw new Error('As ações de contingência já foram registradas.')
  }

  await notificarContingenciaRecebida(prisma, rncId)
}

/**
 * Alertas das ações de contingência em atraso. Vencido o prazo, o
 * fornecedor recebe N alertas por dia (parâmetro do workflow) até enviar
 * a devolutiva. Roda no agendador.
 */
export async function processarAlertasContingencia(
  prisma: PrismaClient,
  baseUrl?: string,
): Promise<{ alertasEnviados: number }> {
  const parametros = await obterParametrosWorkflow(prisma)
  const intervalo = intervaloEntreAlertasMs(parametros.contingenciaAlertasPorDia)
  const agora = new Date()
  const desde = new Date(agora.getTime() - intervalo)

  const atrasadas = await prisma.relatorioNaoConformidade.findMany({
    where: {
      contingenciaStatus: 'PENDENTE',
      contingenciaPrazoEm: { lte: agora },
      OR: [
        { contingenciaUltimoAlerta: null },
        { contingenciaUltimoAlerta: { lte: desde } },
      ],
    },
    select: {
      id: true,
      numero: true,
      cienciaToken: true,
      contingenciaPrazoEm: true,
      contingenciaAlertas: true,
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
  if (atrasadas.length === 0) return { alertasEnviados: 0 }

  const transporte = await criarTransporteSmtp()
  if (!transporte) return { alertasEnviados: 0 }

  let alertasEnviados = 0
  for (const rnc of atrasadas) {
    const contato = escolherEmailFornecedor(rnc.fornecedor?.contatos ?? [])
    if (!contato || !rnc.cienciaToken) continue

    // Marca o alerta ANTES do envio e condicionado à janela: se o disparo
    // falhar, a próxima rodada tenta de novo sem duplicar a cobrança.
    const marcado = await prisma.relatorioNaoConformidade.updateMany({
      where: {
        id: rnc.id,
        contingenciaStatus: 'PENDENTE',
        OR: [
          { contingenciaUltimoAlerta: null },
          { contingenciaUltimoAlerta: { lte: desde } },
        ],
      },
      data: {
        contingenciaUltimoAlerta: new Date(),
        contingenciaAlertas: { increment: 1 },
      },
    })
    if (marcado.count === 0) continue

    const { subject, text, html } = montarEmailAlertaContingencia({
      numero: rnc.numero,
      fornecedorNome: rnc.fornecedor?.razaoSocial ?? '',
      contatoNome: contato.nome,
      prazoEm: rnc.contingenciaPrazoEm ?? agora,
      alerta: rnc.contingenciaAlertas + 1,
      token: rnc.cienciaToken,
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
      alertasEnviados++
    } catch {
      // best-effort: a próxima janela cobra novamente
    }
  }

  return { alertasEnviados }
}
