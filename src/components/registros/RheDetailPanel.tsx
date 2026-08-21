import * as React from 'react'
import {
  X,
  Pencil,
  Loader2,
  Send,
  BellRing,
  ArrowUpCircle,
  Download,
  CheckCircle2,
  MailCheck,
  MailWarning,
  ClipboardCheck,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api/client'
import { rncApi, resumoAssinaturas, type RncStatus } from '@/lib/api/rnc'
import {
  rheApi,
  pendenciasParaAssinaturaRhe,
  HOMOLOGACAO_LABELS,
  type HomologacaoResultado,
  type Rhe,
} from '@/lib/api/rhe'
import { RncFotosSection } from './RncFotosSection'

/**
 * Painel de detalhes do RHE. As ações de workflow usam os endpoints
 * compartilhados de /api/rnc (servem todos os tipos); após cada ação o
 * painel recarrega o RHE para manter os campos próprios. A homologação
 * final tem registro próprio — permitido mesmo com o RHE encerrado.
 */

const STATUS_LABELS: Record<RncStatus, string> = {
  DRAFT: 'Rascunho',
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em andamento',
  CLOSED: 'Encerrado',
  CANCELLED: 'Cancelado',
}

const STATUS_DOT: Record<RncStatus, string> = {
  DRAFT: 'bg-neutral-400',
  OPEN: 'bg-amber-500',
  IN_PROGRESS: 'bg-sky-500',
  CLOSED: 'bg-emerald-500',
  CANCELLED: 'bg-red-500',
}

const HOMOLOGACAO_CLASS: Record<HomologacaoResultado, string> = {
  APROVADO: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  REPROVADO: 'border-red-200 bg-red-50 text-red-700',
  APROVADO_COM_RESTRICAO: 'border-amber-200 bg-amber-50 text-amber-800',
}

const selectClass =
  'flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900'

function fmtData(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** Datas "puras" (sem hora) chegam como meia-noite UTC — exibe o dia UTC. */
function fmtDataPura(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
}

function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function todayISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="border-b border-neutral-100 py-4">
      <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
        {title}
      </h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[190px_1fr] gap-2 text-[13.5px]">
      <span className="text-neutral-500">{label}</span>
      <span className="min-w-0 text-neutral-900">{children}</span>
    </div>
  )
}

function HomologacaoBadge({ valor }: { valor: HomologacaoResultado }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium',
        HOMOLOGACAO_CLASS[valor],
      )}
    >
      {HOMOLOGACAO_LABELS[valor]}
    </span>
  )
}

type Props = {
  rhe: Rhe | null
  onClose: () => void
  onEdit?: (rhe: Rhe) => void
  onUpdated?: (rhe: Rhe) => void
}

export function RheDetailPanel({ rhe, onClose, onEdit, onUpdated }: Props) {
  const open = !!rhe
  const [enviando, setEnviando] = React.useState(false)
  const [lembrando, setLembrando] = React.useState(false)
  const [escalonando, setEscalonando] = React.useState(false)
  const [baixando, setBaixando] = React.useState(false)
  const [reenviando, setReenviando] = React.useState(false)
  const [finalOpen, setFinalOpen] = React.useState(false)
  const [finalResultado, setFinalResultado] = React.useState<'' | HomologacaoResultado>('')
  const [finalData, setFinalData] = React.useState(todayISO())
  const [registrandoFinal, setRegistrandoFinal] = React.useState(false)
  const pendencias = rhe ? pendenciasParaAssinaturaRhe(rhe) : []
  const jaEnviado = !!rhe && rhe.status !== 'DRAFT'
  const temPendentes = !!rhe && rhe.aprovadores.some((a) => !a.assinadoEm)

  /** Recarrega o RHE após uma ação de workflow (que devolve o tipo Rnc). */
  const recarregar = async () => {
    if (!rhe) return
    try {
      onUpdated?.(await rheApi.get(rhe.id))
    } catch {
      // silencioso: a ação principal já foi confirmada
    }
  }

  const handleEnviarAssinatura = async () => {
    if (!rhe) return
    setEnviando(true)
    try {
      const { enviados, falhas } = await rncApi.enviarParaAssinatura(rhe.id)
      await recarregar()
      if (falhas.length === 0) {
        toast.success('RHE enviado para assinatura', {
          description: `${enviados.length} e-mail(s) enviado(s) — aprovadores internos e representantes do fornecedor.`,
        })
      } else {
        toast.warning('Enviado com pendências', {
          description: `${enviados.length} enviado(s), ${falhas.length} falha(s).`,
        })
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Falha ao enviar para assinatura.'
      toast.error('Não foi possível enviar', { description: message })
    } finally {
      setEnviando(false)
    }
  }

  const handleLembrete = async () => {
    if (!rhe) return
    setLembrando(true)
    try {
      const { enviados } = await rncApi.enviarLembrete(rhe.id)
      await recarregar()
      toast.success('Lembrete enviado', {
        description: `${enviados} signatário(s) pendente(s) notificado(s).`,
      })
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Falha ao enviar lembrete.'
      toast.error('Não foi possível enviar o lembrete', { description: message })
    } finally {
      setLembrando(false)
    }
  }

  const handleEscalonar = async () => {
    if (!rhe) return
    setEscalonando(true)
    try {
      const { novos } = await rncApi.escalonar(rhe.id)
      await recarregar()
      toast.success('Escalonado para o nível acima', {
        description: `${novos} aprovador(es) do nível superior notificado(s).`,
      })
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Falha ao escalonar.'
      toast.error('Não foi possível escalonar', { description: message })
    } finally {
      setEscalonando(false)
    }
  }

  const handleEnviarFornecedor = async () => {
    if (!rhe) return
    setReenviando(true)
    try {
      const { rhe: atualizado, email } = await rheApi.enviarFornecedor(rhe.id)
      onUpdated?.(atualizado)
      toast.success('RHE enviado ao fornecedor', {
        description: `PDF assinado enviado a ${email}.`,
      })
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Falha ao enviar ao fornecedor.'
      toast.error('Não foi possível enviar', { description: message })
    } finally {
      setReenviando(false)
    }
  }

  const handlePdf = async () => {
    if (!rhe) return
    setBaixando(true)
    try {
      await rncApi.downloadPdf(rhe.id, rhe.numero)
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Falha ao gerar o PDF.'
      toast.error('Não foi possível baixar o PDF', { description: message })
    } finally {
      setBaixando(false)
    }
  }

  const handleRegistrarFinal = async () => {
    if (!rhe || !finalResultado || !finalData) return
    setRegistrandoFinal(true)
    try {
      const atualizado = await rheApi.homologacaoFinal(
        rhe.id,
        finalResultado,
        finalData,
      )
      onUpdated?.(atualizado)
      setFinalOpen(false)
      toast.success('Homologação final registrada', {
        description: HOMOLOGACAO_LABELS[finalResultado],
      })
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Falha ao registrar a homologação final.'
      toast.error('Não foi possível registrar', { description: message })
    } finally {
      setRegistrandoFinal(false)
    }
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-neutral-950/30 backdrop-blur-[2px]"
          onClick={onClose}
        />
      )}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes do RHE"
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-3/4 max-w-3xl flex-col bg-white shadow-2xl transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {rhe && (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-6 py-4">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  Relatório de Homologação de Embalagem
                </span>
                <h2 className="truncate text-2xl font-semibold tracking-tight text-neutral-900">
                  RHE <span className="tabular-nums">{rhe.numero}</span>
                </h2>
                {rhe.titulo && (
                  <p className="truncate text-sm text-neutral-600">{rhe.titulo}</p>
                )}
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600">
                  <span
                    className={cn(
                      'inline-block h-1.5 w-1.5 rounded-full',
                      STATUS_DOT[rhe.status],
                    )}
                  />
                  {STATUS_LABELS[rhe.status]}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={handleEnviarAssinatura}
                  disabled={enviando || pendencias.length > 0}
                  title={
                    pendencias.length > 0
                      ? `Pendências antes de enviar: ${pendencias.join(', ')}`
                      : 'Enviar e-mail de assinatura aos aprovadores do tipo RHE e aos representantes do fornecedor'
                  }
                >
                  {enviando ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Enviar para assinatura
                </Button>
                {jaEnviado && temPendentes && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={handleLembrete}
                    disabled={lembrando}
                  >
                    {lembrando ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <BellRing className="h-3.5 w-3.5" />
                    )}
                    Lembrete
                  </Button>
                )}
                {jaEnviado && temPendentes && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={handleEscalonar}
                    disabled={escalonando}
                  >
                    {escalonando ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ArrowUpCircle className="h-3.5 w-3.5" />
                    )}
                    Escalonar
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={handlePdf}
                  disabled={baixando}
                >
                  {baixando ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  PDF
                </Button>
                {onEdit && rhe.status !== 'CLOSED' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => onEdit(rhe)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6">
              <Section title="Homologação">
                <Row label="Homologação inicial">
                  {rhe.homologacaoInicial ? (
                    <span className="inline-flex items-center gap-2">
                      <HomologacaoBadge valor={rhe.homologacaoInicial} />
                      {rhe.homologacaoInicialData && (
                        <span className="text-xs text-neutral-500">
                          em {fmtDataPura(rhe.homologacaoInicialData)}
                        </span>
                      )}
                    </span>
                  ) : (
                    '—'
                  )}
                </Row>
                <Row label="Homologação final">
                  {rhe.homologacaoFinal ? (
                    <span className="inline-flex items-center gap-2">
                      <HomologacaoBadge valor={rhe.homologacaoFinal} />
                      {rhe.homologacaoFinalData && (
                        <span className="text-xs text-neutral-500">
                          em {fmtDataPura(rhe.homologacaoFinalData)}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-neutral-500">
                      Em aberto — registrada após o período de acompanhamento.
                    </span>
                  )}
                </Row>
                {!rhe.homologacaoFinal && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-fit gap-1.5"
                    onClick={() => {
                      setFinalResultado('')
                      setFinalData(todayISO())
                      setFinalOpen(true)
                    }}
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    Registrar homologação final
                  </Button>
                )}
              </Section>

              <Section title="Envio ao fornecedor">
                {rhe.enviadoFornecedorEm ? (
                  <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-800">
                    <MailCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Documento assinado enviado a{' '}
                      <b>{rhe.enviadoFornecedorPara}</b> em{' '}
                      {fmtDataHora(rhe.enviadoFornecedorEm)}. O fluxo do RHE se
                      encerra com este envio; apenas a homologação final fica
                      em aberto.
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-xs text-neutral-600">
                      <MailWarning className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" />
                      <span>
                        Concluídas todas as assinaturas — internos e
                        representantes do fornecedor —, o PDF assinado vai
                        automaticamente por e-mail ao contato do fornecedor e o
                        RHE é encerrado.
                      </span>
                    </div>
                    {rhe.assinaturasConcluidasEm && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 w-fit gap-1.5"
                        onClick={handleEnviarFornecedor}
                        disabled={reenviando}
                        title="O envio automático falhou? Envie agora o PDF assinado ao contato do fornecedor."
                      >
                        {reenviando ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        Enviar ao fornecedor agora
                      </Button>
                    )}
                  </div>
                )}
              </Section>

              <Section title={`Assinaturas · ${resumoAssinaturas(rhe).label}`}>
                {rhe.aprovadores.length === 0 ? (
                  <p className="text-[13px] text-neutral-500">
                    Nenhum signatário na matriz. Vincule o tipo RHE aos
                    aprovadores no cadastro de Aprovadores e informe os
                    representantes técnicos do fornecedor.
                  </p>
                ) : (
                  rhe.aprovadores.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 px-3 py-2"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                          {a.areaNome}
                          {a.viaEscalonamento ? ' · escalonado' : ''}
                        </span>
                        <span className="truncate text-sm font-medium text-neutral-900">
                          {a.nome}
                          {a.cargo ? (
                            <span className="text-neutral-500"> · {a.cargo}</span>
                          ) : null}
                        </span>
                        {a.assinadoEm && (
                          <span className="text-xs text-emerald-700">
                            Assinado em {fmtDataHora(a.assinadoEm)}
                          </span>
                        )}
                      </div>
                      {a.assinadoEm ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Assinado
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Pendente
                        </span>
                      )}
                    </div>
                  ))
                )}
              </Section>

              <Section title="Identificação">
                <Row label="Título">{rhe.titulo ?? '—'}</Row>
                <Row label="Unidade">
                  {rhe.filial.codigo} · {rhe.filial.nome}
                </Row>
                <Row label="Data da homologação">{fmtData(rhe.dataIdentificacao)}</Row>
                <Row label="Fornecedor">
                  {rhe.fornecedor.codigo} · {rhe.fornecedor.razaoSocial}
                </Row>
                <Row label="Embalagem (produto)">
                  {rhe.produto
                    ? `${rhe.produto.codigo} · ${rhe.produto.descricao}`
                    : '—'}
                </Row>
                <Row label="Tipo de produto / aplicação">
                  {rhe.tipoProdutoAplicacao ?? '—'}
                </Row>
                <Row label="Linha de envase">{rhe.linhaEnvase ?? '—'}</Row>
                <Row label="Fabricação">{rhe.fabricacaoTexto ?? '—'}</Row>
                <Row label="Validade">{rhe.validadeTexto ?? '—'}</Row>
                <Row label="Quantidade">{rhe.quantidadeTexto ?? '—'}</Row>
                <Row label="Lote(s)">
                  {rhe.lotes.length > 0
                    ? rhe.lotes.map((l) => l.numero).join(' / ')
                    : '—'}
                </Row>
                <Row label="Nota fiscal">
                  {rhe.notasFiscais[0]?.numero ?? '—'}
                </Row>
                <Row label="Emitente">{rhe.criadoPor.nome}</Row>
                <div className="mt-1 flex flex-col gap-1">
                  <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-neutral-400">
                    <Users className="h-3.5 w-3.5" />
                    Representantes técnicos do fornecedor
                  </span>
                  <ul className="flex flex-col gap-0.5 text-[13.5px] text-neutral-800">
                    {rhe.representantes.map((r) => (
                      <li key={r.id}>
                        {r.ordem}. {r.nome}{' '}
                        <span className="text-neutral-500">· {r.email}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Section>

              <Section title="Definição do teste">
                <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-neutral-800">
                  {rhe.definicaoTeste || '—'}
                </p>
              </Section>

              <Section title="Avaliação, performance e considerações finais">
                <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-neutral-800">
                  {rhe.avaliacaoConsideracoes || '—'}
                </p>
                {rhe.analisadoPor && (
                  <Row label="Controle de qualidade">{rhe.analisadoPor}</Row>
                )}
              </Section>

              <Section title="Fotos da homologação">
                <RncFotosSection rncId={rhe.id} />
              </Section>
            </div>
          </>
        )}
      </aside>

      <Dialog open={finalOpen} onOpenChange={setFinalOpen}>
        <DialogContent className="w-[min(96vw,440px)]">
          <DialogHeader>
            <DialogTitle>Registrar homologação final</DialogTitle>
            <DialogDescription>
              Decisão única, tomada após o período de acompanhamento — pode
              ser registrada mesmo com o RHE encerrado.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>
                Resultado<span className="ml-0.5 text-red-600">*</span>
              </Label>
              <select
                className={selectClass}
                value={finalResultado}
                onChange={(e) =>
                  setFinalResultado(e.target.value as '' | HomologacaoResultado)
                }
                disabled={registrandoFinal}
              >
                <option value="">Selecione…</option>
                {(Object.keys(HOMOLOGACAO_LABELS) as HomologacaoResultado[]).map(
                  (h) => (
                    <option key={h} value={h}>
                      {HOMOLOGACAO_LABELS[h]}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>
                Data<span className="ml-0.5 text-red-600">*</span>
              </Label>
              <Input
                type="date"
                value={finalData}
                onChange={(e) => setFinalData(e.target.value)}
                disabled={registrandoFinal}
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setFinalOpen(false)}
              disabled={registrandoFinal}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRegistrarFinal}
              disabled={registrandoFinal || !finalResultado || !finalData}
            >
              {registrandoFinal && <Loader2 className="h-4 w-4 animate-spin" />}
              Registrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
