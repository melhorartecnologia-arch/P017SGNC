import * as React from 'react'
import {
  Loader2,
  FileWarning,
  ShieldAlert,
  MapPin,
  PackageCheck,
  Truck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  Search as SearchIcon,
  ArrowUpRight,
  ChevronDown,
  CalendarRange,
  Timer,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api/client'
import {
  dashboardApi,
  type Contagem,
  type DashboardRnc,
  type TipoPainelDocs,
} from '@/lib/api/dashboard'
import { rncApi, type Rnc, type RncListParams, type RncStatus } from '@/lib/api/rnc'
import { RncDetailPanel } from '@/components/registros/RncDetailPanel'
import { DashboardDocsPanel } from './DashboardDocsPanel'
import {
  AtividadeDiaria,
  Barras,
  Chip,
  Colunas,
  HeroEvolucao,
  Kpi,
  Painel,
  Secao,
  SemDados,
  SLATE,
  fmtDataBR,
  mesRange,
} from './graficos'

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

// ── Período (seletor rápido) ────────────────────────────────────────
const PERIODOS = [
  { key: 'tudo', label: 'Tudo' },
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: '90d', label: '90 dias' },
  { key: 'ano', label: 'Este ano' },
] as const
type PeriodoKey = (typeof PERIODOS)[number]['key']

// 'custom' = período flexível definido por datas quaisquer (de/até).
type Modo = PeriodoKey | 'custom'

function rangeDe(key: PeriodoKey): { de?: string; ate?: string } {
  const now = new Date()
  const dias = (n: number) => new Date(now.getTime() - n * 86400000).toISOString()
  if (key === '7d') return { de: dias(7) }
  if (key === '30d') return { de: dias(30) }
  if (key === '90d') return { de: dias(90) }
  if (key === 'ano') return { de: new Date(now.getFullYear(), 0, 1).toISOString() }
  return {}
}

// Range efetivo: presets ou intervalo personalizado (qualquer data).
function rangeAtual(
  modo: Modo,
  de: string,
  ate: string,
): { de?: string; ate?: string } {
  if (modo !== 'custom') return rangeDe(modo)
  const r: { de?: string; ate?: string } = {}
  if (de) r.de = new Date(`${de}T00:00:00`).toISOString()
  if (ate) {
    // inclui o dia final inteiro (backend filtra por "< ate").
    const d = new Date(`${ate}T00:00:00`)
    d.setDate(d.getDate() + 1)
    r.ate = d.toISOString()
  }
  return r
}

type Filtro = {
  titulo: string
  params: Partial<RncListParams>
  posFiltro?: (r: Rnc) => boolean
}

// ── Abas do painel principal: um painel por tipo de documento ───────
type PainelKey = 'RNC' | TipoPainelDocs
const PAINEIS: {
  key: PainelKey
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { key: 'RNC', label: 'Não Conformidades', icon: FileWarning },
  { key: 'RAQ', label: 'Alertas de Qualidade', icon: ShieldAlert },
  { key: 'RVT', label: 'Visitas Técnicas', icon: MapPin },
  { key: 'RHE', label: 'Homologações', icon: PackageCheck },
]

export function DashboardPage() {
  const [painel, setPainel] = React.useState<PainelKey>('RNC')
  const [periodoKey, setPeriodoKey] = React.useState<Modo>('tudo')
  const [customDe, setCustomDe] = React.useState('')
  const [customAte, setCustomAte] = React.useState('')

  const periodo = React.useMemo(
    () => rangeAtual(periodoKey, customDe, customAte),
    [periodoKey, customDe, customAte],
  )

  return (
    <div className="flex flex-col gap-5 bg-neutral-50/60 p-4 md:p-6">
      {/* Abas por tipo de documento + seletor de período */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-0.5 shadow-sm">
          {PAINEIS.map((p) => {
            const Icon = p.icon
            return (
              <button
                key={p.key}
                onClick={() => setPainel(p.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  painel === p.key
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-500 hover:bg-neutral-100',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{p.label}</span>
                <span className="sm:hidden">{p.key}</span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-col items-end gap-1.5">
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
            <button
              onClick={() => setPeriodoKey('custom')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                periodoKey === 'custom'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-500 hover:bg-neutral-100',
              )}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              Personalizado
            </button>
          </div>
          {periodoKey === 'custom' && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2 py-1 shadow-sm">
              <span className="text-[11px] text-neutral-400">De</span>
              <input
                type="date"
                value={customDe}
                max={customAte || undefined}
                onChange={(e) => setCustomDe(e.target.value)}
                className="rounded-md border border-neutral-200 px-1.5 py-0.5 text-xs text-neutral-700 outline-none focus:border-neutral-400"
              />
              <span className="text-[11px] text-neutral-400">até</span>
              <input
                type="date"
                value={customAte}
                min={customDe || undefined}
                onChange={(e) => setCustomAte(e.target.value)}
                className="rounded-md border border-neutral-200 px-1.5 py-0.5 text-xs text-neutral-700 outline-none focus:border-neutral-400"
              />
              {(customDe || customAte) && (
                <button
                  onClick={() => {
                    setCustomDe('')
                    setCustomAte('')
                  }}
                  className="rounded-md p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                  aria-label="Limpar datas"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {painel === 'RNC' ? (
        <RncPanel periodo={periodo} />
      ) : (
        // key: trocar de aba REMONTA o painel — sem ela, viewing/filtro do
        // tipo anterior sobrevivem e o painel de detalhes do tipo novo
        // renderia um documento de outro tipo (crash em participantes/
        // representantes ausentes no payload).
        <DashboardDocsPanel key={painel} tipo={painel} periodo={periodo} />
      )}
    </div>
  )
}

// ── Painel de Não Conformidades (RNC) ───────────────────────────────
function RncPanel({ periodo }: { periodo: { de?: string; ate?: string } }) {
  const [data, setData] = React.useState<DashboardRnc | null>(null)
  const [recentes, setRecentes] = React.useState<Rnc[] | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [atualizando, setAtualizando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [filtro, setFiltro] = React.useState<Filtro | null>(null)
  const [viewing, setViewing] = React.useState<Rnc | null>(null)

  React.useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAtualizando(true)
    Promise.all([
      dashboardApi.rnc(periodo),
      rncApi.list({ ...periodo, pageSize: 60 }).then((r) => r.items),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo.de, periodo.ate])

  // Abre o drill mesclando o período corrente nos parâmetros — o período
  // entra primeiro para que parâmetros explícitos (ex.: o recorte de um
  // mês clicado na evolução) prevaleçam sobre ele.
  const drill = (
    titulo: string,
    params: Partial<RncListParams>,
    posFiltro?: (r: Rnc) => boolean,
  ) => setFiltro({ titulo, params: { ...periodo, ...params }, posFiltro })

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-300" />
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {error ?? 'Sem dados.'}
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

  // ── Horas de parada ──────────────────────────────────────────────
  const paradaMin = data.paradaTotalMinutos
  const paradaHoras = Math.round(paradaMin / 60)
  const paradaHorasDec = Math.round((paradaMin / 60) * 10) / 10
  const paradaMediaH = data.paradaRncs
    ? Math.round((paradaMin / data.paradaRncs / 60) * 10) / 10
    : 0
  // Converte os minutos agregados em horas (1 casa) para os gráficos.
  const emHoras = (arr: Contagem[]) =>
    arr.map((d) => ({ ...d, total: Math.round((d.total / 60) * 10) / 10 }))
  const paradaFilialH = emHoras(data.paradaPorFilial)
  const paradaTipoH = emHoras(data.paradaPorTipo)
  const paradaFornH = emHoras(data.paradaTopFornecedores)
  const comParada = (r: Rnc) => (r.tempoParadaMinutos ?? 0) > 0

  return (
    <>
      <header className="flex items-center gap-2">
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
        {atualizando && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-300" />
        )}
      </header>

      {/* KPIs interativos com badge colorida + comparativo de período */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
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
        <Kpi
          icon={Timer}
          tom="sky"
          label="Horas de parada"
          valor={paradaHoras}
          bomQuandoSobe={false}
          onClick={() => drill('RNCs com parada de produção', {}, comParada)}
        />
      </div>

      {/* Linha herói: evolução mensal (2/3) + severidade resumida (1/3) */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <HeroEvolucao
            dados={data.porMes}
            titulo="Evolução das RNCs"
            sufixo="RNCs"
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
      <AtividadeDiaria dados={data.porDia} sufixo="RNC" />

      {/* Horas de parada — impacto operacional das RNCs */}
      <Secao titulo="Horas de parada">
        <ParadasResumo
          totalHoras={paradaHorasDec}
          rncsComParada={data.paradaRncs}
          mediaHoras={paradaMediaH}
          totalRnc={total}
          onClick={() => drill('RNCs com parada de produção', {}, comParada)}
        />
        <Painel titulo="Por filial (horas)" icon={Timer}>
          <Colunas
            dados={paradaFilialH}
            sufixo="h"
            onPick={(d) =>
              drill(`Paradas · Filial: ${d.label}`, { filialId: d.id ?? '__none__' }, comParada)
            }
          />
        </Painel>
      </Secao>

      <Secao titulo="Horas de parada por natureza">
        <Painel titulo="Por tipo de não conformidade (horas)">
          <Colunas
            dados={paradaTipoH}
            sufixo="h"
            onPick={(d) =>
              drill(
                `Paradas · Tipo: ${d.label}`,
                { tipoNaoConformidadeId: d.id ?? '__none__' },
                comParada,
              )
            }
          />
        </Painel>
        <Painel titulo="Top 5 fornecedores por horas de parada" icon={Truck}>
          <Barras
            dados={paradaFornH}
            sufixo="h"
            onPick={(d) =>
              drill(
                `Paradas · Fornecedor: ${d.label}`,
                { fornecedorId: d.id ?? '__none__' },
                comParada,
              )
            }
          />
        </Painel>
      </Secao>

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
    </>
  )
}

// Resumo das horas de parada: total, RNCs afetadas, média e % das RNCs.
function ParadasResumo({
  totalHoras,
  rncsComParada,
  mediaHoras,
  totalRnc,
  onClick,
}: {
  totalHoras: number
  rncsComParada: number
  mediaHoras: number
  totalRnc: number
  onClick?: () => void
}) {
  const pct = totalRnc ? Math.round((rncsComParada / totalRnc) * 100) : 0
  return (
    <Card
      onClick={onClick}
      className={cn(
        'flex flex-col justify-between gap-3 rounded-2xl border-neutral-200/70 bg-white p-4 shadow-sm transition-all',
        onClick &&
          'cursor-pointer hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md',
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
          <Timer className="h-4.5 w-4.5" />
        </div>
        <h2 className="text-[13px] font-semibold text-neutral-800">
          Total de paradas no período
        </h2>
      </div>
      <div className="flex items-end gap-1.5">
        <span className="text-3xl font-semibold tracking-tight text-neutral-900 tabular-nums">
          {totalHoras.toLocaleString('pt-BR')}
        </span>
        <span className="pb-1 text-sm font-medium text-neutral-400">horas</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MetricaParada k="RNCs c/ parada" v={String(rncsComParada)} />
        <MetricaParada k="Média/RNC" v={`${mediaHoras} h`} />
        <MetricaParada k="% das RNCs" v={`${pct}%`} />
      </div>
    </Card>
  )
}

function MetricaParada({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-neutral-50 px-2.5 py-2">
      <span className="text-base font-semibold tracking-tight text-neutral-900 tabular-nums">
        {v}
      </span>
      <span className="text-[10.5px] uppercase tracking-wide text-neutral-400">{k}</span>
    </div>
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
