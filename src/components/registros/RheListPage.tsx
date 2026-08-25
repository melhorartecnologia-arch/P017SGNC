import * as React from 'react'
import {
  PackageCheck,
  RefreshCw,
  Plus,
  Pencil,
  Eye,
  Download,
  Loader2,
  MailCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api/client'
import { rncApi, resumoAssinaturas, type RncStatus } from '@/lib/api/rnc'
import {
  rheApi,
  HOMOLOGACAO_LABELS,
  type HomologacaoResultado,
  type Rhe,
} from '@/lib/api/rhe'
import { DEFAULT_PAGE_SIZE, Pagination } from '@/components/cadastros/Pagination'
import { RheWizard } from './RheWizard'
import { RheDetailPanel } from './RheDetailPanel'
import { cn } from '@/lib/utils'

const STATUS_LABELS: Record<RncStatus, string> = {
  DRAFT: 'Rascunho',
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em andamento',
  CLOSED: 'Encerrado',
  CANCELLED: 'Cancelado',
}

const STATUS_CLASS: Record<RncStatus, string> = {
  DRAFT: 'border-neutral-200 bg-neutral-50 text-neutral-700',
  OPEN: 'border-amber-200 bg-amber-50 text-amber-800',
  IN_PROGRESS: 'border-sky-200 bg-sky-50 text-sky-800',
  CLOSED: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  CANCELLED: 'border-red-200 bg-red-50 text-red-700',
}

const HOMOLOGACAO_CLASS: Record<HomologacaoResultado, string> = {
  APROVADO: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  REPROVADO: 'border-red-200 bg-red-50 text-red-700',
  APROVADO_COM_RESTRICAO: 'border-amber-200 bg-amber-50 text-amber-800',
}

const selectClass =
  'flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900'

function fmtData(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** Homologação exibida: a final quando registrada; senão a inicial. */
function homologacaoBadge(r: Rhe): {
  valor: HomologacaoResultado
  rotulo: string
} | null {
  if (r.homologacaoFinal) {
    return {
      valor: r.homologacaoFinal,
      rotulo: `Final: ${HOMOLOGACAO_LABELS[r.homologacaoFinal]}`,
    }
  }
  if (r.homologacaoInicial) {
    return {
      valor: r.homologacaoInicial,
      rotulo: `Inicial: ${HOMOLOGACAO_LABELS[r.homologacaoInicial]}`,
    }
  }
  return null
}

/** Lista dos Relatórios de Homologação de Embalagem. */
export function RheListPage() {
  const [items, setItems] = React.useState<Rhe[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [statusFilter, setStatusFilter] = React.useState<'' | RncStatus>('')
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [wizardOpen, setWizardOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Rhe | null>(null)
  const [viewing, setViewing] = React.useState<Rhe | null>(null)
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null)

  const fetchPage = React.useCallback(
    async (opts: { status?: RncStatus | ''; page: number }) => {
      setLoading(true)
      setError(null)
      try {
        const res = await rheApi.list({
          status: opts.status || undefined,
          page: opts.page,
          pageSize: DEFAULT_PAGE_SIZE,
        })
        setItems(res.items)
        setTotal(res.total)
        setPage(res.page)
      } catch (err) {
        if (err instanceof ApiError) setError(err.message)
        else setError('Não foi possível carregar os RHEs. A API está rodando?')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  React.useEffect(() => {
    fetchPage({ status: statusFilter, page: 1 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  const handleDownload = async (r: Rhe) => {
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

  const atualizarItem = (atualizado: Rhe) => {
    setViewing((prev) => (prev?.id === atualizado.id ? atualizado : prev))
    setItems((cur) => cur.map((it) => (it.id === atualizado.id ? atualizado : it)))
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <PackageCheck className="h-5 w-5 text-neutral-500" />
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
            Relatórios de Homologação de Embalagem
          </h1>
        </div>
        <p className="text-sm text-neutral-500">
          RHEs assinados pelos aprovadores do tipo e pelos representantes
          técnicos do fornecedor; ao final o PDF assinado vai por e-mail ao
          fornecedor.
        </p>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => {
              setStatusFilter('')
              fetchPage({ status: '', page: 1 })
            }}
            title="Limpar filtros"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <Button
          onClick={() => {
            setEditing(null)
            setWizardOpen(true)
          }}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Novo RHE
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="overflow-hidden rounded-xl border-neutral-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/60 text-neutral-500">
                <th className="px-3 py-2.5 text-left font-medium">Nº</th>
                <th className="px-3 py-2.5 text-left font-medium">Título</th>
                <th className="px-3 py-2.5 text-left font-medium">Data</th>
                <th className="px-3 py-2.5 text-left font-medium">Filial</th>
                <th className="px-3 py-2.5 text-left font-medium">Fornecedor</th>
                <th className="px-3 py-2.5 text-center font-medium">Homologação</th>
                <th className="px-3 py-2.5 text-center font-medium">Status</th>
                <th className="px-3 py-2.5 text-center font-medium">Assinaturas</th>
                <th className="px-3 py-2.5 text-center font-medium">Fornecedor avisado</th>
                <th className="w-24 px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-neutral-100">
                    <td colSpan={10} className="px-3 py-2.5">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-neutral-400">
                    Nenhum RHE cadastrado. Clique em "Novo RHE" para criar o
                    primeiro.
                  </td>
                </tr>
              ) : (
                items.map((r) => {
                  const homolog = homologacaoBadge(r)
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-neutral-100 transition-colors last:border-0 hover:bg-neutral-50/60"
                    >
                      <td className="px-3 py-2.5 font-mono text-[13px] font-medium text-neutral-900">
                        {r.numero}
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-2.5 text-neutral-800">
                        {r.titulo ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-neutral-700">
                        {fmtData(r.dataIdentificacao)}
                      </td>
                      <td className="px-3 py-2.5 text-neutral-700">{r.filial.codigo}</td>
                      <td className="max-w-[180px] truncate px-3 py-2.5 text-neutral-700">
                        {r.fornecedor.razaoSocial}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {homolog ? (
                          <span
                            className={cn(
                              'inline-flex items-center whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium',
                              HOMOLOGACAO_CLASS[homolog.valor],
                            )}
                          >
                            {homolog.rotulo}
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium',
                            STATUS_CLASS[r.status],
                          )}
                        >
                          {STATUS_LABELS[r.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-neutral-600">
                        {resumoAssinaturas(r).label}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {r.enviadoFornecedorEm ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
                            title={`Enviado a ${r.enviadoFornecedorPara}`}
                          >
                            <MailCheck className="h-3 w-3" />
                            Enviado
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Visualizar RHE"
                            onClick={() => setViewing(r)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Baixar PDF"
                            disabled={downloadingId === r.id}
                            onClick={() => handleDownload(r)}
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
                            title="Editar RHE"
                            onClick={() => {
                              setEditing(r)
                              setWizardOpen(true)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          pageSize={DEFAULT_PAGE_SIZE}
          total={total}
          onChange={(next: number) =>
            fetchPage({ status: statusFilter, page: next })
          }
        />
      </Card>

      <RheWizard
        open={wizardOpen}
        onOpenChange={(next) => {
          setWizardOpen(next)
          if (!next) {
            setEditing(null)
            fetchPage({ status: statusFilter, page })
          }
        }}
        initial={editing}
        onCreated={() => fetchPage({ status: statusFilter, page: 1 })}
        onUpdated={atualizarItem}
      />

      <RheDetailPanel
        rhe={viewing}
        onClose={() => setViewing(null)}
        onEdit={(r) => {
          setViewing(null)
          setEditing(r)
          setWizardOpen(true)
        }}
        onUpdated={atualizarItem}
      />
    </div>
  )
}
