import * as React from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search as SearchIcon,
  RefreshCw,
  FileWarning,
  Layers,
  ListTree,
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
import type {
  ProdutoRef,
  TipoNaoConformidade,
} from '@/lib/api/tipos-nao-conformidade'
import { tiposNaoConformidadeApi } from '@/lib/api/tipos-nao-conformidade'
import { severidadesApi } from '@/lib/api/severidades'
import { produtosApi } from '@/lib/api/produtos'
import { TipoNaoConformidadeForm } from './TipoNaoConformidadeForm'
import { ProdutosBadges } from './ProdutosMultiSelect'
import { ExportXlsxButton } from './ExportXlsxButton'
import { ImportXlsxButton } from './ImportXlsxButton'
import { BulkDeleteToolbar } from './BulkDeleteToolbar'
import { DEFAULT_PAGE_SIZE, Pagination } from './Pagination'
import { useBulkSelection } from '@/lib/hooks/useBulkSelection'
import {
  fetchAllPaged,
  joinCodigos,
  parseAtivo,
  pick,
  splitCodigos,
} from '@/lib/utils/xlsx'

type View = 'grouped' | 'flat'

type FlatRow = {
  tipo: TipoNaoConformidade
  produto: ProdutoRef | null
}

export function TipoNaoConformidadePage() {
  const [items, setItems] = React.useState<TipoNaoConformidade[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [q, setQ] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [view, setView] = React.useState<View>('grouped')
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<TipoNaoConformidade | null>(null)
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const selection = useBulkSelection(items)

  const flatRows = React.useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = []
    for (const tipo of items) {
      if (tipo.produtos.length === 0) {
        rows.push({ tipo, produto: null })
      } else {
        for (const produto of tipo.produtos) rows.push({ tipo, produto })
      }
    }
    return rows
  }, [items])

  const fetchPage = React.useCallback(async (nextQ: string, nextPage: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await tiposNaoConformidadeApi.list({
        q: nextQ.trim() || undefined,
        page: nextPage,
        pageSize: DEFAULT_PAGE_SIZE,
      })
      setItems(res.items)
      setTotal(res.total)
      setPage(res.page)
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
      else setError('Não foi possível carregar os tipos de não conformidade. A API está rodando?')
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

  const openEdit = (t: TipoNaoConformidade) => {
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
      await tiposNaoConformidadeApi.remove(id)
      setItems((cur) => cur.filter((t) => t.id !== id))
      toast.success('Tipo de não conformidade excluído', {
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
          <FileWarning className="h-5 w-5 text-neutral-500" />
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
            Cadastro de Tipos de Não Conformidade
          </h1>
        </div>
        <p className="text-sm text-neutral-500">
          Categorias do desvio identificado (ex.: dimensional, contaminação,
          etiqueta). Podem ser vinculadas a produtos específicos.
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
          <div
            role="tablist"
            aria-label="Modo de visualização"
            className="inline-flex h-9 items-center rounded-md border border-neutral-200 bg-white p-0.5 text-sm"
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === 'grouped'}
              onClick={() => setView('grouped')}
              className={
                view === 'grouped'
                  ? 'inline-flex items-center gap-1.5 rounded-[5px] bg-neutral-200 px-2.5 py-1 text-neutral-900'
                  : 'inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-neutral-600 hover:text-neutral-900'
              }
              title="Uma linha por tipo, com os produtos como pílulas"
            >
              <Layers className="h-3.5 w-3.5" />
              Agrupado
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'flat'}
              onClick={() => setView('flat')}
              className={
                view === 'flat'
                  ? 'inline-flex items-center gap-1.5 rounded-[5px] bg-neutral-200 px-2.5 py-1 text-neutral-900'
                  : 'inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-neutral-600 hover:text-neutral-900'
              }
              title="Uma linha por relação tipo × produto"
            >
              <ListTree className="h-3.5 w-3.5" />
              Por produto
            </button>
          </div>
          <ImportXlsxButton
            entityLabel="Tipo de Não Conformidade"
            entityPlural="tipos de não conformidade"
            expectedHeaders={[
              { header: 'Código', required: true },
              { header: 'Descrição', required: true },
              {
                header: 'Severidade (código)',
                help: 'opcional — código da severidade típica do defeito',
              },
              {
                header: 'Produtos (códigos)',
                help: 'opcional — códigos dos produtos a vincular, separados por vírgula ou ponto-e-vírgula (ex.: PRD001; PRD002)',
              },
              { header: 'Situação', help: 'Ativo / Inativo (padrão Ativo)' },
            ]}
            notes={[
              'Use o layout "Agrupado" da exportação como modelo: uma linha por tipo, com os códigos dos produtos na coluna "Produtos (códigos)".',
              'Os produtos informados precisam já estar cadastrados; códigos não encontrados apontam erro na linha correspondente.',
            ]}
            mapRow={async (row) => {
              const severidadeCodigo = pick(row, 'Severidade (código)').toUpperCase()
              let severidadeId: string | null = null
              if (severidadeCodigo) {
                const res = await severidadesApi.list({
                  q: severidadeCodigo,
                  pageSize: 5,
                })
                const sev = res.items.find((s) => s.codigo === severidadeCodigo)
                if (!sev) {
                  throw new Error(`Severidade não encontrada: ${severidadeCodigo}`)
                }
                severidadeId = sev.id
              }

              // Vincula produtos pelos códigos informados (resolvendo para IDs).
              const codigosProdutos = splitCodigos(pick(row, 'Produtos (códigos)'))
              const produtosIds: string[] = []
              for (const codigo of codigosProdutos) {
                const res = await produtosApi.list({ q: codigo, pageSize: 10 })
                const prod = res.items.find(
                  (p) => p.codigo.toUpperCase() === codigo,
                )
                if (!prod) {
                  throw new Error(`Produto não encontrado: ${codigo}`)
                }
                produtosIds.push(prod.id)
              }

              return {
                codigo: pick(row, 'Código'),
                descricao: pick(row, 'Descrição'),
                severidadeId,
                ativo: parseAtivo(pick(row, 'Situação')),
                produtosIds,
              }
            }}
            importOne={(input) => tiposNaoConformidadeApi.create(input)}
            onDone={refresh}
          />
          {view === 'grouped' ? (
            <ExportXlsxButton
              filename="tipos-nao-conformidade"
              sheetName="Tipos NC"
              rows={items}
              columns={[
                { header: 'Código', value: (t) => t.codigo, width: 14 },
                { header: 'Descrição', value: (t) => t.descricao, width: 48 },
                {
                  header: 'Severidade (código)',
                  value: (t) => t.severidade?.codigo ?? '',
                  width: 16,
                },
                {
                  header: 'Severidade',
                  value: (t) => t.severidade?.nome ?? '',
                  width: 20,
                },
                {
                  header: 'Produtos (códigos)',
                  value: (t) => joinCodigos(t.produtos),
                  width: 36,
                },
                { header: 'Qtd. produtos', value: (t) => t.produtos.length, width: 14 },
                { header: 'Situação', value: (t) => (t.ativo ? 'Ativo' : 'Inativo'), width: 10 },
              ]}
              total={total}
              fetchAll={() =>
                fetchAllPaged((p) =>
                  tiposNaoConformidadeApi.list({ q: q.trim() || undefined, ...p }),
                )
              }
            />
          ) : (
            <ExportXlsxButton
              filename="tipos-nao-conformidade-por-produto"
              sheetName="Tipos NC × Produto"
              rows={flatRows}
              columns={[
                { header: 'Tipo (código)', value: (r) => r.tipo.codigo, width: 14 },
                { header: 'Tipo (descrição)', value: (r) => r.tipo.descricao, width: 36 },
                { header: 'Produto (código)', value: (r) => r.produto?.codigo ?? '', width: 14 },
                {
                  header: 'Produto (descrição)',
                  value: (r) => r.produto?.descricao ?? '',
                  width: 36,
                },
                {
                  header: 'Unidade',
                  value: (r) => r.produto?.unidadeMedida ?? '',
                  width: 10,
                },
                {
                  header: 'Situação',
                  value: (r) => (r.tipo.ativo ? 'Ativo' : 'Inativo'),
                  width: 10,
                },
              ]}
              fetchAll={async () => {
                const tipos = await fetchAllPaged((p) =>
                  tiposNaoConformidadeApi.list({ q: q.trim() || undefined, ...p }),
                )
                const rows: FlatRow[] = []
                for (const tipo of tipos) {
                  if (tipo.produtos.length === 0) {
                    rows.push({ tipo, produto: null })
                  } else {
                    for (const produto of tipo.produtos) rows.push({ tipo, produto })
                  }
                }
                return rows
              }}
            />
          )}
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Novo tipo
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="overflow-hidden rounded-xl border-neutral-200 bg-white p-0 shadow-sm">
        {view === 'grouped' && (
          <BulkDeleteToolbar
            selectedItems={selection.selectedItems.map((t) => ({
              id: t.id,
              label: `${t.codigo} — ${t.descricao}`,
            }))}
            entityLabel="tipo de não conformidade"
            entityPlural="tipos de não conformidade"
            deleteOne={(id) => tiposNaoConformidadeApi.remove(id)}
            onComplete={() => {
              selection.clear()
              refresh()
            }}
            onClearSelection={selection.clear}
          />
        )}
        <div className="overflow-x-auto">
          {view === 'grouped' ? (
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
                  <th className="px-3 py-2.5 text-left font-medium">Severidade</th>
                  <th className="px-3 py-2.5 text-left font-medium">Produtos</th>
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
                        <Skeleton className="h-5 w-20 rounded-md" />
                      </td>
                      <td className="px-3 py-4">
                        <Skeleton className="h-5 w-24 rounded-md" />
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
                    <td colSpan={7} className="px-3 py-10 text-center text-neutral-500">
                      Nenhum tipo de não conformidade cadastrado.
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
                      <td className="px-3 py-3 font-medium text-neutral-900">{t.codigo}</td>
                      <td className="px-3 py-3 text-neutral-700">
                        <span className="line-clamp-1">{t.descricao}</span>
                      </td>
                      <td className="px-3 py-3">
                        {t.severidade ? (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-xs font-medium text-neutral-700"
                            title={`Nível ${t.severidade.nivel} — ${t.severidade.nome}`}
                          >
                            <span
                              className="inline-block h-2 w-2 shrink-0 rounded-full border border-neutral-200"
                              style={{ backgroundColor: t.severidade.cor ?? '#a3a3a3' }}
                            />
                            {t.severidade.codigo}
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <ProdutosBadges items={t.produtos} empty="—" />
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
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/60 text-neutral-500">
                  <th className="px-3 py-2.5 text-left font-medium">Tipo</th>
                  <th className="px-3 py-2.5 text-left font-medium">Descrição do tipo</th>
                  <th className="px-3 py-2.5 text-left font-medium">Produto</th>
                  <th className="px-3 py-2.5 text-left font-medium">Descrição do produto</th>
                  <th className="px-3 py-2.5 text-center font-medium">Unidade</th>
                  <th className="px-3 py-2.5 text-center font-medium">Situação</th>
                  <th className="w-16 px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {loading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr
                      key={`sk-flat-${i}`}
                      className="border-b border-neutral-200 last:border-b-0"
                    >
                      <td className="px-3 py-4">
                        <Skeleton className="h-3.5 w-16" />
                      </td>
                      <td className="px-3 py-4">
                        <Skeleton className="h-3.5 w-48" />
                      </td>
                      <td className="px-3 py-4">
                        <Skeleton className="h-3.5 w-16" />
                      </td>
                      <td className="px-3 py-4">
                        <Skeleton className="h-3.5 w-56" />
                      </td>
                      <td className="px-3 py-4">
                        <Skeleton className="mx-auto h-5 w-10" />
                      </td>
                      <td className="px-3 py-4">
                        <Skeleton className="mx-auto h-5 w-14" />
                      </td>
                      <td className="px-3 py-4">
                        <Skeleton className="ml-auto h-7 w-7 rounded-md" />
                      </td>
                    </tr>
                  ))}
                {!loading && flatRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-neutral-500">
                      Nenhum tipo de não conformidade cadastrado.
                    </td>
                  </tr>
                )}
                {!loading &&
                  flatRows.map((row, idx) => (
                    <tr
                      key={`${row.tipo.id}-${row.produto?.id ?? 'none'}-${idx}`}
                      className="border-b border-neutral-200 last:border-b-0 hover:bg-neutral-50/60"
                    >
                      <td className="px-3 py-3 font-medium text-neutral-900">
                        {row.tipo.codigo}
                      </td>
                      <td className="px-3 py-3 text-neutral-700">
                        <span className="line-clamp-1">{row.tipo.descricao}</span>
                      </td>
                      <td className="px-3 py-3 font-medium text-neutral-900">
                        {row.produto?.codigo ?? (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-neutral-700">
                        {row.produto ? (
                          <span className="line-clamp-1">{row.produto.descricao}</span>
                        ) : (
                          <span className="text-neutral-400 italic">
                            Sem produto vinculado
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {row.produto ? (
                          <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-xs font-medium text-neutral-700">
                            {row.produto.unidadeMedida}
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={
                            row.tipo.ativo
                              ? 'inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700'
                              : 'inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-xs font-medium text-neutral-600'
                          }
                        >
                          {row.tipo.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(row.tipo)}
                            title="Editar tipo"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
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
              {editing
                ? 'Editar tipo de não conformidade'
                : 'Novo tipo de não conformidade'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? 'Atualize o cadastro do tipo de não conformidade.'
                : 'Cadastre um novo tipo de não conformidade.'}
            </DialogDescription>
          </DialogHeader>
          <TipoNaoConformidadeForm
            initial={editing}
            onSaved={handleSaved}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmingId !== null} onOpenChange={(o) => !o && setConfirmingId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir tipo de não conformidade?</DialogTitle>
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
