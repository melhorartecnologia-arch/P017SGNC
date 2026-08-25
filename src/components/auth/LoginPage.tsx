import * as React from 'react'
import { Circle, Loader2, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth/AuthContext'
import { ApiError } from '@/lib/api/client'

export function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = React.useState('')
  const [senha, setSenha] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login(email.trim(), senha)
      toast.success('Bem-vindo!')
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Não foi possível entrar.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleForgot = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    toast.info('Recuperação de senha', {
      description: 'Solicite ao administrador para redefinir sua senha.',
    })
  }

  return (
    <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-2">
      {/* Coluna esquerda — formulário */}
      <div className="relative flex flex-col bg-white">
        <header className="flex items-center gap-2 px-6 pt-6 sm:px-10 sm:pt-8">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-900 text-white">
            <Circle className="h-4 w-4" strokeWidth={2} />
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-neutral-900">
            SGNC
          </span>
        </header>

        <div className="flex flex-1 items-center justify-center px-6 sm:px-10">
          <form
            onSubmit={handleSubmit}
            className="flex w-full max-w-sm flex-col gap-6"
            noValidate
          >
            <div className="flex flex-col gap-1.5 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
                Entrar na sua conta
              </h1>
              <p className="text-sm text-neutral-500">
                Informe seu e-mail e senha para acessar o sistema
              </p>
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="voce@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="senha">Senha</Label>
                <a
                  href="#"
                  onClick={handleForgot}
                  className="text-xs font-medium text-neutral-600 underline-offset-4 hover:text-neutral-900 hover:underline"
                >
                  Esqueceu sua senha?
                </a>
              </div>
              <Input
                id="senha"
                type="password"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Entrar
            </Button>

            <p className="text-center text-xs text-neutral-500">
              Acesso restrito aos colaboradores autorizados.
            </p>
          </form>
        </div>

        <footer className="flex flex-col gap-0.5 px-6 pb-6 text-center text-xs text-neutral-400 sm:px-10">
          <span>© {new Date().getFullYear()} Cervejaria Cidade Imperial · SGNC</span>
          <span
            className="font-mono text-[11px] text-neutral-300"
            title={
              __APP_VERSAO_DATA__
                ? `Última atualização: ${__APP_VERSAO_DATA__}`
                : undefined
            }
          >
            Versão {__APP_VERSAO__}
            {__APP_VERSAO_DATA__ ? ` · ${__APP_VERSAO_DATA__}` : ''}
          </span>
        </footer>
      </div>

      {/* Coluna direita — painel ilustrativo */}
      <div className="relative hidden items-center justify-center bg-neutral-100 lg:flex">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.06) 0, transparent 60%)',
          }}
        />
        <div className="relative flex h-40 w-40 items-center justify-center rounded-full border border-neutral-200/80 bg-white/30 backdrop-blur-sm">
          <ImageIcon className="h-10 w-10 text-neutral-400" strokeWidth={1.5} />
          <span className="absolute -inset-12 rounded-full border border-dashed border-neutral-200/70" />
          <span className="absolute -inset-24 rounded-full border border-dashed border-neutral-200/50" />
        </div>
      </div>
    </div>
  )
}
