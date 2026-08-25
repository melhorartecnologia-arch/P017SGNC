import * as React from 'react'
import { Loader2, Mail, Save, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api/client'
import {
  configuracoesApi,
  type SmtpSeguranca,
} from '@/lib/api/configuracoes'
import { useAuth } from '@/lib/auth/AuthContext'

const selectClass =
  'flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900 disabled:cursor-not-allowed disabled:opacity-50'

type FormState = {
  host: string
  porta: string
  seguranca: SmtpSeguranca
  usuario: string
  senha: string
  remetenteNome: string
  remetenteEmail: string
  ativo: boolean
}

const empty: FormState = {
  host: '',
  porta: '587',
  seguranca: 'TLS',
  usuario: '',
  senha: '',
  remetenteNome: '',
  remetenteEmail: '',
  ativo: true,
}

export function SmtpConfigPage() {
  const auth = useAuth()
  const [form, setForm] = React.useState<FormState>(empty)
  const [senhaDefinida, setSenhaDefinida] = React.useState(false)
  const [configurado, setConfigurado] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({})
  // E-mail de teste — pré-preenchido com o e-mail do admin logado.
  const [testePara, setTestePara] = React.useState(() =>
    auth.status === 'authenticated' ? auth.user.email : '',
  )
  const [testando, setTestando] = React.useState(false)

  const handleEnviarTeste = async () => {
    if (!testePara.trim() || testando) return
    setTestando(true)
    try {
      const { para } = await configuracoesApi.testarSmtp(testePara.trim())
      toast.success('E-mail de teste enviado', {
        description: `Verifique a caixa de entrada de ${para}.`,
      })
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Falha ao enviar o teste.'
      toast.error('Teste falhou', { description: message })
    } finally {
      setTestando(false)
    }
  }

  React.useEffect(() => {
    let cancelled = false
    configuracoesApi
      .getSmtp()
      .then((cfg) => {
        if (cancelled || !cfg) return
        setForm({
          host: cfg.host,
          porta: String(cfg.porta),
          seguranca: cfg.seguranca,
          usuario: cfg.usuario ?? '',
          senha: '',
          remetenteNome: cfg.remetenteNome,
          remetenteEmail: cfg.remetenteEmail,
          ativo: cfg.ativo,
        })
        setSenhaDefinida(cfg.senhaDefinida)
        setConfigurado(true)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError) setError(err.message)
        else setError('Não foi possível carregar a configuração. A API está rodando?')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
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
      const salvo = await configuracoesApi.saveSmtp({
        host: form.host,
        porta: Number(form.porta),
        seguranca: form.seguranca,
        usuario: form.usuario || null,
        senha: form.senha || null,
        remetenteNome: form.remetenteNome,
        remetenteEmail: form.remetenteEmail,
        ativo: form.ativo,
      })
      setSenhaDefinida(salvo.senhaDefinida)
      setConfigurado(true)
      set('senha', '')
      toast.success('Configuração SMTP salva', {
        description: `${salvo.host}:${salvo.porta}`,
      })
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

  const fieldError = (key: string) => fieldErrors[key]?.[0]

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-neutral-500" />
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
            Servidor de E-mail (SMTP)
          </h1>
        </div>
        <p className="text-sm text-neutral-500">
          Conta de e-mail usada pelo serviço de workflow (notificações e
          aprovações). Apenas administradores podem alterar.
        </p>
      </header>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="max-w-3xl rounded-xl border-neutral-200 bg-white p-4 shadow-sm md:p-6">
        {loading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-12">
              <Field
                label="Servidor (host) *"
                error={fieldError('host')}
                className="sm:col-span-6"
              >
                <Input
                  value={form.host}
                  onChange={(e) => set('host', e.target.value)}
                  placeholder="smtp.empresa.com.br"
                  maxLength={160}
                  required
                />
              </Field>
              <Field
                label="Porta *"
                error={fieldError('porta')}
                className="sm:col-span-3"
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={65535}
                  value={form.porta}
                  onChange={(e) => set('porta', e.target.value)}
                  required
                />
              </Field>
              <Field
                label="Segurança *"
                error={fieldError('seguranca')}
                className="sm:col-span-3"
              >
                <select
                  className={cn(selectClass)}
                  value={form.seguranca}
                  onChange={(e) =>
                    set('seguranca', e.target.value as SmtpSeguranca)
                  }
                >
                  <option value="TLS">STARTTLS (587)</option>
                  <option value="SSL">SSL (465)</option>
                  <option value="NONE">Sem criptografia</option>
                </select>
              </Field>

              <Field
                label="Usuário"
                error={fieldError('usuario')}
                className="sm:col-span-6"
              >
                <Input
                  value={form.usuario}
                  onChange={(e) => set('usuario', e.target.value)}
                  placeholder="workflow@empresa.com.br"
                  autoComplete="off"
                  maxLength={160}
                />
              </Field>
              <Field
                label={senhaDefinida ? 'Senha (definida)' : 'Senha'}
                error={fieldError('senha')}
                className="sm:col-span-6"
              >
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={form.senha}
                  onChange={(e) => set('senha', e.target.value)}
                  placeholder={
                    senhaDefinida
                      ? 'Deixe em branco para manter a atual'
                      : 'Senha da conta SMTP'
                  }
                  maxLength={255}
                />
                <span className="text-xs text-neutral-500">
                  {senhaDefinida
                    ? 'Há uma senha salva. Preencha apenas para substituí-la.'
                    : 'A senha fica armazenada apenas no servidor.'}
                </span>
              </Field>

              <Field
                label="Nome do remetente *"
                error={fieldError('remetenteNome')}
                className="sm:col-span-6"
              >
                <Input
                  value={form.remetenteNome}
                  onChange={(e) => set('remetenteNome', e.target.value)}
                  placeholder="SGNC — Cervejaria Cidade Imperial"
                  maxLength={120}
                  required
                />
              </Field>
              <Field
                label="E-mail do remetente *"
                error={fieldError('remetenteEmail')}
                className="sm:col-span-6"
              >
                <Input
                  type="email"
                  value={form.remetenteEmail}
                  onChange={(e) => set('remetenteEmail', e.target.value)}
                  placeholder="nao-responda@empresa.com.br"
                  maxLength={160}
                  required
                />
              </Field>

              <div className="flex items-center gap-3 sm:col-span-12">
                <Switch
                  checked={form.ativo}
                  onCheckedChange={(v) => set('ativo', v)}
                  id="smtp-ativo"
                />
                <Label htmlFor="smtp-ativo" className="cursor-pointer">
                  Envio de e-mails ativo
                </Label>
                <span className="text-xs text-neutral-500">
                  Desative para suspender os e-mails do workflow sem perder a
                  configuração.
                </span>
              </div>
            </section>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar configuração
              </Button>
            </div>

            <div className="flex flex-col gap-2 border-t border-neutral-200 pt-4">
              <Label>Validar a conta</Label>
              <span className="text-xs text-neutral-500">
                Envia um e-mail de teste usando a configuração <b>salva</b>{' '}
                — salve as alterações antes de testar.
              </span>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="email"
                  value={testePara}
                  onChange={(e) => setTestePara(e.target.value)}
                  placeholder="destinatario@empresa.com.br"
                  maxLength={160}
                  className="sm:max-w-sm"
                  disabled={testando}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleEnviarTeste}
                  disabled={testando || !configurado || !testePara.trim()}
                  title={
                    !configurado
                      ? 'Salve a configuração antes de testar.'
                      : undefined
                  }
                >
                  {testando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Enviar e-mail de teste
                </Button>
              </div>
            </div>
          </form>
        )}
      </Card>
    </div>
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
