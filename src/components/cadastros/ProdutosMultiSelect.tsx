import * as React from 'react'
import { Loader2, Search as SearchIcon, X, Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api/client'
import type { Produto } from '@/lib/api/produtos'
import { produtosApi } from '@/lib/api/produtos'
import type { ProdutoRef } from '@/lib/api/tipos-nao-conformidade'

type Props = {
  selected: ProdutoRef[]
  onChange: (selected: ProdutoRef[]) => void
  disabled?: boolean
}

/**
 * Busca produtos sob demanda (não carrega a lista completa). O usuário
 * digita no campo, vê os resultados e clica para vincular. Itens já
 * vinculados aparecem como chips removíveis acima do campo de busca.
 */
export function ProdutosMultiSelect({ selected, onChange, disabled }: Props) {
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<Produto[]>([])
  const [searching, setSearching] = React.useState(false)
  const [searchError, setSearchError] = React.useState<string | null>(null)

  const selectedIds = React.useMemo(
    () => new Set(selected.map((s) => s.id)),
    [selected],
  )

  React.useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setSearching(false)
      setSearchError(null)
      return
    }
    setSearching(true)
    setSearchError(null)
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const res = await produtosApi.list({
          q: trimmed,
          ativo: true,
          pageSize: 20,
        })
        if (cancelled) return
        setResults(res.items)
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError) setSearchError(err.message)
        else setSearchError('Falha ao buscar produtos.')
        setResults([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  const toRef = (p: Produto): ProdutoRef => ({
    id: p.id,
    codigo: p.codigo,
    descricao: p.descricao,
    unidadeMedida: p.unidadeMedida,
  })

  const add = (p: Produto) => {
    if (disabled || selectedIds.has(p.id)) return
    onChange([...selected, toRef(p)])
    setQuery('')
    setResults([])
  }

  const addAllFiltered = () => {
    if (disabled) return
    const toAdd = results.filter((p) => !selectedIds.has(p.id)).map(toRef)
    if (toAdd.length === 0) return
    onChange([...selected, ...toAdd])
    setQuery('')
    setResults([])
  }

  const remove = (id: string) => {
    if (disabled) return
    onChange(selected.filter((s) => s.id !== id))
  }

  const filteredResults = results.filter((p) => !selectedIds.has(p.id))

  return (
    <div className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-white p-2">
      {/* Itens já vinculados (chips removíveis) */}
      {selected.length === 0 ? (
        <div className="px-1 py-1 text-xs text-neutral-500">
          Nenhum produto vinculado. Use o campo abaixo para pesquisar e vincular.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 px-1 py-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-neutral-500">
              {selected.length} produto(s) vinculado(s)
            </span>
            <button
              type="button"
              onClick={() => !disabled && onChange([])}
              disabled={disabled}
              className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 hover:border-red-200 disabled:cursor-not-allowed disabled:opacity-50"
              title="Remover todos os produtos vinculados"
            >
              <Trash2 className="h-3 w-3" />
              Limpar tudo
            </button>
          </div>
        <div className="flex flex-wrap gap-1">
          {selected.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 py-0.5 pl-2 pr-1 text-xs font-medium text-neutral-700"
              title={`${p.codigo} — ${p.descricao}`}
            >
              <span>{p.codigo}</span>
              <span className="max-w-[180px] truncate font-normal text-neutral-500">
                {p.descricao}
              </span>
              <button
                type="button"
                onClick={() => remove(p.id)}
                disabled={disabled}
                className="ml-0.5 rounded p-0.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Remover ${p.codigo}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        </div>
      )}

      {/* Campo de busca */}
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar produto por código ou descrição"
          className="h-9 pl-8 text-sm"
          disabled={disabled}
        />
      </div>

      {/* Resultados da busca — só aparece quando há texto */}
      {query.trim() && (
        <div className="flex max-h-48 flex-col gap-0.5 overflow-y-auto rounded-md border border-neutral-100">
          {searching && (
            <div className="flex items-center gap-2 px-2 py-2 text-xs text-neutral-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Buscando…
            </div>
          )}
          {!searching && searchError && (
            <div className="px-2 py-2 text-xs text-red-700">{searchError}</div>
          )}
          {!searching &&
            !searchError &&
            filteredResults.length === 0 &&
            results.length > 0 && (
              <div className="px-2 py-2 text-xs text-neutral-500">
                Todos os produtos da busca já estão vinculados.
              </div>
            )}
          {!searching && !searchError && results.length === 0 && (
            <div className="px-2 py-2 text-xs text-neutral-500">
              Nenhum produto encontrado para "{query.trim()}".
            </div>
          )}
          {!searching && !searchError && filteredResults.length > 0 && (
            <div className="flex items-center justify-between gap-2 border-b border-neutral-100 bg-neutral-50/60 px-2 py-1.5">
              <span className="text-[11px] text-neutral-500">
                {filteredResults.length} resultado(s)
              </span>
              <button
                type="button"
                onClick={addAllFiltered}
                disabled={disabled}
                className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-3 w-3" />
                Adicionar todos
              </button>
            </div>
          )}
          {!searching &&
            filteredResults.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => add(p)}
                disabled={disabled}
                className="flex items-center gap-2 px-2 py-1.5 text-left hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                <span className="text-sm font-medium text-neutral-900">{p.codigo}</span>
                <span className="truncate text-sm text-neutral-600">— {p.descricao}</span>
                <span className="ml-auto shrink-0 text-[11px] text-neutral-500">
                  {p.unidadeMedida}
                </span>
              </button>
            ))}
        </div>
      )}

    </div>
  )
}

/** Renderiza os produtos vinculados como pílulas (para listas). */
export function ProdutosBadges({
  items,
  empty = 'Nenhum',
  max = 4,
}: {
  items: { id: string; codigo: string }[]
  empty?: string
  max?: number
}) {
  if (items.length === 0) {
    return <span className="text-neutral-400">{empty}</span>
  }
  const visible = items.slice(0, max)
  const rest = items.length - visible.length
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((p) => (
        <span
          key={p.id}
          className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[11px] font-medium text-neutral-700"
        >
          {p.codigo}
        </span>
      ))}
      {rest > 0 && (
        <span className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-neutral-500">
          +{rest}
        </span>
      )}
    </div>
  )
}
