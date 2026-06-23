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

    // 2) Escalonamento a 100% — uma vez por RNC.
    if (decorrido >= limiteEscalona && !rnc.escalonadoEm) {
      const candidatos = await candidatosPorArea(prisma, rnc.filialId, rnc.turnoId)
      const todos = await prisma.rncAprovador.findMany({
        where: { rncId: rnc.id },
        select: { areaId: true, aprovadorId: true, assinadoEm: true, nivel: true },
      })
      // Áreas com pendência (ninguém da área assinou ainda).
      const areasComPendencia = new Set(
        pendentes.map((p) => p.areaId).filter(Boolean) as string[],
      )
      const assinadasPorArea = new Map<string, boolean>()
      for (const t of todos) {
        if (!t.areaId) continue
        if (t.assinadoEm) assinadasPorArea.set(t.areaId, true)
      }
      const jaNaMatriz = new Set(todos.map((t) => t.aprovadorId).filter(Boolean))

      for (const areaId of areasComPendencia) {
        if (assinadasPorArea.get(areaId)) continue // alguém da área já assinou
        const lista = candidatos.get(areaId) ?? []
        // Níveis superiores ainda não incluídos na matriz.
        const novos = lista.filter((c) => !jaNaMatriz.has(c.aprovadorId))
        for (const c of novos) {
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
          if (r.ok) {
            out.escalonamentos++
            mexeu = true
          }
        }
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

/** Lembrete manual: envia a todos os aprovadores ainda pendentes da RNC. */
export async function enviarLembreteManual(
  prisma: PrismaClient,
  rncId: string,
): Promise<{ enviados: number; semSmtp: boolean; semPendentes: boolean }> {
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
    return { enviados: 0, semSmtp: false, semPendentes: true }

  const transporte = await criarTransporteSmtp()
  if (!transporte) return { enviados: 0, semSmtp: true, semPendentes: false }

  const horas = await horasRespostaRnc(prisma)
  let enviados = 0
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
    }
  }
  return { enviados, semSmtp: false, semPendentes: false }
}
