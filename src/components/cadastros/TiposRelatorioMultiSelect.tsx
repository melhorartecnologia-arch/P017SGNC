import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { ApiError } from '@/lib/api/client'
import type { TipoRelatorio } from '@/lib/api/tipos-relatorio'
import { tiposRelatorioApi } from '@/lib/api/tipos-relatorio'

type Props = {
  value: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}

/** Lista todos os tipos de relatório ativos como checkboxes. */
export function TiposRelatorioMultiSelect({ value, onChange, disabled }: Props) {
  const [items, setItems] = React.useState<TipoRelatorio[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    tiposRelatorioApi
      .list({ ativo: true, pageSize: 100 })
      .then((res) => {
        if (cancelled) return
        setItems(res.items)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError) setError(err.message)
        else setError('Falha ao carregar tipos de relatório.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const toggle = (id: string) => {
    if (disabled) return
    if (value.includes(id)) onChange(value.filter((v) => v !== id))
    else onChange([...value, id])
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Carregando tipos…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
        {error}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-3 py-3 text-xs text-neutral-500">
        Nenhum tipo de relatório cadastrado. Cadastre em{' '}
        <b>Cadastros → Tipos de Relatórios</b>.
      </div>
    )
  }

  return (
    <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border border-neutral-200 bg-white p-2">
      {items.map((t) => {
        const checked = value.includes(t.id)
        const id = `tr-opt-${t.id}`
        return (
          <label
            key={t.id}
            htmlFor={id}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-neutral-100"
          >
            <Checkbox
              id={id}
              checked={checked}
              onCheckedChange={() => toggle(t.id)}
              disabled={disabled}
            />
            <span className="text-sm font-medium text-neutral-900">{t.codigo}</span>
            <span className="truncate text-sm text-neutral-600">— {t.descricao}</span>
          </label>
        )
      })}
    </div>
  )
}

/** Renderiza os tipos vinculados como pequenas pílulas (para tabelas/listas). */
export function TiposRelatorioBadges({
  items,
  empty = 'Nenhum',
}: {
  items: { id: string; codigo: string }[]
  empty?: string
}) {
  if (items.length === 0) {
    return <span className="text-neutral-400">{empty}</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((t) => (
        <span
          key={t.id}
          className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[11px] font-medium text-neutral-700"
        >
          {t.codigo}
        </span>
      ))}
    </div>
  )
}
