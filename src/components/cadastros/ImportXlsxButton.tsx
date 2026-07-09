import * as React from 'react'
import { Upload, Loader2, FileDown, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { downloadTemplate, readXlsxRows } from '@/lib/utils/xlsx'
import { ApiError } from '@/lib/api/client'

/**
 * Extrai uma mensagem acionável do erro. Para erros de validação da API,
 * mostra o detalhe por campo (ex.: "CNPJ deve conter 14 dígitos") em vez
 * do genérico "Dados inválidos".
 */
function mensagemDoErro(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.details as
      | {
          details?: {
            fieldErrors?: Record<string, string[]>
            formErrors?: string[]
          }
        }
      | undefined
    const partes: string[] = []
    const fe = body?.details?.fieldErrors
    if (fe) {
      for (const [campo, msgs] of Object.entries(fe)) {
        if (msgs && msgs.length) partes.push(`${campo}: ${msgs[0]}`)
      }
    }
    const form = body?.details?.formErrors
    if (form && form.length) partes.push(...form)
    return partes.length ? partes.join('; ') : err.message
  }
  return err instanceof Error ? err.message : 'Erro desconhecido'
}

export type ImportColumn = {
  /** Cabeçalho exato esperado na planilha. */
  header: string
  /** Marca o campo como obrigatório no texto de ajuda. */
  required?: boolean
  /** Dica sobre o conteúdo aceito. */
  help?: string
}

type Failure = { rowIndex: number; message: string }

type Props<TInput> = {
  /** Rótulo curto. Ex.: "Filial", "Produto". */
  entityLabel: string
  /** Plural, usado em mensagens. Ex.: "filiais", "produtos". */
  entityPlural?: string
  /** Cabeçalhos esperados (e exibidos na ajuda + template). */
  expectedHeaders: ImportColumn[]
  /**
   * Converte uma linha lida da planilha em entrada para a API.
   * Pode ser assíncrono (ex.: resolver códigos para IDs via lookup).
   * Lance um Error com mensagem amigável para abortar a linha.
   */
  mapRow: (
    row: Record<string, unknown>,
    rowIndex: number,
  ) => Promise<TInput> | TInput
  /** Cria um registro. Pode jogar ApiError. */
  importOne: (input: TInput) => Promise<unknown>
  /** Disparado ao final de uma importação (sucesso parcial inclusive). */
  onDone?: () => void
  /** Linhas de aviso adicionais (ex.: "Vínculos não são importados"). */
  notes?: string[]
}

type Phase = 'idle' | 'parsing' | 'preview' | 'importing' | 'done'

export function ImportXlsxButton<TInput>({
  entityLabel,
  entityPlural,
  expectedHeaders,
  mapRow,
  importOne,
  onDone,
  notes,
}: Props<TInput>) {
  const [open, setOpen] = React.useState(false)
  const [phase, setPhase] = React.useState<Phase>('idle')
  const [rows, setRows] = React.useState<Record<string, unknown>[]>([])
  const [progress, setProgress] = React.useState({ done: 0, total: 0 })
  const [successes, setSuccesses] = React.useState(0)
  const [failures, setFailures] = React.useState<Failure[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const plural = entityPlural ?? `${entityLabel.toLowerCase()}s`
  const headerStrings = React.useMemo(
    () => expectedHeaders.map((h) => h.header),
    [expectedHeaders],
  )

  const reset = () => {
    setPhase('idle')
    setRows([])
    setProgress({ done: 0, total: 0 })
    setSuccesses(0)
    setFailures([])
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleClose = (next: boolean) => {
    if (phase === 'importing') return
    setOpen(next)
    if (!next) reset()
  }

  const handleFile = async (file: File) => {
    setPhase('parsing')
    setError(null)
    try {
      const parsed = await readXlsxRows(file)
      if (parsed.length === 0) {
        setError('A planilha está vazia ou sem linhas além do cabeçalho.')
        setPhase('idle')
        return
      }
      setRows(parsed)
      setPhase('preview')
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error ? err.message : 'Não foi possível ler a planilha.',
      )
      setPhase('idle')
    }
  }

  const handleImport = async () => {
    setPhase('importing')
    setProgress({ done: 0, total: rows.length })
    setSuccesses(0)
    setFailures([])
    let ok = 0
    const errs: Failure[] = []
    for (let i = 0; i < rows.length; i++) {
      try {
        const input = await mapRow(rows[i], i)
        await importOne(input)
        ok += 1
      } catch (err) {
        errs.push({ rowIndex: i, message: mensagemDoErro(err) })
      } finally {
        setProgress({ done: i + 1, total: rows.length })
        setSuccesses(ok)
        setFailures([...errs])
      }
    }
    setPhase('done')
    if (ok > 0) {
      toast.success(`Importação de ${plural} concluída`, {
        description:
          errs.length > 0
            ? `${ok} criado(s), ${errs.length} com erro.`
            : `${ok} criado(s).`,
      })
      onDone?.()
    } else if (errs.length > 0) {
      toast.error(`Nenhum ${entityLabel.toLowerCase()} importado`, {
        description: `${errs.length} linha(s) com erro.`,
      })
    }
  }

  const handleBaixarModelo = () => {
    downloadTemplate({
      filename: `modelo-${plural}`,
      sheetName: entityLabel,
      headers: headerStrings,
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 gap-1.5"
        onClick={() => setOpen(true)}
        title={`Importar ${plural} de uma planilha Excel`}
      >
        <Upload className="h-4 w-4" />
        Importar
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar {plural} via planilha</DialogTitle>
            <DialogDescription>
              Envie um arquivo .xlsx com uma linha por registro. A primeira
              linha deve ser o cabeçalho.
            </DialogDescription>
          </DialogHeader>

          {/* Ajuda — cabeçalhos esperados */}
          <div className="rounded-md border border-neutral-200 bg-neutral-50/60 p-3 text-xs">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-medium text-neutral-700">
                Cabeçalhos esperados
              </span>
              <button
                type="button"
                onClick={handleBaixarModelo}
                className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100"
              >
                <FileDown className="h-3 w-3" />
                Baixar modelo
              </button>
            </div>
            <ul className="grid gap-1 sm:grid-cols-2">
              {expectedHeaders.map((h) => (
                <li key={h.header} className="text-neutral-600">
                  <span className="font-medium text-neutral-900">
                    {h.header}
                    {h.required ? ' *' : ''}
                  </span>
                  {h.help && (
                    <span className="text-neutral-500"> — {h.help}</span>
                  )}
                </li>
              ))}
            </ul>
            {notes && notes.length > 0 && (
              <ul className="mt-2 list-disc pl-4 text-neutral-500">
                {notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* File input — só na fase inicial */}
          {(phase === 'idle' || phase === 'parsing') && (
            <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-neutral-300 bg-white px-4 py-6 text-center">
              <Upload className="h-6 w-6 text-neutral-400" />
              <div className="text-sm text-neutral-700">
                Selecione um arquivo <code className="font-mono">.xlsx</code>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={phase === 'parsing'}
              >
                {phase === 'parsing' && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Escolher arquivo
              </Button>
            </div>
          )}

          {/* Pré-visualização */}
          {phase === 'preview' && (
            <div className="rounded-md border border-neutral-200 bg-white p-3 text-sm">
              <div className="mb-1 font-medium text-neutral-900">
                {rows.length} linha(s) detectada(s)
              </div>
              <div className="text-xs text-neutral-500">
                Confira os cabeçalhos da planilha — colunas com nome diferente
                dos esperados ficarão em branco no registro. Clique em
                "Importar" para enviar.
              </div>
            </div>
          )}

          {/* Progresso */}
          {phase === 'importing' && (
            <div className="flex items-center gap-3 rounded-md border border-neutral-200 bg-white p-3 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />
              <span>
                Importando {progress.done} de {progress.total}…
              </span>
            </div>
          )}

          {/* Resultado */}
          {phase === 'done' && (
            <div className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-white p-3 text-sm">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                <span>{successes} registro(s) criado(s) com sucesso.</span>
              </div>
              {failures.length > 0 && (
                <>
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="h-4 w-4" />
                    <span>{failures.length} linha(s) com erro.</span>
                  </div>
                  <details className="rounded-md border border-red-100 bg-red-50/60 p-2">
                    <summary className="cursor-pointer text-xs font-medium text-red-800">
                      Ver detalhes dos erros
                    </summary>
                    <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto text-xs text-red-800">
                      {failures.map((f) => (
                        <li key={f.rowIndex}>
                          <span className="font-mono">linha {f.rowIndex + 2}</span>{' '}
                          — {f.message}
                        </li>
                      ))}
                    </ul>
                  </details>
                </>
              )}
            </div>
          )}

          {/* Ações */}
          <div className="flex justify-end gap-2 pt-2">
            {phase === 'preview' && (
              <>
                <Button variant="outline" onClick={() => reset()}>
                  Trocar arquivo
                </Button>
                <Button onClick={handleImport}>
                  Importar {rows.length} registro(s)
                </Button>
              </>
            )}
            {phase === 'done' && (
              <Button onClick={() => handleClose(false)}>Fechar</Button>
            )}
            {phase !== 'preview' && phase !== 'done' && (
              <Button
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={phase === 'importing'}
              >
                Fechar
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
