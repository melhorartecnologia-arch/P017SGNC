import * as React from 'react'
import {
  Loader2,
  FileWarning,
  Truck,
  Package,
  AlertTriangle,
  X,
  ChevronRight,
  Search as SearchIcon,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api/client'
import {
  dashboardApi,
  type Contagem,
  type DashboardRnc,
} from '@/lib/api/dashboard'
import { rncApi, type Rnc, type RncStatus } from '@/lib/api/rnc'
import { RncDetailPanel } from '@/components/registros/RncDetailPanel'

// Paleta sóbria (slate) — escala de cinza/ardósia + um acento discreto.
const ACENTO = '#4f46e5'
const SLATE = ['#1e293b', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1']

/** Ramp de n tons (escuro→claro) para hierarquia sutil nas barras. */
function ramp(n: number): string[] {
  if (n <= 1) return [SLATE[1]]
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1)
    const idx = Math.min(SLATE.length - 1, Math.round(t * (SLATE.length - 1)))
    return SLATE[idx]
  })
}

const STATUS_LABEL: Record<RncStatus, string> = {
  DRAFT: 'Rascunho',
  OPEN: 'Aberta',
  IN_PROGRESS: 'Em andamento',
  CLOSED: 'Encerrada',
  CANCELLED: 'Cancelada',
}
const STATUS_DOT: Record<RncStatus, string> = {
  DRAFT: 'bg-neutral-400',
  OPEN: 'bg-amber-500',
  IN_PROGRESS: 'bg-sky-500',
  CLOSED: 'bg-emerald-500',
  CANCELLED: 'bg-red-500',
}

function curto(s: string, max = 22): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}
function fmtDataBR(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** Dimensão de drill-down → nome do parâmetro de filtro da lista de RNC. */
type Dim =
  | 'filialId'
  | 'tipoNaoConformidadeId'
  | 'fornecedorId'
  | 'produtoId'
  | 'disposicaoMaterialId'
  | 'origemId'
  | 'severidadeId'

type Filtro = { dim: Dim; id: string | null; titulo: string; label: string }

export function DashboardPage() {
  const [data, setData] = React.useState<DashboardRnc | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [filtro, setFiltro] = React.useState<Filtro | null>(null)
  const [viewing, setViewing] = React.useState<Rnc | null>(null)

  React.useEffect(() => {
    let cancelled = false
    dashboardApi
      .rnc()
      .then((d) => !cancelled && setData(d))
      .catch((err) => {
        if (cancelled) return
        setError(
          err instanceof ApiError ? err.message : 'Não foi possível carregar o painel.',
        )
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-300" />
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error ?? 'Sem dados.'}
        </div>
      </div>
    )
  }

  const total = data.total
  const statusMap = new Map(data.porStatus.map((s) => [s.status, s.total]))
  const abertas = (statusMap.get('OPEN') ?? 0) + (statusMap.get('IN_PROGRESS') ?? 0)
  const encerradas = statusMap.get('CLOSED') ?? 0
  const criticas = data.porSeveridade
    .filter((s) => (s.nivel ?? 0) >= 3)
    .reduce((a, s) => a + s.total, 0)
  const topForn = data.topFornecedores[0]
  const sevPredominante = [...data.porSeveridade].sort((a, b) => b.total - a.total)[0]
  const pctEncerradas = total ? Math.round((encerradas / total) * 100) : 0

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      {/* Storytelling — título + síntese */}
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold tracking-tight text-neutral-900">
          Painel de Não Conformidades
        </h1>
        {total > 0 ? (
          <p className="max-w-3xl text-sm leading-relaxed text-neutral-500">
            <b className="text-neutral-700">{total}</b> RNCs registradas —{' '}
            <b className="text-neutral-700">{pctEncerradas}%</b> já encerradas e{' '}
            <b className="text-neutral-700">{abertas}</b> em andamento.
            {topForn && (
              <>
                {' '}Maior incidência no fornecedor{' '}
                <b className="text-neutral-700">{topForn.label.split(' — ')[1] ?? topForn.label}</b>.
              </>
            )}
            {sevPredominante && (
              <>
                {' '}Severidade predominante:{' '}
                <b className="text-neutral-700">
                  {sevPredominante.label.replace('Nível ', 'Nv ')}
                </b>
                .
              </>
            )}{' '}
            <span className="text-neutral-400">
              Clique em qualquer gráfico para explorar até a RNC.
            </span>
          </p>
        ) : (
          <p className="text-sm text-neutral-500">
            Ainda não há RNCs cadastradas — os indicadores aparecem conforme os
            registros forem criados.
          </p>
        )}
      </header>

      {/* KPIs compactos */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={FileWarning} label="Total de RNCs" valor={total} destaque />
        <Kpi icon={ChevronRight} label="Em andamento" valor={abertas} />
        <Kpi icon={AlertTriangle} label="Alta/crítica" valor={criticas} />
        <Kpi icon={Truck} label="Fornecedores" valor={data.topFornecedores.length} />
      </div>

      {/* Distribuição */}
      <Secao titulo="Distribuição">
        <Painel titulo="Por filial">
          <Barras dados={data.porFilial} onPick={(d) => setFiltro(filtroDe('filialId', 'filial', d))} />
        </Painel>
        <Painel titulo="Por tipo de não conformidade">
          <Barras dados={data.porTipo} onPick={(d) => setFiltro(filtroDe('tipoNaoConformidadeId', 'tipo de NC', d))} />
        </Painel>
      </Secao>

      {/* Responsáveis & itens */}
      <Secao titulo="Responsáveis & itens">
        <Painel titulo="Top 5 fornecedores" icon={Truck}>
          <Barras dados={data.topFornecedores} onPick={(d) => setFiltro(filtroDe('fornecedorId', 'fornecedor', d))} />
        </Painel>
        <Painel titulo="Top 5 produtos" icon={Package}>
          <Barras dados={data.topProdutos} onPick={(d) => setFiltro(filtroDe('produtoId', 'produto', d))} />
        </Painel>
      </Secao>

      {/* Natureza */}
      <Secao titulo="Natureza da não conformidade" cols={3}>
        <Painel titulo="Por disposição">
          <Colunas dados={data.porDisposicao} onPick={(d) => setFiltro(filtroDe('disposicaoMaterialId', 'disposição', d))} />
        </Painel>
        <Painel titulo="Por origem">
          <Colunas dados={data.porOrigem} onPick={(d) => setFiltro(filtroDe('origemId', 'origem', d))} />
        </Painel>
        <Painel titulo="Por severidade">
          <Rosca
            dados={data.porSeveridade}
            onPick={(d) => setFiltro(filtroDe('severidadeId', 'severidade', d))}
          />
        </Painel>
      </Secao>

      {filtro && (
        <DrillModal
          filtro={filtro}
          onClose={() => setFiltro(null)}
          onOpenRnc={(r) => setViewing(r)}
        />
      )}

      <RncDetailPanel
        rnc={viewing}
        onClose={() => setViewing(null)}
        onUpdated={(u) => setViewing((p) => (p?.id === u.id ? u : p))}
      />
    </div>
  )
}

function filtroDe(dim: Dim, nome: string, d: Contagem): Filtro {
  return { dim, id: d.id, titulo: `${nome}: ${d.label}`, label: d.label }
}

function Kpi({
  icon: Icon,
  label,
  valor,
  destaque,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  valor: number
  destaque?: boolean
}) {
  return (
    <Card className="flex items-center gap-3 rounded-xl border-neutral-200/80 bg-white p-3.5 shadow-sm">
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          destaque ? 'text-white' : 'bg-neutral-100 text-neutral-600',
        )}
        style={destaque ? { backgroundColor: ACENTO } : undefined}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="text-xl font-semibold tracking-tight text-neutral-900 tabular-nums">
          {valor.toLocaleString('pt-BR')}
        </span>
        <span className="truncate text-[11px] uppercase tracking-wide text-neutral-400">
          {label}
        </span>
      </div>
    </Card>
  )
}

function Secao({
  titulo,
  cols = 2,
  children,
}: {
  titulo: string
  cols?: 2 | 3
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
          {titulo}
        </span>
        <div className="h-px flex-1 bg-neutral-100" />
      </div>
      <div
        className={cn(
          'grid grid-cols-1 gap-3',
          cols === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2',
        )}
      >
        {children}
      </div>
    </section>
  )
}

function Painel({
  titulo,
  icon: Icon,
  children,
}: {
  titulo: string
  icon?: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <Card className="flex flex-col gap-2 rounded-xl border-neutral-200/80 bg-white p-3.5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-neutral-400" />}
        <h2 className="text-[13px] font-semibold text-neutral-800">{titulo}</h2>
      </div>
      {children}
    </Card>
  )
}

function SemDados({ altura = 200 }: { altura?: number }) {
  return (
    <div
      className="flex items-center justify-center text-xs text-neutral-300"
      style={{ height: altura }}
    >
      Sem dados
    </div>
  )
}

const tooltipStyle = {
  fontSize: 12,
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
  padding: '6px 10px',
}

/** Barras horizontais clicáveis (rótulos longos). */
function Barras({
  dados,
  onPick,
}: {
  dados: Contagem[]
  onPick: (d: Contagem) => void
}) {
  const [hover, setHover] = React.useState<number | null>(null)
  if (dados.length === 0) return <SemDados />
  const cores = ramp(dados.length)
  const altura = Math.max(180, dados.length * 34 + 24)
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart data={dados} layout="vertical" margin={{ top: 2, right: 28, bottom: 2, left: 4 }}>
        <CartesianGrid horizontal={false} stroke="#f3f4f6" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={150}
          tick={{ fontSize: 10.5, fill: '#475569' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: string) => curto(v)}
        />
        <Tooltip
          cursor={{ fill: '#f8fafc' }}
          formatter={(value) => [`${value} RNCs`, '']}
          contentStyle={tooltipStyle}
          labelStyle={{ fontSize: 11, color: '#64748b' }}
        />
        <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={18}>
          {dados.map((d, i) => (
            <Cell
              key={i}
              cursor="pointer"
              fill={hover === i ? ACENTO : cores[i]}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onPick(d)}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Colunas verticais clicáveis. */
function Colunas({
  dados,
  onPick,
}: {
  dados: Contagem[]
  onPick: (d: Contagem) => void
}) {
  const [hover, setHover] = React.useState<number | null>(null)
  if (dados.length === 0) return <SemDados />
  const cores = ramp(dados.length)
  return (
    <ResponsiveContainer width="100%" height={232}>
      <BarChart data={dados} margin={{ top: 6, right: 8, bottom: 44, left: -16 }}>
        <CartesianGrid vertical={false} stroke="#f3f4f6" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#64748b' }}
          interval={0}
          angle={-22}
          textAnchor="end"
          height={56}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: string) => curto(v, 14)}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: '#f8fafc' }}
          formatter={(value) => [`${value} RNCs`, '']}
          contentStyle={tooltipStyle}
          labelStyle={{ fontSize: 11, color: '#64748b' }}
        />
        <Bar dataKey="total" radius={[4, 4, 0, 0]} barSize={26}>
          {dados.map((d, i) => (
            <Cell
              key={i}
              cursor="pointer"
              fill={hover === i ? ACENTO : cores[i]}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onPick(d)}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Rosca de severidade — escala monocromática por nível. */
function Rosca({
  dados,
  onPick,
}: {
  dados: { id: string | null; label: string; nivel: number | null; total: number }[]
  onPick: (d: Contagem) => void
}) {
  if (dados.length === 0) return <SemDados altura={232} />
  // Tom mais escuro = maior severidade.
  const tons = ['#cbd5e1', '#94a3b8', '#64748b', '#334155', '#0f172a']
  const cor = (nivel: number | null, i: number) =>
    nivel ? tons[Math.min(tons.length - 1, nivel - 1)] : SLATE[i % SLATE.length]
  return (
    <div className="flex flex-col gap-2">
      <ResponsiveContainer width="100%" height={170}>
        <PieChart>
          <Pie
            data={dados}
            dataKey="total"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={72}
            paddingAngle={2}
            stroke="#fff"
            strokeWidth={1.5}
          >
            {dados.map((d, i) => (
              <Cell key={i} cursor="pointer" fill={cor(d.nivel, i)} onClick={() => onPick(d)} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => [`${value} RNCs`, '']} contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-1">
        {dados.map((d, i) => (
          <button
            key={i}
            onClick={() => onPick(d)}
            className="flex items-center justify-between gap-2 rounded-md px-1.5 py-0.5 text-[11px] text-neutral-600 transition-colors hover:bg-neutral-50"
          >
            <span className="flex items-center gap-1.5 truncate">
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: cor(d.nivel, i) }} />
              {d.label.replace('Nível ', 'Nv ')}
            </span>
            <span className="tabular-nums text-neutral-500">{d.total}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Drill-down modal ────────────────────────────────────────────────
function DrillModal({
  filtro,
  onClose,
  onOpenRnc,
}: {
  filtro: Filtro
  onClose: () => void
  onOpenRnc: (r: Rnc) => void
}) {
  const [items, setItems] = React.useState<Rnc[] | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)
  const [statusSel, setStatusSel] = React.useState<RncStatus | null>(null)

  React.useEffect(() => {
    let cancelled = false
    // Reset ao trocar de filtro (mostra o loading enquanto recarrega).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(null)
    setErro(null)
    rncApi
      .list({ [filtro.dim]: filtro.id ?? '__none__', pageSize: 100 })
      .then((res) => !cancelled && setItems(res.items))
      .catch((err) => {
        if (cancelled) return
        setErro(err instanceof ApiError ? err.message : 'Falha ao carregar.')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro.dim, filtro.id])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const statusCounts = React.useMemo(() => {
    const m = new Map<RncStatus, number>()
    for (const r of items ?? []) m.set(r.status, (m.get(r.status) ?? 0) + 1)
    return m
  }, [items])

  const visiveis = (items ?? []).filter((r) => !statusSel || r.status === statusSel)

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-neutral-950/40 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-3.5">
          <div className="flex min-w-0 flex-col">
            <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
              Detalhamento
            </span>
            <h3 className="truncate text-sm font-semibold text-neutral-900">
              {filtro.titulo}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Sub-drill por status (chips) */}
        {items && items.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-neutral-100 px-5 py-2.5">
            <Chip ativo={statusSel === null} onClick={() => setStatusSel(null)}>
              Todas <span className="tabular-nums opacity-60">{items.length}</span>
            </Chip>
            {(Object.keys(STATUS_LABEL) as RncStatus[])
              .filter((s) => statusCounts.get(s))
              .map((s) => (
                <Chip key={s} ativo={statusSel === s} onClick={() => setStatusSel(s)}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[s])} />
                  {STATUS_LABEL[s]}{' '}
                  <span className="tabular-nums opacity-60">{statusCounts.get(s)}</span>
                </Chip>
              ))}
          </div>
        )}

        <div className="min-h-[200px] flex-1 overflow-y-auto">
          {erro && (
            <div className="m-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {erro}
            </div>
          )}
          {!items && !erro && (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-neutral-300" />
            </div>
          )}
          {items && visiveis.length === 0 && !erro && (
            <div className="flex h-40 flex-col items-center justify-center gap-1 text-sm text-neutral-400">
              <SearchIcon className="h-5 w-5" />
              Nenhuma RNC neste recorte.
            </div>
          )}
          {visiveis.length > 0 && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-neutral-100 text-[11px] uppercase tracking-wide text-neutral-400">
                  <th className="px-5 py-2 text-left font-medium">Nº</th>
                  <th className="px-2 py-2 text-left font-medium">Data</th>
                  <th className="px-2 py-2 text-left font-medium">Fornecedor</th>
                  <th className="px-2 py-2 text-left font-medium">Tipo</th>
                  <th className="px-2 py-2 text-center font-medium">Severidade</th>
                  <th className="px-5 py-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => onOpenRnc(r)}
                    className="cursor-pointer border-b border-neutral-50 transition-colors last:border-0 hover:bg-neutral-50"
                  >
                    <td className="px-5 py-2 font-mono text-[12px] font-medium text-neutral-900">
                      #{r.numero}
                    </td>
                    <td className="px-2 py-2 text-neutral-600">
                      {fmtDataBR(r.dataIdentificacao)}
                    </td>
                    <td className="px-2 py-2 text-neutral-700">
                      {r.fornecedor.codigo}
                    </td>
                    <td className="px-2 py-2 text-neutral-700">
                      {r.tipoNaoConformidade.codigo}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {r.severidade ? (
                        <span className="inline-flex items-center gap-1 text-[12px] text-neutral-600">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: r.severidade.cor ?? '#a3a3a3' }}
                          />
                          {r.severidade.nivel}
                        </span>
                      ) : (
                        <span className="text-neutral-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-2 text-right">
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-neutral-600">
                        <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[r.status])} />
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <footer className="border-t border-neutral-100 px-5 py-2 text-[11px] text-neutral-400">
          Clique em uma RNC para ver o detalhe completo.
        </footer>
      </div>
    </div>
  )
}

function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
        ativo
          ? 'border-neutral-900 bg-neutral-900 text-white'
          : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50',
      )}
    >
      {children}
    </button>
  )
}
