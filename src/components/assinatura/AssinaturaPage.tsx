import * as React from 'react'
import {
  Loader2,
  FileWarning,
  Check,
  Download,
  Eye,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api/client'
import { assinaturaApi, type AssinaturaResumo } from '@/lib/api/assinatura'
import {
  coletarMetadadosCliente,
  obterGeolocalizacao,
} from '@/lib/utils/clientMetadata'

function fmtData(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function AssinaturaPage({ token }: { token: string }) {
  const [data, setData] = React.useState<AssinaturaResumo | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [assinando, setAssinando] = React.useState(false)
  const [assinadoEm, setAssinadoEm] = React.useState<string | null>(null)
  const [senha, setSenha] = React.useState('')
  const [erroAssinatura, setErroAssinatura] = React.useState<string | null>(null)
  const [verPdf, setVerPdf] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    assinaturaApi
      .get(token)
      .then((res) => {
        if (cancelled) return
        setData(res)
        setAssinadoEm(res.aprovador.assinadoEm)
      })
      .catch((err) => {
        if (cancelled) return
        setError(
          err instanceof ApiError
            ? err.message
            : 'Não foi possível carregar a RNC.',
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const handleAssinar = async () => {
    if (!/^\d{6}$/.test(senha.trim())) {
      setErroAssinatura('Informe a senha de 6 dígitos enviada por e-mail.')
      return
    }
    setAssinando(true)
    setErroAssinatura(null)
    try {
      // Coleta metadados técnicos e, se autorizado, a geolocalização.
      const [geolocalizacao] = await Promise.all([obterGeolocalizacao()])
      const metadados = coletarMetadadosCliente()
      const res = await assinaturaApi.assinar(token, {
        senha: senha.trim(),
        geolocalizacao,
        metadados,
      })
      setAssinadoEm(res.assinadoEm)
    } catch (err) {
      setErroAssinatura(
        err instanceof ApiError ? err.message : 'Falha ao registrar a assinatura.',
      )
    } finally {
      setAssinando(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-neutral-50">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-neutral-50 p-4">
        <div className="flex max-w-md flex-col items-center gap-3 rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <h1 className="text-lg font-semibold text-neutral-900">
            Link indisponível
          </h1>
          <p className="text-sm text-neutral-600">
            {error ?? 'Link de assinatura inválido ou expirado.'}
          </p>
        </div>
      </div>
    )
  }

  const { aprovador, rnc } = data

  return (
    <div className="min-h-screen w-full bg-neutral-50 py-8 px-4">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-neutral-900 text-white">
            <FileWarning className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-neutral-900">SGNC</span>
            <span className="text-xs text-neutral-500">
              Solicitação de assinatura
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
            RNC {rnc.numero}
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Olá, <b>{aprovador.nome}</b>. Você é o aprovador da área{' '}
            <b>{aprovador.areaNome}</b>
            {aprovador.cargo ? ` (${aprovador.cargo})` : ''} para esta RNC.
          </p>

          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            <Info label="Unidade" value={rnc.filial?.nome} />
            <Info label="Fornecedor" value={rnc.fornecedor?.razaoSocial} />
            <Info
              label="Tipo de NC"
              value={
                rnc.tipoNaoConformidade
                  ? `${rnc.tipoNaoConformidade.codigo} — ${rnc.tipoNaoConformidade.descricao}`
                  : undefined
              }
            />
            <Info
              label="Severidade"
              value={
                rnc.severidade
                  ? `Nível ${rnc.severidade.nivel} — ${rnc.severidade.nome}`
                  : undefined
              }
            />
            <Info
              label="Data da ocorrência"
              value={fmtData(rnc.dataIdentificacao)}
            />
          </dl>

          {rnc.descricaoDefeito && (
            <div className="mt-3">
              <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Defeito identificado
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-neutral-800">
                {rnc.descricaoDefeito}
              </p>
            </div>
          )}

          <div className="mt-5 border-t border-neutral-100 pt-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setVerPdf(true)}
                className="group flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-neutral-900 hover:shadow-md"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white transition-colors group-hover:bg-neutral-700">
                  <Eye className="h-5 w-5" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold text-neutral-900">
                    Visualizar PDF
                  </span>
                  <span className="text-xs text-neutral-500">
                    Abrir aqui na plataforma
                  </span>
                </span>
              </button>

              <a
                href={assinaturaApi.pdfUrl(token)}
                className="group flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-neutral-900 hover:shadow-md"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700 transition-colors group-hover:bg-neutral-900 group-hover:text-white">
                  <Download className="h-5 w-5" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold text-neutral-900">
                    Baixar PDF
                  </span>
                  <span className="text-xs text-neutral-500">
                    Salvar no dispositivo
                  </span>
                </span>
              </a>
            </div>

            {assinadoEm ? (
              <div className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 text-sm font-medium text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                Assinado em {fmtDataHora(assinadoEm)}
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                <Label htmlFor="senha-assinatura">Senha de assinatura *</Label>
                <p className="text-xs text-neutral-500">
                  Digite a senha de 6 dígitos enviada no e-mail desta
                  solicitação.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <Input
                    id="senha-assinatura"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={senha}
                    onChange={(e) => {
                      setSenha(e.target.value.replace(/\D/g, '').slice(0, 6))
                      setErroAssinatura(null)
                    }}
                    placeholder="••••••"
                    className="w-40 text-center text-lg tracking-[0.4em]"
                  />
                  <Button
                    onClick={handleAssinar}
                    disabled={assinando || senha.length !== 6}
                  >
                    {assinando ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Assinar esta RNC
                  </Button>
                </div>
                {erroAssinatura && (
                  <span className="text-xs text-red-600">{erroAssinatura}</span>
                )}
                <p className="text-[11px] text-neutral-400">
                  Ao assinar, registramos data/hora, IP, navegador,
                  dispositivo e — se você autorizar — a localização, como
                  evidência da assinatura.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Andamento das assinaturas
          </div>
          <ul className="mt-2 flex flex-col gap-1.5">
            {rnc.aprovadores.map((a, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                {a.assinadoEm ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-neutral-300" />
                )}
                <span className="text-neutral-500">{a.areaNome}:</span>
                <span className="text-neutral-900">{a.nome}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {verPdf && (
        <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950/70 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-2 border-b border-neutral-200 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <FileWarning className="h-4 w-4 text-neutral-500" />
                <span className="text-sm font-semibold text-neutral-900">
                  RNC {rnc.numero}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <a
                  href={assinaturaApi.pdfUrl(token)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-neutral-200 px-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
                >
                  <Download className="h-4 w-4" />
                  Baixar
                </a>
                <button
                  type="button"
                  onClick={() => setVerPdf(false)}
                  aria-label="Fechar"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <iframe
              title={`RNC ${rnc.numero}`}
              src={assinaturaApi.pdfUrl(token, true)}
              className="h-full w-full flex-1 bg-neutral-100"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </dt>
      <dd className="text-sm text-neutral-900">{value || '—'}</dd>
    </div>
  )
}
