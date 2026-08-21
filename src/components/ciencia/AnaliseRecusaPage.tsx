import * as React from 'react'
import {
  Loader2,
  FileWarning,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Gavel,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api/client'
import { analiseApi, type AnaliseRecusa } from '@/lib/api/ciencia'

function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR')
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-neutral-400">
        {rotulo}
      </span>
      <span className="text-sm text-neutral-900">{valor || '—'}</span>
    </div>
  )
}

/**
 * Página pública (link por token) onde o aprovador marcado analisa a recusa
 * do fornecedor: acatar a recusa ou negá-la, tornando a RNC definitiva.
 */
export function AnaliseRecusaPage({ token }: { token: string }) {
  const [rnc, setRnc] = React.useState<AnaliseRecusa | null>(null)
  const [carregando, setCarregando] = React.useState(true)
  const [erro, setErro] = React.useState<string | null>(null)
  const [enviando, setEnviando] = React.useState(false)
  const [modo, setModo] = React.useState<'acatar' | 'negar' | null>(null)
  const [nome, setNome] = React.useState('')
  const [parecer, setParecer] = React.useState('')

  React.useEffect(() => {
    let cancelado = false
    analiseApi
      .get(token)
      .then((r) => !cancelado && setRnc(r))
      .catch((e) => {
        if (cancelado) return
        setErro(e instanceof ApiError ? e.message : 'Não foi possível abrir a análise.')
      })
      .finally(() => !cancelado && setCarregando(false))
    return () => {
      cancelado = true
    }
  }, [token])

  const decidir = async (acatarRecusa: boolean) => {
    if (enviando) return
    if (!acatarRecusa && !parecer.trim()) {
      toast.error('Informe o parecer que fundamenta a negativa da recusa.')
      return
    }
    setEnviando(true)
    try {
      const atualizado = await analiseApi.decidir(token, {
        acatarRecusa,
        nome: nome.trim() || null,
        justificativa: parecer.trim() || null,
      })
      setRnc(atualizado)
      setModo(null)
      toast.success(
        acatarRecusa
          ? 'Recusa acatada.'
          : 'Recusa negada — a RNC foi enviada em definitivo ao fornecedor.',
      )
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Não foi possível registrar.'
      toast.error('Falha ao registrar', { description: msg })
    } finally {
      setEnviando(false)
    }
  }

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    )
  }

  if (erro || !rnc) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
        <div className="max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-500" />
          <h1 className="mb-1 text-lg font-semibold text-neutral-900">
            Link indisponível
          </h1>
          <p className="text-sm text-neutral-600">{erro ?? 'Análise não encontrada.'}</p>
        </div>
      </div>
    )
  }

  const decidida = rnc.cienciaStatus !== 'RECUSADA'
  const acatada = rnc.cienciaStatus === 'RECUSA_ACEITA'

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <header className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-900 text-white">
              <Gavel className="h-4 w-4" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-neutral-900">
              SGNC · Cervejaria Cidade Imperial
            </span>
          </div>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-neutral-900">
            Análise da recusa — RNC {rnc.numero}
          </h1>
          <p className="text-sm text-neutral-500">
            {rnc.fornecedor?.razaoSocial}
            {rnc.fornecedor?.cnpj ? ` · ${rnc.fornecedor.cnpj}` : ''}
          </p>
        </header>

        {decidida ? (
          <div
            className={cn(
              'flex items-start gap-3 rounded-xl border p-4',
              acatada
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-red-200 bg-red-50',
            )}
          >
            {acatada ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            ) : (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            )}
            <div className="flex flex-col gap-0.5">
              <span
                className={cn(
                  'text-sm font-semibold',
                  acatada ? 'text-emerald-800' : 'text-red-800',
                )}
              >
                {acatada
                  ? 'Recusa acatada'
                  : 'Recusa negada — RNC mantida em definitivo'}
              </span>
              <span className="text-xs text-neutral-600">
                Analisada em {fmtDataHora(rnc.cienciaAnaliseEm)}
                {rnc.cienciaAnalisePor ? ` · por ${rnc.cienciaAnalisePor}` : ''}
              </span>
              {rnc.cienciaAnaliseJustificativa && (
                <p className="mt-1 whitespace-pre-wrap rounded-md border border-neutral-200 bg-white p-2 text-xs text-neutral-700">
                  {rnc.cienciaAnaliseJustificativa}
                </p>
              )}
              {!acatada && (
                <span className="mt-1 text-xs text-neutral-600">
                  O fornecedor foi comunicado e não cabe nova recusa.
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-amber-900">
                Recusa do fornecedor aguardando a sua análise
              </span>
              <span className="text-xs text-amber-800">
                O fornecedor pode recusar apenas uma vez. Ao negar a recusa, a
                RNC é enviada em definitivo, sem possibilidade de nova recusa.
              </span>
            </div>
          </div>
        )}

        {/* Recusa apresentada */}
        <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-[13px] font-semibold text-neutral-800">
            Recusa apresentada pelo fornecedor
          </h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Campo rotulo="Recusada em" valor={fmtDataHora(rnc.cienciaRespondidaEm)} />
            <Campo rotulo="Respondido por" valor={rnc.cienciaRespondidaPor ?? ''} />
            <Campo
              rotulo="Unidade"
              valor={rnc.filial ? `${rnc.filial.codigo} — ${rnc.filial.nome}` : ''}
            />
            <Campo
              rotulo="Tipo"
              valor={
                rnc.tipoNaoConformidade
                  ? `${rnc.tipoNaoConformidade.codigo} — ${rnc.tipoNaoConformidade.descricao}`
                  : ''
              }
            />
            <Campo
              rotulo="Severidade"
              valor={rnc.severidade ? `Nível ${rnc.severidade.nivel} — ${rnc.severidade.nome}` : ''}
            />
          </div>
          {rnc.cienciaJustificativa && (
            <div className="mt-3 flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-neutral-400">
                Justificativa do fornecedor
              </span>
              <p className="whitespace-pre-wrap rounded-md border border-red-200 bg-red-50 p-2.5 text-sm text-neutral-800">
                {rnc.cienciaJustificativa}
              </p>
            </div>
          )}
          {rnc.descricaoDefeito && (
            <div className="mt-3 flex flex-col gap-0.5">
              <span className="text-[11px] uppercase tracking-wide text-neutral-400">
                Defeito registrado na RNC
              </span>
              <p className="whitespace-pre-wrap text-sm text-neutral-900">
                {rnc.descricaoDefeito}
              </p>
            </div>
          )}
          <div className="mt-4">
            <a
              href={analiseApi.pdfUrl(token)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50"
            >
              <Download className="h-4 w-4" />
              Baixar a RNC em PDF
            </a>
          </div>
        </section>

        {/* Decisão */}
        {!decidida && (
          <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="mb-1 text-[13px] font-semibold text-neutral-800">
              Sua decisão
            </h2>
            <p className="mb-3 text-xs text-neutral-500">
              Acate a recusa do fornecedor ou negue-a — nesse caso a RNC é
              enviada em definitivo e o fornecedor não poderá recusar novamente.
            </p>

            <div className="mb-3 flex flex-col gap-1.5">
              <Label htmlFor="nome-analise">Seu nome (opcional)</Label>
              <Input
                id="nome-analise"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Quem está analisando"
                maxLength={160}
                disabled={enviando}
              />
            </div>

            {modo === null && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => setModo('acatar')}
                  className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Acatar a recusa
                </Button>
                <Button
                  onClick={() => setModo('negar')}
                  className="gap-1.5 bg-red-600 hover:bg-red-700"
                >
                  <XCircle className="h-4 w-4" />
                  Negar a recusa (RNC definitiva)
                </Button>
              </div>
            )}

            {modo === 'acatar' && (
              <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-sm text-emerald-900">
                  Ao confirmar, a justificativa do fornecedor é <b>acatada</b> e a
                  ciência é encerrada a favor dele.
                </p>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="parecer-acatar">Parecer (opcional)</Label>
                  <textarea
                    id="parecer-acatar"
                    value={parecer}
                    onChange={(e) => setParecer(e.target.value)}
                    rows={3}
                    maxLength={4000}
                    disabled={enviando}
                    className="flex w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => decidir(true)}
                    disabled={enviando}
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                  >
                    {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
                    Confirmar: acatar a recusa
                  </Button>
                  <Button variant="ghost" onClick={() => setModo(null)} disabled={enviando}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {modo === 'negar' && (
              <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-900">
                  Ao confirmar, a recusa é <b>negada</b>: a RNC é mantida e enviada
                  em <b>definitivo</b> ao fornecedor, sem possibilidade de nova
                  recusa.
                </p>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="parecer-negar">Parecer *</Label>
                  <textarea
                    id="parecer-negar"
                    value={parecer}
                    onChange={(e) => setParecer(e.target.value)}
                    rows={4}
                    maxLength={4000}
                    required
                    disabled={enviando}
                    placeholder="Fundamente por que a recusa do fornecedor não é acatada."
                    className="flex w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => decidir(false)}
                    disabled={enviando || !parecer.trim()}
                    className="gap-1.5"
                  >
                    {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
                    Confirmar: negar e tornar definitiva
                  </Button>
                  <Button variant="ghost" onClick={() => setModo(null)} disabled={enviando}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}

        <footer className="pb-4 text-center text-xs text-neutral-400">
          <FileWarning className="mr-1 inline h-3 w-3" />
          SGNC — Sistema de Gestão de Não Conformidade
        </footer>
      </div>
    </div>
  )
}
