import * as React from 'react'
import { Loader2, Trash2, Star, Phone, MessageCircle, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ApiError } from '@/lib/api/client'
import type {
  ContatoInput,
  ContatoTipo,
  Fornecedor,
  FornecedorInput,
} from '@/lib/api/fornecedores'
import { TIPO_LABEL, fornecedoresApi } from '@/lib/api/fornecedores'
import { cn } from '@/lib/utils'

type Props = {
  initial?: Fornecedor | null
  onSaved: () => void
  onCancel: () => void
}

type ContatoRow = ContatoInput & { _key: string }

let _keyCounter = 0
const newKey = () => `c${++_keyCounter}`

const empty: Omit<FornecedorInput, 'contatos'> = {
  codigo: '',
  razaoSocial: '',
  nomeFantasia: '',
  cnpj: '',
  ativo: true,
  observacoes: '',
}

function toForm(f: Fornecedor): Omit<FornecedorInput, 'contatos'> {
  return {
    codigo: f.codigo,
    razaoSocial: f.razaoSocial,
    nomeFantasia: f.nomeFantasia ?? '',
    cnpj: f.cnpj,
    ativo: f.ativo,
    observacoes: f.observacoes ?? '',
  }
}

const TIPO_ICON: Record<ContatoTipo, React.ComponentType<{ className?: string }>> = {
  TELEFONE_FIXO: Phone,
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
}

const PLACEHOLDERS: Record<ContatoTipo, string> = {
  TELEFONE_FIXO: '(24) 0000-0000',
  WHATSAPP: '(24) 90000-0000',
  EMAIL: 'contato@empresa.com.br',
}

export function FornecedorForm({ initial, onSaved, onCancel }: Props) {
  const [form, setForm] = React.useState(() =>
    initial ? toForm(initial) : empty,
  )
  const [contatos, setContatos] = React.useState<ContatoRow[]>(() =>
    initial
      ? initial.contatos.map((c) => ({
          _key: newKey(),
          tipo: c.tipo,
          valor: c.valor,
          nome: c.nome ?? '',
          principal: c.principal,
        }))
      : [],
  )
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({})

  const set = <K extends keyof typeof empty>(key: K, value: (typeof empty)[K]) =>
    setForm((s) => ({ ...s, [key]: value }))

  const addContato = (tipo: ContatoTipo) => {
    setContatos((cs) => [
      ...cs,
      { _key: newKey(), tipo, valor: '', nome: '', principal: cs.length === 0 },
    ])
  }

  const updateContato = <K extends keyof ContatoRow>(
    key: string,
    field: K,
    value: ContatoRow[K],
  ) => {
    setContatos((cs) =>
      cs.map((c) => (c._key === key ? { ...c, [field]: value } : c)),
    )
  }

  const removeContato = (key: string) => {
    setContatos((cs) => cs.filter((c) => c._key !== key))
  }

  const setPrincipal = (key: string) => {
    setContatos((cs) => cs.map((c) => ({ ...c, principal: c._key === key })))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setFieldErrors({})
    try {
      const payload: Partial<FornecedorInput> = {
        ...form,
        nomeFantasia: form.nomeFantasia || null,
        observacoes: form.observacoes || null,
        contatos: contatos.map(({ _key, ...rest }) => ({
          ...rest,
          nome: rest.nome || null,
        })),
      }
      if (initial) {
        await fornecedoresApi.update(initial.id, payload)
        toast.success('Fornecedor atualizado', {
          description: `${form.codigo} — ${form.razaoSocial}`,
        })
      } else {
        await fornecedoresApi.create(payload)
        toast.success('Fornecedor cadastrado', {
          description: `${form.codigo} — ${form.razaoSocial}`,
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

  const fieldError = (key: keyof typeof empty) => fieldErrors[key as string]?.[0]

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
            placeholder="FORN001"
            maxLength={20}
            required
          />
        </Field>
        <Field
          label="Razão Social *"
          error={fieldError('razaoSocial')}
          className="sm:col-span-9"
        >
          <Input
            value={form.razaoSocial}
            onChange={(e) => set('razaoSocial', e.target.value)}
            maxLength={160}
            required
          />
        </Field>
        <Field
          label="Nome Fantasia"
          error={fieldError('nomeFantasia')}
          className="sm:col-span-8"
        >
          <Input
            value={form.nomeFantasia ?? ''}
            onChange={(e) => set('nomeFantasia', e.target.value)}
            maxLength={160}
          />
        </Field>
        <Field label="CNPJ *" error={fieldError('cnpj')} className="sm:col-span-4">
          <Input
            value={form.cnpj}
            onChange={(e) => set('cnpj', e.target.value)}
            placeholder="00.000.000/0001-00"
            maxLength={18}
            required
          />
        </Field>
      </section>

      <div className="h-px bg-neutral-200" />

      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between">
          <div>
            <Label className="text-base font-semibold text-neutral-900">Contatos</Label>
            <p className="text-xs text-neutral-500">
              Pode ter quantos contatos forem necessários (telefone fixo, WhatsApp e
              e-mail).
            </p>
          </div>
          <div className="flex gap-1">
            {(['TELEFONE_FIXO', 'WHATSAPP', 'EMAIL'] as const).map((t) => {
              const Icon = TIPO_ICON[t]
              return (
                <Button
                  key={t}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => addContato(t)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {TIPO_LABEL[t]}
                </Button>
              )
            })}
          </div>
        </div>

        {contatos.length === 0 && (
          <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50/50 px-4 py-6 text-center text-sm text-neutral-500">
            Nenhum contato adicionado. Use os botões acima para incluir telefone fixo,
            WhatsApp ou e-mail.
          </div>
        )}

        <div className="flex flex-col gap-2">
          {contatos.map((c, idx) => {
            const Icon = TIPO_ICON[c.tipo]
            return (
              <div
                key={c._key}
                className="grid grid-cols-12 gap-2 rounded-md border border-neutral-200 bg-white p-3"
              >
                <div className="col-span-12 sm:col-span-3">
                  <Label className="text-xs text-neutral-500">Tipo</Label>
                  <div className="mt-1 inline-flex h-9 items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 text-sm text-neutral-700">
                    <Icon className="h-4 w-4 text-neutral-500" />
                    {TIPO_LABEL[c.tipo]}
                  </div>
                </div>
                <div className="col-span-12 sm:col-span-4">
                  <Label className="text-xs text-neutral-500">
                    {c.tipo === 'EMAIL' ? 'E-mail *' : 'Número *'}
                  </Label>
                  <Input
                    value={c.valor}
                    onChange={(e) => updateContato(c._key, 'valor', e.target.value)}
                    type={c.tipo === 'EMAIL' ? 'email' : 'text'}
                    placeholder={PLACEHOLDERS[c.tipo]}
                    maxLength={160}
                    required
                    className="mt-1"
                  />
                </div>
                <div className="col-span-9 sm:col-span-3">
                  <Label className="text-xs text-neutral-500">Nome / função</Label>
                  <Input
                    value={c.nome ?? ''}
                    onChange={(e) => updateContato(c._key, 'nome', e.target.value)}
                    placeholder="Ex.: Comercial"
                    maxLength={120}
                    className="mt-1"
                  />
                </div>
                <div className="col-span-3 sm:col-span-2 flex items-end justify-end gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-9 w-9',
                      c.principal
                        ? 'text-amber-500 hover:text-amber-600'
                        : 'text-neutral-400 hover:text-neutral-700',
                    )}
                    onClick={() => setPrincipal(c._key)}
                    title={c.principal ? 'Contato principal' : 'Marcar como principal'}
                  >
                    <Star
                      className={cn('h-4 w-4', c.principal && 'fill-amber-400')}
                    />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => removeContato(c._key)}
                    title="Remover contato"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {idx === 0 && fieldErrors.contatos && (
                  <div className="col-span-12 text-xs text-red-600">
                    {fieldErrors.contatos[0]}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <div className="h-px bg-neutral-200" />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-12">
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
            id="ativo-fornecedor"
          />
          <Label htmlFor="ativo-fornecedor" className="cursor-pointer">
            Fornecedor ativo
          </Label>
        </div>
      </section>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {initial ? 'Salvar alterações' : 'Cadastrar fornecedor'}
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
