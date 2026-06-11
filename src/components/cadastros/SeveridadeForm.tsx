import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ApiError } from '@/lib/api/client'
import type { Severidade, SeveridadeInput } from '@/lib/api/severidades'
import { severidadesApi } from '@/lib/api/severidades'
import { TiposRelatorioMultiSelect } from './TiposRelatorioMultiSelect'

type Props = {
  initial?: Severidade | null
  onSaved: () => void
  onCancel: () => void
}

type FormState = {
  codigo: string
  nome: string
  nivel: number
  cor: string
  descricao: string
  ativo: boolean
  tiposRelatorioIds: string[]
}

const empty: FormState = {
  codigo: '',
  nome: '',
  nivel: 1,
  cor: '#737373',
  descricao: '',
  ativo: true,
  tiposRelatorioIds: [],
}

function toForm(s: Severidade): FormState {
  return {
    codigo: s.codigo,
    nome: s.nome,
    nivel: s.nivel,
    cor: s.cor ?? '#737373',
    descricao: s.descricao ?? '',
    ativo: s.ativo,
    tiposRelatorioIds: s.tiposRelatorio.map((t) => t.id),
  }
}

export function SeveridadeForm({ initial, onSaved, onCancel }: Props) {
  const [form, setForm] = React.useState<FormState>(() =>
    initial ? toForm(initial) : empty,
  )
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({})

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((s) => ({ ...s, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setFieldErrors({})
    try {
      const payload: Partial<SeveridadeInput> = {
        codigo: form.codigo,
        nome: form.nome,
        nivel: form.nivel,
        cor: form.cor || null,
        descricao: form.descricao || null,
        ativo: form.ativo,
        tiposRelatorioIds: form.tiposRelatorioIds,
      }
      if (initial) {
        await severidadesApi.update(initial.id, payload)
        toast.success('Severidade atualizada', {
          description: `${form.codigo} — ${form.nome}`,
        })
      } else {
        await severidadesApi.create(payload)
        toast.success('Severidade cadastrada', {
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

  const fieldError = (key: keyof FormState) => fieldErrors[key as string]?.[0]

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
            placeholder="ALTA"
            maxLength={20}
            required
          />
        </Field>
        <Field label="Nome *" error={fieldError('nome')} className="sm:col-span-7">
          <Input
            value={form.nome}
            onChange={(e) => set('nome', e.target.value)}
            placeholder="Alta"
            maxLength={80}
            required
          />
        </Field>
        <Field label="Nível *" error={fieldError('nivel')} className="sm:col-span-2">
          <Input
            type="number"
            min={1}
            max={99}
            value={form.nivel}
            onChange={(e) => set('nivel', Number(e.target.value) || 1)}
            required
          />
        </Field>
        <Field label="Cor" error={fieldError('cor')} className="sm:col-span-6">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.cor}
              onChange={(e) => set('cor', e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-md border border-neutral-200 bg-white p-1"
              aria-label="Selecionar cor"
            />
            <Input
              value={form.cor}
              onChange={(e) => set('cor', e.target.value)}
              placeholder="#dc2626"
              maxLength={7}
              className="font-mono"
            />
          </div>
        </Field>
        <div className="sm:col-span-12 rounded-md bg-neutral-50 border border-neutral-200 px-3 py-2 text-xs text-neutral-600">
          O <b>nível</b> define a ordem de gravidade (1 = mais leve, valores
          maiores = mais grave) e precisa ser único.
        </div>
        <Field
          label="Descrição"
          error={fieldError('descricao')}
          className="sm:col-span-12"
        >
          <textarea
            value={form.descricao}
            onChange={(e) => set('descricao', e.target.value)}
            rows={3}
            maxLength={2000}
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
            Selecione um ou mais tipos de relatório que utilizam esta severidade.
          </span>
        </Field>
        <div className="flex items-center gap-3 sm:col-span-12">
          <Switch
            checked={form.ativo}
            onCheckedChange={(v) => set('ativo', v)}
            id="ativo-severidade"
          />
          <Label htmlFor="ativo-severidade" className="cursor-pointer">
            Severidade ativa
          </Label>
        </div>
      </section>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {initial ? 'Salvar alterações' : 'Cadastrar severidade'}
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
