import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ApiError } from '@/lib/api/client'
import type { Disposicao, DisposicaoInput } from '@/lib/api/disposicoes'
import { disposicoesApi } from '@/lib/api/disposicoes'
import { TiposRelatorioMultiSelect } from './TiposRelatorioMultiSelect'

type Props = {
  initial?: Disposicao | null
  onSaved: () => void
  onCancel: () => void
}

const empty: DisposicaoInput = {
  codigo: '',
  descricao: '',
  ativo: true,
  tiposRelatorioIds: [],
}

function toInput(d: Disposicao): DisposicaoInput {
  return {
    codigo: d.codigo,
    descricao: d.descricao,
    ativo: d.ativo,
    tiposRelatorioIds: d.tiposRelatorio.map((t) => t.id),
  }
}

export function DisposicaoForm({ initial, onSaved, onCancel }: Props) {
  const [form, setForm] = React.useState<DisposicaoInput>(() =>
    initial ? toInput(initial) : empty,
  )
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({})

  const set = <K extends keyof DisposicaoInput>(key: K, value: DisposicaoInput[K]) =>
    setForm((s) => ({ ...s, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setFieldErrors({})
    try {
      if (initial) {
        await disposicoesApi.update(initial.id, form)
        toast.success('Disposição atualizada', {
          description: `${form.codigo} — ${form.descricao}`,
        })
      } else {
        await disposicoesApi.create(form)
        toast.success('Disposição cadastrada', {
          description: `${form.codigo} — ${form.descricao}`,
        })
      }
      onSaved()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
        toast.error('Não foi possível salvar', { description: err.message })
        const details = err.details as
          | { details?: { fieldErrors?: Record<string, string[]> } }
          | undefined
        if (details?.details?.fieldErrors) setFieldErrors(details.details.fieldErrors)
      } else {
        setError('Erro inesperado ao salvar.')
        toast.error('Erro inesperado ao salvar')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const fieldError = (key: keyof DisposicaoInput) => fieldErrors[key as string]?.[0]

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-12">
        <Field label="Código *" error={fieldError('codigo')} className="sm:col-span-3">
          <Input
            value={form.codigo}
            onChange={(e) => set('codigo', e.target.value)}
            placeholder="RETRABALHO"
            maxLength={20}
            required
          />
        </Field>
        <Field
          label="Descrição *"
          error={fieldError('descricao')}
          className="sm:col-span-9"
        >
          <Input
            value={form.descricao}
            onChange={(e) => set('descricao', e.target.value)}
            placeholder="Retrabalho do material conforme procedimento"
            maxLength={160}
            required
          />
        </Field>
        <Field
          label="Tipos de relatório"
          error={fieldError('tiposRelatorioIds')}
          className="sm:col-span-12"
        >
          <TiposRelatorioMultiSelect
            value={form.tiposRelatorioIds}
            onChange={(ids) => set('tiposRelatorioIds', ids)}
            disabled={submitting}
          />
          <span className="text-xs text-neutral-500">
            Selecione um ou mais tipos de relatório que utilizam esta disposição.
          </span>
        </Field>
        <div className="flex items-center gap-3 sm:col-span-12">
          <Switch
            checked={form.ativo}
            onCheckedChange={(v) => set('ativo', v)}
            id="ativo-disposicao"
          />
          <Label htmlFor="ativo-disposicao" className="cursor-pointer">
            Disposição ativa
          </Label>
        </div>
      </section>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {initial ? 'Salvar alterações' : 'Cadastrar disposição'}
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string
  error?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <Label>{label}</Label>
      {children}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
