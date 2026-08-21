import * as React from 'react'
import {
  FileWarning,
  RefreshCw,
  Search as SearchIcon,
  Plus,
  Pencil,
  Eye,
  Download,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api/client'
import {
  rncApi,
  resumoAssinaturas,
  CIENCIA_RNC_LABEL,
  CONTINGENCIA_RNC_LABEL,
  type AssinaturaStatus,
  type CienciaRncStatus,
  type ContingenciaRncStatus,
  type CausaRaizRncStatus,
  type EficaciaRncStatus,
  type Rnc,
  type RncStatus,
} from '@/lib/api/rnc'
import { DEFAULT_PAGE_SIZE, Pagination } from '@/components/cadastros/Pagination'
import { RncWizard } from './RncWizard'
import { RncDetailPanel } from './RncDetailPanel'
import { cn } from '@/lib/utils'

const STATUS_LABELS: Record<RncStatus, string> = {
  DRAFT: 'Rascunho',
  OPEN: 'Aberta',
  IN_PROGRESS: 'Em andamento',
  CLOSED: 'Encerrada',
  CANCELLED: 'Cancelada',
}

const STATUS_CLASS: Record<RncStatus, string> = {
  DRAFT: 'border-neutral-200 bg-neutral-50 text-neutral-700',
  OPEN: 'border-amber-200 bg-amber-50 text-amber-800',
  IN_PROGRESS: 'border-sky-200 bg-sky-50 text-sky-800',
  CLOSED: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  CANCELLED: 'border-red-200 bg-red-50 text-red-700',
}

const selectClass =
  'flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900'

const ASSINATURA_CLASS: Record<AssinaturaStatus['estado'], string> = {
  vazio: 'border-neutral-200 bg-neutral-50 text-neutral-500',
  pendente: 'border-amber-200 bg-amber-50 text-amber-800',
  parcial: 'border-sky-200 bg-sky-50 text-sky-800',
  completo: 'border-emerald-200 bg-emerald-50 text-emerald-800',
}

/** Selo da ciência do fornecedor na listagem. */
function CienciaBadge({ rnc }: { rnc: Rnc }) {
  const st = rnc.cienciaStatus
  if (!st) {
    return <span className="text-xs text-neutral-300">—</span>
  }
  const classe =
    st === 'PENDENTE'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : st === 'RECUSADA'
        ? 'border-orange-200 bg-orange-50 text-orange-700'
        : st === 'MANTIDA_DEFINITIVA'
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
  const curto =
    st === 'PENDENTE'
      ? 'Aguardando'
      : st === 'RECUSADA'
        ? 'Em análise'
        : st === 'ACEITA'
          ? 'Aceita'
          : st === 'RECUSA_ACEITA'
            ? 'Recusa acatada'
            : st === 'MANTIDA_DEFINITIVA'
              ? 'Definitiva'
              : 'Aceita (prazo)'
  return (
    <span
      title={CIENCIA_RNC_LABEL[st]}
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium',
        classe,
      )}
    >
      {curto}
    </span>
  )
}

function AssinaturaBadge({ rnc }: { rnc: Rnc }) {
  const s = resumoAssinaturas(rnc)
  const titulo =
    s.estado === 'vazio'
      ? 'Nenhum aprovador definido para esta RNC'
      : rnc.aprovadores
          .map(
            (a) =>
              `${a.assinadoEm ? '✓' : '○'} ${a.areaNome}: ${a.nome}`,
          )
          .join('\n')
  return (
    <span
      title={titulo}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        ASSINATURA_CLASS[s.estado],
      )}
    >
      {s.label}
    </span>
  )
}

function formatDataBR(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** Prazo já vencido? Fica fora do render para não depender do relógio. */
function prazoVencido(prazo: string | null | undefined): boolean {
  if (!prazo) return false
  const ms = new Date(prazo).getTime()
  return !Number.isNaN(ms) && ms <= Date.now()
}

/** Situação do plano de ações de contingência, para a lista. */
function ContingenciaBadge({ rnc }: { rnc: Rnc }) {
  const st = rnc.contingenciaStatus
  if (!st) return <span className="text-xs text-neutral-300">—</span>

  const emAberto = st === 'PENDENTE' || st === 'AJUSTE_SOLICITADO'
  const atrasada = emAberto && prazoVencido(rnc.contingenciaPrazoEm)

  const cor = atrasada
    ? 'border-red-200 bg-red-50 text-red-700'
    : st === 'APROVADA'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : st === 'EM_ANALISE'
        ? 'border-sky-200 bg-sky-50 text-sky-700'
        : 'border-amber-200 bg-amber-50 text-amber-700'

  return (
    <span
      className={cn(
        'inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium',
        cor,
      )}
      title={
        atrasada
          ? `${CONTINGENCIA_RNC_LABEL[st]} — prazo vencido`
          : CONTINGENCIA_RNC_LABEL[st]
      }
    >
      {atrasada ? 'Em atraso' : CONTINGENCIA_RNC_LABEL[st]}
    </span>
  )
}

export function RncListPage() {
  const [items, setItems] = React.useState<Rnc[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [q, setQ] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<'' | RncStatus>('')
  const [cienciaFilter, setCienciaFilter] = React.useState<
    '' | CienciaRncStatus | '__none__'
  >('')
  // "atrasada" é um recorte de PENDENTE: só as fora do prazo.
  const [contingenciaFilter, setContingenciaFilter] = React.useState<
    '' | ContingenciaRncStatus | '__none__' | 'atrasada'
  >('')
  const [causaFilter, setCausaFilter] = React.useState<
    '' | CausaRaizRncStatus | '__none__'
  >('')
  const [eficaciaFilter, setEficaciaFilter] = React.useState<
    '' | EficaciaRncStatus | '__none__'
  >('')
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [wizardOpen, setWizardOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Rnc | null>(null)
  const [viewing, setViewing] = React.useState<Rnc | null>(null)
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null)

  const handleDownload = async (r: Rnc) => {
    setDownloadingId(r.id)
    try {
      await rncApi.downloadPdf(r.id, r.numero)
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Falha ao gerar o PDF.'
      toast.error('Não foi possível baixar o PDF', { description: message })
    } finally {
      setDownloadingId(null)
    }
  }

  const fetchPage = React.useCallback(
    async (opts: {
      status?: RncStatus | ''
      ciencia?: CienciaRncStatus | '__none__' | ''
      contingencia?: ContingenciaRncStatus | '__none__' | 'atrasada' | ''
      causa?: CausaRaizRncStatus | '__none__' | ''
      eficacia?: EficaciaRncStatus | '__none__' | ''
      page: number
    }) => {
      setLoading(true)
      setError(null)
      try {
        const res = await rncApi.list({
          status: opts.status || undefined,
          cienciaStatus: opts.ciencia || undefined,
          contingenciaStatus:
            opts.contingencia && opts.contingencia !== 'atrasada'
              ? opts.contingencia
              : undefined,
          contingenciaAtrasada: opts.contingencia === 'atrasada' || undefined,
          causaRaizStatus: opts.causa || undefined,
          eficaciaStatus: opts.eficacia || undefined,
          page: opts.page,
          pageSize: DEFAULT_PAGE_SIZE,
        })
        setItems(res.items)
        setTotal(res.total)
        setPage(res.page)
      } catch (err) {
        if (err instanceof ApiError) setError(err.message)
        else setError('Não foi possível carregar os RNCs. A API está rodando?')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  React.useEffect(() => {
    fetchPage({
      status: statusFilter,
      ciencia: cienciaFilter,
      contingencia: contingenciaFilter,
      causa: causaFilter,
      eficacia: eficaciaFilter,
      page: 1,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    statusFilter,
    cienciaFilter,
    contingenciaFilter,
    causaFilter,
    eficaciaFilter,
  ])

  const refresh = React.useCallback(
    () =>
      fetchPage({
        status: statusFilter,
        ciencia: cienciaFilter,
        contingencia: contingenciaFilter,
        causa: causaFilter,
        eficacia: eficaciaFilter,
        page,
      }),
    [
      fetchPage,
      statusFilter,
      cienciaFilter,
      contingenciaFilter,
      causaFilter,
      eficaciaFilter,
      page,
    ],
  )

  const handleSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // A API atual não filtra por texto livre — o input só estreita visualmente
    // o que já está na página. Para um filtro completo (q), expor no backend
    // depois.
  }

  // Filtro client-side leve por texto (número, fornecedor, tipo NC).
  const visible = React.useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return items
    return items.filter(
      (r) =>
        r.numero.toLowerCase().includes(term) ||
        r.fornecedor.razaoSocial.toLowerCase().includes(term) ||
        r.fornecedor.codigo.toLowerCase().includes(term) ||
        r.tipoNaoConformidade.codigo.toLowerCase().includes(term) ||
        r.tipoNaoConformidade.descricao.toLowerCase().includes(term) ||
        r.filial.codigo.toLowerCase().includes(term),
    )
  }, [items, q])

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <FileWarning className="h-5 w-5 text-neutral-500" />
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
            Relatórios de Não Conformidade
          </h1>
        </div>
        <p className="text-sm text-neutral-500">
          Lista de RNCs cadastradas. Clique em "Nova RNC" para iniciar um novo
          rascunho.
        </p>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <form
          onSubmit={handleSubmitSearch}
          className="flex w-full max-w-2xl flex-col gap-2 sm:flex-row sm:items-center"
        >
          <div className="relative flex-1 min-w-[14rem]">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filtrar por número, fornecedor, tipo ou filial"
              className="pl-8"
            />
          </div>
          <select
            className={cn(selectClass, 'max-w-[12rem]')}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | RncStatus)}
          >
            <option value="">Todos os status</option>
            {(Object.keys(STATUS_LABELS) as RncStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select
            className={cn(selectClass, 'max-w-[14rem]')}
            value={cienciaFilter}
            onChange={(e) =>
              setCienciaFilter(
                e.target.value as '' | CienciaRncStatus | '__none__',
              )
            }
            title="Ciência do fornecedor"
          >
            <option value="">Toda ciência do fornecedor</option>
            <option value="__none__">Ainda não enviada</option>
            {(Object.keys(CIENCIA_RNC_LABEL) as CienciaRncStatus[]).map((c) => (
              <option key={c} value={c}>
                {CIENCIA_RNC_LABEL[c]}
              </option>
            ))}
          </select>
          <select
            className={cn(selectClass, 'max-w-[14rem]')}
            value={contingenciaFilter}
            onChange={(e) =>
              setContingenciaFilter(
                e.target.value as
                  | ''
                  | ContingenciaRncStatus
                  | '__none__'
                  | 'atrasada',
              )
            }
            title="Ações de contingência do fornecedor"
          >
            <option value="">Todas as ações de contingência</option>
            <option value="__none__">Não solicitadas</option>
            <option value="PENDENTE">Aguardando o plano</option>
            <option value="atrasada">Plano em atraso</option>
            <option value="EM_ANALISE">Plano para aprovar</option>
            <option value="AJUSTE_SOLICITADO">Devolvido para ajuste</option>
            <option value="APROVADA">Plano aprovado</option>
          </select>
          <select
            className={cn(selectClass, 'max-w-[13rem]')}
            value={causaFilter}
            onChange={(e) =>
              setCausaFilter(e.target.value as '' | CausaRaizRncStatus | '__none__')
            }
            title="Análise de causa (Ishikawa e 5W2H)"
          >
            <option value="">Toda análise de causa</option>
            <option value="__none__">Não iniciada</option>
            <option value="PENDENTE">Aguardando o fornecedor</option>
            <option value="EM_ANALISE">Análise para aprovar</option>
            <option value="AJUSTE_SOLICITADO">Rejeitada — em ajuste</option>
            <option value="APROVADA">Análise aprovada</option>
          </select>
          <select
            className={cn(selectClass, 'max-w-[13rem]')}
            value={eficaciaFilter}
            onChange={(e) =>
              setEficaciaFilter(
                e.target.value as '' | EficaciaRncStatus | '__none__',
              )
            }
            title="Verificação de eficácia"
          >
            <option value="">Toda verificação de eficácia</option>
            <option value="__none__">Não iniciada</option>
            <option value="AGUARDANDO_PRAZO">Aguardando o prazo</option>
            <option value="PENDENTE">Verificação liberada</option>
            <option value="EFICAZ">Eficaz</option>
            <option value="NAO_EFICAZ">Não eficaz</option>
          </select>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => {
              setQ('')
              setStatusFilter('')
              setCienciaFilter('')
              setContingenciaFilter('')
              setCausaFilter('')
              setEficaciaFilter('')
              fetchPage({
                status: '',
                ciencia: '',
                contingencia: '',
                causa: '',
                eficacia: '',
                page: 1,
              })
            }}
            title="Limpar filtros"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </form>
        <Button
          onClick={() => {
            setEditing(null)
            setWizardOpen(true)
          }}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Nova RNC
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="overflow-hidden rounded-xl border-neutral-200 bg-white p-0 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/60 text-neutral-500">
                <th className="px-3 py-2.5 text-left font-medium">Nº</th>
                <th className="px-3 py-2.5 text-left font-medium">Data</th>
                <th className="px-3 py-2.5 text-left font-medium">Filial</th>
                <th className="px-3 py-2.5 text-left font-medium">Fornecedor</th>
                <th className="px-3 py-2.5 text-left font-medium">Tipo NC</th>
                <th className="px-3 py-2.5 text-left font-medium">Turno</th>
                <th className="px-3 py-2.5 text-center font-medium">Status</th>
                <th className="px-3 py-2.5 text-center font-medium">Assinaturas</th>
                <th className="px-3 py-2.5 text-center font-medium">Ciência</th>
                <th className="px-3 py-2.5 text-center font-medium">Ações</th>
                <th className="px-3 py-2.5 text-left font-medium">Criado por</th>
                <th className="w-24 px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr
                    key={`sk-${i}`}
                    className="border-b border-neutral-200 last:border-b-0"
                  >
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} className="px-3 py-4">
                        <Skeleton className="h-3.5 w-24" />
                      </td>
                    ))}
                    <td className="px-3 py-4">
                      <Skeleton className="ml-auto h-7 w-7 rounded-md" />
                    </td>
                  </tr>
                ))}
              {!loading && visible.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-3 py-10 text-center text-neutral-500"
                  >
                    {total === 0
                      ? 'Nenhuma RNC cadastrada ainda.'
                      : 'Nenhuma RNC corresponde ao filtro.'}
                  </td>
                </tr>
              )}
              {!loading &&
                visible.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-neutral-200 last:border-b-0 hover:bg-neutral-50/60"
                  >
                    <td className="px-3 py-3 font-mono font-medium text-neutral-900">
                      #{r.numero}
                    </td>
                    <td className="px-3 py-3 text-neutral-700">
                      {formatDataBR(r.dataIdentificacao)}
                    </td>
                    <td className="px-3 py-3 text-neutral-900">
                      <div className="font-medium">{r.filial.codigo}</div>
                      <div className="text-xs text-neutral-500 line-clamp-1">
                        {r.filial.nome}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-neutral-900">
                      <div className="font-medium">{r.fornecedor.codigo}</div>
                      <div className="text-xs text-neutral-500 line-clamp-1">
                        {r.fornecedor.razaoSocial}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-neutral-900">
                      <div className="flex items-center gap-1.5">
                        {r.tipoNaoConformidade.severidade && (
                          <span
                            className="inline-block h-2 w-2 shrink-0 rounded-full border border-neutral-200"
                            style={{
                              backgroundColor:
                                r.tipoNaoConformidade.severidade.cor ?? '#a3a3a3',
                            }}
                            title={`Nível ${r.tipoNaoConformidade.severidade.nivel} — ${r.tipoNaoConformidade.severidade.nome}`}
                          />
                        )}
                        <span className="font-medium">
                          {r.tipoNaoConformidade.codigo}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-500 line-clamp-1">
                        {r.tipoNaoConformidade.descricao}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-neutral-700">
                      {r.turno ? (
                        <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-xs font-medium text-neutral-700">
                          {r.turno.codigo}
                        </span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium',
                          STATUS_CLASS[r.status],
                        )}
                      >
                        {STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <AssinaturaBadge rnc={r} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <CienciaBadge rnc={r} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <ContingenciaBadge rnc={r} />
                    </td>
                    <td className="px-3 py-3 text-neutral-700">
                      <div className="line-clamp-1 text-sm">
                        {r.criadoPor.nome}
                      </div>
                      <div className="text-xs text-neutral-500 line-clamp-1">
                        {r.criadoPor.email}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setViewing(r)}
                          title="Visualizar RNC"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDownload(r)}
                          disabled={downloadingId === r.id}
                          title="Baixar PDF do RNC"
                        >
                          {downloadingId === r.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditing(r)
                            setWizardOpen(true)
                          }}
                          title="Editar RNC"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          pageSize={DEFAULT_PAGE_SIZE}
          total={total}
          onChange={(next) =>
            fetchPage({
              status: statusFilter,
              ciencia: cienciaFilter,
              contingencia: contingenciaFilter,
              causa: causaFilter,
              eficacia: eficaciaFilter,
              page: next,
            })
          }
          disabled={loading}
        />
      </Card>

      <RncWizard
        open={wizardOpen}
        onOpenChange={(next) => {
          setWizardOpen(next)
          if (!next) setEditing(null)
        }}
        initial={editing}
        onCreated={() => refresh()}
        onUpdated={(updated) => {
          refresh()
          // Se o painel de detalhes estava aberto pro mesmo RNC, sincroniza
          // os dados sem precisar reabrir.
          setViewing((prev) => (prev?.id === updated.id ? updated : prev))
        }}
      />

      <RncDetailPanel
        rnc={viewing}
        onClose={() => setViewing(null)}
        onEdit={(r) => {
          setViewing(null)
          setEditing(r)
          setWizardOpen(true)
        }}
        onUpdated={(updated) => {
          setViewing((prev) => (prev?.id === updated.id ? updated : prev))
          setItems((cur) =>
            cur.map((it) => (it.id === updated.id ? updated : it)),
          )
        }}
      />
    </div>
  )
}
