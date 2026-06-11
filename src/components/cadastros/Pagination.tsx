import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  page: number
  pageSize: number
  total: number
  onChange: (next: number) => void
  disabled?: boolean
}

export function Pagination({ page, pageSize, total, onChange, disabled }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)

  if (total === 0) return null

  const start = (safePage - 1) * pageSize + 1
  const end = Math.min(safePage * pageSize, total)

  const go = (next: number) => {
    if (disabled) return
    const clamped = Math.min(Math.max(1, next), totalPages)
    if (clamped !== safePage) onChange(clamped)
  }

  return (
    <div className="flex flex-col items-center justify-between gap-2 border-t border-neutral-200 bg-neutral-50/40 px-3 py-2 text-xs text-neutral-600 sm:flex-row">
      <span>
        Mostrando <b className="text-neutral-900">{start}</b>–
        <b className="text-neutral-900">{end}</b> de{' '}
        <b className="text-neutral-900">{total}</b>
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => go(1)}
          disabled={disabled || safePage <= 1}
          title="Primeira página"
          aria-label="Primeira página"
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => go(safePage - 1)}
          disabled={disabled || safePage <= 1}
          title="Página anterior"
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="px-1.5 tabular-nums">
          {safePage} / {totalPages}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => go(safePage + 1)}
          disabled={disabled || safePage >= totalPages}
          title="Próxima página"
          aria-label="Próxima página"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => go(totalPages)}
          disabled={disabled || safePage >= totalPages}
          title="Última página"
          aria-label="Última página"
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

/** pageSize padrão usado nas listas de cadastros. */
export const DEFAULT_PAGE_SIZE = 20
