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
  ClipboardList,
  Plus,
  Trash2,
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
  ACAO_CONTINGENCIA_LABEL,
  type AcaoContingencia,
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
  // Arredonda para o minuto ANTES de separar horas e minutos: arredondar
  // só o resto produzia "69h60" quando os minutos batiam em 60.
  const totalMin = Math.round(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h >= 1) return `faltam ${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`
  return `faltam ${Math.max(1, m)} min`
}

/** Uma linha do plano em edição, antes do envio. */
type LinhaAcao = { descricao: string; responsavel: string; prazo: string }

/** Teto de ações por plano — espelha a validação do servidor. */
const MAX_ACOES = 50

const LINHA_VAZIA: LinhaAcao = { descricao: '', responsavel: '', prazo: '' }

/**
 * A tabela sempre mostra ao menos uma linha: a página é pública e de uso
 * único, então o fornecedor começa a digitar sem ter de descobrir o botão
 * "Adicionar ação".
 */
function comLinhaInicial(linhas: LinhaAcao[]): LinhaAcao[] {
  return linhas.length > 0 ? linhas : [LINHA_VAZIA]
}

const inputAcaoClass =
  'flex h-9 w-full rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900 disabled:cursor-not-allowed disabled:opacity-50'

/** Selo de situação de uma ação já enviada. */
function SeloAcao({ status }: { status: AcaoContingencia['status'] }) {
  const cor =
    status === 'APROVADA'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === 'RECUSADA'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-amber-200 bg-amber-50 text-amber-700'
  return (
    <span
      className={cn(
        'inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium',
        cor,
      )}
    >
      {ACAO_CONTINGENCIA_LABEL[status]}
    </span>
  )
}

/** Tabela somente leitura das ações já enviadas, com o parecer. */
function TabelaAcoesEnviadas({ acoes }: { acoes: AcaoContingencia[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50/60 text-neutral-500">
            <th className="w-10 px-2 py-2 text-left text-xs font-medium">#</th>
            <th className="px-2 py-2 text-left text-xs font-medium">Ação</th>
            <th className="w-40 px-2 py-2 text-left text-xs font-medium">
              Responsável
            </th>
            <th className="w-28 px-2 py-2 text-left text-xs font-medium">Prazo</th>
            <th className="w-28 px-2 py-2 text-left text-xs font-medium">
              Situação
            </th>
          </tr>
        </thead>
        <tbody>
          {acoes.map((a) => (
            <tr key={a.id} className="border-b border-neutral-100 last:border-0">
              <td className="px-2 py-2 align-top text-xs text-neutral-500">
                {a.ordem}
              </td>
              <td className="px-2 py-2 align-top text-neutral-900">
                <span className="whitespace-pre-wrap">{a.descricao}</span>
                {a.parecer && (
                  <p
                    className={cn(
                      'mt-1 whitespace-pre-wrap rounded-md border px-2 py-1 text-xs',
                      a.status === 'RECUSADA'
                        ? 'border-red-200 bg-red-50 text-red-800'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-700',
                    )}
                  >
                    <b>Parecer do aprovador:</b> {a.parecer}
                  </p>
                )}
              </td>
              <td className="px-2 py-2 align-top text-neutral-700">
                {a.responsavel || '—'}
              </td>
              <td className="px-2 py-2 align-top text-neutral-700">
                {a.prazo ? fmtData(a.prazo) : '—'}
              </td>
              <td className="px-2 py-2 align-top">
                <SeloAcao status={a.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Prazo já vencido? Fica fora do render para não depender do relógio. */
function prazoVencido(prazo: string | null | undefined): boolean {
  if (!prazo) return false
  const ms = new Date(prazo).getTime()
  return !Number.isNaN(ms) && ms <= Date.now()
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
  // Linhas do plano em edição — uma por ação, adicionadas uma a uma.
  const [acoes, setAcoes] = React.useState<LinhaAcao[]>([])
  const [enviandoAcoes, setEnviandoAcoes] = React.useState(false)

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

  const addAcaoRow = () =>
    setAcoes((atual) =>
      atual.length >= MAX_ACOES ? atual : [...comLinhaInicial(atual), LINHA_VAZIA],
    )
  const updateAcaoRow = (idx: number, patch: Partial<LinhaAcao>) =>
    setAcoes((atual) =>
      comLinhaInicial(atual).map((a, i) => (i === idx ? { ...a, ...patch } : a)),
    )
  const removeAcaoRow = (idx: number) =>
    setAcoes((atual) => comLinhaInicial(atual).filter((_, i) => i !== idx))

  const enviarAcoes = async () => {
    if (enviandoAcoes) return
    const preenchidas = acoes.filter((a) => a.descricao.trim() !== '')
    if (preenchidas.length === 0) {
      toast.error('Informe ao menos uma ação de contingência.')
      return
    }
    setEnviandoAcoes(true)
    try {
      const atualizado = await cienciaApi.registrarContingencia(token, {
        acoes: preenchidas.map((a) => ({
          descricao: a.descricao.trim(),
          responsavel: a.responsavel.trim() || null,
          prazo: a.prazo || null,
        })),
        nome: nome.trim() || null,
      })
      setRnc(atualizado)
      setAcoes([])
      toast.success(
        `${preenchidas.length} ação(ões) enviada(s) para análise.`,
      )
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : 'Não foi possível registrar as ações de contingência.'
      toast.error('Falha ao registrar', { description: msg })
    } finally {
      setEnviandoAcoes(false)
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
  // O plano é devido enquanto nunca foi enviado ou voltou para correção.
  const planoEmAberto =
    rnc.contingenciaStatus === 'PENDENTE' ||
    rnc.contingenciaStatus === 'AJUSTE_SOLICITADO'
  const planoEmAjuste = rnc.contingenciaStatus === 'AJUSTE_SOLICITADO'
  const planoEmAnalise = rnc.contingenciaStatus === 'EM_ANALISE'
  const planoAprovado = rnc.contingenciaStatus === 'APROVADA'
  const contingenciaAtrasada =
    planoEmAberto && prazoVencido(rnc.contingenciaPrazoEm)
  const prazoAcoesTexto = restante(rnc.contingenciaPrazoEm)
  const acoesEnviadas = rnc.acoesContingencia ?? []
  const linhasEmEdicao = comLinhaInicial(acoes)

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
              status === 'RECUSADA' || status === 'MANTIDA_DEFINITIVA'
                ? 'border-red-200 bg-red-50'
                : 'border-emerald-200 bg-emerald-50',
            )}
          >
            {status === 'RECUSADA' || status === 'MANTIDA_DEFINITIVA' ? (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            )}
            <div className="flex flex-col gap-0.5">
              <span
                className={cn(
                  'text-sm font-semibold',
                  status === 'RECUSADA' || status === 'MANTIDA_DEFINITIVA'
                    ? 'text-red-800'
                    : 'text-emerald-800',
                )}
              >
                {CIENCIA_LABEL[status]}
              </span>
              <span className="text-xs text-neutral-600">
                Registrada em {fmtDataHora(rnc.cienciaRespondidaEm)}
                {rnc.cienciaRespondidaPor ? ` · por ${rnc.cienciaRespondidaPor}` : ''}
              </span>
              {status === 'RECUSADA' && (
                <span className="text-xs text-neutral-600">
                  Sua recusa está em análise. Não é possível recusar novamente.
                </span>
              )}
              {status === 'MANTIDA_DEFINITIVA' && (
                <span className="text-xs font-medium text-red-800">
                  A recusa não foi acatada: a não conformidade é mantida em
                  definitivo, não cabendo nova recusa.
                </span>
              )}
              {status === 'RECUSA_ACEITA' && (
                <span className="text-xs text-neutral-600">
                  Sua recusa foi acatada.
                </span>
              )}
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

        {/* Plano de ações de contingência — uma ação por linha */}
        {rnc.contingenciaStatus && (
          <section
            className={cn(
              'rounded-xl border bg-white p-4 shadow-sm',
              contingenciaAtrasada ? 'border-red-300' : 'border-neutral-200',
            )}
          >
            <div className="mb-1 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-neutral-500" />
              <h2 className="text-[13px] font-semibold text-neutral-800">
                Ações de contingência
              </h2>
            </div>

            {/* Situação do plano */}
            {planoEmAnalise && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Plano enviado em {fmtDataHora(rnc.contingenciaRespondidaEm)} e
                  em análise. Cada ação será aprovada ou recusada
                  individualmente — você será avisado do resultado.
                </span>
              </div>
            )}
            {planoAprovado && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Plano <b>aprovado integralmente</b> em{' '}
                  {fmtDataHora(rnc.contingenciaAnalisadaEm)}.
                </span>
              </div>
            )}
            {planoEmAberto && (
              <div
                className={cn(
                  'mb-3 flex items-start gap-2 rounded-lg border p-3 text-xs',
                  contingenciaAtrasada
                    ? 'border-red-200 bg-red-50 text-red-800'
                    : 'border-amber-200 bg-amber-50 text-amber-800',
                )}
              >
                {contingenciaAtrasada ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span>
                  {planoEmAjuste ? (
                    <>
                      O plano foi <b>devolvido para correção</b>: veja abaixo o
                      parecer de cada ação recusada e cadastre as ações
                      corrigidas.{' '}
                    </>
                  ) : null}
                  {contingenciaAtrasada ? (
                    <>
                      O prazo venceu em {fmtDataHora(rnc.contingenciaPrazoEm)}.
                      Os alertas se repetem até o envio.
                    </>
                  ) : (
                    <>
                      Envie até {fmtDataHora(rnc.contingenciaPrazoEm)}
                      {prazoAcoesTexto ? ` (${prazoAcoesTexto})` : ''}. Vencido o
                      prazo, você passa a receber alertas diários.
                    </>
                  )}
                </span>
              </div>
            )}

            {/* Ações já enviadas */}
            {acoesEnviadas.length > 0 && (
              <div className="mb-4 flex flex-col gap-1.5">
                <span className="text-[11px] uppercase tracking-wide text-neutral-400">
                  {planoEmAberto ? 'Ações já enviadas' : 'Plano enviado'}
                </span>
                <TabelaAcoesEnviadas acoes={acoesEnviadas} />
              </div>
            )}

            {/* Editor: uma ação por linha */}
            {planoEmAberto && (
              <>
                <p className="mb-3 text-xs text-neutral-500">
                  Cadastre as ações <b>uma a uma</b>: o que será feito, quem é o
                  responsável e até quando. Cada ação é analisada
                  individualmente pelo aprovador.
                </p>

                <div className="mb-3 flex flex-col gap-1.5 sm:max-w-sm">
                  <Label htmlFor="nome-acoes">Seu nome (opcional)</Label>
                  <Input
                    id="nome-acoes"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Quem está respondendo"
                    maxLength={160}
                    disabled={enviandoAcoes}
                  />
                </div>

                <div className="overflow-x-auto rounded-lg border border-neutral-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-200 bg-neutral-50/60 text-neutral-500">
                          <th className="w-9 px-2 py-2 text-left text-xs font-medium">
                            #
                          </th>
                          <th className="px-2 py-2 text-left text-xs font-medium">
                            Ação a executar *
                          </th>
                          <th className="w-44 px-2 py-2 text-left text-xs font-medium">
                            Responsável
                          </th>
                          <th className="w-36 px-2 py-2 text-left text-xs font-medium">
                            Prazo
                          </th>
                          <th className="w-10 px-2 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {linhasEmEdicao.map((a, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-neutral-100 last:border-0"
                          >
                            <td className="px-2 py-1.5 text-xs text-neutral-500">
                              {acoesEnviadas.length + idx + 1}
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                className={inputAcaoClass}
                                value={a.descricao}
                                onChange={(e) =>
                                  updateAcaoRow(idx, { descricao: e.target.value })
                                }
                                placeholder="Ex.: Inspeção 100% na próxima remessa, com laudo por palete"
                                maxLength={2000}
                                disabled={enviandoAcoes}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                className={inputAcaoClass}
                                value={a.responsavel}
                                onChange={(e) =>
                                  updateAcaoRow(idx, {
                                    responsavel: e.target.value,
                                  })
                                }
                                placeholder="Área ou pessoa"
                                maxLength={160}
                                disabled={enviandoAcoes}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="date"
                                className={inputAcaoClass}
                                value={a.prazo}
                                onChange={(e) =>
                                  updateAcaoRow(idx, { prazo: e.target.value })
                                }
                                disabled={enviandoAcoes}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <button
                                type="button"
                                onClick={() => removeAcaoRow(idx)}
                                disabled={enviandoAcoes}
                                aria-label={`Remover ação ${idx + 1}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addAcaoRow}
                    disabled={enviandoAcoes || linhasEmEdicao.length >= MAX_ACOES}
                    className="gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar ação
                  </Button>
                  <Button
                    onClick={enviarAcoes}
                    disabled={
                      enviandoAcoes ||
                      linhasEmEdicao.every((a) => a.descricao.trim() === '')
                    }
                    className="gap-1.5"
                  >
                    {enviandoAcoes && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {planoEmAjuste
                      ? 'Enviar plano corrigido'
                      : 'Enviar plano de ações'}
                  </Button>
                  {linhasEmEdicao.length >= MAX_ACOES && (
                    <span className="text-xs text-neutral-500">
                      Máximo de {MAX_ACOES} ações por envio.
                    </span>
                  )}
                </div>
              </>
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
