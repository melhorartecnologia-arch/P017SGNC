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
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api/client'
import { rncApi, resumoAssinaturas, type RncStatus } from '@/lib/api/rnc'
import { rvtApi, pendenciasParaAssinaturaRvt, type Rvt } from '@/lib/api/rvt'
import { RncFotosSection } from './RncFotosSection'

/**
 * Painel de detalhes do RVT. As ações de workflow usam os endpoints
 * compartilhados de /api/rnc (servem todos os tipos); após cada ação o
 * painel recarrega o RVT para manter os campos próprios.
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

function fmtData(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
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
    <div className="grid grid-cols-[170px_1fr] gap-2 text-[13.5px]">
      <span className="text-neutral-500">{label}</span>
      <span className="min-w-0 text-neutral-900">{children}</span>
    </div>
  )
}

type Props = {
  rvt: Rvt | null
  onClose: () => void
  onEdit?: (rvt: Rvt) => void
  onUpdated?: (rvt: Rvt) => void
}

export function RvtDetailPanel({ rvt, onClose, onEdit, onUpdated }: Props) {
  const open = !!rvt
  const [enviando, setEnviando] = React.useState(false)
  const [lembrando, setLembrando] = React.useState(false)
  const [escalonando, setEscalonando] = React.useState(false)
  const [baixando, setBaixando] = React.useState(false)
  const [reenviando, setReenviando] = React.useState(false)
  const pendencias = rvt ? pendenciasParaAssinaturaRvt(rvt) : []
  const jaEnviado = !!rvt && rvt.status !== 'DRAFT'
  const temPendentes =
    !!rvt && rvt.aprovadores.some((a) => !a.assinadoEm && !a.escalonadoEm)

  /** Recarrega o RVT após uma ação de workflow (que devolve o tipo Rnc). */
  const recarregar = async () => {
    if (!rvt) return
    try {
      onUpdated?.(await rvtApi.get(rvt.id))
    } catch {
      // silencioso: a ação principal já foi confirmada
    }
  }

  const handleEnviarAssinatura = async () => {
    if (!rvt) return
    setEnviando(true)
    try {
      const { enviados, falhas } = await rncApi.enviarParaAssinatura(rvt.id)
      await recarregar()
      if (falhas.length === 0) {
        toast.success('RVT enviado para assinatura', {
          description: `${enviados.length} e-mail(s) enviado(s) aos aprovadores do tipo RVT.`,
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
    if (!rvt) return
    setLembrando(true)
    try {
      const { enviados } = await rncApi.enviarLembrete(rvt.id)
      await recarregar()
      toast.success('Lembrete enviado', {
        description: `${enviados} aprovador(es) pendente(s) notificado(s).`,
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
    if (!rvt) return
    setEscalonando(true)
    try {
      const { novos } = await rncApi.escalonar(rvt.id)
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
    if (!rvt) return
    setReenviando(true)
    try {
      const { rvt: atualizado, email } = await rvtApi.enviarFornecedor(rvt.id)
      onUpdated?.(atualizado)
      toast.success('RVT enviado ao fornecedor', {
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
    if (!rvt) return
    setBaixando(true)
    try {
      await rncApi.downloadPdf(rvt.id, rvt.numero)
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Falha ao gerar o PDF.'
      toast.error('Não foi possível baixar o PDF', { description: message })
    } finally {
      setBaixando(false)
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
        aria-label="Detalhes do RVT"
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-3/4 max-w-3xl flex-col bg-white shadow-2xl transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {rvt && (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-6 py-4">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  Relatório de Visita Técnica
                </span>
                <h2 className="truncate text-2xl font-semibold tracking-tight text-neutral-900">
                  RVT <span className="tabular-nums">{rvt.numero}</span>
                </h2>
                {rvt.pauta && (
                  <p className="truncate text-sm text-neutral-600">{rvt.pauta}</p>
                )}
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600">
                  <span
                    className={cn(
                      'inline-block h-1.5 w-1.5 rounded-full',
                      STATUS_DOT[rvt.status],
                    )}
                  />
                  {STATUS_LABELS[rvt.status]}
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
                      : 'Enviar e-mail de assinatura aos aprovadores do tipo RVT'
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
                {onEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => onEdit(rvt)}
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
              <Section title="Envio ao fornecedor">
                {rvt.enviadoFornecedorEm ? (
                  <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-800">
                    <MailCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Documento assinado enviado a{' '}
                      <b>{rvt.enviadoFornecedorPara}</b> em{' '}
                      {fmtDataHora(rvt.enviadoFornecedorEm)}. O fluxo do RVT se
                      encerra com este envio.
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-xs text-neutral-600">
                      <MailWarning className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" />
                      <span>
                        Concluídas todas as assinaturas, o PDF assinado vai
                        automaticamente por e-mail ao contato do fornecedor e o
                        RVT é encerrado.
                      </span>
                    </div>
                    {rvt.assinaturasConcluidasEm && (
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

              <Section title={`Matriz de aprovação · ${resumoAssinaturas(rvt).label}`}>
                {rvt.aprovadores.length === 0 ? (
                  <p className="text-[13px] text-neutral-500">
                    Nenhum aprovador configurado para o tipo RVT nesta filial.
                    Vincule o tipo RVT aos aprovadores no cadastro de
                    Aprovadores.
                  </p>
                ) : (
                  rvt.aprovadores.map((a) => (
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
                      ) : a.escalonadoEm ? (
                        <span
                          className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500"
                          title="Escalonado ao nível superior — não pode mais assinar"
                        >
                          Superado
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

              <Section title="Visita técnica">
                <Row label="Pauta">{rvt.pauta ?? '—'}</Row>
                <Row label="Unidade">
                  {rvt.filial.codigo} · {rvt.filial.nome}
                </Row>
                <Row label="Data da visita">{fmtData(rvt.dataIdentificacao)}</Row>
                <Row label="Fornecedor">
                  {rvt.fornecedor.codigo} · {rvt.fornecedor.razaoSocial}
                </Row>
                <Row label="Produto">
                  {rvt.produto
                    ? `${rvt.produto.codigo} · ${rvt.produto.descricao}`
                    : '—'}
                </Row>
                <Row label="Emitente">{rvt.criadoPor.nome}</Row>
                <div className="mt-1 flex flex-col gap-1">
                  <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-neutral-400">
                    <Users className="h-3.5 w-3.5" />
                    Participantes
                  </span>
                  <ul className="flex flex-col gap-0.5 text-[13.5px] text-neutral-800">
                    {rvt.participantes.map((p) => (
                      <li key={p.id}>
                        {p.ordem}. {p.nome}
                      </li>
                    ))}
                  </ul>
                </div>
              </Section>

              <Section title="Assuntos abordados">
                <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-neutral-800">
                  {rvt.assuntosAbordados || '—'}
                </p>
              </Section>

              <Section title="Conclusão">
                <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-neutral-800">
                  {rvt.conclusao || '—'}
                </p>
              </Section>

              <Section title="Fotos da visita técnica">
                <RncFotosSection rncId={rvt.id} />
              </Section>
            </div>
          </>
        )}
      </aside>
    </>
  )
}
