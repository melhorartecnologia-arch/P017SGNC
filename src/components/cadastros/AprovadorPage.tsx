import * as React from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search as SearchIcon,
  RefreshCw,
  UserCheck,
  Phone,
  MessageCircle,
  Mail,
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
import type { Aprovador } from '@/lib/api/aprovadores'
import { aprovadoresApi } from '@/lib/api/aprovadores'
import { filiaisApi, type Filial } from '@/lib/api/filiais'
import { areasApi, type Area } from '@/lib/api/areas'
import { turnosTrabalhoApi } from '@/lib/api/turnos-trabalho'
import { AprovadorForm } from './AprovadorForm'
import { ExportXlsxButton } from './ExportXlsxButton'
import { ImportXlsxButton } from './ImportXlsxButton'
import { BulkDeleteToolbar } from './BulkDeleteToolbar'
import { DEFAULT_PAGE_SIZE, Pagination } from './Pagination'
import { useBulkSelection } from '@/lib/hooks/useBulkSelection'
import { fetchAllPaged, parseAtivo, pick } from '@/lib/utils/xlsx'

const selectClass =
  'flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900'

export function AprovadorPage() {
  const [items, setItems] = React.useState<Aprovador[]>([])
  const [filiais, setFiliais] = React.useState<Filial[]>([])
  const [areas, setAreas] = React.useState<Area[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [q, setQ] = React.useState('')
  const [filterFilial, setFilterFilial] = React.useState('')
  const [filterArea, setFilterArea] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Aprovador | null>(null)
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const selection = useBulkSelection(items)

  const fetchPage = React.useCallback(
    async (opts: {
      q?: string
      filialId?: string
      areaId?: string
      page: number
    }) => {
      setLoading(true)
      setError(null)
      try {
        const res = await aprovadoresApi.list({
          q: opts.q?.trim() || undefined,
          filialId: opts.filialId || undefined,
          areaId: opts.areaId || undefined,
          page: opts.page,
          pageSize: DEFAULT_PAGE_SIZE,
        })
        setItems(res.items)
        setTotal(res.total)
        setPage(res.page)
      } catch (err) {
        if (err instanceof ApiError) setError(err.message)
        else setError('Não foi possível carregar os aprovadores. A API está rodando?')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  React.useEffect(() => {
    let mounted = true
    Promise.all([
      filiaisApi.list({ pageSize: 100 }),
      areasApi.list({ pageSize: 100 }),
    ])
      .then(([f, a]) => {
        if (!mounted) return
        setFiliais(f.items)
        setAreas(a.items)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  // Carrega ao mudar de filtro filial/area — sempre volta para a página 1.
  React.useEffect(() => {
    fetchPage({ q, filialId: filterFilial, areaId: filterArea, page: 1 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterFilial, filterArea])

  const refresh = React.useCallback(
    () =>
      fetchPage({
        q,
        filialId: filterFilial,
        areaId: filterArea,
        page,
      }),
    [fetchPage, q, filterFilial, filterArea, page],
  )

  const handleSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchPage({ q, filialId: filterFilial, areaId: filterArea, page: 1 })
  }

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (a: Aprovador) => {
    setEditing(a)
    setDialogOpen(true)
  }

  const handleSaved = () => {
    setDialogOpen(false)
    refresh()
  }

  const handleDelete = async (id: string) => {
    const target = items.find((a) => a.id === id)
    setDeletingId(id)
    try {
      await aprovadoresApi.remove(id)
      setItems((cur) => cur.filter((a) => a.id !== id))
      toast.success('Aprovador excluído', { description: target?.nome })
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
          <UserCheck className="h-5 w-5 text-neutral-500" />
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
            Cadastro de Aprovadores
          </h1>
        </div>
        <p className="text-sm text-neutral-500">
          Aprovadores por filial e área, com seus contatos.
        </p>
      </header>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <form
          onSubmit={handleSubmitSearch}
          className="flex w-full max-w-3xl flex-col gap-2 sm:flex-row sm:items-center"
        >
          <div className="relative flex-1 min-w-[14rem]">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, e-mail ou cargo"
              className="pl-8"
            />
          </div>
          <select
            className={selectClass + ' max-w-[12rem]'}
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
          <select
            className={selectClass + ' max-w-[12rem]'}
            value={filterArea}
            onChange={(e) => setFilterArea(e.target.value)}
          >
            <option value="">Todas as áreas</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.codigo} — {a.nome}
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
              setFilterArea('')
              fetchPage({ q: '', filialId: '', areaId: '', page: 1 })
            }}
            title="Limpar filtros"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </form>
        <div className="flex items-center gap-2">
          <ImportXlsxButton
            entityLabel="Aprovador"
            entityPlural="aprovadores"
            expectedHeaders={[
              {
                header: 'Filial (código)',
                required: true,
                help: 'código da filial já cadastrada',
              },
              {
                header: 'Área (código)',
                required: true,
                help: 'código da área já cadastrada',
              },
              { header: 'Nível', required: true, help: 'número inteiro >= 1' },
              {
                header: 'Turno (código)',
                help: 'opcional — código do turno dentro da filial',
              },
              { header: 'Nome', required: true },
              { header: 'Cargo' },
              { header: 'E-mail', required: true },
              { header: 'Telefone' },
              { header: 'WhatsApp' },
              { header: 'Situação', help: 'Ativo / Inativo (padrão Ativo)' },
              { header: 'Observações' },
            ]}
            notes={[
              'Filial e Área devem existir previamente — informe o código exato cadastrado.',
              'O turno (opcional) é buscado dentro da filial informada.',
            ]}
            mapRow={async (row) => {
              const filialCodigo = pick(row, 'Filial (código)').toUpperCase()
              const areaCodigo = pick(row, 'Área (código)').toUpperCase()
              if (!filialCodigo) throw new Error('Filial (código) é obrigatório')
              if (!areaCodigo) throw new Error('Área (código) é obrigatório')

              let filial = filiais.find((f) => f.codigo === filialCodigo)
              if (!filial) {
                const res = await filiaisApi.list({ q: filialCodigo, pageSize: 5 })
                filial = res.items.find((f) => f.codigo === filialCodigo)
              }
              if (!filial) {
                throw new Error(`Filial não encontrada: ${filialCodigo}`)
              }
              let area = areas.find((a) => a.codigo === areaCodigo)
              if (!area) {
                const res = await areasApi.list({ q: areaCodigo, pageSize: 5 })
                area = res.items.find((a) => a.codigo === areaCodigo)
              }
              if (!area) {
                throw new Error(`Área não encontrada: ${areaCodigo}`)
              }

              const nivelRaw = pick(row, 'Nível')
              const nivel = Number(nivelRaw)
              if (!Number.isFinite(nivel) || nivel < 1) {
                throw new Error('Nível inválido (use inteiro >= 1)')
              }

              const turnoCodigo = pick(row, 'Turno (código)').toUpperCase()
              let turnoId: string | null = null
              if (turnoCodigo) {
                const tRes = await turnosTrabalhoApi.list({
                  q: turnoCodigo,
                  filialId: filial.id,
                  pageSize: 5,
                })
                const turno = tRes.items.find((t) => t.codigo === turnoCodigo)
                if (!turno) {
                  throw new Error(
                    `Turno "${turnoCodigo}" não encontrado na filial ${filial.codigo}.`,
                  )
                }
                turnoId = turno.id
              }

              return {
                filialId: filial.id,
                areaId: area.id,
                turnoId,
                nivel: Math.trunc(nivel),
                nome: pick(row, 'Nome'),
                cargo: pick(row, 'Cargo') || null,
                email: pick(row, 'E-mail'),
                telefone: pick(row, 'Telefone') || null,
                whatsapp: pick(row, 'WhatsApp') || null,
                ativo: parseAtivo(pick(row, 'Situação')),
                observacoes: pick(row, 'Observações') || null,
              }
            }}
            importOne={(input) => aprovadoresApi.create(input)}
            onDone={refresh}
          />
          <ExportXlsxButton
            filename="aprovadores"
            sheetName="Aprovadores"
            rows={items}
            columns={[
              { header: 'Filial (código)', value: (a) => a.filial.codigo, width: 16 },
              { header: 'Filial', value: (a) => a.filial.nome, width: 28 },
              { header: 'Área (código)', value: (a) => a.area.codigo, width: 16 },
              { header: 'Área', value: (a) => a.area.nome, width: 22 },
              { header: 'Nível', value: (a) => a.nivel, width: 8 },
              {
                header: 'Turno (código)',
                value: (a) => a.turno?.codigo ?? '',
                width: 14,
              },
              {
                header: 'Turno',
                value: (a) => a.turno?.nome ?? '',
                width: 18,
              },
              { header: 'Nome', value: (a) => a.nome, width: 28 },
              { header: 'Cargo', value: (a) => a.cargo ?? '', width: 22 },
              { header: 'E-mail', value: (a) => a.email, width: 30 },
              { header: 'Telefone', value: (a) => a.telefone ?? '', width: 16 },
              { header: 'WhatsApp', value: (a) => a.whatsapp ?? '', width: 16 },
              { header: 'Situação', value: (a) => (a.ativo ? 'Ativo' : 'Inativo'), width: 10 },
              { header: 'Observações', value: (a) => a.observacoes ?? '', width: 40 },
            ]}
            total={total}
            fetchAll={() =>
              fetchAllPaged((p) =>
                aprovadoresApi.list({
                  q: q.trim() || undefined,
                  filialId: filterFilial || undefined,
                  areaId: filterArea || undefined,
                  ...p,
                }),
              )
            }
          />
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Novo aprovador
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
          selectedItems={selection.selectedItems.map((a) => ({
            id: a.id,
            label: `${a.filial.codigo}/${a.area.codigo} — ${a.nome}`,
          }))}
          entityLabel="aprovador"
          entityPlural="aprovadores"
          deleteOne={(id) => aprovadoresApi.remove(id)}
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
                <th className="px-3 py-2.5 text-left font-medium">Área</th>
                <th className="px-3 py-2.5 text-center font-medium">Nível</th>
                <th className="px-3 py-2.5 text-left font-medium">Turno</th>
                <th className="px-3 py-2.5 text-left font-medium">Aprovador</th>
                <th className="px-3 py-2.5 text-left font-medium">Contatos</th>
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
                      <Skeleton className="h-3.5 w-24" />
                    </td>
                    <td className="px-3 py-4">
                      <Skeleton className="h-3.5 w-24" />
                    </td>
                    <td className="px-3 py-4">
                      <Skeleton className="mx-auto h-6 w-8" />
                    </td>
                    <td className="px-3 py-4">
                      <Skeleton className="h-3.5 w-20" />
                    </td>
                    <td className="px-3 py-4">
                      <Skeleton className="h-3.5 w-40" />
                      <Skeleton className="mt-1.5 h-3 w-28" />
                    </td>
                    <td className="px-3 py-4">
                      <Skeleton className="h-3 w-44" />
                      <Skeleton className="mt-1.5 h-3 w-36" />
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
                  <td colSpan={9} className="px-3 py-10 text-center text-neutral-500">
                    Nenhum aprovador encontrado.
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-neutral-200 last:border-b-0 hover:bg-neutral-50/60"
                  >
                    <td className="w-8 px-3 py-3">
                      <Checkbox
                        checked={selection.isSelected(a.id)}
                        onCheckedChange={() => selection.toggle(a.id)}
                        aria-label="Selecionar"
                      />
                    </td>
                    <td className="px-3 py-3 text-neutral-700">
                      <div className="text-xs text-neutral-500">{a.filial.codigo}</div>
                      <div className="text-sm">{a.filial.nome}</div>
                    </td>
                    <td className="px-3 py-3 text-neutral-700">
                      <div className="text-xs text-neutral-500">{a.area.codigo}</div>
                      <div className="text-sm">{a.area.nome}</div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 px-1.5 text-xs font-semibold tabular-nums text-neutral-700">
                        {a.nivel}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-neutral-700">
                      {a.turno ? (
                        <>
                          <div className="font-medium text-neutral-900">
                            {a.turno.codigo}
                          </div>
                          <div className="text-xs text-neutral-500 line-clamp-1">
                            {a.turno.nome}
                          </div>
                        </>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-neutral-900">
                      <div className="font-medium">{a.nome}</div>
                      {a.cargo && (
                        <div className="text-xs text-neutral-500">{a.cargo}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-neutral-700">
                      <div className="flex flex-col gap-0.5">
                        <div className="inline-flex items-center gap-1.5 text-xs">
                          <Mail className="h-3 w-3 text-neutral-500" />
                          <span className="break-all">{a.email}</span>
                        </div>
                        {a.telefone && (
                          <div className="inline-flex items-center gap-1.5 text-xs">
                            <Phone className="h-3 w-3 text-neutral-500" />
                            <span>{a.telefone}</span>
                          </div>
                        )}
                        {a.whatsapp && (
                          <div className="inline-flex items-center gap-1.5 text-xs">
                            <MessageCircle className="h-3 w-3 text-neutral-500" />
                            <span>{a.whatsapp}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={
                          a.ativo
                            ? 'inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700'
                            : 'inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-xs font-medium text-neutral-600'
                        }
                      >
                        {a.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(a)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => setConfirmingId(a.id)}
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
          onChange={(next) =>
            fetchPage({
              q,
              filialId: filterFilial,
              areaId: filterArea,
              page: next,
            })
          }
          disabled={loading}
        />
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Editar aprovador' : 'Novo aprovador'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? 'Atualize os dados do aprovador e seus contatos.'
                : 'Cadastre um aprovador para uma filial e área.'}
            </DialogDescription>
          </DialogHeader>
          <AprovadorForm
            initial={editing}
            onSaved={handleSaved}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmingId !== null} onOpenChange={(o) => !o && setConfirmingId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir aprovador?</DialogTitle>
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
