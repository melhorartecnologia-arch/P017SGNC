import * as React from 'react'
import { Loader2, Search as SearchIcon, X, Building2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api/client'
import { fornecedoresApi, type Fornecedor } from '@/lib/api/fornecedores'

type Props = {
  value: Fornecedor | null
  onChange: (next: Fornecedor | null) => void
  disabled?: boolean
}

/** Busca-conforme-digita para selecionar um único fornecedor. */
export function FornecedorCombobox({ value, onChange, disabled }: Props) {
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<Fornecedor[]>([])
  const [searching, setSearching] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setSearching(false)
      setError(null)
      return
    }
    setSearching(true)
    setError(null)
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const res = await fornecedoresApi.list({
          q: trimmed,
          ativo: true,
          pageSize: 20,
        })
        if (cancelled) return
        setResults(res.items)
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError) setError(err.message)
        else setError('Falha ao buscar fornecedores.')
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

  if (value) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2">
        <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-medium text-neutral-900">
            {value.codigo} — {value.razaoSocial}
          </span>
          {value.nomeFantasia && (
            <span className="text-xs text-neutral-500">{value.nomeFantasia}</span>
          )}
          <span className="text-xs text-neutral-500">CNPJ: {value.cnpj}</span>
        </div>
        <button
          type="button"
          onClick={() => !disabled && onChange(null)}
          disabled={disabled}
          className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Trocar fornecedor"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-white p-2">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar fornecedor por código, razão social, fantasia ou CNPJ"
          className="h-9 pl-8 text-sm"
          disabled={disabled}
          autoFocus
        />
      </div>

      {query.trim() && (
        <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto rounded-md border border-neutral-100">
          {searching && (
            <div className="flex items-center gap-2 px-2 py-2 text-xs text-neutral-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Buscando…
            </div>
          )}
          {!searching && error && (
            <div className="px-2 py-2 text-xs text-red-700">{error}</div>
          )}
          {!searching && !error && results.length === 0 && (
            <div className="px-2 py-2 text-xs text-neutral-500">
              Nenhum fornecedor encontrado para "{query.trim()}".
            </div>
          )}
          {!searching &&
            results.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onChange(f)}
                disabled={disabled}
                className="flex items-start gap-2 px-2 py-1.5 text-left hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" />
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium text-neutral-900">
                    {f.codigo} — {f.razaoSocial}
                  </span>
                  <span className="truncate text-xs text-neutral-500">
                    {f.nomeFantasia ? `${f.nomeFantasia} · ` : ''}CNPJ {f.cnpj}
                  </span>
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
