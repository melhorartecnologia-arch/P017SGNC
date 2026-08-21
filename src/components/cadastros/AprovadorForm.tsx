import * as React from 'react'
import { Loader2, Phone, MessageCircle, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ApiError } from '@/lib/api/client'
import type { Aprovador, AprovadorInput } from '@/lib/api/aprovadores'
import { aprovadoresApi } from '@/lib/api/aprovadores'
import {
  tiposRelatorioApi,
  type TipoRelatorio,
} from '@/lib/api/tipos-relatorio'
import { filiaisApi, type Filial } from '@/lib/api/filiais'
import { areasApi, type Area } from '@/lib/api/areas'
import {
  turnosTrabalhoApi,
  type TurnoTrabalho,
} from '@/lib/api/turnos-trabalho'
import { cn } from '@/lib/utils'

type Props = {
  initial?: Aprovador | null
  onSaved: () => void
  onCancel: () => void
}

type FormState = {
  filialId: string
  areaId: string
  turnoId: string
  nivel: number
  nome: string
  cargo: string
  email: string
  telefone: string
  whatsapp: string
  ativo: boolean
  recebeRespostaFornecedor: boolean
  observacoes: string
  tiposRelatorioIds: string[]
}

const empty: FormState = {
  filialId: '',
  areaId: '',
  turnoId: '',
  nivel: 1,
  nome: '',
  cargo: '',
  email: '',
  telefone: '',
  whatsapp: '',
  ativo: true,
  recebeRespostaFornecedor: false,
  observacoes: '',
  tiposRelatorioIds: [],
}

function toForm(a: Aprovador): FormState {
  return {
    filialId: a.filialId,
    areaId: a.areaId,
    turnoId: a.turnoId ?? '',
    nivel: a.nivel,
    nome: a.nome,
    cargo: a.cargo ?? '',
    email: a.email,
    telefone: a.telefone ?? '',
    whatsapp: a.whatsapp ?? '',
    ativo: a.ativo,
    recebeRespostaFornecedor: a.recebeRespostaFornecedor ?? false,
    observacoes: a.observacoes ?? '',
    tiposRelatorioIds: (a.tiposRelatorio ?? []).map((t) => t.id),
  }
}

const selectClass =
  'flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900 disabled:cursor-not-allowed disabled:opacity-50'

export function AprovadorForm({ initial, onSaved, onCancel }: Props) {
  const [form, setForm] = React.useState<FormState>(() =>
    initial ? toForm(initial) : empty,
  )
  const [filiais, setFiliais] = React.useState<Filial[]>([])
  const [areas, setAreas] = React.useState<Area[]>([])
  const [tiposRelatorio, setTiposRelatorio] = React.useState<TipoRelatorio[]>([])
  const [turnos, setTurnos] = React.useState<TurnoTrabalho[]>([])
  const [loadingDeps, setLoadingDeps] = React.useState(true)
  const [loadingTurnos, setLoadingTurnos] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({})

  React.useEffect(() => {
    let mounted = true
    setLoadingDeps(true)
    Promise.all([
      filiaisApi.list({ ativo: true, pageSize: 100 }),
      areasApi.list({ ativo: true, pageSize: 100 }),
      tiposRelatorioApi.list({ ativo: true, pageSize: 100 }),
    ])
      .then(([f, a, t]) => {
        if (!mounted) return
        setFiliais(f.items)
        setAreas(a.items)
        setTiposRelatorio(t.items)
      })
      .catch(() => {
        if (!mounted) return
        setError('Falha ao carregar filiais ou áreas.')
      })
      .finally(() => {
        if (mounted) setLoadingDeps(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  // Carrega turnos sempre que a filial selecionada muda. Limpa o turno
  // atual se ele não pertencer mais à filial escolhida.
  React.useEffect(() => {
    if (!form.filialId) {
      setTurnos([])
      if (form.turnoId !== '') setForm((s) => ({ ...s, turnoId: '' }))
      return
    }
    let cancelled = false
    setLoadingTurnos(true)
    turnosTrabalhoApi
      .list({ ativo: true, filialId: form.filialId, pageSize: 100 })
      .then((res) => {
        if (cancelled) return
        setTurnos(res.items)
        // Se o turno atual não está na lista da nova filial, limpa.
        if (form.turnoId && !res.items.some((t) => t.id === form.turnoId)) {
          setForm((s) => ({ ...s, turnoId: '' }))
        }
      })
      .catch(() => {
        if (!cancelled) setTurnos([])
      })
      .finally(() => {
        if (!cancelled) setLoadingTurnos(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.filialId])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((s) => ({ ...s, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setFieldErrors({})
    try {
      const payload: Partial<AprovadorInput> = {
        filialId: form.filialId,
        areaId: form.areaId,
        turnoId: form.turnoId || null,
        nivel: form.nivel,
        nome: form.nome,
        cargo: form.cargo || null,
        email: form.email,
        telefone: form.telefone || null,
        whatsapp: form.whatsapp || null,
        ativo: form.ativo,
        recebeRespostaFornecedor: form.recebeRespostaFornecedor,
        tiposRelatorioIds: form.tiposRelatorioIds,
        observacoes: form.observacoes || null,
      }
      if (initial) {
        await aprovadoresApi.update(initial.id, payload)
        toast.success('Aprovador atualizado', { description: form.nome })
      } else {
        await aprovadoresApi.create(payload)
        toast.success('Aprovador cadastrado', { description: form.nome })
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
        <Field label="Filial *" error={fieldError('filialId')} className="sm:col-span-5">
          <select
            className={cn(selectClass)}
            value={form.filialId}
            onChange={(e) => set('filialId', e.target.value)}
            required
            disabled={loadingDeps}
          >
            <option value="">Selecione…</option>
            {filiais.map((f) => (
              <option key={f.id} value={f.id}>
                {f.codigo} — {f.nome}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Área *" error={fieldError('areaId')} className="sm:col-span-5">
          <select
            className={cn(selectClass)}
            value={form.areaId}
            onChange={(e) => set('areaId', e.target.value)}
            required
            disabled={loadingDeps}
          >
            <option value="">Selecione…</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.codigo} — {a.nome}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Nível *"
          error={fieldError('nivel')}
          className="sm:col-span-2"
        >
          <Input
            type="number"
            min={1}
            max={99}
            value={form.nivel}
            onChange={(e) => set('nivel', Number(e.target.value) || 1)}
            required
          />
        </Field>
        <Field
          label="Turno"
          error={fieldError('turnoId')}
          className="sm:col-span-12"
        >
          <select
            className={cn(selectClass)}
            value={form.turnoId}
            onChange={(e) => set('turnoId', e.target.value)}
            disabled={!form.filialId || loadingTurnos}
          >
            <option value="">
              {form.filialId ? '(Sem turno definido)' : 'Selecione a filial primeiro'}
            </option>
            {turnos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.codigo} — {t.nome} ({t.horaInicio}–{t.horaFim})
              </option>
            ))}
          </select>
          {form.filialId && !loadingTurnos && turnos.length === 0 && (
            <span className="text-xs text-neutral-500">
              Esta filial não possui turnos cadastrados.
            </span>
          )}
        </Field>
        <Field label="Nome *" error={fieldError('nome')} className="sm:col-span-7">
          <Input
            value={form.nome}
            onChange={(e) => set('nome', e.target.value)}
            placeholder="Maria Silva"
            maxLength={120}
            required
          />
        </Field>
        <Field label="Cargo" error={fieldError('cargo')} className="sm:col-span-5">
          <Input
            value={form.cargo}
            onChange={(e) => set('cargo', e.target.value)}
            placeholder="Gerente de Qualidade"
            maxLength={120}
          />
        </Field>
        <div className="sm:col-span-12 rounded-md bg-neutral-50 border border-neutral-200 px-3 py-2 text-xs text-neutral-600">
          O <b>nível</b> define a ordem de escalonamento das aprovações. Só pode
          existir um aprovador por nível para cada combinação de filial e área.
        </div>
      </section>

      <div className="h-px bg-neutral-200" />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-12">
        <Field label="E-mail *" error={fieldError('email')} className="sm:col-span-12">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="aprovador@cidadeimperial.com.br"
              maxLength={160}
              required
              className="pl-8"
            />
          </div>
        </Field>
        <Field label="Telefone fixo" error={fieldError('telefone')} className="sm:col-span-6">
          <div className="relative">
            <Phone className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={form.telefone}
              onChange={(e) => set('telefone', e.target.value)}
              placeholder="(24) 0000-0000"
              maxLength={20}
              className="pl-8"
            />
          </div>
        </Field>
        <Field label="WhatsApp" error={fieldError('whatsapp')} className="sm:col-span-6">
          <div className="relative">
            <MessageCircle className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={form.whatsapp}
              onChange={(e) => set('whatsapp', e.target.value)}
              placeholder="(24) 90000-0000"
              maxLength={20}
              className="pl-8"
            />
          </div>
        </Field>
      </section>

      <div className="h-px bg-neutral-200" />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-12">
        <Field
          label="Observações"
          error={fieldError('observacoes')}
          className="sm:col-span-12"
        >
          <textarea
            value={form.observacoes}
            onChange={(e) => set('observacoes', e.target.value)}
            rows={3}
            maxLength={2000}
            className="flex w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900"
          />
        </Field>
        <div className="flex flex-col gap-1.5 sm:col-span-12">
          <Label>Tipos de relatório que assina</Label>
          <div className="flex flex-wrap gap-2">
            {tiposRelatorio.map((t) => {
              const marcado = form.tiposRelatorioIds.includes(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() =>
                    set(
                      'tiposRelatorioIds',
                      marcado
                        ? form.tiposRelatorioIds.filter((id) => id !== t.id)
                        : [...form.tiposRelatorioIds, t.id],
                    )
                  }
                  className={
                    marcado
                      ? 'rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1 text-xs font-medium text-white'
                      : 'rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50'
                  }
                >
                  {t.codigo}
                </button>
              )
            })}
          </div>
          <span className="text-xs text-neutral-500">
            Sem nenhum tipo selecionado, o aprovador assina todos os tipos de
            relatório — mesma regra da restrição de turno.
          </span>
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-12">
          <div className="flex items-center gap-3">
            <Switch
              checked={form.recebeRespostaFornecedor}
              onCheckedChange={(v) => set('recebeRespostaFornecedor', v)}
              id="recebe-resposta-fornecedor"
            />
            <Label htmlFor="recebe-resposta-fornecedor" className="cursor-pointer">
              Recebe as respostas do fornecedor
            </Label>
          </div>
          <span className="text-xs text-neutral-500">
            Após todas as assinaturas, a RNC vai ao fornecedor para aceite ou
            recusa. Somente os aprovadores marcados aqui recebem essa resposta
            por e-mail.
          </span>
        </div>
        <div className="flex items-center gap-3 sm:col-span-12">
          <Switch
            checked={form.ativo}
            onCheckedChange={(v) => set('ativo', v)}
            id="ativo-aprovador"
          />
          <Label htmlFor="ativo-aprovador" className="cursor-pointer">
            Aprovador ativo
          </Label>
        </div>
      </section>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting || loadingDeps}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {initial ? 'Salvar alterações' : 'Cadastrar aprovador'}
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
