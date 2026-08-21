import * as React from 'react'
import {
  Send,
  Search as SearchIcon,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api/client'
import { rncApi, type EnvioAssinatura, type RncStatus } from '@/lib/api/rnc'
import { DEFAULT_PAGE_SIZE, Pagination } from '@/components/cadastros/Pagination'
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

function fmtDataHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function progresso(e: EnvioAssinatura): { assinadas: number; total: number } {
  const ap = e.rnc?.aprovadores ?? []
  return { total: ap.length, assinadas: ap.filter((a) => a.assinadoEm).length }
}

function AssinaturaBadge({ e }: { e: EnvioAssinatura }) {
  const { total, assinadas } = progresso(e)
  let cls = 'border-neutral-200 bg-neutral-50 text-neutral-500'
  let label = 'Sem aprovadores'
  if (total > 0) {
    if (assinadas === 0) {
      cls = 'border-amber-200 bg-amber-50 text-amber-800'
      label = `Pendente · 0/${total}`
    } else if (assinadas < total) {
      cls = 'border-sky-200 bg-sky-50 text-sky-800'
      label = `Parcial · ${assinadas}/${total}`
    } else {
      cls = 'border-emerald-200 bg-emerald-50 text-emerald-800'
      label = `Assinado · ${total}/${total}`
    }
  }
  const titulo = (e.rnc?.aprovadores ?? [])
    .map((a) => `${a.assinadoEm ? '✓' : '○'} ${a.areaNome}: ${a.nome}`)
    .join('\n')
  return (
    <span
      title={titulo}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        cls,
      )}
    >
      {label}
    </span>
  )
}

export function WorkflowAssinaturasPage() {
  const [items, setItems] = React.useState<EnvioAssinatura[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [q, setQ] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)

  const fetchPage = React.useCallback(
    async (nextQ: string, nextPage: number) => {
      setLoading(true)
      setError(null)
      try {
        const res = await rncApi.listEnvios({
          q: nextQ.trim() || undefined,
          page: nextPage,
          pageSize: DEFAULT_PAGE_SIZE,
        })
        setItems(res.items)
        setTotal(res.total)
        setPage(res.page)
      } catch (err) {
        if (err instanceof ApiError) setError(err.message)
        else setError('Não foi possível carregar os envios. A API está rodando?')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  React.useEffect(() => {
    // Carga inicial (mesmo padrão das demais páginas de lista).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPage('', 1)
  }, [fetchPage])

  const handleSubmitSearch = (ev: React.FormEvent) => {
    ev.preventDefault()
    fetchPage(q, 1)
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Send className="h-5 w-5 text-neutral-500" />
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
            Workflows de Assinatura
          </h1>
        </div>
        <p className="text-sm text-neutral-500">
          Histórico de envios para assinatura (RNCs e RAQs) e o status de
          cada um.
        </p>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <form
          onSubmit={handleSubmitSearch}
          className="flex w-full max-w-md gap-2"
        >
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filtrar por código do documento (ex.: MATRIZ0626001)"
              className="pl-8"
            />
          </div>
          <Button type="submit" variant="outline" size="sm" className="h-9">
            Filtrar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => {
              setQ('')
              fetchPage('', 1)
            }}
            title="Limpar filtro"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </form>
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
                <th className="px-3 py-2.5 text-left font-medium">Código</th>
                <th className="px-3 py-2.5 text-left font-medium">Enviado em</th>
                <th className="px-3 py-2.5 text-left font-medium">Enviado por</th>
                <th className="px-3 py-2.5 text-left font-medium">Filial</th>
                <th className="px-3 py-2.5 text-left font-medium">Fornecedor</th>
                <th className="px-3 py-2.5 text-center font-medium">Destinatários</th>
                <th className="px-3 py-2.5 text-center font-medium">Assinaturas</th>
                <th className="px-3 py-2.5 text-center font-medium">Tipo</th>
                <th className="px-3 py-2.5 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr
                    key={`sk-${i}`}
                    className="border-b border-neutral-200 last:border-b-0"
                  >
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-3 py-4">
                        <Skeleton className="h-3.5 w-24" />
                      </td>
                    ))}
                  </tr>
                ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-10 text-center text-neutral-500"
                  >
                    {total === 0
                      ? 'Nenhum envio de workflow registrado ainda.'
                      : 'Nenhum envio corresponde ao filtro.'}
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-neutral-200 last:border-b-0 hover:bg-neutral-50/60"
                  >
                    <td className="px-3 py-3 font-mono font-medium text-neutral-900">
                      #{e.rncNumero}
                    </td>
                    <td className="px-3 py-3 text-neutral-700">
                      {fmtDataHora(e.enviadoEm)}
                    </td>
                    <td className="px-3 py-3 text-neutral-700">
                      {e.enviadoPorNome}
                    </td>
                    <td className="px-3 py-3 text-neutral-900">
                      {e.rnc?.filial ? (
                        <>
                          <div className="font-medium">{e.rnc.filial.codigo}</div>
                          <div className="text-xs text-neutral-500 line-clamp-1">
                            {e.rnc.filial.nome}
                          </div>
                        </>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-neutral-900">
                      {e.rnc?.fornecedor ? (
                        <>
                          <div className="font-medium">
                            {e.rnc.fornecedor.codigo}
                          </div>
                          <div className="text-xs text-neutral-500 line-clamp-1">
                            {e.rnc.fornecedor.razaoSocial}
                          </div>
                        </>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className="inline-flex items-center gap-1 text-neutral-700"
                        title={e.destinatarios
                          .map((d) => `${d.areaNome}: ${d.nome} <${d.email}>`)
                          .join('\n')}
                      >
                        <Send className="h-3.5 w-3.5 text-neutral-400" />
                        {e.totalDestinatarios}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <AssinaturaBadge e={e} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold',
                          e.rnc?.tipoDocumento === 'RAQ'
                            ? 'border-violet-200 bg-violet-50 text-violet-700'
                            : 'border-neutral-200 bg-neutral-50 text-neutral-700',
                        )}
                      >
                        {e.rnc?.tipoDocumento ?? 'RNC'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {e.rnc ? (
                        <span
                          className={cn(
                            'inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium',
                            STATUS_CLASS[e.rnc.status],
                          )}
                        >
                          {STATUS_LABELS[e.rnc.status]}
                        </span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
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
          onChange={(next) => fetchPage(q, next)}
          disabled={loading}
        />
      </Card>

      {!loading && total > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-neutral-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {total} envio(s) registrado(s) no histórico de workflows.
        </p>
      )}
    </div>
  )
}
