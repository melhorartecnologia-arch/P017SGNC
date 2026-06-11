import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ApiError } from '@/lib/api/client'
import type { Produto, ProdutoInput } from '@/lib/api/produtos'
import { produtosApi } from '@/lib/api/produtos'

type Props = {
  initial?: Produto | null
  onSaved: () => void
  onCancel: () => void
}

const empty: ProdutoInput = {
  codigo: '',
  descricao: '',
  unidadeMedida: '',
  ativo: true,
}

function toInput(p: Produto): ProdutoInput {
  return {
    codigo: p.codigo,
    descricao: p.descricao,
    unidadeMedida: p.unidadeMedida,
    ativo: p.ativo,
  }
}

export function ProdutoForm({ initial, onSaved, onCancel }: Props) {
  const [form, setForm] = React.useState<ProdutoInput>(() =>
    initial ? toInput(initial) : empty,
  )
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({})

  const set = <K extends keyof ProdutoInput>(key: K, value: ProdutoInput[K]) =>
    setForm((s) => ({ ...s, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setFieldErrors({})
    try {
      if (initial) {
        await produtosApi.update(initial.id, form)
        toast.success('Produto atualizado', {
          description: `${form.codigo} — ${form.descricao}`,
        })
      } else {
        await produtosApi.create(form)
        toast.success('Produto cadastrado', {
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

  const fieldError = (key: keyof ProdutoInput) => fieldErrors[key as string]?.[0]

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-12">
        <Field label="Código *" error={fieldError('codigo')} className="sm:col-span-4">
          <Input
            value={form.codigo}
            onChange={(e) => set('codigo', e.target.value)}
            placeholder="P00001"
            maxLength={20}
            required
          />
        </Field>
        <Field
          label="Unidade de medida *"
          error={fieldError('unidadeMedida')}
          className="sm:col-span-2"
        >
          <Input
            value={form.unidadeMedida}
            onChange={(e) => set('unidadeMedida', e.target.value)}
            placeholder="UN"
            maxLength={10}
            list="unidades-comuns"
            required
          />
          <datalist id="unidades-comuns">
            <option value="UN" />
            <option value="PC" />
            <option value="CX" />
            <option value="KG" />
            <option value="G" />
            <option value="L" />
            <option value="ML" />
            <option value="M" />
            <option value="M2" />
            <option value="M3" />
            <option value="PAR" />
          </datalist>
        </Field>
        <Field
          label="Descrição *"
          error={fieldError('descricao')}
          className="sm:col-span-6"
        >
          <Input
            value={form.descricao}
            onChange={(e) => set('descricao', e.target.value)}
            placeholder="Garrafa long neck 355ml"
            maxLength={160}
            required
          />
        </Field>
        <div className="flex items-center gap-3 sm:col-span-12">
          <Switch
            checked={form.ativo}
            onCheckedChange={(v) => set('ativo', v)}
            id="ativo-produto"
          />
          <Label htmlFor="ativo-produto" className="cursor-pointer">
            Produto ativo
          </Label>
        </div>
      </section>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {initial ? 'Salvar alterações' : 'Cadastrar produto'}
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
