import * as React from 'react'
import {
  Loader2,
  ShieldAlert,
  MapPin,
  PackageCheck,
  Clock,
  CheckCircle2,
  MailCheck,
  Repeat,
  ClipboardCheck,
  Truck,
  X,
  Search as SearchIcon,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api/client'
import {
  dashboardApi,
  type DashboardDocs,
  type TipoPainelDocs,
} from '@/lib/api/dashboard'
import type { RncStatus } from '@/lib/api/rnc'
import { raqApi, type Raq } from '@/lib/api/raq'
import { rvtApi, type Rvt } from '@/lib/api/rvt'
import { rheApi, type Rhe } from '@/lib/api/rhe'
import { HOMOLOGACAO_LABELS } from '@/lib/api/rhe'
import { RaqDetailPanel } from '@/components/registros/RaqDetailPanel'
import { RvtDetailPanel } from '@/components/registros/RvtDetailPanel'
import { RheDetailPanel } from '@/components/registros/RheDetailPanel'
import {
  AtividadeDiaria,
  Barras,
  Chip,
  Colunas,
  Composicao,
  HeroEvolucao,
  Kpi,
  Painel,
  Secao,
  SLATE,
  fmtDataBR,
  mesRange,
  type ComposicaoItem,
} from './graficos'

/**
 * Painel genérico dos demais tipos de documento (RAQ, RVT e RHE) — mesmo
 * visual do painel de RNCs, com as dimensões próprias de cada tipo. O
 * drill-down lista os documentos do recorte e abre o painel de detalhes
 * do tipo correspondente.
 */

type Doc = Raq | Rvt | Rhe

const STATUS_LABEL: Record<RncStatus, string> = {
  DRAFT: 'Rascunho',
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em andamento',
  CLOSED: 'Encerrado',
  CANCELLED: 'Cancelado',
}
const STATUS_DOT: Record<RncStatus, string> = {
  DRAFT: 'bg-neutral-400',
  OPEN: 'bg-amber-500',
  IN_PROGRESS: 'bg-sky-500',
  CLOSED: 'bg-emerald-500',
  CANCELLED: 'bg-red-500',
}
const STATUS_COR: Record<RncStatus, string> = {
  DRAFT: '#a3a3a3',
  OPEN: '#f59e0b',
  IN_PROGRESS: '#0ea5e9',
  CLOSED: '#10b981',
  CANCELLED: '#ef4444',
}

const HOMOLOG_COR: Record<string, string> = {
  APROVADO: '#10b981',
  APROVADO_COM_RESTRICAO: '#f59e0b',
  REPROVADO: '#ef4444',
}

const CONFIG: Record<
  TipoPainelDocs,
  {
    icon: React.ComponentType<{ className?: string }>
    titulo: string
    plural: string
    rotuloDoc: string
  }
> = {
  RAQ: {
    icon: ShieldAlert,
    titulo: 'Painel de Alertas de Qualidade',
    plural: 'RAQs',
    rotuloDoc: 'Título',
  },
  RVT: {
    icon: MapPin,
    titulo: 'Painel de Visitas Técnicas',
    plural: 'RVTs',
    rotuloDoc: 'Pauta',
  },
  RHE: {
    icon: PackageCheck,
    titulo: 'Painel de Homologações de Embalagem',
    plural: 'RHEs',
    rotuloDoc: 'Título',
  },
}

type ListParams = {
  status?: RncStatus
  filialId?: string
  fornecedorId?: string
  de?: string
  ate?: string
}

type Filtro = {
  titulo: string
  params: ListParams
  posFiltro?: (d: Doc) => boolean
}

function listar(tipo: TipoPainelDocs, params: ListParams & { pageSize: number }) {
  if (tipo === 'RAQ') return raqApi.list(params).then((r) => r.items as Doc[])
  if (tipo === 'RVT') return rvtApi.list(params).then((r) => r.items as Doc[])
  return rheApi.list(params).then((r) => r.items as Doc[])
}

export function DashboardDocsPanel({
  tipo,
  periodo,
}: {
  tipo: TipoPainelDocs
  periodo: { de?: string; ate?: string }
}) {
  const cfg = CONFIG[tipo]
  const [data, setData] = React.useState<DashboardDocs | null>(null)
  const [recentes, setRecentes] = React.useState<Doc[] | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [atualizando, setAtualizando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [filtro, setFiltro] = React.useState<Filtro | null>(null)
  const [viewing, setViewing] = React.useState<Doc | null>(null)

  // Troca de período NÃO apaga o painel: os dados anteriores continuam na
  // tela com um spinner discreto (mesmo padrão do painel de RNCs). A troca
  // de aba remonta o componente (key no pai), então cai no loading cheio.
  React.useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAtualizando(true)
    setError(null)
    Promise.all([
      dashboardApi.documentos(tipo, periodo),
      listar(tipo, { ...periodo, pageSize: 60 }),
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
  }, [tipo, periodo.de, periodo.ate])

  // O período ambiente entra primeiro: parâmetros explícitos (ex.: o
  // recorte de um mês clicado na evolução) prevalecem sobre ele.
  const drill = (
    titulo: string,
    params: ListParams,
    posFiltro?: (d: Doc) => boolean,
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
  const abertos = (statusMap.get('OPEN') ?? 0) + (statusMap.get('IN_PROGRESS') ?? 0)
  const encerrados = statusMap.get('CLOSED') ?? 0
  const pctEncerrados = total ? Math.round((encerrados / total) * 100) : 0
  const ant = data.anterior

  // Composição da lateral do herói, por tipo.
  const comp = ((): {
    titulo: string
    sub: string
    rotulo: string
    dados: ComposicaoItem[]
    pick: (c: ComposicaoItem) => void
  } => {
    if (tipo === 'RAQ') {
      const tons = ['#cbd5e1', '#94a3b8', '#64748b', '#334155', '#0f172a']
      return {
        titulo: 'Severidade',
        sub: 'Composição dos RAQs',
        rotulo: 'RAQs classificados',
        // Sentinela 'null' idêntica dos dois lados: o groupBy produz no
        // máximo um grupo sem severidade, então a chave permanece única.
        dados: data.porSeveridade.map((s, i) => ({
          chave: s.id ?? 'null',
          label: s.label.replace('Nível ', 'Nv '),
          cor: s.nivel
            ? tons[Math.min(tons.length - 1, s.nivel - 1)]
            : SLATE[i % SLATE.length],
          total: s.total,
        })),
        pick: (c) =>
          drill(`Severidade: ${c.label}`, {}, (d) =>
            (d.severidadeId ?? 'null') === c.chave,
          ),
      }
    }
    if (tipo === 'RVT') {
      return {
        titulo: 'Situação',
        sub: 'Composição dos RVTs',
        rotulo: 'RVTs no período',
        dados: (Object.keys(STATUS_LABEL) as RncStatus[])
          .map((s) => ({
            chave: s,
            label: STATUS_LABEL[s],
            cor: STATUS_COR[s],
            total: statusMap.get(s) ?? 0,
          }))
          .filter((c) => c.total > 0),
        pick: (c) => drill(`Status: ${c.label}`, { status: c.chave as RncStatus }),
      }
    }
    return {
      titulo: 'Homologação inicial',
      sub: 'Resultado registrado nos RHEs',
      rotulo: 'RHEs no período',
      dados: data.porHomologacaoInicial.map((h) => ({
        chave: h.valor ?? 'null',
        label: h.valor
          ? HOMOLOGACAO_LABELS[h.valor as keyof typeof HOMOLOGACAO_LABELS]
          : 'Sem registro',
        cor: h.valor ? HOMOLOG_COR[h.valor] : '#cbd5e1',
        total: h.total,
      })),
      pick: (c) =>
        drill(`Homologação inicial: ${c.label}`, {}, (d) =>
          ((d as Rhe).homologacaoInicial ?? 'null') === c.chave,
        ),
    }
  })()

  const homologFinalComposicao: ComposicaoItem[] =
    tipo === 'RHE'
      ? data.porHomologacaoFinal.map((h) => ({
          chave: h.valor ?? 'null',
          label: h.valor
            ? HOMOLOGACAO_LABELS[h.valor as keyof typeof HOMOLOGACAO_LABELS]
            : 'Em aberto',
          cor: h.valor ? HOMOLOG_COR[h.valor] : '#cbd5e1',
          total: h.total,
        }))
      : []

  const Icon = cfg.icon

  return (
    <>
      <header className="flex flex-col">
        <div className="flex items-center gap-2">
          <Icon className="h-4.5 w-4.5 text-neutral-500" />
          <h1 className="text-lg font-semibold tracking-tight text-neutral-900">
            {cfg.titulo}
          </h1>
          {atualizando && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-300" />
          )}
        </div>
        <p className="text-xs text-neutral-400">
          {total > 0
            ? `${total} ${cfg.plural} · ${pctEncerrados}% encerrados · ${abertos} em andamento`
            : `Nenhum ${cfg.plural.slice(0, 3)} no período selecionado`}
        </p>
      </header>

      {/* KPIs */}
      <div
        className={cn(
          'grid grid-cols-2 gap-3',
          tipo === 'RVT' ? 'lg:grid-cols-4' : 'lg:grid-cols-5',
        )}
      >
        <Kpi
          icon={Icon}
          tom="indigo"
          label={`Total de ${cfg.plural}`}
          valor={total}
          anterior={ant?.total}
          bomQuandoSobe={false}
          onClick={() => drill(`Todos os ${cfg.plural} do período`, {})}
        />
        <Kpi
          icon={Clock}
          tom="amber"
          label="Em andamento"
          valor={abertos}
          anterior={ant?.abertas}
          bomQuandoSobe={false}
          onClick={() =>
            drill(`${cfg.plural} em andamento`, {}, (d) =>
              ['OPEN', 'IN_PROGRESS'].includes(d.status),
            )
          }
        />
        <Kpi
          icon={CheckCircle2}
          tom="emerald"
          label="Encerrados"
          valor={encerrados}
          anterior={ant?.encerradas}
          bomQuandoSobe
          onClick={() => drill(`${cfg.plural} encerrados`, { status: 'CLOSED' })}
        />
        <Kpi
          icon={MailCheck}
          tom="sky"
          label="Enviados ao fornecedor"
          valor={data.enviadosFornecedor}
          bomQuandoSobe
          onClick={() =>
            drill(`${cfg.plural} enviados ao fornecedor`, {}, (d) => !!d.enviadoFornecedorEm)
          }
        />
        {tipo === 'RAQ' && (
          <Kpi
            icon={Repeat}
            tom="rose"
            label="Reincidentes"
            valor={data.reincidentes}
            bomQuandoSobe={false}
            onClick={() =>
              drill('RAQs reincidentes', {}, (d) => (d as Raq).reincidente === true)
            }
          />
        )}
        {tipo === 'RHE' && (
          <Kpi
            icon={ClipboardCheck}
            tom="violet"
            label="Homolog. final pendente"
            valor={
              data.porHomologacaoFinal.find((h) => h.valor === null)?.total ?? 0
            }
            bomQuandoSobe={false}
            onClick={() =>
              drill(
                'RHEs com homologação final em aberto',
                {},
                (d) => !(d as Rhe).homologacaoFinal,
              )
            }
          />
        )}
      </div>

      {/* Herói: evolução mensal + composição do tipo */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <HeroEvolucao
            dados={data.porMes}
            titulo={`Evolução dos ${cfg.plural}`}
            sufixo={cfg.plural}
            onPick={(m) => {
              const ref = mesRange(data.porMes, m)
              if (ref)
                drill(`Evolução · ${m.label}/${m.ano}`, { de: ref.de, ate: ref.ate })
            }}
          />
        </div>
        <Composicao
          titulo={comp.titulo}
          subtitulo={comp.sub}
          dados={comp.dados}
          rotuloTotal={comp.rotulo}
          onPick={comp.pick}
        />
      </div>

      <AtividadeDiaria dados={data.porDia} sufixo={cfg.plural.slice(0, 3)} />

      <Secao titulo="Distribuição">
        <Painel titulo="Por filial">
          <Colunas
            dados={data.porFilial}
            sufixo={cfg.plural}
            onPick={(d) => drill(`Filial: ${d.label}`, { filialId: d.id ?? undefined })}
          />
        </Painel>
        <Painel titulo="Top 5 fornecedores" icon={Truck}>
          <Barras
            dados={data.topFornecedores}
            sufixo={cfg.plural}
            onPick={(d) =>
              drill(`Fornecedor: ${d.label}`, { fornecedorId: d.id ?? undefined })
            }
          />
        </Painel>
      </Secao>

      {tipo === 'RAQ' && (
        <Secao titulo="Natureza do alerta">
          <Painel titulo="Por origem">
            <Colunas
              dados={data.porOrigem}
              sufixo="RAQs"
              onPick={(d) =>
                drill(`Origem: ${d.label}`, {}, (x) => (x.origemId ?? null) === d.id)
              }
            />
          </Painel>
          <Painel titulo="Por disposição">
            <Colunas
              dados={data.porDisposicao}
              sufixo="RAQs"
              onPick={(d) =>
                drill(
                  `Disposição: ${d.label}`,
                  {},
                  (x) => (x.disposicaoMaterialId ?? null) === d.id,
                )
              }
            />
          </Painel>
        </Secao>
      )}

      <Secao titulo={tipo === 'RHE' ? 'Itens e homologação final' : 'Itens'}>
        <Painel titulo={tipo === 'RHE' ? 'Top 5 embalagens (produtos)' : 'Top 5 produtos'}>
          <Barras
            dados={data.topProdutos}
            sufixo={cfg.plural}
            onPick={(d) =>
              drill(`Produto: ${d.label}`, {}, (x) => (x.produtoId ?? null) === d.id)
            }
          />
        </Painel>
        {tipo === 'RHE' ? (
          <Composicao
            titulo="Homologação final"
            subtitulo="Decisão registrada após o acompanhamento"
            dados={homologFinalComposicao}
            rotuloTotal="RHEs no período"
            onPick={(c) =>
              drill(`Homologação final: ${c.label}`, {}, (d) =>
                ((d as Rhe).homologacaoFinal ?? 'null') === c.chave,
              )
            }
          />
        ) : (
          <Painel titulo="Assinaturas concluídas">
            <div className="flex h-full flex-col justify-center gap-1 py-6 text-center">
              <span className="text-3xl font-semibold tracking-tight text-neutral-900 tabular-nums">
                {data.assinaturasConcluidas}
              </span>
              <span className="text-[11px] uppercase tracking-wide text-neutral-400">
                documentos com todas as assinaturas
              </span>
              <span className="text-[11px] text-neutral-400">
                {data.enviadosFornecedor} já entregues ao fornecedor por e-mail
              </span>
            </div>
          </Painel>
        )}
      </Secao>

      <Recentes tipo={tipo} itens={recentes} onOpen={setViewing} />

      {filtro && (
        <DrillDocsModal
          tipo={tipo}
          filtro={filtro}
          onClose={() => setFiltro(null)}
          onOpen={setViewing}
        />
      )}

      {tipo === 'RAQ' && (
        <RaqDetailPanel
          raq={viewing as Raq | null}
          onClose={() => setViewing(null)}
          onUpdated={(u) => setViewing((p) => (p?.id === u.id ? u : p))}
        />
      )}
      {tipo === 'RVT' && (
        <RvtDetailPanel
          rvt={viewing as Rvt | null}
          onClose={() => setViewing(null)}
          onUpdated={(u) => setViewing((p) => (p?.id === u.id ? u : p))}
        />
      )}
      {tipo === 'RHE' && (
        <RheDetailPanel
          rhe={viewing as Rhe | null}
          onClose={() => setViewing(null)}
          onUpdated={(u) => setViewing((p) => (p?.id === u.id ? u : p))}
        />
      )}
    </>
  )
}

/** Título/pauta exibido na tabela conforme o tipo. */
function tituloDoc(d: Doc): string {
  if ('pauta' in d && d.pauta) return d.pauta
  return d.titulo ?? '—'
}

function Recentes({
  tipo,
  itens,
  onOpen,
}: {
  tipo: TipoPainelDocs
  itens: Doc[] | null
  onOpen: (d: Doc) => void
}) {
  const cfg = CONFIG[tipo]
  const [busca, setBusca] = React.useState('')
  const lista = React.useMemo(() => {
    let l = itens ?? []
    const q = busca.trim().toLowerCase()
    if (q) {
      l = l.filter(
        (d) =>
          d.numero.toLowerCase().includes(q) ||
          d.fornecedor.razaoSocial.toLowerCase().includes(q) ||
          tituloDoc(d).toLowerCase().includes(q),
      )
    }
    return l.slice(0, 12)
  }, [itens, busca])

  return (
    <Card className="flex flex-col gap-3 rounded-2xl border-neutral-200/70 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-neutral-800">
          {cfg.plural} recentes
        </h2>
        <div className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2 py-1">
          <SearchIcon className="h-3.5 w-3.5 text-neutral-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar…"
            className="w-28 bg-transparent text-[12px] text-neutral-700 outline-none placeholder:text-neutral-300 sm:w-40"
          />
        </div>
      </div>

      {!itens ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-neutral-300" />
        </div>
      ) : lista.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center gap-1 text-sm text-neutral-400">
          <SearchIcon className="h-5 w-5" />
          Nenhum documento encontrado.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-[11px] uppercase tracking-wide text-neutral-400">
                <th className="py-2 pr-2 text-left font-medium">Nº</th>
                <th className="px-2 py-2 text-left font-medium">Data</th>
                <th className="px-2 py-2 text-left font-medium">{cfg.rotuloDoc}</th>
                <th className="px-2 py-2 text-left font-medium">Filial</th>
                <th className="px-2 py-2 text-left font-medium">Fornecedor</th>
                <th className="py-2 pl-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((d) => (
                <tr
                  key={d.id}
                  onClick={() => onOpen(d)}
                  className="cursor-pointer border-b border-neutral-50 transition-colors last:border-0 hover:bg-neutral-50"
                >
                  <td className="py-2 pr-2 font-mono text-[12px] font-medium text-neutral-900">
                    {d.numero}
                  </td>
                  <td className="px-2 py-2 text-neutral-600">
                    {fmtDataBR(d.dataIdentificacao)}
                  </td>
                  <td className="max-w-[220px] truncate px-2 py-2 text-neutral-700">
                    {tituloDoc(d)}
                  </td>
                  <td className="px-2 py-2 text-neutral-700">{d.filial.codigo}</td>
                  <td className="max-w-[160px] truncate px-2 py-2 text-neutral-700">
                    {d.fornecedor.razaoSocial}
                  </td>
                  <td className="py-2 pl-2 text-right">
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-neutral-600">
                      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[d.status])} />
                      {STATUS_LABEL[d.status]}
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

function DrillDocsModal({
  tipo,
  filtro,
  onClose,
  onOpen,
}: {
  tipo: TipoPainelDocs
  filtro: Filtro
  onClose: () => void
  onOpen: (d: Doc) => void
}) {
  const cfg = CONFIG[tipo]
  const [items, setItems] = React.useState<Doc[] | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)
  const [statusSel, setStatusSel] = React.useState<RncStatus | null>(null)

  React.useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(null)
    setErro(null)
    listar(tipo, { ...filtro.params, pageSize: 100 })
      .then((res) => {
        if (cancelled) return
        setItems(filtro.posFiltro ? res.filter(filtro.posFiltro) : res)
      })
      .catch((err) => {
        if (cancelled) return
        setErro(err instanceof ApiError ? err.message : 'Falha ao carregar.')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, JSON.stringify(filtro.params)])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const statusCounts = React.useMemo(() => {
    const m = new Map<RncStatus, number>()
    for (const d of items ?? []) m.set(d.status, (m.get(d.status) ?? 0) + 1)
    return m
  }, [items])

  const visiveis = (items ?? []).filter((d) => !statusSel || d.status === statusSel)

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-neutral-950/40 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-3.5">
          <div className="flex min-w-0 flex-col">
            <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
              Detalhamento · {tipo}
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
              Todos <span className="tabular-nums opacity-60">{items.length}</span>
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
              Nenhum documento neste recorte.
            </div>
          )}
          {visiveis.length > 0 && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-neutral-100 text-[11px] uppercase tracking-wide text-neutral-400">
                  <th className="px-5 py-2 text-left font-medium">Nº</th>
                  <th className="px-2 py-2 text-left font-medium">Data</th>
                  <th className="px-2 py-2 text-left font-medium">{cfg.rotuloDoc}</th>
                  <th className="px-2 py-2 text-left font-medium">Fornecedor</th>
                  <th className="px-5 py-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => onOpen(d)}
                    className="cursor-pointer border-b border-neutral-50 transition-colors last:border-0 hover:bg-neutral-50"
                  >
                    <td className="px-5 py-2 font-mono text-[12px] font-medium text-neutral-900">
                      {d.numero}
                    </td>
                    <td className="px-2 py-2 text-neutral-600">
                      {fmtDataBR(d.dataIdentificacao)}
                    </td>
                    <td className="max-w-[220px] truncate px-2 py-2 text-neutral-700">
                      {tituloDoc(d)}
                    </td>
                    <td className="px-2 py-2 text-neutral-700">{d.fornecedor.codigo}</td>
                    <td className="px-5 py-2 text-right">
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-neutral-600">
                        <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[d.status])} />
                        {STATUS_LABEL[d.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <footer className="border-t border-neutral-100 px-5 py-2 text-[11px] text-neutral-400">
          Clique em um documento para ver o detalhe completo.
        </footer>
      </div>
    </div>
  )
}
