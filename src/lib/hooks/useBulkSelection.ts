import * as React from 'react'

type WithId = { id: string }

/**
 * Estado de seleção múltipla para listas paginadas. A seleção é resetada
 * automaticamente sempre que a referência de `items` muda (ex.: trocou de
 * página ou aplicou outro filtro) — isso garante que o usuário nunca
 * delete em massa registros que não está vendo.
 */
export function useBulkSelection<T extends WithId>(items: T[]) {
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())

  React.useEffect(() => {
    setSelectedIds(new Set())
  }, [items])

  const toggle = React.useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = React.useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === items.length) return new Set()
      return new Set(items.map((i) => i.id))
    })
  }, [items])

  const clear = React.useCallback(() => setSelectedIds(new Set()), [])

  const isSelected = React.useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  )

  const selectedItems = React.useMemo(
    () => items.filter((i) => selectedIds.has(i.id)),
    [items, selectedIds],
  )

  const allSelected = items.length > 0 && selectedIds.size === items.length
  const someSelected = selectedIds.size > 0 && !allSelected

  return {
    selectedIds,
    selectedItems,
    count: selectedIds.size,
    toggle,
    toggleAll,
    clear,
    isSelected,
    allSelected,
    someSelected,
  }
}
