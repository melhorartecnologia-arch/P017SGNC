import * as React from 'react'
import {
  Loader2,
  FileWarning,
  Truck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  Search as SearchIcon,
  TrendingUp,
  TrendingDown,
  Activity,
  ArrowUpRight,
  ChevronDown,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api/client'
import {
  dashboardApi,
  type Contagem,
  type ContagemMes,
  type ContagemDia,
  type DashboardRnc,
} from '@/lib/api/dashboard'
import { rncApi, type Rnc, type RncListParams, type RncStatus } from '@/lib/api/rnc'
import { RncDetailPanel } from '@/components/registros/RncDetailPanel'

// Paleta sóbria (slate) com um único acento — inspirada em painéis fintech:
// barras "fantasma" + uma barra de destaque em acento, rótulos sempre visíveis.
const ACENTO = '#4f46e5'
const FANTASMA = '#e8edf3'
const SLATE = ['#1e293b', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1']

// Índice da barra de destaque (maior volume). -1 quando tudo é zero.
function indiceDestaque(dados: { total: number }[]): number {
  let idx = -1
  let max = 0
  dados.forEach((d, i) => {
    if (d.total > max) {
      max = d.total
      idx = i
    }
  })
  return idx
}

// Rótulo de coluna vertical: balão escuro no destaque, número discreto nos demais.
function rotuloColuna(destaque: number) {
  return function Rotulo(props: {
    x?: number
    y?: number
    width?: number
    value?: number
    index?: number
  }) {
    const { x = 0, y = 0, width = 0, value = 0, index } = props
    const cx = x + width / 2
    if (index === destaque) {
      const w = Math.max(34, String(value).length * 9 + 18)
      return (
        <g>
          <rect x={cx - w / 2} y={y - 28} width={w} height={19} rx={6} fill="#0f172a" />
          <text
            x={cx}
            y={y - 14.5}
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            fill="#fff"
          >
            {value}
          </text>
        </g>
      )
    }
    if (!value) return null
    return (
      <text x={cx} y={y - 5} textAnchor="middle" fontSize={10} fontWeight={600} fill="#94a3b8">
        {value}
      </text>
    )
  }
}

// Rótulo de barra horizontal: balão escuro no destaque, número discreto nos demais.
function rotuloBarra(destaque: number) {
  return function Rotulo(props: {
    x?: number
    y?: number
    width?: number
    height?: number
    value?: number
    index?: number
  }) {
    const { x = 0, y = 0, width = 0, height = 0, value = 0, index } = props
    const ex = x + width
    const ey = y + height / 2
    if (index === destaque) {
      const w = Math.max(30, String(value).length * 8 + 16)
      return (
        <g>
          <rect x={ex + 5} y={ey - 9.5} width={w} height={19} rx={6} fill="#0f172a" />
          <text
            x={ex + 5 + w / 2}
            y={ey + 3.5}
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            fill="#fff"
          >
            {value}
          </text>
        </g>
      )
    }
    if (!value) return null
    return (
      <text x={ex + 6} y={ey + 3.5} fontSize={10} fontWeight={600} fill="#94a3b8">
        {value}
      </text>
    )
  }
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

// ── Período (seletor rápido) ────────────────────────────────────────
const PERIODOS = [
  { key: 'tudo', label: 'Tudo' },
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: '90d', label: '90 dias' },
  { key: 'ano', label: 'Este ano' },
] as const
type PeriodoKey = (typeof PERIODOS)[number]['key']

function rangeDe(key: PeriodoKey): { de?: string; ate?: string } {
  const now = new Date()
  const dias = (n: number) => new Date(now.getTime() - n * 86400000).toISOString()
  if (key === '7d') return { de: dias(7) }
  if (key === '30d') return { de: dias(30) }
  if (key === '90d') return { de: dias(90) }
  if (key === 'ano') return { de: new Date(now.getFullYear(), 0, 1).toISOString() }
  return {}
}

type Filtro = {
  titulo: string
  params: Partial<RncListParams>
  posFiltro?: (r: Rnc) => boolean
}

export function DashboardPage() {
  const [data, setData] = React.useState<DashboardRnc | null>(null)
  const [recentes, setRecentes] = React.useState<Rnc[] | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [atualizando, setAtualizando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [periodoKey, setPeriodoKey] = React.useState<PeriodoKey>('tudo')
  const [filtro, setFiltro] = React.useState<Filtro | null>(null)
  const [viewing, setViewing] = React.useState<Rnc | null>(null)

  const periodo = React.useMemo(() => rangeDe(periodoKey), [periodoKey])

  React.useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAtualizando(true)
    const range = rangeDe(periodoKey)
    Promise.all([
      dashboardApi.rnc(range),
      rncApi.list({ ...range, pageSize: 60 }).then((r) => r.items),
    ])
      .then(([d, items]) => {
        if (cancelled) return
        setData(d)
        setRecentes(items)
      })
      .catch((err) => {
        if (cancelled) return
        setError(
          err instanceof ApiError ? err.message : 'Não foi possível carregar o painel.',
        )
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
        setAtualizando(false)
      })
    return () => {
      cancelled = true
    }
  }, [periodoKey])

  // Abre o drill mesclando o período corrente nos parâmetros.
  const drill = (
    titulo: string,
    params: Partial<RncListParams>,
    posFiltro?: (r: Rnc) => boolean,
  ) => setFiltro({ titulo, params: { ...params, ...periodo }, posFiltro })

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
  const sevPredominante = [...data.porSeveridade].sort((a, b) => b.total - a.total)[0]
  const pctEncerradas = total ? Math.round((encerradas / total) * 100) : 0
  const ant = data.anterior

  return (
    <div className="flex flex-col gap-5 bg-neutral-50/60 p-4 md:p-6">
      {/* Cabeçalho + seletor de período */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold tracking-tight text-neutral-900">
              Painel de Não Conformidades
            </h1>
            <p className="text-xs text-neutral-400">
              {total > 0
                ? `${total} RNCs · ${pctEncerradas}% encerradas · ${abertas} em andamento`
                : 'Nenhuma RNC no período selecionado'}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {atualizando && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-300" />
            )}
            <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-0.5 shadow-sm">
              {PERIODOS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriodoKey(p.key)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    periodoKey === p.key
                      ? 'bg-neutral-900 text-white'
                      : 'text-neutral-500 hover:bg-neutral-100',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* KPIs interativos com badge colorida + comparativo de período */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={FileWarning}
          tom="indigo"
          label="Total de RNCs"
          valor={total}
          anterior={ant?.total}
          bomQuandoSobe={false}
          onClick={() => drill('Todas as RNCs do período', {})}
        />
        <Kpi
          icon={Clock}
          tom="amber"
          label="Em andamento"
          valor={abertas}
          anterior={ant?.abertas}
          bomQuandoSobe={false}
          onClick={() =>
            drill('RNCs em andamento', {}, (r) =>
              ['OPEN', 'IN_PROGRESS'].includes(r.status),
            )
          }
        />
        <Kpi
          icon={AlertTriangle}
          tom="rose"
          label="Alta/crítica"
          valor={criticas}
          bomQuandoSobe={false}
          onClick={() =>
            drill(
              'RNCs de severidade alta/crítica',
              {},
              (r) => (r.severidade?.nivel ?? 0) >= 3,
            )
          }
        />
        <Kpi
          icon={CheckCircle2}
          tom="emerald"
          label="Encerradas"
          valor={encerradas}
          anterior={ant?.encerradas}
          bomQuandoSobe
          onClick={() => drill('RNCs encerradas', { status: 'CLOSED' })}
        />
      </div>

      {/* Linha herói: evolução mensal (2/3) + severidade resumida (1/3) */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <HeroEvolucao
            dados={data.porMes}
            onPick={(m) => {
              const ref = mesRange(data.porMes, m)
              if (ref)
                drill(`Evolução · ${m.label}/${m.ano}`, { de: ref.de, ate: ref.ate })
            }}
          />
        </div>
        <SeveridadeResumo
          dados={data.porSeveridade}
          total={total}
          predominante={sevPredominante}
          onPick={(d) => drill(`Severidade: ${d.label}`, { severidadeId: d.id ?? '__none__' })}
        />
      </div>

      {/* Atividade diária (estilo "código de barras") */}
      <AtividadeDiaria dados={data.porDia} />

      <Secao titulo="Distribuição">
        <Painel titulo="Por filial">
          <Colunas
            dados={data.porFilial}
            onPick={(d) => drill(`Filial: ${d.label}`, { filialId: d.id ?? '__none__' })}
          />
        </Painel>
        <Painel titulo="Por tipo de não conformidade">
          <Colunas
            dados={data.porTipo}
            onPick={(d) =>
              drill(`Tipo de NC: ${d.label}`, {
                tipoNaoConformidadeId: d.id ?? '__none__',
              })
            }
          />
        </Painel>
      </Secao>

      <Secao titulo="Responsáveis & itens">
        <Painel titulo="Top 5 fornecedores" icon={Truck}>
          <Barras
            dados={data.topFornecedores}
            onPick={(d) => drill(`Fornecedor: ${d.label}`, { fornecedorId: d.id ?? '__none__' })}
          />
        </Painel>
        <Painel titulo="Top 5 produtos">
          <Barras
            dados={data.topProdutos}
            onPick={(d) => drill(`Produto: ${d.label}`, { produtoId: d.id ?? '__none__' })}
          />
        </Painel>
      </Secao>

      <Secao titulo="Natureza da não conformidade">
        <Painel titulo="Por disposição">
          <Colunas
            dados={data.porDisposicao}
            onPick={(d) =>
              drill(`Disposição: ${d.label}`, {
                disposicaoMaterialId: d.id ?? '__none__',
              })
            }
          />
        </Painel>
        <Painel titulo="Por origem">
          <Colunas
            dados={data.porOrigem}
            onPick={(d) => drill(`Origem: ${d.label}`, { origemId: d.id ?? '__none__' })}
          />
        </Painel>
      </Secao>

      {/* Tabela de RNCs recentes com busca + ordenação */}
      <Recentes itens={recentes} onOpenRnc={setViewing} />

      {filtro && (
        <DrillModal filtro={filtro} onClose={() => setFiltro(null)} onOpenRnc={setViewing} />
      )}

      <RncDetailPanel
        rnc={viewing}
        onClose={() => setViewing(null)}
        onUpdated={(u) => setViewing((p) => (p?.id === u.id ? u : p))}
      />
    </div>
  )
}

// Janela [de, ate) do mês clicado no gráfico de evolução.
function mesRange(
  serie: ContagemMes[],
  m: ContagemMes,
): { de: string; ate: string } | null {
  const idx = serie.findIndex((x) => x.label === m.label && x.ano === m.ano)
  if (idx < 0) return null
  // O índice da série representa meses recuando a partir do atual.
  const mesesAtras = serie.length - 1 - idx
  const agora = new Date()
  const ini = new Date(agora.getFullYear(), agora.getMonth() - mesesAtras, 1)
  const fim = new Date(agora.getFullYear(), agora.getMonth() - mesesAtras + 1, 1)
  return { de: ini.toISOString(), ate: fim.toISOString() }
}

const TONS_BADGE: Record<string, string> = {
  indigo: 'bg-indigo-50 text-indigo-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  emerald: 'bg-emerald-50 text-emerald-600',
}

function Kpi({
  icon: Icon,
  tom,
  label,
  valor,
  anterior,
  bomQuandoSobe,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  tom: keyof typeof TONS_BADGE
  label: string
  valor: number
  anterior?: number
  bomQuandoSobe?: boolean
  onClick?: () => void
}) {
  const delta =
    anterior != null && anterior > 0
      ? Math.round(((valor - anterior) / anterior) * 100)
      : null
  const subiu = delta != null && delta > 0
  const bom = delta != null && delta !== 0 && subiu === !!bomQuandoSobe
  return (
    <Card
      onClick={onClick}
      className={cn(
        'flex flex-col gap-2.5 rounded-2xl border-neutral-200/70 bg-white p-4 shadow-sm transition-all',
        onClick &&
          'cursor-pointer hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md',
      )}
    >
      <div className="flex items-center justify-between">
        <div
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-xl',
            TONS_BADGE[tom],
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
        {delta != null && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold',
              delta === 0
                ? 'bg-neutral-100 text-neutral-500'
                : bom
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-rose-50 text-rose-600',
            )}
          >
            {delta > 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : delta < 0 ? (
              <TrendingDown className="h-3 w-3" />
            ) : null}
            {delta > 0 ? '+' : ''}
            {delta}%
          </span>
        )}
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-2xl font-semibold tracking-tight text-neutral-900 tabular-nums">
          {valor.toLocaleString('pt-BR')}
        </span>
        <span className="text-[11px] uppercase tracking-wide text-neutral-400">
          {label}
        </span>
      </div>
      {anterior != null && (
        <span className="text-[11px] text-neutral-400">
          Período anterior:{' '}
          <span className="font-medium text-neutral-500 tabular-nums">{anterior}</span>
        </span>
      )}
    </Card>
  )
}

function Secao({
  titulo,
  children,
}: {
  titulo: string
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
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{children}</div>
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
    <Card className="flex flex-col gap-2 rounded-2xl border-neutral-200/70 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-neutral-400" />}
        <h2 className="text-[13px] font-semibold text-neutral-800">{titulo}</h2>
      </div>
      {children}
    </Card>
  )
}

function SemDados({ altura = 220 }: { altura?: number }) {
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

// ── Herói: evolução mensal (barras fantasma + barra de destaque + balão) ──
function HeroEvolucao({
  dados,
  onPick,
}: {
  dados: ContagemMes[]
  onPick: (m: ContagemMes) => void
}) {
  const [hover, setHover] = React.useState<number | null>(null)
  const totalPeriodo = dados.reduce((a, m) => a + m.total, 0)
  // Mês de destaque = maior volume — mesmo padrão dos demais gráficos.
  const destaque = indiceDestaque(dados)
  const Rotulo = rotuloColuna(destaque)

  return (
    <Card className="flex h-full flex-col gap-1 rounded-2xl border-neutral-200/70 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <h2 className="text-[13px] font-semibold text-neutral-800">
            Evolução das RNCs
          </h2>
          <span className="text-[11px] text-neutral-400">Últimos 12 meses</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xl font-semibold tracking-tight text-neutral-900 tabular-nums">
            {totalPeriodo.toLocaleString('pt-BR')}
          </span>
          <span className="text-[11px] text-neutral-400">no período</span>
        </div>
      </div>
      {totalPeriodo === 0 ? (
        <SemDados altura={240} />
      ) : (
        <ResponsiveContainer width="100%" height={252}>
          <BarChart data={dados} margin={{ top: 30, right: 6, bottom: 4, left: -18 }}>
            <CartesianGrid vertical={false} stroke="#f3f4f6" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10.5, fill: '#94a3b8' }}
              interval={0}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: '#cbd5e1' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: '#f8fafc' }}
              formatter={(value) => [`${value} RNCs`, '']}
              labelFormatter={(l, p) => {
                const ano = (p?.[0]?.payload as ContagemMes | undefined)?.ano
                return ano ? `${l}/${ano}` : String(l)
              }}
              contentStyle={tooltipStyle}
              labelStyle={{ fontSize: 11, color: '#64748b' }}
            />
            <Bar dataKey="total" radius={[6, 6, 0, 0]} barSize={28}>
              {dados.map((m, i) => (
                <Cell
                  key={i}
                  cursor="pointer"
                  fill={i === destaque || hover === i ? ACENTO : FANTASMA}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onPick(m)}
                />
              ))}
              <LabelList dataKey="total" content={Rotulo} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

// ── Severidade: barra segmentada + lista (estilo "spending overview") ──
function SeveridadeResumo({
  dados,
  total,
  predominante,
  onPick,
}: {
  dados: { id: string | null; label: string; nivel: number | null; total: number }[]
  total: number
  predominante?: { label: string; total: number }
  onPick: (d: Contagem) => void
}) {
  const tons = ['#cbd5e1', '#94a3b8', '#64748b', '#334155', '#0f172a']
  const cor = (nivel: number | null, i: number) =>
    nivel ? tons[Math.min(tons.length - 1, nivel - 1)] : SLATE[i % SLATE.length]
  const soma = dados.reduce((a, d) => a + d.total, 0)
  const pctCriticas = total
    ? Math.round(
        (dados.filter((d) => (d.nivel ?? 0) >= 3).reduce((a, d) => a + d.total, 0) /
          total) *
          100,
      )
    : 0
  return (
    <Card className="flex h-full flex-col gap-3 rounded-2xl border-neutral-200/70 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <h2 className="text-[13px] font-semibold text-neutral-800">
            Severidade
          </h2>
          <span className="text-[11px] text-neutral-400">Composição das RNCs</span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600">
          <ArrowUpRight className="h-3 w-3" />
          {pctCriticas}% críticas
        </span>
      </div>

      <div>
        <span className="text-2xl font-semibold tracking-tight text-neutral-900 tabular-nums">
          {soma.toLocaleString('pt-BR')}
        </span>
        <span className="ml-1.5 text-[11px] text-neutral-400">
          RNCs classificadas
          {predominante ? ` · predomina ${predominante.label.replace('Nível ', 'Nv ')}` : ''}
        </span>
      </div>

      {soma === 0 ? (
        <SemDados altura={120} />
      ) : (
        <>
          {/* Barra empilhada segmentada */}
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
            {dados.map((d, i) =>
              d.total > 0 ? (
                <button
                  key={i}
                  onClick={() => onPick(d)}
                  title={`${d.label}: ${d.total}`}
                  className="h-full transition-opacity hover:opacity-80"
                  style={{
                    width: `${(d.total / soma) * 100}%`,
                    backgroundColor: cor(d.nivel, i),
                  }}
                />
              ) : null,
            )}
          </div>

          <div className="flex flex-col gap-1">
            {dados.map((d, i) => (
              <button
                key={i}
                onClick={() => onPick(d)}
                className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-[12px] text-neutral-600 transition-colors hover:bg-neutral-50"
              >
                <span className="flex items-center gap-2 truncate">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: cor(d.nivel, i) }}
                  />
                  {d.label.replace('Nível ', 'Nv ')}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-[11px] text-neutral-400 tabular-nums">
                    {Math.round((d.total / soma) * 100)}%
                  </span>
                  <span className="font-medium tabular-nums text-neutral-700">
                    {d.total}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}

// ── Atividade diária — barrinhas finas estilo "código de barras" ──
function AtividadeDiaria({ dados }: { dados: ContagemDia[] }) {
  const totalPeriodo = dados.reduce((a, d) => a + d.total, 0)
  const max = Math.max(1, ...dados.map((d) => d.total))
  const maxIdx = dados.reduce((mi, d, i) => (d.total > dados[mi].total ? i : mi), 0)
  const diaPico = dados[maxIdx]
  return (
    <Card className="flex flex-col gap-3 rounded-2xl border-neutral-200/70 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-neutral-400" />
          <div className="flex flex-col">
            <h2 className="text-[13px] font-semibold text-neutral-800">
              Atividade diária
            </h2>
            <span className="text-[11px] text-neutral-400">Últimos 30 dias</span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-lg font-semibold tracking-tight text-neutral-900 tabular-nums">
            {totalPeriodo}
          </span>
          <span className="text-[11px] text-neutral-400">
            pico {diaPico ? `${diaPico.total} em ${fmtDataBR(diaPico.label).slice(0, 5)}` : '—'}
          </span>
        </div>
      </div>
      {totalPeriodo === 0 ? (
        <SemDados altura={72} />
      ) : (
        <div className="flex h-[72px] items-end gap-[3px]">
          {dados.map((d, i) => (
            <div
              key={i}
              title={`${fmtDataBR(d.label)} · ${d.total} RNC${d.total === 1 ? '' : 's'}`}
              className="group flex h-full flex-1 items-end"
            >
              <div
                className="w-full rounded-sm transition-colors"
                style={{
                  height: `${Math.max(4, (d.total / max) * 100)}%`,
                  backgroundColor: i === maxIdx && d.total > 0 ? ACENTO : FANTASMA,
                }}
              />
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-between text-[10px] text-neutral-300">
        <span>{dados[0] ? fmtDataBR(dados[0].label) : ''}</span>
        <span>{dados.length ? fmtDataBR(dados[dados.length - 1].label) : ''}</span>
      </div>
    </Card>
  )
}

/** Barras horizontais clicáveis (rótulos longos) — mesmo padrão do herói. */
function Barras({
  dados,
  onPick,
}: {
  dados: Contagem[]
  onPick: (d: Contagem) => void
}) {
  const [hover, setHover] = React.useState<number | null>(null)
  if (dados.length === 0) return <SemDados />
  const destaque = indiceDestaque(dados)
  const Rotulo = rotuloBarra(destaque)
  const altura = Math.max(190, dados.length * 42 + 24)
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart data={dados} layout="vertical" margin={{ top: 2, right: 46, bottom: 2, left: 4 }}>
        <CartesianGrid horizontal={false} stroke="#f3f4f6" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
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
        <Bar dataKey="total" radius={[0, 6, 6, 0]} barSize={30}>
          {dados.map((d, i) => (
            <Cell
              key={i}
              cursor="pointer"
              fill={i === destaque || hover === i ? ACENTO : FANTASMA}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onPick(d)}
            />
          ))}
          <LabelList dataKey="total" content={Rotulo} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Colunas verticais clicáveis — mesmo padrão do gráfico herói. */
function Colunas({
  dados,
  onPick,
}: {
  dados: Contagem[]
  onPick: (d: Contagem) => void
}) {
  const [hover, setHover] = React.useState<number | null>(null)
  if (dados.length === 0) return <SemDados />
  const destaque = indiceDestaque(dados)
  const Rotulo = rotuloColuna(destaque)
  return (
    <ResponsiveContainer width="100%" height={244}>
      <BarChart data={dados} margin={{ top: 30, right: 8, bottom: 44, left: -16 }}>
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
        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: '#f8fafc' }}
          formatter={(value) => [`${value} RNCs`, '']}
          contentStyle={tooltipStyle}
          labelStyle={{ fontSize: 11, color: '#64748b' }}
        />
        <Bar dataKey="total" radius={[6, 6, 0, 0]} barSize={44}>
          {dados.map((d, i) => (
            <Cell
              key={i}
              cursor="pointer"
              fill={i === destaque || hover === i ? ACENTO : FANTASMA}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onPick(d)}
            />
          ))}
          <LabelList dataKey="total" content={Rotulo} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── RNCs recentes (busca + ordenação) ───────────────────────────────
type OrdemKey = 'recentes' | 'severidade' | 'status'
const ORDENS: { key: OrdemKey; label: string }[] = [
  { key: 'recentes', label: 'Mais recentes' },
  { key: 'severidade', label: 'Severidade' },
  { key: 'status', label: 'Status' },
]

function Recentes({
  itens,
  onOpenRnc,
}: {
  itens: Rnc[] | null
  onOpenRnc: (r: Rnc) => void
}) {
  const [busca, setBusca] = React.useState('')
  const [ordem, setOrdem] = React.useState<OrdemKey>('recentes')

  const lista = React.useMemo(() => {
    let l = itens ?? []
    const q = busca.trim().toLowerCase()
    if (q) {
      l = l.filter(
        (r) =>
          r.numero.toLowerCase().includes(q) ||
          r.fornecedor.codigo.toLowerCase().includes(q) ||
          r.fornecedor.razaoSocial.toLowerCase().includes(q) ||
          r.tipoNaoConformidade.codigo.toLowerCase().includes(q),
      )
    }
    const ord = [...l]
    if (ordem === 'severidade') {
      ord.sort((a, b) => (b.severidade?.nivel ?? 0) - (a.severidade?.nivel ?? 0))
    } else if (ordem === 'status') {
      ord.sort((a, b) => a.status.localeCompare(b.status))
    }
    return ord.slice(0, 12)
  }, [itens, busca, ordem])

  return (
    <Card className="flex flex-col gap-3 rounded-2xl border-neutral-200/70 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-neutral-800">RNCs recentes</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2 py-1">
            <SearchIcon className="h-3.5 w-3.5 text-neutral-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar…"
              className="w-28 bg-transparent text-[12px] text-neutral-700 outline-none placeholder:text-neutral-300 sm:w-40"
            />
          </div>
          <div className="relative">
            <select
              value={ordem}
              onChange={(e) => setOrdem(e.target.value as OrdemKey)}
              className="appearance-none rounded-lg border border-neutral-200 bg-white py-1 pl-2.5 pr-7 text-[12px] font-medium text-neutral-600 outline-none"
            >
              {ORDENS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
          </div>
        </div>
      </div>

      {!itens ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-neutral-300" />
        </div>
      ) : lista.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center gap-1 text-sm text-neutral-400">
          <SearchIcon className="h-5 w-5" />
          Nenhuma RNC encontrada.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-[11px] uppercase tracking-wide text-neutral-400">
                <th className="py-2 pr-2 text-left font-medium">Nº</th>
                <th className="px-2 py-2 text-left font-medium">Data</th>
                <th className="px-2 py-2 text-left font-medium">Fornecedor</th>
                <th className="px-2 py-2 text-left font-medium">Tipo</th>
                <th className="px-2 py-2 text-center font-medium">Sev.</th>
                <th className="py-2 pl-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => onOpenRnc(r)}
                  className="cursor-pointer border-b border-neutral-50 transition-colors last:border-0 hover:bg-neutral-50"
                >
                  <td className="py-2 pr-2 font-mono text-[12px] font-medium text-neutral-900">
                    #{r.numero}
                  </td>
                  <td className="px-2 py-2 text-neutral-600">
                    {fmtDataBR(r.dataIdentificacao)}
                  </td>
                  <td className="px-2 py-2 text-neutral-700">{r.fornecedor.codigo}</td>
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
                  <td className="py-2 pl-2 text-right">
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-neutral-600">
                      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[r.status])} />
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(null)
    setErro(null)
    rncApi
      .list({ ...filtro.params, pageSize: 100 })
      .then((res) => {
        if (cancelled) return
        const base = filtro.posFiltro
          ? res.items.filter(filtro.posFiltro)
          : res.items
        setItems(base)
      })
      .catch((err) => {
        if (cancelled) return
        setErro(err instanceof ApiError ? err.message : 'Falha ao carregar.')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filtro.params)])

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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-neutral-950/40 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

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
                    <td className="px-2 py-2 text-neutral-700">{r.fornecedor.codigo}</td>
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
