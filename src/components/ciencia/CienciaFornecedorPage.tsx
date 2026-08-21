import * as React from 'react'
import {
  Loader2,
  FileWarning,
  Download,
  Eye,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api/client'
import {
  cienciaApi,
  CIENCIA_LABEL,
  type CienciaRnc,
  type CienciaStatus,
} from '@/lib/api/ciencia'

function fmtData(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR')
}

/** Tempo restante até o prazo, em texto curto. */
function restante(prazo: string | null): string | null {
  if (!prazo) return null
  const ms = new Date(prazo).getTime() - Date.now()
  if (Number.isNaN(ms)) return null
  if (ms <= 0) return 'prazo encerrado'
  const h = Math.floor(ms / 3600_000)
  const m = Math.round((ms % 3600_000) / 60_000)
  if (h >= 1) return `faltam ${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`
  return `faltam ${Math.max(1, m)} min`
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

export function CienciaFornecedorPage({ token }: { token: string }) {
  const [rnc, setRnc] = React.useState<CienciaRnc | null>(null)
  const [carregando, setCarregando] = React.useState(true)
  const [erro, setErro] = React.useState<string | null>(null)
  const [enviando, setEnviando] = React.useState(false)
  const [modo, setModo] = React.useState<'aceitar' | 'recusar' | null>(null)
  const [nome, setNome] = React.useState('')
  const [justificativa, setJustificativa] = React.useState('')
  const [verPdf, setVerPdf] = React.useState(false)

  React.useEffect(() => {
    let cancelado = false
    cienciaApi
      .get(token)
      .then((r) => !cancelado && setRnc(r))
      .catch((e) => {
        if (cancelado) return
        setErro(
          e instanceof ApiError ? e.message : 'Não foi possível abrir o documento.',
        )
      })
      .finally(() => !cancelado && setCarregando(false))
    return () => {
      cancelado = true
    }
  }, [token])

  const responder = async (aceita: boolean) => {
    if (enviando) return
    if (!aceita && !justificativa.trim()) {
      toast.error('Informe o motivo da recusa ou o questionamento.')
      return
    }
    setEnviando(true)
    try {
      const atualizado = await cienciaApi.responder(token, {
        aceita,
        nome: nome.trim() || null,
        justificativa: justificativa.trim() || null,
      })
      setRnc(atualizado)
      setModo(null)
      toast.success(
        aceita ? 'Ciência registrada: aceita.' : 'Ciência registrada: recusada.',
      )
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : 'Não foi possível registrar a resposta.'
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
          <p className="text-sm text-neutral-600">{erro ?? 'Documento não encontrado.'}</p>
        </div>
      </div>
    )
  }

  const status = (rnc.cienciaStatus ?? 'PENDENTE') as CienciaStatus
  const respondido = status !== 'PENDENTE'
  const prazoTexto = restante(rnc.cienciaPrazoEm)

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {/* Cabeçalho */}
        <header className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-900 text-white">
              <FileWarning className="h-4 w-4" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-neutral-900">
              SGNC · Cervejaria Cidade Imperial
            </span>
          </div>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-neutral-900">
            Ciência do fornecedor — RNC {rnc.numero}
          </h1>
          <p className="text-sm text-neutral-500">
            {rnc.fornecedor?.razaoSocial}
            {rnc.fornecedor?.cnpj ? ` · ${rnc.fornecedor.cnpj}` : ''}
          </p>
        </header>

        {/* Situação */}
        {respondido ? (
          <div
            className={cn(
              'flex items-start gap-3 rounded-xl border p-4',
              status === 'RECUSADA'
                ? 'border-red-200 bg-red-50'
                : 'border-emerald-200 bg-emerald-50',
            )}
          >
            {status === 'RECUSADA' ? (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            )}
            <div className="flex flex-col gap-0.5">
              <span
                className={cn(
                  'text-sm font-semibold',
                  status === 'RECUSADA' ? 'text-red-800' : 'text-emerald-800',
                )}
              >
                {CIENCIA_LABEL[status]}
              </span>
              <span className="text-xs text-neutral-600">
                Registrada em {fmtDataHora(rnc.cienciaRespondidaEm)}
                {rnc.cienciaRespondidaPor ? ` · por ${rnc.cienciaRespondidaPor}` : ''}
              </span>
              {rnc.cienciaJustificativa && (
                <p className="mt-1 whitespace-pre-wrap rounded-md border border-neutral-200 bg-white p-2 text-xs text-neutral-700">
                  {rnc.cienciaJustificativa}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <Clock className="h-5 w-5 shrink-0 text-amber-600" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-amber-900">
                Aguardando a sua resposta
              </span>
              <span className="text-xs text-amber-800">
                Prazo até {fmtDataHora(rnc.cienciaPrazoEm)}
                {prazoTexto ? ` (${prazoTexto})` : ''} — sem manifestação, a não
                conformidade será <b>aceita automaticamente</b>.
              </span>
            </div>
          </div>
        )}

        {/* Dados da RNC */}
        <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-[13px] font-semibold text-neutral-800">
            Dados da não conformidade
          </h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Campo rotulo="Unidade" valor={rnc.filial ? `${rnc.filial.codigo} — ${rnc.filial.nome}` : ''} />
            <Campo rotulo="Data da ocorrência" valor={fmtData(rnc.dataIdentificacao)} />
            <Campo
              rotulo="Tipo"
              valor={rnc.tipoNaoConformidade ? `${rnc.tipoNaoConformidade.codigo} — ${rnc.tipoNaoConformidade.descricao}` : ''}
            />
            <Campo
              rotulo="Severidade"
              valor={rnc.severidade ? `Nível ${rnc.severidade.nivel} — ${rnc.severidade.nome}` : ''}
            />
            <Campo
              rotulo="Produto"
              valor={rnc.produto ? `${rnc.produto.codigo} — ${rnc.produto.descricao}` : ''}
            />
            <Campo
              rotulo="Qtd. com defeito"
              valor={
                rnc.quantidadeDefeito != null
                  ? `${rnc.quantidadeDefeito}${rnc.produto ? ` ${rnc.produto.unidadeMedida}` : ''}`
                  : ''
              }
            />
            <Campo rotulo="Origem" valor={rnc.origem?.nome ?? ''} />
            <Campo rotulo="Disposição" valor={rnc.disposicaoMaterial?.descricao ?? ''} />
            <Campo
              rotulo="Lotes"
              valor={rnc.lotes.map((l) => l.numero).join(', ')}
            />
          </div>
          {rnc.descricaoDefeito && (
            <div className="mt-3 flex flex-col gap-0.5">
              <span className="text-[11px] uppercase tracking-wide text-neutral-400">
                Defeito identificado
              </span>
              <p className="whitespace-pre-wrap text-sm text-neutral-900">
                {rnc.descricaoDefeito}
              </p>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setVerPdf(true)} className="gap-1.5">
              <Eye className="h-4 w-4" />
              Visualizar documento
            </Button>
            <a
              href={cienciaApi.pdfUrl(token)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50"
            >
              <Download className="h-4 w-4" />
              Baixar PDF
            </a>
          </div>
        </section>

        {/* Ações do fornecedor */}
        {!respondido && (
          <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="mb-1 text-[13px] font-semibold text-neutral-800">
              Registrar a sua resposta
            </h2>
            <p className="mb-3 text-xs text-neutral-500">
              Reconheça e aceite a não conformidade, ou recuse informando o
              motivo/questionamento.
            </p>

            <div className="mb-3 flex flex-col gap-1.5">
              <Label htmlFor="nome-resp">Seu nome (opcional)</Label>
              <Input
                id="nome-resp"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Quem está respondendo"
                maxLength={160}
                disabled={enviando}
              />
            </div>

            {modo === null && (
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => setModo('aceitar')}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Reconhecer e aceitar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setModo('recusar')}
                  className="gap-1.5 border-red-200 text-red-700 hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4" />
                  Recusar / questionar
                </Button>
              </div>
            )}

            {modo === 'aceitar' && (
              <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-sm text-emerald-900">
                  Ao confirmar, você <b>reconhece e aceita</b> a não conformidade
                  descrita neste relatório.
                </p>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="obs-aceite">Observações (opcional)</Label>
                  <textarea
                    id="obs-aceite"
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    rows={3}
                    maxLength={4000}
                    disabled={enviando}
                    className="flex w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => responder(true)}
                    disabled={enviando}
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                  >
                    {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
                    Confirmar aceite
                  </Button>
                  <Button variant="ghost" onClick={() => setModo(null)} disabled={enviando}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {modo === 'recusar' && (
              <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-900">
                  Descreva o motivo da recusa ou o questionamento. A equipe de
                  qualidade será notificada.
                </p>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="just-recusa">Motivo / questionamento *</Label>
                  <textarea
                    id="just-recusa"
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    rows={4}
                    maxLength={4000}
                    required
                    disabled={enviando}
                    placeholder="Explique por que a não conformidade está sendo recusada ou o que precisa ser esclarecido."
                    className="flex w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => responder(false)}
                    disabled={enviando || !justificativa.trim()}
                    className="gap-1.5"
                  >
                    {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
                    Confirmar recusa
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
          SGNC — Sistema de Gestão de Não Conformidade
        </footer>
      </div>

      {/* Visualizador de PDF */}
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
                  href={cienciaApi.pdfUrl(token)}
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
              src={cienciaApi.pdfUrl(token, true)}
              title={`RNC ${rnc.numero}`}
              className="h-full w-full flex-1 border-0"
            />
          </div>
        </div>
      )}
    </div>
  )
}
