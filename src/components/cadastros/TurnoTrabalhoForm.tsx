import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api/client'
import { filiaisApi, type Filial } from '@/lib/api/filiais'
import type {
  TurnoTrabalho,
  TurnoTrabalhoInput,
} from '@/lib/api/turnos-trabalho'
import { turnosTrabalhoApi } from '@/lib/api/turnos-trabalho'

type Props = {
  initial?: TurnoTrabalho | null
  onSaved: () => void
  onCancel: () => void
  /** Pré-seleciona uma filial ao criar (vinda do filtro da página). */
  defaultFilialId?: string
}

type FormState = {
  filialId: string
  codigo: string
  nome: string
  horaInicio: string
  horaFim: string
  descricao: string
  ativo: boolean
}

const empty: FormState = {
  filialId: '',
  codigo: '',
  nome: '',
  horaInicio: '06:00',
  horaFim: '14:00',
  descricao: '',
  ativo: true,
}

function toForm(t: TurnoTrabalho): FormState {
  return {
    filialId: t.filialId,
    codigo: t.codigo,
    nome: t.nome,
    horaInicio: t.horaInicio,
    horaFim: t.horaFim,
    descricao: t.descricao ?? '',
    ativo: t.ativo,
  }
}

const selectClass =
  'flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900 disabled:cursor-not-allowed disabled:opacity-50'

export function TurnoTrabalhoForm({ initial, onSaved, onCancel, defaultFilialId }: Props) {
  const [filiais, setFiliais] = React.useState<Filial[]>([])
  const [form, setForm] = React.useState<FormState>(() => {
    if (initial) return toForm(initial)
    return { ...empty, filialId: defaultFilialId ?? '' }
  })
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({})

  React.useEffect(() => {
    let cancelled = false
    filiaisApi
      .list({ ativo: true, pageSize: 100 })
      .then((res) => {
        if (cancelled) return
        setFiliais(res.items)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((s) => ({ ...s, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setFieldErrors({})
    try {
      if (!form.filialId) {
        throw new Error('Selecione uma filial.')
      }
      const payload: Partial<TurnoTrabalhoInput> = {
        ...form,
        descricao: form.descricao || null,
      }
      if (initial) {
        await turnosTrabalhoApi.update(initial.id, payload)
        toast.success('Turno atualizado', {
          description: `${form.codigo} — ${form.nome}`,
        })
      } else {
        await turnosTrabalhoApi.create(payload)
        toast.success('Turno cadastrado', {
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
      } else if (err instanceof Error) {
        setError(err.message)
        toast.error(err.message)
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
        <Field label="Filial *" error={fieldError('filialId')} className="sm:col-span-12">
          <select
            className={cn(selectClass)}
            value={form.filialId}
            onChange={(e) => set('filialId', e.target.value)}
            required
          >
            <option value="" disabled>
              Selecione a filial
            </option>
            {filiais.map((f) => (
              <option key={f.id} value={f.id}>
                {f.codigo} — {f.nome}
              </option>
            ))}
          </select>
          <span className="text-xs text-neutral-500">
            O código do turno é único <b>por filial</b>: cada unidade pode ter
            seu próprio "MANHA", "TARDE", etc.
          </span>
        </Field>
        <Field label="Código *" error={fieldError('codigo')} className="sm:col-span-4">
          <Input
            value={form.codigo}
            onChange={(e) => set('codigo', e.target.value)}
            placeholder="MANHA"
            maxLength={20}
            required
          />
        </Field>
        <Field label="Nome *" error={fieldError('nome')} className="sm:col-span-8">
          <Input
            value={form.nome}
            onChange={(e) => set('nome', e.target.value)}
            placeholder="Manhã"
            maxLength={80}
            required
          />
        </Field>
        <Field
          label="Hora de início *"
          error={fieldError('horaInicio')}
          className="sm:col-span-6"
        >
          <Input
            type="time"
            value={form.horaInicio}
            onChange={(e) => set('horaInicio', e.target.value)}
            required
          />
        </Field>
        <Field
          label="Hora de fim *"
          error={fieldError('horaFim')}
          className="sm:col-span-6"
        >
          <Input
            type="time"
            value={form.horaFim}
            onChange={(e) => set('horaFim', e.target.value)}
            required
          />
        </Field>
        <div className="sm:col-span-12 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          Turnos que viram a meia-noite (ex.: 22:00 → 06:00) também são
          aceitos.
        </div>
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
            placeholder="Observações sobre o turno (intervalos, equipes habituais, etc.)"
            className="flex w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900"
          />
        </Field>
        <div className="flex items-center gap-3 sm:col-span-12">
          <Switch
            checked={form.ativo}
            onCheckedChange={(v) => set('ativo', v)}
            id="ativo-turno"
          />
          <Label htmlFor="ativo-turno" className="cursor-pointer">
            Turno ativo
          </Label>
        </div>
      </section>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {initial ? 'Salvar alterações' : 'Cadastrar turno'}
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
