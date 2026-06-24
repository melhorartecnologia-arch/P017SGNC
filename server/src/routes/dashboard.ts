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

dashboardRouter.get('/rnc', async (_req, res, next) => {
  try {
    const [
      total,
      porFilialRaw,
      porTipoRaw,
      porFornecedorRaw,
      porProdutoRaw,
      porDisposicaoRaw,
      porOrigemRaw,
      porSeveridadeRaw,
    ] = await Promise.all([
      prisma.relatorioNaoConformidade.count(),
      prisma.relatorioNaoConformidade.groupBy({
        by: ['filialId'],
        _count: { _all: true },
      }),
      prisma.relatorioNaoConformidade.groupBy({
        by: ['tipoNaoConformidadeId'],
        _count: { _all: true },
      }),
      prisma.relatorioNaoConformidade.groupBy({
        by: ['fornecedorId'],
        _count: { _all: true },
        orderBy: { _count: { fornecedorId: 'desc' } },
        take: 5,
      }),
      prisma.relatorioNaoConformidade.groupBy({
        by: ['produtoId'],
        _count: { _all: true },
        where: { produtoId: { not: null } },
        orderBy: { _count: { produtoId: 'desc' } },
        take: 5,
      }),
      prisma.relatorioNaoConformidade.groupBy({
        by: ['disposicaoMaterialId'],
        _count: { _all: true },
      }),
      prisma.relatorioNaoConformidade.groupBy({
        by: ['origemId'],
        _count: { _all: true },
      }),
      prisma.relatorioNaoConformidade.groupBy({
        by: ['severidadeId'],
        _count: { _all: true },
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
          cor: s?.cor ?? '#a3a3a3',
          total: r._count._all,
        }
      })
      .sort((a, b) => b.total - a.total)

    const ordena = (arr: Contagem[]) =>
      [...arr].sort((a, b) => b.total - a.total)

    res.json({
      total,
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
    })
  } catch (err) {
    next(err)
  }
})
