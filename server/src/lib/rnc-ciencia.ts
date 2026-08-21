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
  montarEmailAnalisePlanoContingencia,
  montarEmailCausaRaizSolicitada,
  montarEmailCausaRaizEnviada,
  montarEmailCausaRaizAnalisada,
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

/** Aviso interno com o plano de ações enviado pelo fornecedor. */
async function notificarContingenciaRecebida(
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
      contingenciaPrazoEm: true,
      contingenciaRespondidaEm: true,
      contingenciaRespondidaPor: true,
      fornecedor: { select: { razaoSocial: true } },
      criadoPor: { select: { email: true } },
      aprovadores: { select: { email: true } },
      acoesContingencia: {
        where: { status: 'PENDENTE' },
        orderBy: { ordem: 'asc' },
        select: { ordem: true, descricao: true, responsavel: true, prazo: true },
      },
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
    rncId: rnc.id,
    fornecedorNome: rnc.fornecedor?.razaoSocial ?? '',
    respondidaPor: rnc.contingenciaRespondidaPor,
    respondidaEm,
    acoes: rnc.acoesContingencia,
    emAtraso: !!rnc.contingenciaPrazoEm && respondidaEm > rnc.contingenciaPrazoEm,
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
    // best-effort: a devolutiva já está registrada
  }
}

/** Uma ação do plano, como informada pelo fornecedor. */
export type AcaoContingenciaEntrada = {
  descricao: string
  responsavel?: string | null
  prazo?: Date | null
}

/**
 * Estados em que o fornecedor ainda deve (re)enviar o plano de ações:
 * nunca enviou, ou teve ao menos uma ação recusada.
 */
const CONTINGENCIA_ABERTA = ['PENDENTE', 'AJUSTE_SOLICITADO'] as const

/**
 * Registra o plano de ações do fornecedor — uma linha por ação — e
 * encerra os alertas até a análise do aprovador. As ações recusadas em
 * uma rodada anterior permanecem no histórico; as novas entram como
 * pendentes de análise, continuando a numeração.
 */
export async function registrarAcoesContingencia(
  prisma: PrismaClient,
  rncId: string,
  opts: {
    acoes: AcaoContingenciaEntrada[]
    respondidoPor?: string | null
    ip?: string | null
    navegador?: string | null
    baseUrl?: string
  },
): Promise<{ registradas: number }> {
  const acoes = opts.acoes
    .map((a) => ({
      descricao: a.descricao.trim(),
      responsavel: a.responsavel?.trim() || null,
      prazo: a.prazo ?? null,
    }))
    .filter((a) => a.descricao !== '')
  if (acoes.length === 0) {
    throw new Error('Informe ao menos uma ação de contingência.')
  }

  const agora = new Date()
  const informadaPor = opts.respondidoPor?.trim() || null

  // Tudo em uma transação: ou o plano inteiro entra e o status muda,
  // ou nada acontece.
  await prisma.$transaction(async (tx) => {
    // Condicionado ao status aberto: evita sobrescrever um plano que
    // outra sessão acabou de enviar.
    const r = await tx.relatorioNaoConformidade.updateMany({
      where: { id: rncId, contingenciaStatus: { in: [...CONTINGENCIA_ABERTA] } },
      data: {
        contingenciaStatus: 'EM_ANALISE',
        contingenciaRespondidaEm: agora,
        contingenciaRespondidaPor: informadaPor,
        contingenciaIp: opts.ip?.slice(0, 64) || null,
        contingenciaNavegador: opts.navegador?.slice(0, 160) || null,
        // Enquanto o plano está em análise não há o que cobrar.
        contingenciaUltimoAlerta: null,
      },
    })
    if (r.count === 0) {
      throw new Error('O plano de ações já foi enviado e está em análise.')
    }

    // Continua a numeração para não confundir o histórico de recusas.
    const ultima = await tx.rncAcaoContingencia.aggregate({
      where: { rncId },
      _max: { ordem: true },
    })
    let ordem = ultima._max.ordem ?? 0

    await tx.rncAcaoContingencia.createMany({
      data: acoes.map((a) => ({
        rncId,
        ordem: ++ordem,
        descricao: a.descricao,
        responsavel: a.responsavel,
        prazo: a.prazo,
        informadaEm: agora,
        informadaPor,
      })),
    })
  })

  await notificarContingenciaRecebida(prisma, rncId, opts.baseUrl)
  // Enviado o plano, abre a análise de causa (Ishikawa + 5W2H).
  await abrirCausaRaiz(prisma, rncId, opts.baseUrl)
  return { registradas: acoes.length }
}

/**
 * Aprova ou recusa UMA ação do plano. A recusa exige parecer — é o que o
 * fornecedor recebe para corrigir. Quando não sobra nenhuma ação pendente,
 * o plano é fechado: aprovado, ou devolvido para ajuste.
 */
export async function analisarAcaoContingencia(
  prisma: PrismaClient,
  rncId: string,
  acaoId: string,
  opts: {
    aprovada: boolean
    analisadaPor?: string | null
    parecer?: string | null
    baseUrl?: string
  },
): Promise<{ contingenciaStatus: string; pendentes: number }> {
  const parecer = opts.parecer?.trim() || null
  if (!opts.aprovada && !parecer) {
    throw new Error('Informe o parecer que fundamenta a recusa da ação.')
  }

  const acao = await prisma.rncAcaoContingencia.findUnique({
    where: { id: acaoId },
    select: { id: true, rncId: true, status: true },
  })
  if (!acao || acao.rncId !== rncId) {
    throw new Error('Ação de contingência não encontrada nesta RNC.')
  }
  if (acao.status !== 'PENDENTE') {
    throw new Error('Esta ação já foi analisada.')
  }

  // Condicionado ao status pendente: evita duas análises simultâneas.
  const r = await prisma.rncAcaoContingencia.updateMany({
    where: { id: acaoId, status: 'PENDENTE' },
    data: {
      status: opts.aprovada ? 'APROVADA' : 'RECUSADA',
      analisadaEm: new Date(),
      analisadaPor: opts.analisadaPor?.trim() || null,
      parecer,
    },
  })
  if (r.count === 0) throw new Error('Esta ação já foi analisada.')

  return await fecharAnalisePlano(prisma, rncId, opts.analisadaPor, opts.baseUrl)
}

/**
 * Reavalia o plano depois de cada decisão: enquanto houver ação pendente
 * ele segue EM_ANALISE; sem pendências, vira APROVADA (todas aprovadas) ou
 * AJUSTE_SOLICITADO (alguma recusada), reabrindo o prazo do fornecedor.
 */
async function fecharAnalisePlano(
  prisma: PrismaClient,
  rncId: string,
  analisadaPor?: string | null,
  baseUrl?: string,
): Promise<{ contingenciaStatus: string; pendentes: number }> {
  const rnc = await prisma.relatorioNaoConformidade.findUnique({
    where: { id: rncId },
    select: { contingenciaRespondidaEm: true },
  })

  const pendentes = await prisma.rncAcaoContingencia.count({
    where: { rncId, status: 'PENDENTE' },
  })
  // Só as recusas DESTA rodada decidem o veredito: uma ação recusada e
  // já corrigida em um envio posterior fica no histórico, mas não pode
  // travar o plano em ajuste para sempre.
  const recusadas = await prisma.rncAcaoContingencia.count({
    where: {
      rncId,
      status: 'RECUSADA',
      ...(rnc?.contingenciaRespondidaEm
        ? { informadaEm: { gte: rnc.contingenciaRespondidaEm } }
        : {}),
    },
  })

  // Ainda há ação por analisar: o plano continua em análise e o
  // fornecedor não é incomodado no meio da avaliação.
  if (pendentes > 0) {
    return { contingenciaStatus: 'EM_ANALISE', pendentes }
  }

  const aprovado = recusadas === 0
  const agora = new Date()
  const parametros = await obterParametrosWorkflow(prisma)

  const fechou = await prisma.relatorioNaoConformidade.updateMany({
    where: { id: rncId, contingenciaStatus: 'EM_ANALISE' },
    data: {
      contingenciaStatus: aprovado ? 'APROVADA' : 'AJUSTE_SOLICITADO',
      contingenciaAnalisadaEm: agora,
      contingenciaAnalisadaPor: analisadaPor?.trim() || null,
      // Recusa reabre o prazo do fornecedor e volta a cobrar do zero: o
      // contador é por rodada, senão a 1ª cobrança da correção chegaria
      // numerada como se fosse continuação da rodada anterior.
      ...(aprovado
        ? {}
        : {
            contingenciaPrazoEm: new Date(
              agora.getTime() + parametros.contingenciaPrazoHoras * 3600_000,
            ),
            contingenciaUltimoAlerta: null,
            contingenciaAlertas: 0,
          }),
    },
  })

  // Se nada foi gravado, outra sessão já fechou o plano — não avisa o
  // fornecedor duas vezes.
  if (fechou.count === 0) {
    return { contingenciaStatus: 'EM_ANALISE', pendentes: 0 }
  }

  await notificarAnalisePlano(prisma, rncId, { aprovado, baseUrl })
  return {
    contingenciaStatus: aprovado ? 'APROVADA' : 'AJUSTE_SOLICITADO',
    pendentes: 0,
  }
}

/** Comunica ao fornecedor o resultado da análise do plano de ações. */
async function notificarAnalisePlano(
  prisma: PrismaClient,
  rncId: string,
  opts: { aprovado: boolean; baseUrl?: string },
): Promise<void> {
  const rnc = await prisma.relatorioNaoConformidade.findUnique({
    where: { id: rncId },
    select: {
      numero: true,
      cienciaToken: true,
      contingenciaPrazoEm: true,
      fornecedor: {
        select: {
          razaoSocial: true,
          contatos: {
            select: { tipo: true, valor: true, nome: true, principal: true },
          },
        },
      },
      acoesContingencia: {
        orderBy: { ordem: 'asc' },
        select: {
          ordem: true,
          descricao: true,
          responsavel: true,
          prazo: true,
          status: true,
          parecer: true,
        },
      },
    },
  })
  if (!rnc || !rnc.cienciaToken) return

  const contato = escolherEmailFornecedor(rnc.fornecedor?.contatos ?? [])
  const transporte = await criarTransporteSmtp()
  if (!contato || !transporte) return

  const { subject, text, html } = montarEmailAnalisePlanoContingencia({
    numero: rnc.numero,
    fornecedorNome: rnc.fornecedor?.razaoSocial ?? '',
    contatoNome: contato.nome,
    aprovado: opts.aprovado,
    acoes: rnc.acoesContingencia,
    novoPrazoEm: opts.aprovado ? null : rnc.contingenciaPrazoEm,
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
      contingenciaStatus: { in: [...CONTINGENCIA_ABERTA] },
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
      contingenciaStatus: true,
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
        contingenciaStatus: { in: [...CONTINGENCIA_ABERTA] },
        // Repete o filtro de prazo: entre a busca e este update o plano
        // pode ter sido reaberto com prazo novo — cobrar aí seria cobrar
        // algo que ainda nem venceu.
        contingenciaPrazoEm: { lte: agora },
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
      ajuste: rnc.contingenciaStatus === 'AJUSTE_SOLICITADO',
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

// ── Análise de causa: Ishikawa + 5W2H ───────────────────────────────

/**
 * Enviadas as ações de contingência, o fornecedor preenche na plataforma
 * o diagrama de Ishikawa e o 5W2H e manda para o aprovador marcado, que
 * aprova ou rejeita. Rejeitada, a análise volta editável — diferente das
 * ações de contingência, aqui o conteúdo é alterado, não acrescentado.
 */

export const ISHIKAWA_CATEGORIAS = [
  'METODO',
  'MAQUINA',
  'MAO_DE_OBRA',
  'MATERIAL',
  'MEDICAO',
  'MEIO_AMBIENTE',
] as const

export type IshikawaCategoriaValor = (typeof ISHIKAWA_CATEGORIAS)[number]

export type CausaIshikawaEntrada = {
  categoria: IshikawaCategoriaValor
  descricao: string
}

export type Cinco2HEntrada = {
  oQue?: string | null
  porQue?: string | null
  onde?: string | null
  quando?: string | null
  quem?: string | null
  como?: string | null
  quantoCusta?: string | null
}

/** Estados em que o fornecedor ainda pode mexer na análise. */
const CAUSA_RAIZ_ABERTA = ['PENDENTE', 'AJUSTE_SOLICITADO'] as const

const CAMPOS_5W2H: [keyof Cinco2HEntrada, string][] = [
  ['oQue', 'O quê'],
  ['porQue', 'Por quê'],
  ['onde', 'Onde'],
  ['quando', 'Quando'],
  ['quem', 'Quem'],
  ['como', 'Como'],
  ['quantoCusta', 'Quanto custa'],
]

/**
 * Abre a etapa de análise de causa. Idempotente: chamada a cada envio do
 * plano de ações, só tem efeito na primeira vez.
 */
export async function abrirCausaRaiz(
  prisma: PrismaClient,
  rncId: string,
  baseUrl?: string,
): Promise<{ aberta: boolean; motivo?: string }> {
  const rnc = await prisma.relatorioNaoConformidade.findUnique({
    where: { id: rncId },
    select: {
      id: true,
      numero: true,
      cienciaToken: true,
      causaRaizStatus: true,
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
  if (!rnc) return { aberta: false, motivo: 'RNC não encontrada' }
  if (rnc.causaRaizStatus) {
    return { aberta: false, motivo: 'Análise de causa já aberta' }
  }

  // Condicionado a ainda não existir: dois envios simultâneos do plano não
  // abrem a etapa duas vezes nem mandam dois e-mails.
  const r = await prisma.relatorioNaoConformidade.updateMany({
    where: { id: rncId, causaRaizStatus: null },
    data: { causaRaizStatus: 'PENDENTE', causaRaizSolicitadaEm: new Date() },
  })
  if (r.count === 0) {
    return { aberta: false, motivo: 'Análise de causa já aberta' }
  }

  const contato = escolherEmailFornecedor(rnc.fornecedor?.contatos ?? [])
  const transporte = await criarTransporteSmtp()
  if (contato && transporte && rnc.cienciaToken) {
    const { subject, text, html } = montarEmailCausaRaizSolicitada({
      numero: rnc.numero,
      fornecedorNome: rnc.fornecedor?.razaoSocial ?? '',
      contatoNome: contato.nome,
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
    } catch {
      // best-effort: a etapa já está aberta na plataforma
    }
  }

  return { aberta: true }
}

/**
 * Grava o que o fornecedor preencheu. Com `enviar`, valida a completude e
 * manda para o aprovador marcado; sem, é só rascunho — o formulário é
 * longo e perder o preenchimento seria cruel com quem está do outro lado.
 */
export async function salvarCausaRaiz(
  prisma: PrismaClient,
  rncId: string,
  opts: {
    causas: CausaIshikawaEntrada[]
    cinco2h: Cinco2HEntrada
    enviar: boolean
    respondidoPor?: string | null
    ip?: string | null
    navegador?: string | null
    baseUrl?: string
  },
): Promise<{ enviada: boolean; causas: number }> {
  const causas = opts.causas
    .map((c) => ({ categoria: c.categoria, descricao: c.descricao.trim() }))
    .filter((c) => c.descricao !== '')

  const texto = (v: string | null | undefined) => v?.trim() || null
  const cinco2h = {
    causaOQue: texto(opts.cinco2h.oQue),
    causaPorQue: texto(opts.cinco2h.porQue),
    causaOnde: texto(opts.cinco2h.onde),
    causaQuando: texto(opts.cinco2h.quando),
    causaQuem: texto(opts.cinco2h.quem),
    causaComo: texto(opts.cinco2h.como),
    causaQuantoCusta: texto(opts.cinco2h.quantoCusta),
  }

  if (opts.enviar) {
    if (causas.length === 0) {
      throw new Error(
        'Informe ao menos uma causa no diagrama de Ishikawa antes de enviar.',
      )
    }
    const faltando = CAMPOS_5W2H.filter(
      ([chave]) => !texto(opts.cinco2h[chave]),
    ).map(([, rotulo]) => rotulo)
    if (faltando.length > 0) {
      throw new Error(
        `Preencha todos os campos do 5W2H antes de enviar. Faltam: ${faltando.join(', ')}.`,
      )
    }
  }

  const agora = new Date()

  await prisma.$transaction(async (tx) => {
    // Condicionado ao estado aberto: o fornecedor não mexe numa análise
    // que já está em análise ou aprovada.
    const r = await tx.relatorioNaoConformidade.updateMany({
      where: { id: rncId, causaRaizStatus: { in: [...CAUSA_RAIZ_ABERTA] } },
      data: {
        ...cinco2h,
        ...(opts.enviar
          ? {
              causaRaizStatus: 'EM_ANALISE',
              causaRaizEnviadaEm: agora,
              causaRaizEnviadaPor: opts.respondidoPor?.trim() || null,
              causaRaizIp: opts.ip?.slice(0, 64) || null,
              causaRaizNavegador: opts.navegador?.slice(0, 160) || null,
              causaRaizEnvios: { increment: 1 },
            }
          : {}),
      },
    })
    if (r.count === 0) {
      throw new Error(
        'A análise de causa não está aberta para edição neste momento.',
      )
    }

    // O conteúdo é substituído: o fornecedor altera o que preencheu, então
    // o conjunto de causas reflete sempre o último preenchimento.
    await tx.rncIshikawaCausa.deleteMany({ where: { rncId } })
    if (causas.length > 0) {
      const porCategoria = new Map<string, number>()
      await tx.rncIshikawaCausa.createMany({
        data: causas.map((c) => {
          const ordem = (porCategoria.get(c.categoria) ?? 0) + 1
          porCategoria.set(c.categoria, ordem)
          return {
            rncId,
            categoria: c.categoria,
            ordem,
            descricao: c.descricao,
          }
        }),
      })
    }
  })

  if (opts.enviar) {
    await notificarCausaRaizEnviada(prisma, rncId, opts.baseUrl)
  }
  return { enviada: opts.enviar, causas: causas.length }
}

/** Avisa o aprovador marcado de que a análise chegou para aprovação. */
async function notificarCausaRaizEnviada(
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
      causaRaizEnviadaEm: true,
      causaRaizEnviadaPor: true,
      causaRaizEnvios: true,
      causaOQue: true,
      causaPorQue: true,
      causaOnde: true,
      causaQuando: true,
      causaQuem: true,
      causaComo: true,
      causaQuantoCusta: true,
      fornecedor: { select: { razaoSocial: true } },
      criadoPor: { select: { email: true } },
      aprovadores: { select: { email: true } },
      causasIshikawa: {
        orderBy: [{ categoria: 'asc' }, { ordem: 'asc' }],
        select: { categoria: true, descricao: true },
      },
    },
  })
  if (!rnc) return

  const transporte = await criarTransporteSmtp()
  if (!transporte) return

  const destinatarios = await destinatariosRespostaFornecedor(prisma, rnc)
  if (destinatarios.length === 0) return

  const { subject, text, html } = montarEmailCausaRaizEnviada({
    numero: rnc.numero,
    rncId: rnc.id,
    fornecedorNome: rnc.fornecedor?.razaoSocial ?? '',
    enviadaPor: rnc.causaRaizEnviadaPor,
    enviadaEm: rnc.causaRaizEnviadaEm ?? new Date(),
    envio: rnc.causaRaizEnvios,
    causas: rnc.causasIshikawa,
    cinco2h: {
      oQue: rnc.causaOQue,
      porQue: rnc.causaPorQue,
      onde: rnc.causaOnde,
      quando: rnc.causaQuando,
      quem: rnc.causaQuem,
      como: rnc.causaComo,
      quantoCusta: rnc.causaQuantoCusta,
    },
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
    // best-effort: o envio já está registrado
  }
}

/**
 * Aprova ou rejeita a análise de causa (Ishikawa e 5W2H juntos, como
 * chegaram). Rejeitar exige parecer e devolve a análise para alteração.
 */
export async function analisarCausaRaiz(
  prisma: PrismaClient,
  rncId: string,
  opts: {
    aprovada: boolean
    analisadaPor?: string | null
    parecer?: string | null
    baseUrl?: string
  },
): Promise<{ causaRaizStatus: 'APROVADA' | 'AJUSTE_SOLICITADO' }> {
  const parecer = opts.parecer?.trim() || null
  if (!opts.aprovada && !parecer) {
    throw new Error('Informe o parecer que fundamenta a rejeição da análise.')
  }

  const novoStatus = opts.aprovada ? 'APROVADA' : 'AJUSTE_SOLICITADO'

  // Condicionado ao status em análise: evita duas decisões simultâneas.
  const r = await prisma.relatorioNaoConformidade.updateMany({
    where: { id: rncId, causaRaizStatus: 'EM_ANALISE' },
    data: {
      causaRaizStatus: novoStatus,
      causaRaizAnalisadaEm: new Date(),
      causaRaizAnalisadaPor: opts.analisadaPor?.trim() || null,
      causaRaizParecer: parecer,
    },
  })
  if (r.count === 0) {
    throw new Error('Esta análise de causa já foi avaliada.')
  }

  await notificarCausaRaizAnalisada(prisma, rncId, {
    aprovada: opts.aprovada,
    parecer,
    baseUrl: opts.baseUrl,
  })
  return { causaRaizStatus: novoStatus }
}

/** Comunica ao fornecedor o resultado da análise de causa. */
async function notificarCausaRaizAnalisada(
  prisma: PrismaClient,
  rncId: string,
  opts: { aprovada: boolean; parecer: string | null; baseUrl?: string },
): Promise<void> {
  const rnc = await prisma.relatorioNaoConformidade.findUnique({
    where: { id: rncId },
    select: {
      numero: true,
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
  if (!rnc || !rnc.cienciaToken) return

  const contato = escolherEmailFornecedor(rnc.fornecedor?.contatos ?? [])
  const transporte = await criarTransporteSmtp()
  if (!contato || !transporte) return

  const { subject, text, html } = montarEmailCausaRaizAnalisada({
    numero: rnc.numero,
    fornecedorNome: rnc.fornecedor?.razaoSocial ?? '',
    contatoNome: contato.nome,
    aprovada: opts.aprovada,
    parecer: opts.parecer,
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
