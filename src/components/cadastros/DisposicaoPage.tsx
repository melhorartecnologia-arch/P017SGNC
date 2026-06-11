import * as React from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search as SearchIcon,
  RefreshCw,
  PackageCheck,
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
import { ApiError } from '@/lib/api/client'
import type { Disposicao } from '@/lib/api/disposicoes'
import { disposicoesApi } from '@/lib/api/disposicoes'
import { DisposicaoForm } from './DisposicaoForm'
import { TiposRelatorioBadges } from './TiposRelatorioMultiSelect'
import { ExportXlsxButton } from './ExportXlsxButton'
import { ImportXlsxButton } from './ImportXlsxButton'
import { BulkDeleteToolbar } from './BulkDeleteToolbar'
import { DEFAULT_PAGE_SIZE, Pagination } from './Pagination'
import { useBulkSelection } from '@/lib/hooks/useBulkSelection'
import { fetchAllPaged, joinCodigos, parseAtivo, pick } from '@/lib/utils/xlsx'

export function DisposicaoPage() {
  const [items, setItems] = React.useState<Disposicao[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [q, setQ] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Disposicao | null>(null)
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const selection = useBulkSelection(items)

  const fetchPage = React.useCallback(async (nextQ: string, nextPage: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await disposicoesApi.list({
        q: nextQ.trim() || undefined,
        page: nextPage,
        pageSize: DEFAULT_PAGE_SIZE,
      })
      setItems(res.items)
      setTotal(res.total)
      setPage(res.page)
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
      else setError('Não foi possível carregar as disposições. A API está rodando?')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchPage('', 1)
  }, [fetchPage])

  const refresh = React.useCallback(() => fetchPage(q, page), [fetchPage, q, page])

  const handleSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchPage(q, 1)
  }

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (d: Disposicao) => {
    setEditing(d)
    setDialogOpen(true)
  }

  const handleSaved = () => {
    setDialogOpen(false)
    refresh()
  }

  const handleDelete = async (id: string) => {
    const target = items.find((d) => d.id === id)
    setDeletingId(id)
    try {
      await disposicoesApi.remove(id)
      setItems((cur) => cur.filter((d) => d.id !== id))
      toast.success('Disposição excluída', {
        description: target ? `${target.codigo} — ${target.descricao}` : undefined,
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
          <PackageCheck className="h-5 w-5 text-neutral-500" />
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
            Cadastro de Disposição do Material
          </h1>
        </div>
        <p className="text-sm text-neutral-500">
          Destinos possíveis para o material objeto da não conformidade (ex.:
          retrabalho, sucata, devolução, aceitar sob concessão).
        </p>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSubmitSearch} className="flex w-full max-w-md gap-2">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por código ou descrição"
              className="pl-8"
            />
          </div>
          <Button type="submit" variant="outline" size="sm" className="h-9">
            Buscar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => {
              setQ('')
              fetchPage('', 1)
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </form>
        <div className="flex items-center gap-2">
          <ImportXlsxButton
            entityLabel="Disposição"
            entityPlural="disposições"
            expectedHeaders={[
              { header: 'Código', required: true },
              { header: 'Descrição', required: true },
              { header: 'Situação', help: 'Ativa / Inativa (padrão Ativa)' },
            ]}
            notes={[
              'Vínculos com Tipos de Relatório não são importados. Edite cada disposição depois, se necessário.',
            ]}
            mapRow={(row) => ({
              codigo: pick(row, 'Código'),
              descricao: pick(row, 'Descrição'),
              ativo: parseAtivo(pick(row, 'Situação')),
            })}
            importOne={(input) => disposicoesApi.create(input)}
            onDone={refresh}
          />
          <ExportXlsxButton
            filename="disposicoes-material"
            sheetName="Disposições"
            rows={items}
            columns={[
              { header: 'Código', value: (d) => d.codigo, width: 16 },
              { header: 'Descrição', value: (d) => d.descricao, width: 40 },
              {
                header: 'Tipos de relatório',
                value: (d) => joinCodigos(d.tiposRelatorio),
                width: 28,
              },
              { header: 'Situação', value: (d) => (d.ativo ? 'Ativa' : 'Inativa'), width: 10 },
            ]}
            total={total}
            fetchAll={() => fetchAllPaged((p) => disposicoesApi.list({ q: q.trim() || undefined, ...p }))}
          />
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Nova disposição
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
          selectedItems={selection.selectedItems.map((d) => ({
            id: d.id,
            label: `${d.codigo} — ${d.descricao}`,
          }))}
          entityLabel="disposição"
          entityPlural="disposições"
          deleteOne={(id) => disposicoesApi.remove(id)}
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
                <th className="px-3 py-2.5 text-left font-medium">Código</th>
                <th className="px-3 py-2.5 text-left font-medium">Descrição</th>
                <th className="px-3 py-2.5 text-left font-medium">Tipos de relatório</th>
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
                      <Skeleton className="h-3.5 w-20" />
                    </td>
                    <td className="px-3 py-4">
                      <Skeleton className="h-3.5 w-72" />
                    </td>
                    <td className="px-3 py-4">
                      <Skeleton className="h-5 w-16 rounded-md" />
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
                  <td colSpan={6} className="px-3 py-10 text-center text-neutral-500">
                    Nenhuma disposição cadastrada.
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-neutral-200 last:border-b-0 hover:bg-neutral-50/60"
                  >
                    <td className="w-8 px-3 py-3">
                      <Checkbox
                        checked={selection.isSelected(d.id)}
                        onCheckedChange={() => selection.toggle(d.id)}
                        aria-label="Selecionar"
                      />
                    </td>
                    <td className="px-3 py-3 font-medium text-neutral-900">{d.codigo}</td>
                    <td className="px-3 py-3 text-neutral-700">
                      <span className="line-clamp-1">{d.descricao}</span>
                    </td>
                    <td className="px-3 py-3">
                      <TiposRelatorioBadges items={d.tiposRelatorio} empty="—" />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={
                          d.ativo
                            ? 'inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700'
                            : 'inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-xs font-medium text-neutral-600'
                        }
                      >
                        {d.ativo ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(d)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => setConfirmingId(d.id)}
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
          onChange={(next) => fetchPage(q, next)}
          disabled={loading}
        />
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Editar disposição' : 'Nova disposição'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? 'Atualize o cadastro da disposição.'
                : 'Cadastre uma nova disposição de material.'}
            </DialogDescription>
          </DialogHeader>
          <DisposicaoForm
            initial={editing}
            onSaved={handleSaved}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmingId !== null} onOpenChange={(o) => !o && setConfirmingId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir disposição?</DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita.
            </DialogDescription>
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
