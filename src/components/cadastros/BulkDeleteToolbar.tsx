import * as React from 'react'
import { Trash2, X, Loader2, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Item = { id: string; label: string }

type Props = {
  /** Itens atualmente selecionados na página (id + descrição curta). */
  selectedItems: Item[]
  /** Rótulo singular do registro. Ex.: "filial". */
  entityLabel: string
  /** Rótulo plural. Ex.: "filiais". */
  entityPlural: string
  /** Função que remove um único item. Chamada em loop. */
  deleteOne: (id: string) => Promise<void>
  /** Disparado depois da execução (sucesso parcial inclusive). O pai deve
   *  limpar a seleção e recarregar a página. */
  onComplete: () => void
  /** Limpa a seleção sem excluir. */
  onClearSelection: () => void
}

type Phase = 'idle' | 'step1' | 'step2' | 'running' | 'done'

const CONFIRM_TOKEN = 'EXCLUIR'

export function BulkDeleteToolbar({
  selectedItems,
  entityLabel,
  entityPlural,
  deleteOne,
  onComplete,
  onClearSelection,
}: Props) {
  const [phase, setPhase] = React.useState<Phase>('idle')
  const [typed, setTyped] = React.useState('')
  const [progress, setProgress] = React.useState({ done: 0, total: 0 })
  const [successes, setSuccesses] = React.useState(0)
  const [failures, setFailures] = React.useState<
    { id: string; label: string; message: string }[]
  >([])

  const count = selectedItems.length
  const open = phase !== 'idle'

  const reset = () => {
    setPhase('idle')
    setTyped('')
    setProgress({ done: 0, total: 0 })
    setSuccesses(0)
    setFailures([])
  }

  const handleClose = (next: boolean) => {
    if (phase === 'running') return
    if (!next) {
      reset()
    }
  }

  const startConfirm = () => setPhase('step1')

  const runDelete = async () => {
    setPhase('running')
    setProgress({ done: 0, total: count })
    let ok = 0
    const errs: typeof failures = []
    for (let i = 0; i < selectedItems.length; i++) {
      const item = selectedItems[i]
      try {
        await deleteOne(item.id)
        ok += 1
      } catch (err) {
        errs.push({
          id: item.id,
          label: item.label,
          message: err instanceof Error ? err.message : 'Erro desconhecido',
        })
      } finally {
        setProgress({ done: i + 1, total: count })
        setSuccesses(ok)
        setFailures([...errs])
      }
    }
    setPhase('done')
    if (ok > 0) {
      toast.success(`Exclusão em massa de ${entityPlural} concluída`, {
        description:
          errs.length > 0 ? `${ok} excluído(s), ${errs.length} com erro.` : `${ok} excluído(s).`,
      })
    } else if (errs.length > 0) {
      toast.error(`Nenhum ${entityLabel} excluído`, {
        description: `${errs.length} linha(s) com erro.`,
      })
    }
  }

  const handleDoneClose = () => {
    reset()
    onComplete()
  }

  if (count === 0) return null

  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-red-200 bg-red-50/60 px-3 py-2 text-sm">
        <div className="flex items-center gap-2 text-red-800">
          <span className="font-medium">
            {count} {count === 1 ? entityLabel : entityPlural} selecionado(s)
          </span>
          <button
            type="button"
            onClick={onClearSelection}
            className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100"
            title="Limpar seleção"
          >
            <X className="h-3 w-3" />
            Limpar seleção
          </button>
        </div>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="h-8 gap-1.5"
          onClick={startConfirm}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Excluir selecionados
        </Button>
      </div>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          {phase === 'step1' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                  Excluir {count} {count === 1 ? entityLabel : entityPlural}?
                </DialogTitle>
                <DialogDescription>
                  Esta ação <b>não pode ser desfeita</b>. Os registros abaixo
                  serão removidos permanentemente do sistema.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-40 overflow-y-auto rounded-md border border-neutral-200 bg-neutral-50 p-2 text-xs text-neutral-700">
                <ul className="space-y-0.5">
                  {selectedItems.slice(0, 30).map((it) => (
                    <li key={it.id} className="truncate">
                      • {it.label}
                    </li>
                  ))}
                  {selectedItems.length > 30 && (
                    <li className="text-neutral-500">
                      … e mais {selectedItems.length - 30} registro(s).
                    </li>
                  )}
                </ul>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => handleClose(false)}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={() => setPhase('step2')}>
                  Continuar
                </Button>
              </div>
            </>
          )}

          {phase === 'step2' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                  Confirmação final
                </DialogTitle>
                <DialogDescription>
                  Para concluir a exclusão de <b>{count}</b>{' '}
                  {count === 1 ? entityLabel : entityPlural}, digite{' '}
                  <code className="rounded bg-neutral-100 px-1 font-mono text-neutral-900">
                    {CONFIRM_TOKEN}
                  </code>{' '}
                  abaixo.
                </DialogDescription>
              </DialogHeader>
              <Input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={CONFIRM_TOKEN}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && typed === CONFIRM_TOKEN) {
                    e.preventDefault()
                    runDelete()
                  }
                }}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setPhase('step1')}>
                  Voltar
                </Button>
                <Button
                  variant="destructive"
                  onClick={runDelete}
                  disabled={typed !== CONFIRM_TOKEN}
                >
                  Excluir {count} {count === 1 ? entityLabel : entityPlural}
                </Button>
              </div>
            </>
          )}

          {phase === 'running' && (
            <>
              <DialogHeader>
                <DialogTitle>Excluindo…</DialogTitle>
                <DialogDescription>
                  Não feche esta janela até a conclusão.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-3 rounded-md border border-neutral-200 bg-white p-3 text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />
                <span>
                  {progress.done} de {progress.total} processado(s)…
                </span>
              </div>
            </>
          )}

          {phase === 'done' && (
            <>
              <DialogHeader>
                <DialogTitle>Resultado</DialogTitle>
                <DialogDescription>Resumo da exclusão em massa.</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-white p-3 text-sm">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{successes} excluído(s) com sucesso.</span>
                </div>
                {failures.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 text-red-700">
                      <AlertCircle className="h-4 w-4" />
                      <span>{failures.length} não pôde(ram) ser excluído(s).</span>
                    </div>
                    <details className="rounded-md border border-red-100 bg-red-50/60 p-2">
                      <summary className="cursor-pointer text-xs font-medium text-red-800">
                        Ver detalhes dos erros
                      </summary>
                      <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-xs text-red-800">
                        {failures.map((f) => (
                          <li key={f.id}>
                            <span className="font-medium">{f.label}</span> — {f.message}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </>
                )}
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={handleDoneClose}>Fechar</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
