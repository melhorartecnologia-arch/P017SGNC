import { randomBytes, randomInt } from 'node:crypto'
import type { Prisma, PrismaClient } from '@prisma/client'
import { criarTransporteSmtp, type Transporte } from './smtp.js'
import { montarEmailAssinatura } from './rnc-email.js'
import { candidatosPorArea } from './rnc-aprovadores.js'

type Db = Prisma.TransactionClient | PrismaClient

const rncInfoSelect = {
  id: true,
  numero: true,
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
  tokenAssinatura: string | null
  senhaAssinatura: string | null
}

/** Horas de resposta (SLA) da Política de Resposta do tipo "RNC". */
export async function horasRespostaRnc(db: Db): Promise<number | null> {
  const politica = await db.politicaResposta.findFirst({
    where: {
      ativo: true,
      tipoRelatorio: { codigo: { equals: 'RNC', mode: 'insensitive' } },
    },
    select: { horasResposta: true },
  })
  return politica?.horasResposta ?? null
}

function fmtHoras(horas: number): string {
  return horas % 1 === 0 ? `${horas}h` : `${horas.toFixed(1)}h`
}

/** Envia o e-mail de workflow a um aprovador, gerando token/senha se faltar. */
export async function enviarWorkflowAprovador(
  db: Db,
  transporte: Transporte,
  rnc: RncInfo,
  ap: AprovadorRow,
  tipo: 'solicitacao' | 'lembrete' | 'escalonamento',
  prazoTexto?: string | null,
): Promise<{ ok: boolean; erro?: string }> {
  if (!ap.email) return { ok: false, erro: 'sem e-mail' }
  const token = ap.tokenAssinatura ?? randomBytes(24).toString('hex')
  const senha =
    ap.senhaAssinatura ?? String(randomInt(0, 1_000_000)).padStart(6, '0')
  if (!ap.tokenAssinatura || !ap.senhaAssinatura) {
    await db.rncAprovador.update({
      where: { id: ap.id },
      data: { tokenAssinatura: token, senhaAssinatura: senha },
    })
  }

  const { subject, text, html } = montarEmailAssinatura({
    numero: rnc.numero,
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
  })

  try {
    await transporte.transporter.sendMail({
      from: transporte.remetente,
      to: ap.email,
      subject,
      text,
      html,
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : 'erro' }
  }
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
  rnc: RncInfo,
  modo: 'todos' | 'proximo',
): Promise<{ novos: number; falhas: string[]; havendoCandidatos: boolean }> {
  const candidatos = await candidatosPorArea(prisma, rnc.filialId, rnc.turnoId)
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
          nivel: c.nivel,
          viaEscalonamento: true,
        },
        select: {
          id: true,
          nome: true,
          areaNome: true,
          email: true,
          tokenAssinatura: true,
          senhaAssinatura: true,
        },
      })
      const r = await enviarWorkflowAprovador(
        prisma,
        transporte,
        rnc,
        criado,
        'escalonamento',
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

  const horas = await horasRespostaRnc(prisma)
  if (!horas || horas <= 0) return out // Sem SLA configurado.

  const transporte = await criarTransporteSmtp()
  if (!transporte) return out // SMTP não configurado.

  const agora = Date.now()
  const limiteLembrete = horas * 0.5 * 3600_000
  const limiteEscalona = horas * 3600_000

  // RNCs já enviadas e ainda em aberto (não encerradas/canceladas).
  const rncs = await prisma.relatorioNaoConformidade.findMany({
    where: {
      assinaturaEnviadaEm: { not: null },
      status: { in: ['OPEN', 'IN_PROGRESS'] },
    },
    select: { ...rncInfoSelect, assinaturaEnviadaEm: true },
  })

  for (const rnc of rncs) {
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
        if (ap.lembreteEnviadoEm || !ap.email) continue
        const r = await enviarWorkflowAprovador(
          prisma,
          transporte,
          rnc,
          ap,
          'lembrete',
          fmtHoras(horas),
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
      const { novos } = await escalonarRncInterno(prisma, transporte, rnc, 'todos')
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

  const { novos, falhas, havendoCandidatos } = await escalonarRncInterno(
    prisma,
    transporte,
    rnc,
    'proximo',
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
): Promise<ResultadoLembreteManual> {
  const rnc = await prisma.relatorioNaoConformidade.findUnique({
    where: { id: rncId },
    select: rncInfoSelect,
  })
  if (!rnc) throw new Error('RNC não encontrada')

  const pendentes = await prisma.rncAprovador.findMany({
    where: { rncId, assinadoEm: null, email: { not: null } },
    select: {
      id: true,
      nome: true,
      areaNome: true,
      email: true,
      tokenAssinatura: true,
      senhaAssinatura: true,
    },
  })
  if (pendentes.length === 0)
    return { enviados: 0, falhas: [], semSmtp: false, semPendentes: true }

  const transporte = await criarTransporteSmtp()
  if (!transporte)
    return { enviados: 0, falhas: [], semSmtp: true, semPendentes: false }

  const horas = await horasRespostaRnc(prisma)
  let enviados = 0
  const falhas: string[] = []
  for (const ap of pendentes) {
    const r = await enviarWorkflowAprovador(
      prisma,
      transporte,
      rnc,
      ap,
      'lembrete',
      horas ? fmtHoras(horas) : null,
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
