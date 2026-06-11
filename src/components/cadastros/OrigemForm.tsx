import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ApiError } from '@/lib/api/client'
import type { Origem, OrigemInput } from '@/lib/api/origens'
import { origensApi } from '@/lib/api/origens'
import { TiposRelatorioMultiSelect } from './TiposRelatorioMultiSelect'

type Props = {
  initial?: Origem | null
  onSaved: () => void
  onCancel: () => void
}

const empty: OrigemInput = {
  codigo: '',
  nome: '',
  descricao: '',
  ativo: true,
  tiposRelatorioIds: [],
}

function toInput(o: Origem): OrigemInput {
  return {
    codigo: o.codigo,
    nome: o.nome,
    descricao: o.descricao ?? '',
    ativo: o.ativo,
    tiposRelatorioIds: o.tiposRelatorio.map((t) => t.id),
  }
}

export function OrigemForm({ initial, onSaved, onCancel }: Props) {
  const [form, setForm] = React.useState<OrigemInput>(() =>
    initial ? toInput(initial) : empty,
  )
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({})

  const set = <K extends keyof OrigemInput>(key: K, value: OrigemInput[K]) =>
    setForm((s) => ({ ...s, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setFieldErrors({})
    try {
      const payload: Partial<OrigemInput> = {
        ...form,
        descricao: form.descricao || null,
        tiposRelatorioIds: form.tiposRelatorioIds,
      }
      if (initial) {
        await origensApi.update(initial.id, payload)
        toast.success('Origem atualizada', {
          description: `${form.codigo} — ${form.nome}`,
        })
      } else {
        await origensApi.create(payload)
        toast.success('Origem cadastrada', {
          description: `${form.codigo} — ${form.nome}`,
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

  const fieldError = (key: keyof OrigemInput) => fieldErrors[key as string]?.[0]

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
            placeholder="AUDITORIA"
            maxLength={20}
            required
          />
        </Field>
        <Field label="Nome *" error={fieldError('nome')} className="sm:col-span-9">
          <Input
            value={form.nome}
            onChange={(e) => set('nome', e.target.value)}
            placeholder="Auditoria interna"
            maxLength={120}
            required
          />
        </Field>
        <Field
          label="Descrição"
          error={fieldError('descricao')}
          className="sm:col-span-12"
        >
          <textarea
            value={form.descricao ?? ''}
            onChange={(e) => set('descricao', e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Detalhes sobre quando essa origem se aplica."
            className="flex w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900"
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
            Selecione um ou mais tipos de relatório que utilizam esta origem.
          </span>
        </Field>
        <div className="flex items-center gap-3 sm:col-span-12">
          <Switch
            checked={form.ativo}
            onCheckedChange={(v) => set('ativo', v)}
            id="ativo-origem"
          />
          <Label htmlFor="ativo-origem" className="cursor-pointer">
            Origem ativa
          </Label>
        </div>
      </section>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {initial ? 'Salvar alterações' : 'Cadastrar origem'}
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
