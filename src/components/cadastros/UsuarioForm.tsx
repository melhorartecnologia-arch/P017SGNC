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
  Usuario,
  UsuarioCreateInput,
  UsuarioRole,
  UsuarioUpdateInput,
} from '@/lib/api/usuarios'
import { usuariosApi } from '@/lib/api/usuarios'
import { useAuth } from '@/lib/auth/AuthContext'

type FormState = {
  email: string
  nome: string
  senha: string
  role: UsuarioRole
  ativo: boolean
  filialPadraoId: string
}

type Props = {
  initial?: Usuario | null
  onSaved: () => void
  onCancel: () => void
}

const empty: FormState = {
  email: '',
  nome: '',
  senha: '',
  role: 'USUARIO',
  ativo: true,
  filialPadraoId: '',
}

function toForm(u: Usuario): FormState {
  return {
    email: u.email,
    nome: u.nome,
    senha: '',
    role: u.role,
    ativo: u.ativo,
    filialPadraoId: u.filialPadraoId ?? '',
  }
}

const selectClass =
  'flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900 disabled:cursor-not-allowed disabled:opacity-50'

export function UsuarioForm({ initial, onSaved, onCancel }: Props) {
  const auth = useAuth()
  const currentUserId = auth.status === 'authenticated' ? auth.user.id : null
  const editandoEuMesmo = !!initial && currentUserId === initial.id

  const [filiais, setFiliais] = React.useState<Filial[]>([])
  const [form, setForm] = React.useState<FormState>(() =>
    initial ? toForm(initial) : empty,
  )
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

  // Mantém a filial padrão atual visível mesmo se estiver inativa
  // (a listagem só traz filiais ativas).
  const filialOptions = React.useMemo(() => {
    const opts: { id: string; codigo: string; nome: string }[] = filiais.map(
      (f) => ({ id: f.id, codigo: f.codigo, nome: f.nome }),
    )
    const atual = initial?.filialPadrao
    if (atual && !opts.some((f) => f.id === atual.id)) opts.push(atual)
    return opts
  }, [filiais, initial])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((s) => ({ ...s, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setFieldErrors({})
    try {
      if (initial) {
        const payload: UsuarioUpdateInput = {
          email: form.email,
          nome: form.nome,
          role: form.role,
          ativo: form.ativo,
          filialPadraoId: form.filialPadraoId || null,
        }
        if (form.senha.trim()) payload.senha = form.senha
        await usuariosApi.update(initial.id, payload)
        toast.success('Usuário atualizado', { description: form.email })
      } else {
        const payload: UsuarioCreateInput = {
          email: form.email,
          nome: form.nome,
          senha: form.senha,
          role: form.role,
          ativo: form.ativo,
          filialPadraoId: form.filialPadraoId || null,
        }
        await usuariosApi.create(payload)
        toast.success('Usuário cadastrado', { description: form.email })
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
        <Field label="Nome *" error={fieldError('nome')} className="sm:col-span-7">
          <Input
            value={form.nome}
            onChange={(e) => set('nome', e.target.value)}
            placeholder="Nome completo"
            maxLength={120}
            required
          />
        </Field>

        <Field label="Perfil *" error={fieldError('role')} className="sm:col-span-5">
          <select
            className={cn(selectClass)}
            value={form.role}
            onChange={(e) => set('role', e.target.value as UsuarioRole)}
            disabled={editandoEuMesmo}
            title={
              editandoEuMesmo
                ? 'Você não pode alterar seu próprio perfil.'
                : undefined
            }
          >
            <option value="USUARIO">Usuário</option>
            <option value="ADMIN">Administrador</option>
          </select>
          {editandoEuMesmo && (
            <span className="text-xs text-neutral-500">
              Você não pode alterar seu próprio perfil.
            </span>
          )}
        </Field>

        <Field label="E-mail *" error={fieldError('email')} className="sm:col-span-12">
          <Input
            type="email"
            autoComplete="off"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="usuario@empresa.com"
            maxLength={160}
            required
          />
        </Field>

        <Field
          label={initial ? 'Nova senha' : 'Senha *'}
          error={fieldError('senha')}
          className="sm:col-span-12"
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={form.senha}
            onChange={(e) => set('senha', e.target.value)}
            placeholder={
              initial ? 'Deixe em branco para manter a atual' : 'Mínimo 6 caracteres'
            }
            minLength={initial ? undefined : 6}
            maxLength={72}
            required={!initial}
          />
          <span className="text-xs text-neutral-500">
            {initial
              ? 'Preencha apenas se quiser redefinir a senha do usuário.'
              : 'Mínimo de 6 caracteres.'}
          </span>
        </Field>

        <Field
          label="Filial padrão"
          error={fieldError('filialPadraoId')}
          className="sm:col-span-12"
        >
          <select
            className={cn(selectClass)}
            value={form.filialPadraoId}
            onChange={(e) => set('filialPadraoId', e.target.value)}
          >
            <option value="">Sem filial padrão</option>
            {filialOptions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.codigo} — {f.nome}
              </option>
            ))}
          </select>
          <span className="text-xs text-neutral-500">
            Filial sugerida automaticamente para o usuário ao criar
            relatórios. Opcional.
          </span>
        </Field>

        <div className="flex items-center gap-3 sm:col-span-12">
          <Switch
            checked={form.ativo}
            onCheckedChange={(v) => set('ativo', v)}
            id="ativo-usuario"
            disabled={editandoEuMesmo}
          />
          <Label htmlFor="ativo-usuario" className="cursor-pointer">
            Usuário ativo
          </Label>
          {editandoEuMesmo && (
            <span className="text-xs text-neutral-500">
              Você não pode se desativar.
            </span>
          )}
        </div>
      </section>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {initial ? 'Salvar alterações' : 'Cadastrar usuário'}
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
