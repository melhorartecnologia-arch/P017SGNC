import * as React from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search as SearchIcon,
  RefreshCw,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api/client'
import { filiaisApi, type Filial } from '@/lib/api/filiais'
import type { TurnoTrabalho } from '@/lib/api/turnos-trabalho'
import { turnosTrabalhoApi } from '@/lib/api/turnos-trabalho'
import { TurnoTrabalhoForm } from './TurnoTrabalhoForm'
import { ExportXlsxButton } from './ExportXlsxButton'
import { ImportXlsxButton } from './ImportXlsxButton'
import { BulkDeleteToolbar } from './BulkDeleteToolbar'
import { DEFAULT_PAGE_SIZE, Pagination } from './Pagination'
import { useBulkSelection } from '@/lib/hooks/useBulkSelection'
import { fetchAllPaged, parseAtivo, pick } from '@/lib/utils/xlsx'

const selectClass =
  'flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900'

export function TurnoTrabalhoPage() {
  const [items, setItems] = React.useState<TurnoTrabalho[]>([])
  const [filiais, setFiliais] = React.useState<Filial[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [q, setQ] = React.useState('')
  const [filterFilial, setFilterFilial] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<TurnoTrabalho | null>(null)
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const selection = useBulkSelection(items)

  const fetchPage = React.useCallback(
    async (opts: { q?: string; filialId?: string; page: number }) => {
      setLoading(true)
      setError(null)
      try {
        const res = await turnosTrabalhoApi.list({
          q: opts.q?.trim() || undefined,
          filialId: opts.filialId || undefined,
          page: opts.page,
          pageSize: DEFAULT_PAGE_SIZE,
        })
        setItems(res.items)
        setTotal(res.total)
        setPage(res.page)
      } catch (err) {
        if (err instanceof ApiError) setError(err.message)
        else setError('Não foi possível carregar os turnos. A API está rodando?')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  React.useEffect(() => {
    let cancelled = false
    filiaisApi
      .list({ ativo: true, pageSize: 100 })
      .then((res) => {
        if (!cancelled) setFiliais(res.items)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Carrega ao mudar o filtro de filial — sempre volta pra página 1.
  React.useEffect(() => {
    fetchPage({ q, filialId: filterFilial, page: 1 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterFilial])

  const refresh = React.useCallback(
    () => fetchPage({ q, filialId: filterFilial, page }),
    [fetchPage, q, filterFilial, page],
  )

  const handleSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchPage({ q, filialId: filterFilial, page: 1 })
  }

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (t: TurnoTrabalho) => {
    setEditing(t)
    setDialogOpen(true)
  }

  const handleSaved = () => {
    setDialogOpen(false)
    refresh()
  }

  const handleDelete = async (id: string) => {
    const target = items.find((t) => t.id === id)
    setDeletingId(id)
    try {
      await turnosTrabalhoApi.remove(id)
      setItems((cur) => cur.filter((t) => t.id !== id))
      toast.success('Turno excluído', {
        description: target ? `${target.codigo} — ${target.nome}` : undefined,
      })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
        toast.error('Não foi possível excluir', { description: err.message })
      } else {
        setError('Erro ao excluir.')
        toast.error('Erro ao excluir')
      }
    } finally {
      setDeletingId(null)
      setConfirmingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-neutral-500" />
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
            Cadastro de Turnos de Trabalho
          </h1>
        </div>
        <p className="text-sm text-neutral-500">
          Horários das equipes <b>por filial</b>. Cada filial tem o seu
          próprio conjunto de turnos.
        </p>
      </header>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <form
          onSubmit={handleSubmitSearch}
          className="flex w-full max-w-2xl flex-col gap-2 sm:flex-row sm:items-center"
        >
          <div className="relative flex-1 min-w-[14rem]">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por código ou nome"
              className="pl-8"
            />
          </div>
          <select
            className={cn(selectClass, 'max-w-[16rem]')}
            value={filterFilial}
            onChange={(e) => setFilterFilial(e.target.value)}
          >
            <option value="">Todas as filiais</option>
            {filiais.map((f) => (
              <option key={f.id} value={f.id}>
                {f.codigo} — {f.nome}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline" size="sm" className="h-9">
            Buscar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => {
              setQ('')
              setFilterFilial('')
              fetchPage({ q: '', filialId: '', page: 1 })
            }}
            title="Limpar filtros"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </form>
        <div className="flex items-center gap-2">
          <ImportXlsxButton
            entityLabel="Turno"
            entityPlural="turnos"
            expectedHeaders={[
              {
                header: 'Filial (código)',
                required: true,
                help: 'código da filial já cadastrada',
              },
              { header: 'Código', required: true, help: 'único dentro da filial' },
              { header: 'Nome', required: true },
              {
                header: 'Hora início',
                required: true,
                help: 'formato HH:MM (24h), ex.: 06:00',
              },
              {
                header: 'Hora fim',
                required: true,
                help: 'formato HH:MM (24h), ex.: 14:00',
              },
              { header: 'Descrição' },
              { header: 'Situação', help: 'Ativo / Inativo (padrão Ativo)' },
            ]}
            notes={[
              'A filial deve existir previamente — informe o código exato.',
            ]}
            mapRow={async (row) => {
              const filialCodigo = pick(row, 'Filial (código)').toUpperCase()
              if (!filialCodigo) throw new Error('Filial (código) é obrigatório')
              let filial = filiais.find((f) => f.codigo === filialCodigo)
              if (!filial) {
                const res = await filiaisApi.list({ q: filialCodigo, pageSize: 5 })
                filial = res.items.find((f) => f.codigo === filialCodigo)
              }
              if (!filial) {
                throw new Error(`Filial não encontrada: ${filialCodigo}`)
              }
              return {
                filialId: filial.id,
                codigo: pick(row, 'Código'),
                nome: pick(row, 'Nome'),
                horaInicio: pick(row, 'Hora início'),
                horaFim: pick(row, 'Hora fim'),
                descricao: pick(row, 'Descrição') || null,
                ativo: parseAtivo(pick(row, 'Situação')),
              }
            }}
            importOne={(input) => turnosTrabalhoApi.create(input)}
            onDone={refresh}
          />
          <ExportXlsxButton
            filename="turnos-trabalho"
            sheetName="Turnos"
            rows={items}
            columns={[
              { header: 'Filial (código)', value: (t) => t.filial.codigo, width: 16 },
              { header: 'Filial', value: (t) => t.filial.nome, width: 28 },
              { header: 'Código', value: (t) => t.codigo, width: 14 },
              { header: 'Nome', value: (t) => t.nome, width: 22 },
              { header: 'Hora início', value: (t) => t.horaInicio, width: 14 },
              { header: 'Hora fim', value: (t) => t.horaFim, width: 14 },
              { header: 'Descrição', value: (t) => t.descricao ?? '', width: 40 },
              { header: 'Situação', value: (t) => (t.ativo ? 'Ativo' : 'Inativo'), width: 10 },
            ]}
            total={total}
            fetchAll={() =>
              fetchAllPaged((p) =>
                turnosTrabalhoApi.list({
                  q: q.trim() || undefined,
                  filialId: filterFilial || undefined,
                  ...p,
                }),
              )
            }
          />
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Novo turno
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="overflow-hidden rounded-xl border-neutral-200 bg-white p-0 shadow-sm">
        <BulkDeleteToolbar
          selectedItems={selection.selectedItems.map((t) => ({
            id: t.id,
            label: `${t.filial.codigo}/${t.codigo} — ${t.nome}`,
          }))}
          entityLabel="turno"
          entityPlural="turnos"
          deleteOne={(id) => turnosTrabalhoApi.remove(id)}
          onComplete={() => {
            selection.clear()
            refresh()
          }}
          onClearSelection={selection.clear}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/60 text-neutral-500">
                <th className="w-8 px-3 py-2.5">
                  <Checkbox
                    checked={selection.allSelected}
                    onCheckedChange={() => selection.toggleAll()}
                    aria-label="Selecionar todos"
                    disabled={items.length === 0}
                  />
                </th>
                <th className="px-3 py-2.5 text-left font-medium">Filial</th>
                <th className="px-3 py-2.5 text-left font-medium">Código</th>
                <th className="px-3 py-2.5 text-left font-medium">Nome</th>
                <th className="px-3 py-2.5 text-center font-medium">Horário</th>
                <th className="px-3 py-2.5 text-left font-medium">Descrição</th>
                <th className="px-3 py-2.5 text-center font-medium">Situação</th>
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
                    <td className="w-8 px-3 py-4">
                      <Skeleton className="h-4 w-4 rounded" />
                    </td>
                    <td className="px-3 py-4">
                      <Skeleton className="h-3.5 w-28" />
                    </td>
                    <td className="px-3 py-4">
                      <Skeleton className="h-3.5 w-20" />
                    </td>
                    <td className="px-3 py-4">
                      <Skeleton className="h-3.5 w-32" />
                    </td>
                    <td className="px-3 py-4">
                      <Skeleton className="mx-auto h-5 w-28" />
                    </td>
                    <td className="px-3 py-4">
                      <Skeleton className="h-3.5 w-60" />
                    </td>
                    <td className="px-3 py-4">
                      <Skeleton className="mx-auto h-5 w-14" />
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex justify-end gap-1">
                        <Skeleton className="h-7 w-7 rounded-md" />
                        <Skeleton className="h-7 w-7 rounded-md" />
                      </div>
                    </td>
                  </tr>
                ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-neutral-500">
                    Nenhum turno cadastrado.
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-neutral-200 last:border-b-0 hover:bg-neutral-50/60"
                  >
                    <td className="w-8 px-3 py-3">
                      <Checkbox
                        checked={selection.isSelected(t.id)}
                        onCheckedChange={() => selection.toggle(t.id)}
                        aria-label={`Selecionar ${t.codigo}`}
                      />
                    </td>
                    <td className="px-3 py-3 text-neutral-900">
                      <div className="font-medium">{t.filial.codigo}</div>
                      <div className="text-xs text-neutral-500 line-clamp-1">
                        {t.filial.nome}
                      </div>
                    </td>
                    <td className="px-3 py-3 font-medium text-neutral-900">{t.codigo}</td>
                    <td className="px-3 py-3 font-medium text-neutral-900">{t.nome}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-xs font-medium text-neutral-700">
                        {t.horaInicio} → {t.horaFim}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-neutral-700">
                      {t.descricao ? (
                        <span className="line-clamp-1">{t.descricao}</span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={
                          t.ativo
                            ? 'inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700'
                            : 'inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-xs font-medium text-neutral-600'
                        }
                      >
                        {t.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(t)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => setConfirmingId(t.id)}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
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
          onChange={(next) => fetchPage({ q, filialId: filterFilial, page: next })}
          disabled={loading}
        />
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar turno' : 'Novo turno'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Atualize o cadastro do turno de trabalho.'
                : 'Cadastre um novo turno de trabalho para uma filial.'}
            </DialogDescription>
          </DialogHeader>
          <TurnoTrabalhoForm
            initial={editing}
            defaultFilialId={filterFilial || undefined}
            onSaved={handleSaved}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmingId !== null} onOpenChange={(o) => !o && setConfirmingId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir turno?</DialogTitle>
            <DialogDescription>Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmingId(null)}
              disabled={deletingId !== null}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmingId && handleDelete(confirmingId)}
              disabled={deletingId !== null}
            >
              {deletingId !== null && <Loader2 className="h-4 w-4 animate-spin" />}
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
