import { Router } from 'express'
import { prisma } from '../db.js'

/**
 * Estatísticas agregadas das RNCs para o painel principal. Usa groupBy do
 * Prisma e enriquece com os rótulos das entidades relacionadas.
 */
export const dashboardRouter = Router()

type Contagem = { id: string | null; label: string; total: number }

async function porRelacao<T extends { _count: number }>(
  groupField: string,
  rows: { [k: string]: unknown; _count: { _all: number } }[],
  resolveLabels: (ids: string[]) => Promise<Map<string, string>>,
): Promise<Contagem[]> {
  const ids = rows
    .map((r) => r[groupField] as string | null)
    .filter((v): v is string => !!v)
  const labels = await resolveLabels(ids)
  return rows.map((r) => {
    const id = (r[groupField] as string | null) ?? null
    return {
      id,
      label: id ? (labels.get(id) ?? '—') : 'Não informado',
      total: r._count._all,
    }
  })
}

/** Igual a porRelacao, mas somando um campo numérico (ex.: minutos de parada). */
async function porRelacaoSoma(
  groupField: string,
  somaField: string,
  rows: { [k: string]: unknown }[],
  resolveLabels: (ids: string[]) => Promise<Map<string, string>>,
): Promise<Contagem[]> {
  const ids = rows
    .map((r) => r[groupField] as string | null)
    .filter((v): v is string => !!v)
  const labels = await resolveLabels(ids)
  return rows.map((r) => {
    const id = (r[groupField] as string | null) ?? null
    const soma = (r._sum as Record<string, number | null>)?.[somaField] ?? 0
    return {
      id,
      label: id ? (labels.get(id) ?? '—') : 'Não informado',
      total: soma ?? 0,
    }
  })
}

dashboardRouter.get('/rnc', async (req, res, next) => {
  try {
    // Filtro de período por data de identificação.
    const de = typeof req.query.de === 'string' ? new Date(req.query.de) : null
    const ate = typeof req.query.ate === 'string' ? new Date(req.query.ate) : null
    // Só RNCs: os RAQs compartilham a tabela, mas não entram no painel.
    const wP: {
      tipoDocumento: 'RNC'
      dataIdentificacao?: { gte?: Date; lt?: Date }
    } = { tipoDocumento: 'RNC' }
    if ((de && !isNaN(de.getTime())) || (ate && !isNaN(ate.getTime()))) {
      wP.dataIdentificacao = {}
      if (de && !isNaN(de.getTime())) wP.dataIdentificacao.gte = de
      if (ate && !isNaN(ate.getTime())) wP.dataIdentificacao.lt = ate
    }

    // Filtro de paradas: RNCs com tempo de parada informado (> 0).
    const wParada = { tempoParadaMinutos: { gt: 0 }, ...wP }

    const [
      total,
      porStatusRaw,
      porFilialRaw,
      porTipoRaw,
      porFornecedorRaw,
      porProdutoRaw,
      porDisposicaoRaw,
      porOrigemRaw,
      porSeveridadeRaw,
      paradaAgg,
      paradaFilialRaw,
      paradaTipoRaw,
      paradaFornecedorRaw,
    ] = await Promise.all([
      prisma.relatorioNaoConformidade.count({ where: wP }),
      prisma.relatorioNaoConformidade.groupBy({
        by: ['status'],
        _count: { _all: true },
        where: wP,
      }),
      prisma.relatorioNaoConformidade.groupBy({
        by: ['filialId'],
        _count: { _all: true },
        where: wP,
      }),
      prisma.relatorioNaoConformidade.groupBy({
        by: ['tipoNaoConformidadeId'],
        _count: { _all: true },
        where: wP,
      }),
      prisma.relatorioNaoConformidade.groupBy({
        by: ['fornecedorId'],
        _count: { _all: true },
        where: wP,
        orderBy: { _count: { fornecedorId: 'desc' } },
        take: 5,
      }),
      prisma.relatorioNaoConformidade.groupBy({
        by: ['produtoId'],
        _count: { _all: true },
        where: { produtoId: { not: null }, ...wP },
        orderBy: { _count: { produtoId: 'desc' } },
        take: 5,
      }),
      prisma.relatorioNaoConformidade.groupBy({
        by: ['disposicaoMaterialId'],
        _count: { _all: true },
        where: wP,
      }),
      prisma.relatorioNaoConformidade.groupBy({
        by: ['origemId'],
        _count: { _all: true },
        where: wP,
      }),
      prisma.relatorioNaoConformidade.groupBy({
        by: ['severidadeId'],
        _count: { _all: true },
        where: wP,
      }),
      // ── Horas de parada ──────────────────────────────────────────
      prisma.relatorioNaoConformidade.aggregate({
        _sum: { tempoParadaMinutos: true },
        _count: { tempoParadaMinutos: true },
        where: wParada,
      }),
      prisma.relatorioNaoConformidade.groupBy({
        by: ['filialId'],
        _sum: { tempoParadaMinutos: true },
        where: wParada,
      }),
      prisma.relatorioNaoConformidade.groupBy({
        by: ['tipoNaoConformidadeId'],
        _sum: { tempoParadaMinutos: true },
        where: wParada,
      }),
      prisma.relatorioNaoConformidade.groupBy({
        by: ['fornecedorId'],
        _sum: { tempoParadaMinutos: true },
        where: wParada,
        orderBy: { _sum: { tempoParadaMinutos: 'desc' } },
        take: 5,
      }),
    ])

    const labelFilial = async (ids: string[]) => {
      const rows = await prisma.filial.findMany({
        where: { id: { in: ids } },
        select: { id: true, codigo: true, nome: true },
      })
      return new Map(rows.map((f) => [f.id, `${f.codigo} — ${f.nome}`]))
    }
    const labelTipo = async (ids: string[]) => {
      const rows = await prisma.tipoNaoConformidade.findMany({
        where: { id: { in: ids } },
        select: { id: true, codigo: true, descricao: true },
      })
      return new Map(rows.map((t) => [t.id, `${t.codigo} — ${t.descricao}`]))
    }
    const labelFornecedor = async (ids: string[]) => {
      const rows = await prisma.fornecedor.findMany({
        where: { id: { in: ids } },
        select: { id: true, codigo: true, razaoSocial: true },
      })
      return new Map(rows.map((f) => [f.id, `${f.codigo} — ${f.razaoSocial}`]))
    }
    const labelProduto = async (ids: string[]) => {
      const rows = await prisma.produto.findMany({
        where: { id: { in: ids } },
        select: { id: true, codigo: true, descricao: true },
      })
      return new Map(rows.map((p) => [p.id, `${p.codigo} — ${p.descricao}`]))
    }
    const labelDisposicao = async (ids: string[]) => {
      const rows = await prisma.disposicaoMaterial.findMany({
        where: { id: { in: ids } },
        select: { id: true, codigo: true, descricao: true },
      })
      return new Map(rows.map((d) => [d.id, `${d.codigo} — ${d.descricao}`]))
    }
    const labelOrigem = async (ids: string[]) => {
      const rows = await prisma.origemNaoConformidade.findMany({
        where: { id: { in: ids } },
        select: { id: true, codigo: true, nome: true },
      })
      return new Map(rows.map((o) => [o.id, `${o.codigo} — ${o.nome}`]))
    }
    const labelSeveridade = async (ids: string[]) => {
      const rows = await prisma.severidade.findMany({
        where: { id: { in: ids } },
        select: { id: true, codigo: true, nome: true, nivel: true, cor: true },
      })
      return new Map(rows.map((s) => [s.id, s]))
    }

    // Severidade carrega cor/nivel para o gráfico de rosca.
    const sevIds = porSeveridadeRaw
      .map((r) => r.severidadeId)
      .filter((v): v is string => !!v)
    const sevMap = await labelSeveridade(sevIds)
    const porSeveridade = porSeveridadeRaw
      .map((r) => {
        const s = r.severidadeId ? sevMap.get(r.severidadeId) : null
        return {
          id: r.severidadeId,
          label: s ? `Nível ${s.nivel} — ${s.nome}` : 'Não informada',
          nivel: s?.nivel ?? null,
          cor: s?.cor ?? '#a3a3a3',
          total: r._count._all,
        }
      })
      .sort((a, b) => (a.nivel ?? 99) - (b.nivel ?? 99))

    const porStatus = porStatusRaw.map((r) => ({
      status: r.status as string,
      total: r._count._all,
    }))

    // ── Evolução mensal (últimos 12 meses) ────────────────────────
    const mesesRaw = await prisma.$queryRaw<{ mes: Date; total: number }[]>`
      SELECT date_trunc('month', "data_identificacao") AS mes, count(*)::int AS total
      FROM "relatorios_nao_conformidade"
      WHERE "tipo_documento" = 'RNC'
        AND "data_identificacao" >= (date_trunc('month', now()) - interval '11 months')
      GROUP BY mes ORDER BY mes
    `
    const mapMes = new Map(
      mesesRaw.map((r) => [new Date(r.mes).toISOString().slice(0, 7), Number(r.total)]),
    )
    const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const agoraM = new Date()
    const porMes: { label: string; total: number; ano: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(agoraM.getFullYear(), agoraM.getMonth() - i, 1)
      const chave = d.toISOString().slice(0, 7)
      porMes.push({ label: MESES_PT[d.getMonth()], ano: d.getFullYear(), total: mapMes.get(chave) ?? 0 })
    }

    // ── Atividade diária (últimos 30 dias) ────────────────────────
    const diasRaw = await prisma.$queryRaw<{ dia: Date; total: number }[]>`
      SELECT date_trunc('day', "data_identificacao") AS dia, count(*)::int AS total
      FROM "relatorios_nao_conformidade"
      WHERE "tipo_documento" = 'RNC'
        AND "data_identificacao" >= (date_trunc('day', now()) - interval '29 days')
      GROUP BY dia ORDER BY dia
    `
    const mapDia = new Map(
      diasRaw.map((r) => [new Date(r.dia).toISOString().slice(0, 10), Number(r.total)]),
    )
    const porDia: { label: string; total: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const chave = d.toISOString().slice(0, 10)
      porDia.push({ label: chave, total: mapDia.get(chave) ?? 0 })
    }

    // ── Comparação com o período anterior (quando há "de") ────────
    let anterior: { total: number; abertas: number; encerradas: number } | null = null
    if (de && !isNaN(de.getTime())) {
      const fim = ate && !isNaN(ate.getTime()) ? ate : new Date()
      const dur = fim.getTime() - de.getTime()
      const prevDe = new Date(de.getTime() - dur)
      const wPrev = {
        tipoDocumento: 'RNC' as const,
        dataIdentificacao: { gte: prevDe, lt: de },
      }
      const prevStatus = await prisma.relatorioNaoConformidade.groupBy({
        by: ['status'],
        _count: { _all: true },
        where: wPrev,
      })
      const pm = new Map(prevStatus.map((s) => [s.status as string, s._count._all]))
      anterior = {
        total: prevStatus.reduce((a, s) => a + s._count._all, 0),
        abertas: (pm.get('OPEN') ?? 0) + (pm.get('IN_PROGRESS') ?? 0),
        encerradas: pm.get('CLOSED') ?? 0,
      }
    }

    const ordena = (arr: Contagem[]) =>
      [...arr].sort((a, b) => b.total - a.total)

    // ── Horas de parada (agregações) ──────────────────────────────
    const paradaTotalMinutos = paradaAgg._sum.tempoParadaMinutos ?? 0
    const paradaRncs = paradaAgg._count.tempoParadaMinutos ?? 0
    const paradaPorFilial = ordena(
      await porRelacaoSoma('filialId', 'tempoParadaMinutos', paradaFilialRaw, labelFilial),
    )
    const paradaPorTipo = ordena(
      await porRelacaoSoma('tipoNaoConformidadeId', 'tempoParadaMinutos', paradaTipoRaw, labelTipo),
    )
    const paradaTopFornecedores = await porRelacaoSoma(
      'fornecedorId',
      'tempoParadaMinutos',
      paradaFornecedorRaw,
      labelFornecedor,
    )

    res.json({
      total,
      porStatus,
      porFilial: ordena(
        await porRelacao('filialId', porFilialRaw, labelFilial),
      ),
      porTipo: ordena(await porRelacao('tipoNaoConformidadeId', porTipoRaw, labelTipo)),
      topFornecedores: await porRelacao(
        'fornecedorId',
        porFornecedorRaw,
        labelFornecedor,
      ),
      topProdutos: await porRelacao('produtoId', porProdutoRaw, labelProduto),
      porDisposicao: ordena(
        await porRelacao('disposicaoMaterialId', porDisposicaoRaw, labelDisposicao),
      ),
      porOrigem: ordena(
        await porRelacao('origemId', porOrigemRaw, labelOrigem),
      ),
      porSeveridade,
      porMes,
      porDia,
      anterior,
      paradaTotalMinutos,
      paradaRncs,
      paradaPorFilial,
      paradaPorTipo,
      paradaTopFornecedores,
    })
  } catch (err) {
    next(err)
  }
})
