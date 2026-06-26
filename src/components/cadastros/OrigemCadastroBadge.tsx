import { Database, PencilLine } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OrigemCadastro } from '@/lib/api/produtos'

/**
 * Distingue visualmente a origem do cadastro: integrado do ERP Protheus
 * (via ETL) ou criado diretamente na plataforma.
 */
export function OrigemCadastroBadge({
  origem,
  className,
}: {
  origem: OrigemCadastro
  className?: string
}) {
  const isProtheus = origem === 'PROTHEUS'
  const Icon = isProtheus ? Database : PencilLine
  return (
    <span
      title={
        isProtheus
          ? 'Cadastro integrado do ERP Protheus (ETL)'
          : 'Cadastro criado diretamente na plataforma'
      }
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium',
        isProtheus
          ? 'border-sky-200 bg-sky-50 text-sky-700'
          : 'border-violet-200 bg-violet-50 text-violet-700',
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {isProtheus ? 'Protheus' : 'Plataforma'}
    </span>
  )
}
