import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ApiError } from '@/lib/api/client'
import type { TipoRelatorio, TipoRelatorioInput } from '@/lib/api/tipos-relatorio'
import { tiposRelatorioApi } from '@/lib/api/tipos-relatorio'

type Props = {
  initial?: TipoRelatorio | null
  onSaved: () => void
  onCancel: () => void
}

const empty: TipoRelatorioInput = {
  codigo: '',
  descricao: '',
  ativo: true,
}

function toInput(t: TipoRelatorio): TipoRelatorioInput {
  return {
    codigo: t.codigo,
    descricao: t.descricao,
    ativo: t.ativo,
  }
}

export function TipoRelatorioForm({ initial, onSaved, onCancel }: Props) {
  const [form, setForm] = React.useState<TipoRelatorioInput>(() =>
    initial ? toInput(initial) : empty,
  )
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({})

  const set = <K extends keyof TipoRelatorioInput>(
    key: K,
    value: TipoRelatorioInput[K],
  ) => setForm((s) => ({ ...s, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setFieldErrors({})
    try {
      if (initial) {
        await tiposRelatorioApi.update(initial.id, form)
        toast.success('Tipo de relatório atualizado', {
          description: `${form.codigo} — ${form.descricao}`,
        })
      } else {
        await tiposRelatorioApi.create(form)
        toast.success('Tipo de relatório cadastrado', {
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

  const fieldError = (key: keyof TipoRelatorioInput) =>
    fieldErrors[key as string]?.[0]

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
            placeholder="RNC"
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
            placeholder="Relatório de Não Conformidade"
            maxLength={160}
            required
          />
        </Field>
        <div className="flex items-center gap-3 sm:col-span-12">
          <Switch
            checked={form.ativo}
            onCheckedChange={(v) => set('ativo', v)}
            id="ativo-tipo-relatorio"
          />
          <Label htmlFor="ativo-tipo-relatorio" className="cursor-pointer">
            Tipo de relatório ativo
          </Label>
        </div>
      </section>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {initial ? 'Salvar alterações' : 'Cadastrar tipo de relatório'}
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
