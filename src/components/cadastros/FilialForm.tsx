import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ApiError } from '@/lib/api/client'
import type { Filial, FilialInput } from '@/lib/api/filiais'
import { filiaisApi } from '@/lib/api/filiais'
import { maskCnpj, maskCep } from '@/lib/utils/masks'

type Props = {
  initial?: Filial | null
  onSaved: () => void
  onCancel: () => void
}

const empty: FilialInput = {
  codigo: '',
  nome: '',
  razaoSocial: '',
  cnpj: '',
  endereco: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  cep: '',
  ativo: true,
  observacoes: '',
  rncNumeroInicial: 0,
  raqNumeroInicial: 0,
  rvtNumeroInicial: 0,
}

function toInput(f: Filial): FilialInput {
  return {
    codigo: f.codigo,
    nome: f.nome,
    razaoSocial: f.razaoSocial,
    cnpj: f.cnpj,
    endereco: f.endereco,
    numero: f.numero ?? '',
    complemento: f.complemento ?? '',
    bairro: f.bairro ?? '',
    cidade: f.cidade,
    uf: f.uf,
    cep: f.cep,
    ativo: f.ativo,
    observacoes: f.observacoes ?? '',
    rncNumeroInicial: f.rncNumeroInicial ?? 0,
    raqNumeroInicial: f.raqNumeroInicial ?? 0,
    rvtNumeroInicial: f.rvtNumeroInicial ?? 0,
  }
}

export function FilialForm({ initial, onSaved, onCancel }: Props) {
  const [form, setForm] = React.useState<FilialInput>(() =>
    initial ? toInput(initial) : empty,
  )
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({})

  const set = <K extends keyof FilialInput>(key: K, value: FilialInput[K]) =>
    setForm((s) => ({ ...s, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setFieldErrors({})
    try {
      // Trim and convert empty strings to null where API expects nullable
      const payload: Partial<FilialInput> = {
        ...form,
        numero: form.numero || null,
        complemento: form.complemento || null,
        bairro: form.bairro || null,
        observacoes: form.observacoes || null,
      }
      if (initial) {
        await filiaisApi.update(initial.id, payload)
        toast.success('Filial atualizada', {
          description: `${form.codigo} — ${form.nome}`,
        })
      } else {
        await filiaisApi.create(payload)
        toast.success('Filial cadastrada', {
          description: `${form.codigo} — ${form.nome}`,
        })
      }
      onSaved()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
        toast.error('Não foi possível salvar a filial', { description: err.message })
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

  const fieldError = (key: keyof FilialInput) => fieldErrors[key as string]?.[0]

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
            placeholder="MATRIZ"
            maxLength={20}
            required
          />
        </Field>
        <Field label="Nome *" error={fieldError('nome')} className="sm:col-span-9">
          <Input
            value={form.nome}
            onChange={(e) => set('nome', e.target.value)}
            placeholder="Matriz Petrópolis"
            maxLength={120}
            required
          />
        </Field>
        <Field
          label="Razão Social *"
          error={fieldError('razaoSocial')}
          className="sm:col-span-8"
        >
          <Input
            value={form.razaoSocial}
            onChange={(e) => set('razaoSocial', e.target.value)}
            placeholder="Cervejaria Cidade Imperial Ltda."
            maxLength={160}
            required
          />
        </Field>
        <Field label="CNPJ *" error={fieldError('cnpj')} className="sm:col-span-4">
          <Input
            value={form.cnpj}
            onChange={(e) => set('cnpj', maskCnpj(e.target.value))}
            placeholder="00.000.000/0001-00"
            inputMode="numeric"
            maxLength={18}
            required
          />
        </Field>
      </section>

      <div className="h-px bg-neutral-200" />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-12">
        <Field label="Endereço *" error={fieldError('endereco')} className="sm:col-span-9">
          <Input
            value={form.endereco}
            onChange={(e) => set('endereco', e.target.value)}
            maxLength={200}
            required
          />
        </Field>
        <Field label="Número" error={fieldError('numero')} className="sm:col-span-3">
          <Input
            value={form.numero ?? ''}
            onChange={(e) => set('numero', e.target.value)}
            maxLength={20}
          />
        </Field>
        <Field label="Bairro" error={fieldError('bairro')} className="sm:col-span-5">
          <Input
            value={form.bairro ?? ''}
            onChange={(e) => set('bairro', e.target.value)}
            maxLength={80}
          />
        </Field>
        <Field
          label="Complemento"
          error={fieldError('complemento')}
          className="sm:col-span-7"
        >
          <Input
            value={form.complemento ?? ''}
            onChange={(e) => set('complemento', e.target.value)}
            maxLength={60}
          />
        </Field>
        <Field label="Cidade *" error={fieldError('cidade')} className="sm:col-span-7">
          <Input
            value={form.cidade}
            onChange={(e) => set('cidade', e.target.value)}
            maxLength={80}
            required
          />
        </Field>
        <Field label="UF *" error={fieldError('uf')} className="sm:col-span-2">
          <Input
            value={form.uf}
            onChange={(e) => set('uf', e.target.value.toUpperCase())}
            maxLength={2}
            required
          />
        </Field>
        <Field label="CEP *" error={fieldError('cep')} className="sm:col-span-3">
          <Input
            value={form.cep}
            onChange={(e) => set('cep', maskCep(e.target.value))}
            placeholder="00000-000"
            inputMode="numeric"
            maxLength={9}
            required
          />
        </Field>
      </section>

      <div className="h-px bg-neutral-200" />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-12">
        <Field
          label="Numeração inicial de RNC"
          error={fieldError('rncNumeroInicial')}
          className="sm:col-span-4"
        >
          <Input
            type="number"
            min={0}
            step={1}
            value={String(form.rncNumeroInicial ?? 0)}
            onChange={(e) =>
              set('rncNumeroInicial', Math.max(0, Math.floor(Number(e.target.value) || 0)))
            }
            placeholder="0"
          />
        </Field>
        <Field
          label="Numeração inicial de RAQ"
          error={fieldError('raqNumeroInicial')}
          className="sm:col-span-4"
        >
          <Input
            type="number"
            min={0}
            step={1}
            value={String(form.raqNumeroInicial ?? 0)}
            onChange={(e) =>
              set('raqNumeroInicial', Math.max(0, Math.floor(Number(e.target.value) || 0)))
            }
            placeholder="0"
          />
        </Field>
        <Field
          label="Numeração inicial de RVT"
          error={fieldError('rvtNumeroInicial')}
          className="sm:col-span-4"
        >
          <Input
            type="number"
            min={0}
            step={1}
            value={String(form.rvtNumeroInicial ?? 0)}
            onChange={(e) =>
              set('rvtNumeroInicial', Math.max(0, Math.floor(Number(e.target.value) || 0)))
            }
            placeholder="0"
          />
        </Field>
        <p className="self-end pb-2 text-xs text-neutral-500 sm:col-span-12">
          Informe o <b>último número já usado</b> de cada tipo no controle atual
          desta filial — a contagem continua a partir daí (ex.: informando 120,
          o próximo documento será o 121). Deixe 0 para começar do início.
        </p>

        <Field
          label="Observações"
          error={fieldError('observacoes')}
          className="sm:col-span-12"
        >
          <textarea
            value={form.observacoes ?? ''}
            onChange={(e) => set('observacoes', e.target.value)}
            rows={3}
            maxLength={2000}
            className="flex w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900"
          />
        </Field>
        <div className="flex items-center gap-3 sm:col-span-12">
          <Switch
            checked={form.ativo}
            onCheckedChange={(v) => set('ativo', v)}
            id="ativo"
          />
          <Label htmlFor="ativo" className="cursor-pointer">
            Filial ativa
          </Label>
        </div>
      </section>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {initial ? 'Salvar alterações' : 'Cadastrar filial'}
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
