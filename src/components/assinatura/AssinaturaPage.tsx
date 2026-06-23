import * as React from 'react'
import {
  Loader2,
  FileWarning,
  Check,
  Download,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api/client'
import { assinaturaApi, type AssinaturaResumo } from '@/lib/api/assinatura'

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
    setAssinando(true)
    try {
      const res = await assinaturaApi.assinar(token)
      setAssinadoEm(res.assinadoEm)
    } catch (err) {
      setError(
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

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <a
              href={assinaturaApi.pdfUrl(token)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:bg-neutral-50"
            >
              <Download className="h-4 w-4" />
              Baixar a RNC em PDF
            </a>

            {assinadoEm ? (
              <div className="inline-flex h-9 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 text-sm font-medium text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                Assinado em {fmtDataHora(assinadoEm)}
              </div>
            ) : (
              <Button onClick={handleAssinar} disabled={assinando}>
                {assinando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Assinar esta RNC
              </Button>
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
