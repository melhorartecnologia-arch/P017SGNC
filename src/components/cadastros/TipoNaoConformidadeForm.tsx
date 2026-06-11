import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api/client'
import type {
  ProdutoRef,
  TipoNaoConformidade,
} from '@/lib/api/tipos-nao-conformidade'
import { tiposNaoConformidadeApi } from '@/lib/api/tipos-nao-conformidade'
import { severidadesApi, type Severidade } from '@/lib/api/severidades'
import { ProdutosMultiSelect } from './ProdutosMultiSelect'

type Props = {
  initial?: TipoNaoConformidade | null
  onSaved: () => void
  onCancel: () => void
}

type FormState = {
  codigo: string
  descricao: string
  severidadeId: string
  ativo: boolean
  produtos: ProdutoRef[]
}

const empty: FormState = {
  codigo: '',
  descricao: '',
  severidadeId: '',
  ativo: true,
  produtos: [],
}

function toForm(t: TipoNaoConformidade): FormState {
  return {
    codigo: t.codigo,
    descricao: t.descricao,
    severidadeId: t.severidadeId ?? '',
    ativo: t.ativo,
    produtos: t.produtos,
  }
}

const selectClass =
  'flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900 disabled:cursor-not-allowed disabled:opacity-50'

export function TipoNaoConformidadeForm({ initial, onSaved, onCancel }: Props) {
  const [severidades, setSeveridades] = React.useState<Severidade[]>([])
  const [form, setForm] = React.useState<FormState>(() =>
    initial ? toForm(initial) : empty,
  )
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({})

  React.useEffect(() => {
    let cancelled = false
    severidadesApi
      .list({ ativo: true, pageSize: 100 })
      .then((res) => {
        if (!cancelled) setSeveridades(res.items)
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
      const payload = {
        codigo: form.codigo,
        descricao: form.descricao,
        severidadeId: form.severidadeId || null,
        ativo: form.ativo,
        produtosIds: form.produtos.map((p) => p.id),
      }
      if (initial) {
        await tiposNaoConformidadeApi.update(initial.id, payload)
        toast.success('Tipo de não conformidade atualizado', {
          description: `${form.codigo} — ${form.descricao}`,
        })
      } else {
        await tiposNaoConformidadeApi.create(payload)
        toast.success('Tipo de não conformidade cadastrado', {
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

  const fieldError = (key: keyof FormState | 'produtosIds') =>
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
            placeholder="DIM"
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
            placeholder="Não conformidade dimensional"
            maxLength={160}
            required
          />
        </Field>
        <Field
          label="Severidade do defeito"
          error={fieldError('severidadeId')}
          className="sm:col-span-12"
        >
          <select
            className={cn(selectClass)}
            value={form.severidadeId}
            onChange={(e) => set('severidadeId', e.target.value)}
          >
            <option value="">(Sem severidade definida)</option>
            {severidades.map((s) => (
              <option key={s.id} value={s.id}>
                Nível {s.nivel} — {s.codigo} — {s.nome}
              </option>
            ))}
          </select>
          <span className="text-xs text-neutral-500">
            Opcional. Use para indicar a gravidade típica desse tipo de defeito.
          </span>
        </Field>
        <Field
          label="Produtos relacionados"
          error={fieldError('produtosIds')}
          className="sm:col-span-12"
        >
          <ProdutosMultiSelect
            selected={form.produtos}
            onChange={(produtos) => set('produtos', produtos)}
            disabled={submitting}
          />
          <span className="text-xs text-neutral-500">
            Opcional. Vincule produtos que costumam apresentar este tipo de não
            conformidade.
          </span>
        </Field>
        <div className="flex items-center gap-3 sm:col-span-12">
          <Switch
            checked={form.ativo}
            onCheckedChange={(v) => set('ativo', v)}
            id="ativo-tipo-nc"
          />
          <Label htmlFor="ativo-tipo-nc" className="cursor-pointer">
            Tipo ativo
          </Label>
        </div>
      </section>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {initial ? 'Salvar alterações' : 'Cadastrar tipo'}
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
