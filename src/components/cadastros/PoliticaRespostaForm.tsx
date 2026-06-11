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
  PoliticaResposta,
  PoliticaRespostaInput,
} from '@/lib/api/politicas-resposta'
import { politicasRespostaApi } from '@/lib/api/politicas-resposta'
import {
  tiposRelatorioApi,
  type TipoRelatorio,
} from '@/lib/api/tipos-relatorio'

type Props = {
  initial?: PoliticaResposta | null
  onSaved: () => void
  onCancel: () => void
}

type FormState = {
  tipoRelatorioId: string
  horasResposta: number
  descricao: string
  ativo: boolean
}

const empty: FormState = {
  tipoRelatorioId: '',
  horasResposta: 24,
  descricao: '',
  ativo: true,
}

function toForm(p: PoliticaResposta): FormState {
  return {
    tipoRelatorioId: p.tipoRelatorioId,
    horasResposta: p.horasResposta,
    descricao: p.descricao ?? '',
    ativo: p.ativo,
  }
}

const selectClass =
  'flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900 disabled:cursor-not-allowed disabled:opacity-50'

export function PoliticaRespostaForm({ initial, onSaved, onCancel }: Props) {
  const [tipos, setTipos] = React.useState<TipoRelatorio[]>([])
  const [loadingTipos, setLoadingTipos] = React.useState(true)
  const [form, setForm] = React.useState<FormState>(() =>
    initial ? toForm(initial) : empty,
  )
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({})

  React.useEffect(() => {
    let cancelled = false
    setLoadingTipos(true)
    tiposRelatorioApi
      .list({ ativo: true, pageSize: 100 })
      .then((res) => {
        if (!cancelled) setTipos(res.items)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingTipos(false)
      })
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
      const payload: Partial<PoliticaRespostaInput> = {
        tipoRelatorioId: form.tipoRelatorioId,
        horasResposta: form.horasResposta,
        descricao: form.descricao || null,
        ativo: form.ativo,
      }
      if (initial) {
        await politicasRespostaApi.update(initial.id, payload)
        toast.success('Política atualizada')
      } else {
        await politicasRespostaApi.create(payload)
        toast.success('Política cadastrada')
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
        <Field
          label="Tipo de Relatório *"
          error={fieldError('tipoRelatorioId')}
          className="sm:col-span-12"
        >
          <select
            className={cn(selectClass)}
            value={form.tipoRelatorioId}
            onChange={(e) => set('tipoRelatorioId', e.target.value)}
            required
            disabled={loadingTipos || !!initial}
            title={
              initial
                ? 'O tipo de relatório não pode ser alterado depois de criada a política.'
                : undefined
            }
          >
            <option value="" disabled>
              Selecione o tipo de relatório
            </option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.codigo} — {t.descricao}
              </option>
            ))}
          </select>
          <span className="text-xs text-neutral-500">
            Cada tipo de relatório pode ter <b>apenas uma</b> política de
            resposta.
          </span>
        </Field>
        <Field
          label="Horas para assinatura *"
          error={fieldError('horasResposta')}
          className="sm:col-span-6"
        >
          <Input
            type="number"
            min={1}
            max={8760}
            value={form.horasResposta}
            onChange={(e) =>
              set('horasResposta', Number(e.target.value) || 1)
            }
            required
          />
          <span className="text-xs text-neutral-500">
            Quantidade de horas contínuas dentro das quais a assinatura precisa
            acontecer. Ex.: 24 = 1 dia, 72 = 3 dias, 168 = 1 semana.
          </span>
        </Field>
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
            placeholder="Observações sobre a política (contagem, exceções, etc.)"
            className="flex w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900"
          />
        </Field>
        <div className="flex items-center gap-3 sm:col-span-12">
          <Switch
            checked={form.ativo}
            onCheckedChange={(v) => set('ativo', v)}
            id="ativo-politica"
          />
          <Label htmlFor="ativo-politica" className="cursor-pointer">
            Política ativa
          </Label>
        </div>
      </section>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting || loadingTipos}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {initial ? 'Salvar alterações' : 'Cadastrar política'}
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
