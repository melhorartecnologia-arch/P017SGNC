import * as React from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search as SearchIcon,
  RefreshCw,
  Truck,
  Phone,
  MessageCircle,
  Mail,
  Star,
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
import type { ContatoInput, ContatoTipo, Fornecedor } from '@/lib/api/fornecedores'
import { fornecedoresApi } from '@/lib/api/fornecedores'
import { cn } from '@/lib/utils'
import { FornecedorForm } from './FornecedorForm'
import { OrigemCadastroBadge } from './OrigemCadastroBadge'
import { ExportXlsxButton } from './ExportXlsxButton'
import { ImportXlsxButton } from './ImportXlsxButton'
import { BulkDeleteToolbar } from './BulkDeleteToolbar'
import { DEFAULT_PAGE_SIZE, Pagination } from './Pagination'
import { useBulkSelection } from '@/lib/hooks/useBulkSelection'
import { fetchAllPaged, parseAtivo, pick, splitLista } from '@/lib/utils/xlsx'

const TIPO_ICON: Record<ContatoTipo, React.ComponentType<{ className?: string }>> = {
  TELEFONE_FIXO: Phone,
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
}

export function FornecedorPage() {
  const [items, setItems] = React.useState<Fornecedor[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [q, setQ] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Fornecedor | null>(null)
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const selection = useBulkSelection(items)

  const fetchPage = React.useCallback(async (nextQ: string, nextPage: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fornecedoresApi.list({
        q: nextQ.trim() || undefined,
        page: nextPage,
        pageSize: DEFAULT_PAGE_SIZE,
      })
      setItems(res.items)
      setTotal(res.total)
      setPage(res.page)
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
      else setError('Não foi possível carregar os fornecedores. A API está rodando?')
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

  const openEdit = (f: Fornecedor) => {
    setEditing(f)
    setDialogOpen(true)
  }

  const handleSaved = () => {
    setDialogOpen(false)
    refresh()
  }

  const handleDelete = async (id: string) => {
    const target = items.find((f) => f.id === id)
    setDeletingId(id)
    try {
      await fornecedoresApi.remove(id)
      setItems((cur) => cur.filter((f) => f.id !== id))
      toast.success('Fornecedor excluído', {
        description: target ? `${target.codigo} — ${target.razaoSocial}` : undefined,
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
          <Truck className="h-5 w-5 text-neutral-500" />
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
            Cadastro de Fornecedores
          </h1>
        </div>
        <p className="text-sm text-neutral-500">
          Fornecedores de insumos, produtos e serviços, com seus contatos.
        </p>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSubmitSearch} className="flex w-full max-w-md gap-2">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por código, razão social, fantasia ou CNPJ"
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
            entityLabel="Fornecedor"
            entityPlural="fornecedores"
            expectedHeaders={[
              { header: 'Código', required: true },
              { header: 'Razão social', required: true },
              { header: 'Nome fantasia' },
              { header: 'CNPJ', required: true },
              {
                header: 'Telefones fixos',
                help: 'opcional — um ou mais, separados por ; (ex.: (24) 3333-4444; (24) 3333-5555)',
              },
              {
                header: 'WhatsApps',
                help: 'opcional — um ou mais, separados por ; (ex.: (24) 99999-8888)',
              },
              {
                header: 'E-mails',
                help: 'opcional — um ou mais, separados por ; (ex.: compras@empresa.com; fiscal@empresa.com)',
              },
              { header: 'Situação', help: 'Ativo / Inativo (padrão Ativo)' },
              { header: 'Observações' },
            ]}
            notes={[
              'Os contatos são importados pelas colunas Telefones fixos, WhatsApps e E-mails — cada uma aceita vários valores separados por ponto-e-vírgula.',
              'O primeiro contato informado (na ordem telefone fixo → WhatsApp → e-mail) é marcado como principal.',
            ]}
            mapRow={(row) => {
              // Monta os contatos a partir das colunas de cada tipo clicável.
              const contatos: ContatoInput[] = [
                ...splitLista(pick(row, 'Telefones fixos')).map((valor) => ({
                  tipo: 'TELEFONE_FIXO' as ContatoTipo,
                  valor,
                  principal: false,
                })),
                ...splitLista(pick(row, 'WhatsApps')).map((valor) => ({
                  tipo: 'WHATSAPP' as ContatoTipo,
                  valor,
                  principal: false,
                })),
                ...splitLista(pick(row, 'E-mails')).map((valor) => ({
                  tipo: 'EMAIL' as ContatoTipo,
                  valor,
                  principal: false,
                })),
              ]
              if (contatos.length > 0) contatos[0].principal = true
              return {
                codigo: pick(row, 'Código'),
                razaoSocial: pick(row, 'Razão social'),
                nomeFantasia: pick(row, 'Nome fantasia') || null,
                cnpj: pick(row, 'CNPJ'),
                ativo: parseAtivo(pick(row, 'Situação')),
                observacoes: pick(row, 'Observações') || null,
                contatos,
              }
            }}
            importOne={(input) => fornecedoresApi.create(input)}
            onDone={refresh}
          />
          <ExportXlsxButton
            filename="fornecedores"
            sheetName="Fornecedores"
            rows={items}
            columns={[
              { header: 'Código', value: (f) => f.codigo, width: 14 },
              { header: 'Razão social', value: (f) => f.razaoSocial, width: 36 },
              { header: 'Nome fantasia', value: (f) => f.nomeFantasia ?? '', width: 28 },
              { header: 'CNPJ', value: (f) => f.cnpj, width: 22 },
              {
                header: 'Telefones fixos',
                value: (f) =>
                  f.contatos
                    .filter((c) => c.tipo === 'TELEFONE_FIXO')
                    .map((c) => c.valor)
                    .join('; '),
                width: 28,
              },
              {
                header: 'WhatsApps',
                value: (f) =>
                  f.contatos
                    .filter((c) => c.tipo === 'WHATSAPP')
                    .map((c) => c.valor)
                    .join('; '),
                width: 24,
              },
              {
                header: 'E-mails',
                value: (f) =>
                  f.contatos
                    .filter((c) => c.tipo === 'EMAIL')
                    .map((c) => c.valor)
                    .join('; '),
                width: 32,
              },
              { header: 'Situação', value: (f) => (f.ativo ? 'Ativo' : 'Inativo'), width: 10 },
              {
                header: 'Origem do cadastro',
                value: (f) => (f.origemCadastro === 'PROTHEUS' ? 'Protheus' : 'Plataforma'),
                width: 18,
              },
              { header: 'Observações', value: (f) => f.observacoes ?? '', width: 40 },
            ]}
            total={total}
            fetchAll={() => fetchAllPaged((p) => fornecedoresApi.list({ q: q.trim() || undefined, ...p }))}
          />
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Novo fornecedor
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
          selectedItems={selection.selectedItems.map((f) => ({
            id: f.id,
            label: `${f.codigo} — ${f.razaoSocial}`,
          }))}
          entityLabel="fornecedor"
          entityPlural="fornecedores"
          deleteOne={(id) => fornecedoresApi.remove(id)}
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
                <th className="px-3 py-2.5 text-left font-medium">Razão Social</th>
                <th className="px-3 py-2.5 text-left font-medium">CNPJ</th>
                <th className="px-3 py-2.5 text-left font-medium">Contatos</th>
                <th className="px-3 py-2.5 text-center font-medium">Situação</th>
                <th className="px-3 py-2.5 text-center font-medium">Origem</th>
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
                      <Skeleton className="h-3.5 w-16" />
                    </td>
                    <td className="px-3 py-4">
                      <Skeleton className="h-3.5 w-48" />
                      <Skeleton className="mt-1.5 h-3 w-32" />
                    </td>
                    <td className="px-3 py-4">
                      <Skeleton className="h-3.5 w-32" />
                    </td>
                    <td className="px-3 py-4">
                      <Skeleton className="h-3 w-44" />
                      <Skeleton className="mt-1.5 h-3 w-36" />
                    </td>
                    <td className="px-3 py-4">
                      <Skeleton className="mx-auto h-5 w-14" />
                    </td>
                    <td className="px-3 py-4">
                      <Skeleton className="mx-auto h-5 w-20" />
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
                    Nenhum fornecedor cadastrado.
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-neutral-200 last:border-b-0 hover:bg-neutral-50/60"
                  >
                    <td className="w-8 px-3 py-3">
                      <Checkbox
                        checked={selection.isSelected(f.id)}
                        onCheckedChange={() => selection.toggle(f.id)}
                        aria-label="Selecionar"
                      />
                    </td>
                    <td className="px-3 py-3 font-medium text-neutral-900">
                      {f.codigo}
                    </td>
                    <td className="px-3 py-3 text-neutral-900">
                      <div className="font-medium">{f.razaoSocial}</div>
                      {f.nomeFantasia && (
                        <div className="text-xs text-neutral-500">{f.nomeFantasia}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-neutral-700">{f.cnpj}</td>
                    <td className="px-3 py-3 text-neutral-700">
                      {f.contatos.length === 0 ? (
                        <span className="text-xs text-neutral-400">—</span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {f.contatos.slice(0, 3).map((c) => {
                            const Icon = TIPO_ICON[c.tipo]
                            return (
                              <div
                                key={c.id}
                                className="inline-flex items-center gap-1.5 text-xs"
                              >
                                <Icon className="h-3 w-3 text-neutral-500" />
                                <span>{c.valor}</span>
                                {c.principal && (
                                  <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                                )}
                              </div>
                            )
                          })}
                          {f.contatos.length > 3 && (
                            <span className="text-[11px] text-neutral-400">
                              +{f.contatos.length - 3} contato(s)
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={
                          f.ativo
                            ? 'inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700'
                            : 'inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-xs font-medium text-neutral-600'
                        }
                      >
                        {f.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <OrigemCadastroBadge origem={f.origemCadastro} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(f)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700',
                          )}
                          onClick={() => setConfirmingId(f.id)}
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
        <DialogContent className="max-w-5xl w-[min(96vw,72rem)]">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Editar fornecedor' : 'Novo fornecedor'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? 'Atualize os dados cadastrais e os contatos do fornecedor.'
                : 'Cadastre um novo fornecedor com seus contatos.'}
            </DialogDescription>
          </DialogHeader>
          <FornecedorForm
            initial={editing}
            onSaved={handleSaved}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmingId !== null} onOpenChange={(o) => !o && setConfirmingId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir fornecedor?</DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. O fornecedor e seus contatos serão
              removidos permanentemente.
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
