import { randomBytes, randomInt } from 'node:crypto'
import type { Prisma, PrismaClient } from '@prisma/client'
import { criarTransporteSmtp, type Transporte } from './smtp.js'
import {
  montarEmailAssinatura,
  montarEmailConclusao,
  montarEmailRaqFornecedor,
  montarEmailRvtFornecedor,
} from './rnc-email.js'
import {
  enviarCienciaFornecedor,
  escolherEmailFornecedor,
} from './rnc-ciencia.js'
import { gerarPdfBuffer } from './rnc-pdf-loader.js'
import { candidatosPorArea } from './rnc-aprovadores.js'
import {
  criarContextoWa,
  enviarTemplateWa,
  type WaContexto,
} from './wa.js'

type Db = Prisma.TransactionClient | PrismaClient

/** Data/hora no formato "dd/mm/aaaa às HHhMM" (fuso de operação). */
function fmtPrazoData(d: Date): string {
  const p = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  return `${g('day')}/${g('month')}/${g('year')} às ${g('hour')}h${g('minute')}`
}

/** Texto do tempo restante até o prazo (ex.: "24 horas", "30 minutos"). */
function fmtTempoRestante(deadline: Date): string {
  const ms = deadline.getTime() - Date.now()
  if (ms <= 0) return 'expirado'
  const horas = ms / 3600_000
  if (horas >= 1) return `${Math.round(horas)} horas`
  return `${Math.max(1, Math.round(ms / 60_000))} minutos`
}

const rncInfoSelect = {
  id: true,
  numero: true,
  tipoDocumento: true,
  titulo: true,
  pauta: true,
  status: true,
  dataIdentificacao: true,
  descricaoDefeito: true,
  turnoId: true,
  filialId: true,
  assinaturaEnviadaEm: true,
  escalonadoEm: true,
  filial: { select: { nome: true } },
  fornecedor: { select: { razaoSocial: true } },
  tipoNaoConformidade: { select: { codigo: true, descricao: true } },
  severidade: { select: { nivel: true, nome: true } },
} as const

type RncInfo = Prisma.RelatorioNaoConformidadeGetPayload<{
  select: typeof rncInfoSelect
}>

type AprovadorRow = {
  id: string
  nome: string
  areaNome: string
  email: string | null
  whatsapp: string | null
  tokenAssinatura: string | null
  senhaAssinatura: string | null
}

/**
 * Horas de resposta (SLA) da Política de Resposta do tipo de relatório
 * do documento — 'RNC' por padrão; 'RAQ' usa a política do tipo RAQ.
 */
export async function horasRespostaRnc(
  db: Db,
  tipoCodigo: string = 'RNC',
): Promise<number | null> {
  const politica = await db.politicaResposta.findFirst({
    where: {
      ativo: true,
      tipoRelatorio: { codigo: { equals: tipoCodigo, mode: 'insensitive' } },
    },
    select: { horasResposta: true },
  })
  return politica?.horasResposta ?? null
}

// Formata um prazo em horas fracionárias como "2h", "30min" ou "1h30min".
function fmtHoras(horas: number): string {
  const totalMin = Math.round(horas * 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0 && m > 0) return `${h}h${String(m).padStart(2, '0')}min`
  if (h > 0) return `${h}h`
  return `${m}min`
}

/**
 * Notifica um aprovador (e-mail + WhatsApp, conforme disponível), gerando
 * token/senha se faltar. O e-mail é obrigatório para o sucesso; o WhatsApp
 * é best-effort. `horasSla` é o prazo da Política de Resposta (horas).
 */
export async function enviarWorkflowAprovador(
  db: Db,
  transporte: Transporte,
  wa: WaContexto | null,
  rnc: RncInfo,
  ap: AprovadorRow,
  tipo: 'solicitacao' | 'lembrete' | 'escalonamento',
  horasSla?: number | null,
  baseUrl?: string,
): Promise<{ ok: boolean; erro?: string }> {
  const token = ap.tokenAssinatura ?? randomBytes(24).toString('hex')
  const senha =
    ap.senhaAssinatura ?? String(randomInt(0, 1_000_000)).padStart(6, '0')
  if (!ap.tokenAssinatura || !ap.senhaAssinatura) {
    await db.rncAprovador.update({
      where: { id: ap.id },
      data: { tokenAssinatura: token, senhaAssinatura: senha },
    })
  }

  // Prazo (deadline) a partir do início do workflow + SLA.
  const base = rnc.assinaturaEnviadaEm ?? new Date()
  const deadline =
    horasSla && horasSla > 0
      ? new Date(base.getTime() + horasSla * 3600_000)
      : null
  const prazoData = deadline ? fmtPrazoData(deadline) : 'a definir'
  const prazoTexto = horasSla && horasSla > 0 ? fmtHoras(horasSla) : null

  // ── E-mail ────────────────────────────────────────────────
  let emailOk = false
  let emailErro: string | undefined
  if (ap.email) {
    const { subject, text, html } = montarEmailAssinatura({
      numero: rnc.numero,
      docTipo: rnc.tipoDocumento,
      titulo: rnc.titulo ?? rnc.pauta,
      filialNome: rnc.filial?.nome ?? '',
      fornecedorNome: rnc.fornecedor?.razaoSocial ?? '',
      tipoNc: rnc.tipoNaoConformidade
        ? `${rnc.tipoNaoConformidade.codigo} — ${rnc.tipoNaoConformidade.descricao}`
        : '',
      severidade: rnc.severidade
        ? `Nível ${rnc.severidade.nivel} — ${rnc.severidade.nome}`
        : null,
      dataIdentificacao: rnc.dataIdentificacao,
      descricaoDefeito: rnc.descricaoDefeito,
      aprovadorNome: ap.nome,
      areaNome: ap.areaNome,
      token,
      senha,
      tipo,
      prazoTexto,
      baseUrl,
    })
    try {
      await transporte.transporter.sendMail({
        from: transporte.remetente,
        to: ap.email,
        subject,
        text,
        html,
      })
      emailOk = true
    } catch (err) {
      emailErro = err instanceof Error ? err.message : 'erro'
    }
  } else {
    emailErro = 'sem e-mail'
  }

  // ── WhatsApp (best-effort) ────────────────────────────────
  let waOk = false
  if (wa && ap.whatsapp) {
    const fornecedor = rnc.fornecedor?.razaoSocial ?? ''
    const r =
      tipo === 'lembrete'
        ? await enviarTemplateWa(wa, ap.whatsapp, 'lembrete', {
            '1': ap.nome,
            '2': rnc.numero,
            '3': prazoData,
            '4': deadline ? fmtTempoRestante(deadline) : 'a definir',
            '5': token,
          })
        : // solicitacao e escalonamento usam o template de solicitação.
          await enviarTemplateWa(wa, ap.whatsapp, 'solicitacao', {
            '1': ap.nome,
            '2': rnc.numero,
            '3': fornecedor,
            '4': prazoData,
            '5': token,
          })
    waOk = r.ok
  }

  // Sucesso = notificado por qualquer canal (e-mail ou WhatsApp).
  if (emailOk || waOk) return { ok: true }
  return { ok: false, erro: emailErro }
}

/**
 * Escalona as áreas pendentes da RNC para níveis superiores, incluindo
 * os aprovadores na matriz e enviando o workflow a eles.
 * - modo 'todos': adiciona todos os níveis superiores ainda fora da matriz.
 * - modo 'proximo': adiciona apenas o próximo nível acima do atual (um passo).
 * Retorna quantos foram adicionados/notificados e as falhas de envio.
 */
async function escalonarRncInterno(
  prisma: PrismaClient,
  transporte: Transporte,
  wa: WaContexto | null,
  rnc: RncInfo,
  modo: 'todos' | 'proximo',
  horasSla: number | null,
  baseUrl?: string,
): Promise<{ novos: number; falhas: string[]; havendoCandidatos: boolean }> {
  const candidatos = await candidatosPorArea(
    prisma,
    rnc.filialId,
    rnc.turnoId,
    rnc.tipoDocumento,
  )
  const todos = await prisma.rncAprovador.findMany({
    where: { rncId: rnc.id },
    select: { areaId: true, aprovadorId: true, assinadoEm: true, nivel: true },
  })

  // Áreas resolvidas (alguém já assinou) saem da escalada.
  const assinadasPorArea = new Set<string>()
  const maxNivelPorArea = new Map<string, number>()
  const jaNaMatriz = new Set(todos.map((t) => t.aprovadorId).filter(Boolean))
  for (const t of todos) {
    if (!t.areaId) continue
    if (t.assinadoEm) assinadasPorArea.add(t.areaId)
    const atual = maxNivelPorArea.get(t.areaId) ?? 0
    if ((t.nivel ?? 0) > atual) maxNivelPorArea.set(t.areaId, t.nivel ?? 0)
  }

  let novos = 0
  let havendoCandidatos = false
  const falhas: string[] = []

  for (const [areaId, lista] of candidatos) {
    if (assinadasPorArea.has(areaId)) continue
    // Só escalona áreas que estão na matriz e ainda pendentes.
    if (!maxNivelPorArea.has(areaId)) continue
    const maxAtual = maxNivelPorArea.get(areaId) ?? 0
    const acima = lista
      .filter((c) => !jaNaMatriz.has(c.aprovadorId) && c.nivel > maxAtual)
      .sort((a, b) => a.nivel - b.nivel)
    if (acima.length === 0) continue
    havendoCandidatos = true

    // 'proximo' = só o próximo nível (e empates desse nível); 'todos' = todos.
    const proximoNivel = acima[0].nivel
    const alvo =
      modo === 'proximo'
        ? acima.filter((c) => c.nivel === proximoNivel)
        : acima

    for (const c of alvo) {
      const criado = await prisma.rncAprovador.create({
        data: {
          rncId: rnc.id,
          aprovadorId: c.aprovadorId,
          areaId: c.areaId,
          areaNome: c.areaNome,
          nome: c.nome,
          cargo: c.cargo,
          email: c.email,
          whatsapp: c.whatsapp,
          nivel: c.nivel,
          viaEscalonamento: true,
        },
        select: {
          id: true,
          nome: true,
          areaNome: true,
          email: true,
          whatsapp: true,
          tokenAssinatura: true,
          senhaAssinatura: true,
        },
      })
      const r = await enviarWorkflowAprovador(
        prisma,
        transporte,
        wa,
        rnc,
        criado,
        'escalonamento',
        horasSla,
        baseUrl,
      )
      if (r.ok) novos++
      else if (r.erro) falhas.push(r.erro)
    }
  }

  return { novos, falhas, havendoCandidatos }
}

export type ResultadoProcessamento = {
  lembretesEnviados: number
  escalonamentos: number
  rncsProcessadas: number
}

/**
 * Processa o SLA dos workflows pendentes:
 * - 50% do prazo: lembrete a quem não assinou (e ainda não recebeu lembrete).
 * - 100% do prazo: escalona as áreas pendentes para os níveis superiores
 *   e os notifica.
 */
export async function processarWorkflows(
  prisma: PrismaClient,
): Promise<ResultadoProcessamento> {
  const out: ResultadoProcessamento = {
    lembretesEnviados: 0,
    escalonamentos: 0,
    rncsProcessadas: 0,
  }

  // Um prazo por tipo de documento: RNC e RAQ têm políticas próprias.
  const horasPorTipo: Record<string, number | null> = {
    RNC: await horasRespostaRnc(prisma, 'RNC'),
    RAQ: await horasRespostaRnc(prisma, 'RAQ'),
    RVT: await horasRespostaRnc(prisma, 'RVT'),
  }
  if (!Object.values(horasPorTipo).some((h) => h && h > 0)) return out

  const transporte = await criarTransporteSmtp()
  if (!transporte) return out // SMTP não configurado.

  const wa = criarContextoWa()
  const agora = Date.now()

  // Documentos já enviados e ainda em aberto (não encerrados/cancelados).
  const rncs = await prisma.relatorioNaoConformidade.findMany({
    where: {
      assinaturaEnviadaEm: { not: null },
      status: { in: ['OPEN', 'IN_PROGRESS'] },
    },
    select: { ...rncInfoSelect, assinaturaEnviadaEm: true },
  })

  for (const rnc of rncs) {
    const horas = horasPorTipo[rnc.tipoDocumento]
    if (!horas || horas <= 0) continue // Tipo sem SLA configurado.
    const limiteLembrete = horas * 0.5 * 3600_000
    const limiteEscalona = horas * 3600_000
    const enviadaEm = rnc.assinaturaEnviadaEm!.getTime()
    const decorrido = agora - enviadaEm
    let mexeu = false

    const pendentes = await prisma.rncAprovador.findMany({
      where: { rncId: rnc.id, assinadoEm: null },
      select: {
        id: true,
        nome: true,
        areaNome: true,
        email: true,
        whatsapp: true,
        areaId: true,
        nivel: true,
        tokenAssinatura: true,
        senhaAssinatura: true,
        lembreteEnviadoEm: true,
      },
    })
    if (pendentes.length === 0) continue

    // 1) Lembrete a 50% — quem não assinou e ainda não recebeu lembrete.
    if (decorrido >= limiteLembrete) {
      for (const ap of pendentes) {
        if (ap.lembreteEnviadoEm || (!ap.email && !ap.whatsapp)) continue
        const r = await enviarWorkflowAprovador(
          prisma,
          transporte,
          wa,
          rnc,
          ap,
          'lembrete',
          horas,
        )
        if (r.ok) {
          await prisma.rncAprovador.update({
            where: { id: ap.id },
            data: { lembreteEnviadoEm: new Date() },
          })
          out.lembretesEnviados++
          mexeu = true
        }
      }
    }

    // 2) Escalonamento a 100% — uma vez por RNC (todos os níveis acima).
    if (decorrido >= limiteEscalona && !rnc.escalonadoEm) {
      const { novos } = await escalonarRncInterno(
        prisma,
        transporte,
        wa,
        rnc,
        'todos',
        horas,
      )
      if (novos > 0) {
        out.escalonamentos += novos
        mexeu = true
      }
      await prisma.relatorioNaoConformidade.update({
        where: { id: rnc.id },
        data: { escalonadoEm: new Date() },
      })
    }

    if (mexeu) out.rncsProcessadas++
  }

  return out
}

export type ResultadoEscalonamentoManual = {
  novos: number
  falhas: string[]
  semSmtp: boolean
  semPendentes: boolean
  semCandidatos: boolean
}

/**
 * Escalonamento manual: sobe um nível acima do atual nas áreas pendentes,
 * independentemente do prazo. Pode ser clicado várias vezes para subir
 * níveis sucessivos.
 */
export async function escalonarManual(
  prisma: PrismaClient,
  rncId: string,
  baseUrl?: string,
): Promise<ResultadoEscalonamentoManual> {
  const rnc = await prisma.relatorioNaoConformidade.findUnique({
    where: { id: rncId },
    select: rncInfoSelect,
  })
  if (!rnc) throw new Error('RNC não encontrada')

  const temPendentes = await prisma.rncAprovador.count({
    where: { rncId, assinadoEm: null },
  })
  if (temPendentes === 0)
    return {
      novos: 0,
      falhas: [],
      semSmtp: false,
      semPendentes: true,
      semCandidatos: false,
    }

  const transporte = await criarTransporteSmtp()
  if (!transporte)
    return {
      novos: 0,
      falhas: [],
      semSmtp: true,
      semPendentes: false,
      semCandidatos: false,
    }

  const horas = await horasRespostaRnc(prisma, rnc.tipoDocumento)
  const wa = criarContextoWa()
  const { novos, falhas, havendoCandidatos } = await escalonarRncInterno(
    prisma,
    transporte,
    wa,
    rnc,
    'proximo',
    horas,
    baseUrl,
  )
  return {
    novos,
    falhas,
    semSmtp: false,
    semPendentes: false,
    semCandidatos: !havendoCandidatos,
  }
}

export type ResultadoLembreteManual = {
  enviados: number
  falhas: string[]
  semSmtp: boolean
  semPendentes: boolean
}

/** Lembrete manual: envia a todos os aprovadores ainda pendentes da RNC. */
export async function enviarLembreteManual(
  prisma: PrismaClient,
  rncId: string,
  baseUrl?: string,
): Promise<ResultadoLembreteManual> {
  const rnc = await prisma.relatorioNaoConformidade.findUnique({
    where: { id: rncId },
    select: rncInfoSelect,
  })
  if (!rnc) throw new Error('RNC não encontrada')

  const pendentes = await prisma.rncAprovador.findMany({
    where: {
      rncId,
      assinadoEm: null,
      OR: [{ email: { not: null } }, { whatsapp: { not: null } }],
    },
    select: {
      id: true,
      nome: true,
      areaNome: true,
      email: true,
      whatsapp: true,
      tokenAssinatura: true,
      senhaAssinatura: true,
    },
  })
  if (pendentes.length === 0)
    return { enviados: 0, falhas: [], semSmtp: false, semPendentes: true }

  const transporte = await criarTransporteSmtp()
  if (!transporte)
    return { enviados: 0, falhas: [], semSmtp: true, semPendentes: false }

  const horas = await horasRespostaRnc(prisma, rnc.tipoDocumento)
  const wa = criarContextoWa()
  let enviados = 0
  const falhas: string[] = []
  for (const ap of pendentes) {
    const r = await enviarWorkflowAprovador(
      prisma,
      transporte,
      wa,
      rnc,
      ap,
      'lembrete',
      horas,
      baseUrl,
    )
    if (r.ok) {
      await prisma.rncAprovador.update({
        where: { id: ap.id },
        data: { lembreteEnviadoEm: new Date() },
      })
      enviados++
    } else if (r.erro) {
      falhas.push(r.erro)
    }
  }
  return { enviados, falhas, semSmtp: false, semPendentes: false }
}

/**
 * Verifica se TODAS as assinaturas da RNC foram concluídas. Em caso
 * afirmativo (e ainda não notificado), marca a conclusão, encerra a RNC
 * e envia um e-mail de conclusão a todos os envolvidos (aprovadores +
 * emitente) com o resumo das assinaturas. Idempotente.
 */
export async function finalizarSeConcluida(
  prisma: PrismaClient,
  rncId: string,
  baseUrl?: string,
): Promise<boolean> {
  const rnc = await prisma.relatorioNaoConformidade.findUnique({
    where: { id: rncId },
    select: {
      id: true,
      numero: true,
      tipoDocumento: true,
      titulo: true,
      pauta: true,
      dataIdentificacao: true,
      status: true,
      assinaturasConcluidasEm: true,
      filial: { select: { nome: true } },
      fornecedor: { select: { razaoSocial: true } },
      tipoNaoConformidade: { select: { codigo: true, descricao: true } },
      severidade: { select: { nivel: true, nome: true } },
      criadoPor: { select: { nome: true, email: true } },
      aprovadores: {
        select: {
          areaNome: true,
          nome: true,
          cargo: true,
          email: true,
          whatsapp: true,
          assinadoEm: true,
          assinaturaIp: true,
          assinaturaNavegador: true,
          assinaturaSo: true,
          assinaturaDispositivo: true,
          assinaturaLatitude: true,
          assinaturaLongitude: true,
        },
        orderBy: { areaNome: 'asc' },
      },
    },
  })
  if (!rnc) return false
  if (rnc.assinaturasConcluidasEm) return false // já concluída/notificada
  if (rnc.aprovadores.length === 0) return false
  if (!rnc.aprovadores.every((a) => a.assinadoEm)) return false // ainda pendente

  // Marca a conclusão e encerra a RNC (evita reenvio mesmo se o e-mail falhar).
  await prisma.relatorioNaoConformidade.update({
    where: { id: rnc.id },
    data: { assinaturasConcluidasEm: new Date(), status: 'CLOSED' },
  })

  const transporte = await criarTransporteSmtp()
  if (!transporte) return true // concluída, mas sem SMTP para notificar

  const { subject, text, html } = montarEmailConclusao({
    baseUrl,
    numero: rnc.numero,
    docTipo: rnc.tipoDocumento,
    titulo: rnc.titulo ?? rnc.pauta,
    filialNome: rnc.filial?.nome ?? '',
    fornecedorNome: rnc.fornecedor?.razaoSocial ?? '',
    tipoNc: rnc.tipoNaoConformidade
      ? `${rnc.tipoNaoConformidade.codigo} — ${rnc.tipoNaoConformidade.descricao}`
      : '',
    severidade: rnc.severidade
      ? `Nível ${rnc.severidade.nivel} — ${rnc.severidade.nome}`
      : null,
    dataIdentificacao: rnc.dataIdentificacao,
    emitenteNome: rnc.criadoPor?.nome ?? null,
    assinaturas: rnc.aprovadores.map((a) => ({
      areaNome: a.areaNome,
      nome: a.nome,
      cargo: a.cargo,
      assinadoEm: a.assinadoEm,
      ip: a.assinaturaIp,
      navegador: a.assinaturaNavegador,
      so: a.assinaturaSo,
      dispositivo: a.assinaturaDispositivo,
      latitude: a.assinaturaLatitude,
      longitude: a.assinaturaLongitude,
    })),
  })

  // Destinatários: aprovadores + emitente, sem repetir e-mails.
  const destinatarios = new Set<string>()
  for (const a of rnc.aprovadores) if (a.email) destinatarios.add(a.email)
  if (rnc.criadoPor?.email) destinatarios.add(rnc.criadoPor.email)

  if (destinatarios.size > 0) {
    try {
      await transporte.transporter.sendMail({
        from: transporte.remetente,
        to: [...destinatarios].join(', '),
        subject,
        text,
        html,
      })
    } catch {
      // Falha no e-mail não desfaz a conclusão.
    }
  }

  // WhatsApp de conclusão aos aprovadores que têm número (best-effort).
  const wa = criarContextoWa()
  if (wa) {
    const dataConclusao = fmtPrazoData(new Date())
    const total = String(rnc.aprovadores.length)
    const enviadosWa = new Set<string>()
    for (const a of rnc.aprovadores) {
      if (!a.whatsapp || enviadosWa.has(a.whatsapp)) continue
      enviadosWa.add(a.whatsapp)
      await enviarTemplateWa(wa, a.whatsapp, 'concluida', {
        '1': a.nome,
        '2': rnc.numero,
        '3': dataConclusao,
        '4': total,
      })
    }
  }

  if (rnc.tipoDocumento !== 'RNC') {
    // RAQ e RVT: o fluxo termina aqui — o documento assinado vai por
    // e-mail ao contato do fornecedor, sem ciência nem resposta esperada.
    // Falha não desfaz a conclusão; fica no log e o painel oferece o
    // reenvio manual.
    try {
      const r = await enviarDocumentoAoFornecedor(prisma, rnc.id)
      if (!r.enviado && r.motivo !== 'Documento já enviado ao fornecedor') {
        console.warn(
          `SGNC ${rnc.tipoDocumento} ${rnc.numero}: envio ao fornecedor falhou — ${r.motivo}`,
        )
      }
    } catch (err) {
      console.warn(
        `SGNC ${rnc.tipoDocumento} ${rnc.numero}: envio ao fornecedor falhou.`,
        err,
      )
    }
    return true
  }

  // Com as assinaturas concluídas, a RNC segue para a ciência do
  // fornecedor (aceitar ou recusar/questionar, com prazo). Best-effort: a
  // conclusão da RNC não depende do sucesso deste envio.
  try {
    await enviarCienciaFornecedor(prisma, rnc.id, baseUrl)
  } catch {
    // ignora: a ciência pode ser reenviada depois
  }
  return true
}

/**
 * Etapa final do RAQ e do RVT: envia o documento assinado, em PDF anexo,
 * ao contato de e-mail do fornecedor e registra o envio. Idempotente.
 */
export async function enviarDocumentoAoFornecedor(
  prisma: PrismaClient,
  raqId: string,
): Promise<{ enviado: boolean; motivo?: string; email?: string }> {
  const raq = await prisma.relatorioNaoConformidade.findUnique({
    where: { id: raqId },
    select: {
      id: true,
      numero: true,
      tipoDocumento: true,
      titulo: true,
      pauta: true,
      conclusao: true,
      dataIdentificacao: true,
      descricaoDefeito: true,
      enviadoFornecedorEm: true,
      filial: { select: { nome: true } },
      severidade: { select: { nivel: true, nome: true } },
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
  if (!raq) return { enviado: false, motivo: 'Documento não encontrado' }
  if (raq.enviadoFornecedorEm) {
    return { enviado: false, motivo: 'Documento já enviado ao fornecedor' }
  }

  const contato = escolherEmailFornecedor(raq.fornecedor?.contatos ?? [])
  if (!contato) {
    return {
      enviado: false,
      motivo: `Fornecedor sem contato de e-mail cadastrado — o ${raq.tipoDocumento} não pôde ser enviado.`,
    }
  }

  const transporte = await criarTransporteSmtp()
  if (!transporte) return { enviado: false, motivo: 'SMTP não configurado' }

  // Reserva atômica: duas conclusões em corrida (última assinatura +
  // reenvio manual) não podem mandar o e-mail duas vezes. Quem gravar o
  // carimbo primeiro envia; se o envio falhar, o carimbo é desfeito.
  const claim = await prisma.relatorioNaoConformidade.updateMany({
    where: { id: raq.id, enviadoFornecedorEm: null },
    data: {
      enviadoFornecedorEm: new Date(),
      enviadoFornecedorPara: contato.email,
    },
  })
  if (claim.count === 0) {
    return { enviado: false, motivo: 'Documento já enviado ao fornecedor' }
  }

  const desfazerClaim = () =>
    prisma.relatorioNaoConformidade.updateMany({
      where: { id: raq.id },
      data: { enviadoFornecedorEm: null, enviadoFornecedorPara: null },
    })

  const pdf = await gerarPdfBuffer(raq.id)
  const { subject, text, html } =
    raq.tipoDocumento === 'RVT'
      ? montarEmailRvtFornecedor({
          numero: raq.numero,
          pauta: raq.pauta,
          filialNome: raq.filial?.nome ?? '',
          fornecedorNome: raq.fornecedor?.razaoSocial ?? '',
          contatoNome: contato.nome,
          dataVisita: raq.dataIdentificacao,
          conclusao: raq.conclusao,
        })
      : montarEmailRaqFornecedor({
          numero: raq.numero,
          titulo: raq.titulo,
          filialNome: raq.filial?.nome ?? '',
          fornecedorNome: raq.fornecedor?.razaoSocial ?? '',
          contatoNome: contato.nome,
          severidade: raq.severidade
            ? `Nível ${raq.severidade.nivel} — ${raq.severidade.nome}`
            : null,
          dataIdentificacao: raq.dataIdentificacao,
          descricaoDefeito: raq.descricaoDefeito,
        })

  try {
    await transporte.transporter.sendMail({
      from: transporte.remetente,
      to: contato.email,
      subject,
      text,
      html,
      attachments: pdf
        ? [
            {
              filename: `${raq.tipoDocumento}-${raq.numero}.pdf`,
              content: pdf,
              contentType: 'application/pdf',
            },
          ]
        : [],
    })
  } catch (err) {
    await desfazerClaim()
    return {
      enviado: false,
      motivo: err instanceof Error ? err.message : 'Falha no envio do e-mail',
    }
  }

  return { enviado: true, email: contato.email }
}
