import * as React from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { exportToXlsx, type XlsxColumn } from '@/lib/utils/xlsx'

type Props<T> = {
  filename: string
  sheetName?: string
  /** Linhas da página atual (já carregadas). */
  rows: T[]
  columns: XlsxColumn<T>[]
  /** Total de registros no servidor (para mostrar no diálogo). */
  total?: number
  /** Carrega todas as páginas (respeitando os filtros atuais). */
  fetchAll?: () => Promise<T[]>
  /** Texto do botão. Padrão: "Exportar". */
  label?: string
  /** Mensagem do toast de sucesso. */
  successMessage?: string
  disabled?: boolean
}

type Scope = 'current' | 'all'

export function ExportXlsxButton<T>({
  filename,
  sheetName,
  rows,
  columns,
  total,
  fetchAll,
  label = 'Exportar',
  successMessage = 'Exportação concluída',
  disabled,
}: Props<T>) {
  const [open, setOpen] = React.useState(false)
  const [scope, setScope] = React.useState<Scope>('current')
  const [exporting, setExporting] = React.useState(false)
  const isEmpty = rows.length === 0 && (total ?? 0) === 0

  const handleOpenChange = (next: boolean) => {
    if (exporting) return
    setOpen(next)
    if (next) setScope('current')
  }

  const handleClick = () => {
    if (isEmpty) {
      toast.info('Nada para exportar', {
        description: 'A lista atual está vazia.',
      })
      return
    }
    setOpen(true)
  }

  const doExport = async () => {
    setExporting(true)
    try {
      let dataRows: T[]
      if (scope === 'all' && fetchAll) {
        dataRows = await fetchAll()
      } else {
        dataRows = rows
      }
      if (dataRows.length === 0) {
        toast.info('Nada para exportar', {
          description: 'A consulta não retornou registros.',
        })
        return
      }
      exportToXlsx({ filename, sheetName, rows: dataRows, columns })
      toast.success(successMessage, {
        description: `${dataRows.length} registro(s) exportado(s).`,
      })
      setOpen(false)
    } catch (err) {
      console.error(err)
      toast.error('Falha ao exportar', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 gap-1.5"
        onClick={handleClick}
        disabled={disabled || isEmpty}
        title={isEmpty ? 'Nada para exportar' : 'Exportar para Excel (.xlsx)'}
      >
        <Download className="h-4 w-4" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar para Excel</DialogTitle>
            <DialogDescription>
              Escolha o escopo dos dados a exportar.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <label
              className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm transition-colors ${
                scope === 'current'
                  ? 'border-neutral-900 bg-neutral-50'
                  : 'border-neutral-200 bg-white hover:bg-neutral-50'
              }`}
            >
              <input
                type="radio"
                name="export-scope"
                value="current"
                checked={scope === 'current'}
                onChange={() => setScope('current')}
                className="mt-0.5"
                disabled={exporting}
              />
              <div>
                <div className="font-medium text-neutral-900">
                  Apenas a página atual
                </div>
                <div className="text-xs text-neutral-500">
                  Exporta os {rows.length} registro(s) carregado(s) nesta página.
                </div>
              </div>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm transition-colors ${
                !fetchAll
                  ? 'border-neutral-100 bg-neutral-50 opacity-50'
                  : scope === 'all'
                  ? 'border-neutral-900 bg-neutral-50'
                  : 'border-neutral-200 bg-white hover:bg-neutral-50'
              }`}
            >
              <input
                type="radio"
                name="export-scope"
                value="all"
                checked={scope === 'all'}
                onChange={() => setScope('all')}
                className="mt-0.5"
                disabled={exporting || !fetchAll}
              />
              <div>
                <div className="font-medium text-neutral-900">
                  Todo o cadastro
                </div>
                <div className="text-xs text-neutral-500">
                  {fetchAll
                    ? `Exporta todos os registros que atendem ao filtro atual${
                        total !== undefined ? ` (${total} no total)` : ''
                      }.`
                    : 'Indisponível nesta tela.'}
                </div>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={exporting}
            >
              Cancelar
            </Button>
            <Button onClick={doExport} disabled={exporting}>
              {exporting && <Loader2 className="h-4 w-4 animate-spin" />}
              Exportar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
