import * as React from 'react'
import {
  X,
  Pencil,
  Check,
  Loader2,
  Send,
  BellRing,
  ArrowUpCircle,
  CheckCircle2,
  XCircle,
  Clock,
  MailWarning,
  ClipboardList,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api/client'
import {
  rncApi,
  resumoAssinaturas,
  pendenciasParaAssinatura,
  CIENCIA_RNC_LABEL,
  CONTINGENCIA_RNC_LABEL,
  ACAO_CONTINGENCIA_LABEL,
  type AcaoContingencia,
  type Rnc,
  type RncStatus,
} from '@/lib/api/rnc'
import { podeAnalisarRecusa } from '@/lib/api/auth'
import { useAuth } from '@/lib/auth/AuthContext'
import { RncFotosSection } from './RncFotosSection'

const STATUS_LABELS: Record<RncStatus, string> = {
  DRAFT: 'Rascunho',
  OPEN: 'Aberta',
  IN_PROGRESS: 'Em andamento',
  CLOSED: 'Encerrada',
  CANCELLED: 'Cancelada',
}

const STATUS_DOT: Record<RncStatus, string> = {
  DRAFT: 'bg-neutral-400',
  OPEN: 'bg-amber-500',
  IN_PROGRESS: 'bg-sky-500',
  CLOSED: 'bg-emerald-500',
  CANCELLED: 'bg-red-500',
}

function formatDataBR(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

function formatDataHoraBR(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}

type Props = {
  rnc: Rnc | null
  onClose: () => void
  onEdit?: (rnc: Rnc) => void
  /** Propaga a RNC atualizada (ex.: após registrar assinatura). */
  onUpdated?: (rnc: Rnc) => void
}

export function RncDetailPanel({ rnc, onClose, onEdit, onUpdated }: Props) {
  const open = !!rnc
  const [assinandoId, setAssinandoId] = React.useState<string | null>(null)
  const [enviando, setEnviando] = React.useState(false)
  const [lembrando, setLembrando] = React.useState(false)
  const [escalonando, setEscalonando] = React.useState(false)
  const pendencias = rnc ? pendenciasParaAssinatura(rnc) : []
  // "Enviada" = saiu de rascunho (cobre RNCs enviadas antes do campo
  // assinaturaEnviadaEm existir).
  const jaEnviada = !!rnc && rnc.status !== 'DRAFT'
  const temPendentesAssinatura =
    !!rnc && rnc.aprovadores.some((a) => !a.assinadoEm)

  const handleEnviarLembrete = async () => {
    if (!rnc) return
    setLembrando(true)
    try {
      const { rnc: atualizado, enviados } = await rncApi.enviarLembrete(rnc.id)
      onUpdated?.(atualizado)
      if (enviados > 0) {
        toast.success('Lembrete enviado', {
          description: `${enviados} aprovador(es) pendente(s) notificado(s).`,
        })
      } else {
        toast.warning('Nenhum lembrete enviado', {
          description: 'Verifique se há aprovadores pendentes com e-mail.',
        })
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Falha ao enviar lembrete.'
      toast.error('Não foi possível enviar o lembrete', { description: message })
    } finally {
      setLembrando(false)
    }
  }

  const handleEscalonar = async () => {
    if (!rnc) return
    setEscalonando(true)
    try {
      const { rnc: atualizado, novos } = await rncApi.escalonar(rnc.id)
      onUpdated?.(atualizado)
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

  const handleEnviarAssinatura = async () => {
    if (!rnc) return
    setEnviando(true)
    try {
      const { rnc: atualizado, enviados, falhas } =
        await rncApi.enviarParaAssinatura(rnc.id)
      onUpdated?.(atualizado)
      if (falhas.length === 0) {
        toast.success('RNC enviada para assinatura', {
          description: `${enviados.length} e-mail(s) enviado(s) aos aprovadores.`,
        })
      } else {
        toast.warning('Enviada com pendências', {
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

  const toggleAssinatura = async (aprovadorId: string, assinado: boolean) => {
    if (!rnc) return
    setAssinandoId(aprovadorId)
    try {
      const atualizado = await rncApi.setAssinatura(rnc.id, aprovadorId, assinado)
      onUpdated?.(atualizado)
      toast.success(assinado ? 'Assinatura registrada' : 'Assinatura cancelada')
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Falha ao atualizar a assinatura.'
      toast.error('Não foi possível atualizar', { description: message })
    } finally {
      setAssinandoId(null)
    }
  }

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  React.useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <>
      {/* Clicar fora não fecha — evita descartar o que está sendo visto/feito.
          Use o botão Fechar ou a tecla Esc. */}
      <div
        aria-hidden
        className={cn(
          'fixed inset-0 z-40 bg-neutral-950/30 backdrop-blur-[2px] transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes do RNC"
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-3/4 flex-col bg-white shadow-2xl transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {rnc && (
          <>
            <header className="flex items-start justify-between gap-6 px-10 pb-6 pt-8">
              <div className="flex min-w-0 flex-col gap-3">
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-400">
                  Relatório de Não Conformidade
                </span>
                <div className="flex items-baseline gap-4">
                  <h2
                    className="font-serif text-4xl font-normal tracking-tight text-neutral-900"
                    style={{
                      fontFamily:
                        '"Iowan Old Style", "Apple Garamond", "Baskerville", "Times New Roman", "Droid Serif", Times, serif',
                    }}
                  >
                    RNC <span className="tabular-nums">{rnc.numero}</span>
                  </h2>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600">
                    <span
                      className={cn(
                        'inline-block h-1.5 w-1.5 rounded-full',
                        STATUS_DOT[rnc.status],
                      )}
                    />
                    {STATUS_LABELS[rnc.status]}
                  </span>
                </div>
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
                      : 'Enviar e-mail de assinatura aos aprovadores'
                  }
                >
                  {enviando ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Enviar para assinatura
                </Button>
                {jaEnviada && temPendentesAssinatura && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={handleEnviarLembrete}
                    disabled={lembrando}
                    title="Enviar lembrete aos aprovadores pendentes"
                  >
                    {lembrando ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <BellRing className="h-3.5 w-3.5" />
                    )}
                    Enviar lembrete
                  </Button>
                )}
                {jaEnviada && temPendentesAssinatura && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={handleEscalonar}
                    disabled={escalonando}
                    title="Escalonar agora para o nível acima dos aprovadores pendentes"
                  >
                    {escalonando ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ArrowUpCircle className="h-3.5 w-3.5" />
                    )}
                    Escalonar agora
                  </Button>
                )}
                {onEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-neutral-600"
                    onClick={() => onEdit(rnc)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-neutral-500 hover:text-neutral-900"
                  onClick={onClose}
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-10 pb-12">
              <div className="border-t border-neutral-200" />

              <Section title="Identificação">
                <Row label="Unidade">
                  <span className="font-medium text-neutral-900">
                    {rnc.filial.codigo}
                  </span>
                  <span className="text-neutral-500"> · {rnc.filial.nome}</span>
                </Row>
                <Row label="Data de identificação">
                  {formatDataBR(rnc.dataIdentificacao)}
                </Row>
                <Row label="Turno">
                  {rnc.turno ? (
                    <>
                      <span className="font-medium text-neutral-900">
                        {rnc.turno.codigo}
                      </span>
                      <span className="text-neutral-500"> · {rnc.turno.nome}</span>
                    </>
                  ) : (
                    <em className="text-neutral-400">não informado</em>
                  )}
                </Row>
              </Section>

              <Section title="Tipo de não conformidade">
                <Row label="Código">
                  <span className="font-medium text-neutral-900">
                    {rnc.tipoNaoConformidade.codigo}
                  </span>
                </Row>
                <Row label="Descrição">
                  {rnc.tipoNaoConformidade.descricao}
                </Row>
                <Row label="Severidade típica">
                  {rnc.tipoNaoConformidade.severidade ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor:
                            rnc.tipoNaoConformidade.severidade.cor ?? '#a3a3a3',
                        }}
                      />
                      <span className="text-neutral-900">
                        Nível {rnc.tipoNaoConformidade.severidade.nivel} —{' '}
                        {rnc.tipoNaoConformidade.severidade.nome}
                      </span>
                    </span>
                  ) : (
                    <em className="text-neutral-400">não associada</em>
                  )}
                </Row>
              </Section>

              <Section title="Fornecedor">
                <Row label="Código">
                  <span className="font-medium text-neutral-900">
                    {rnc.fornecedor.codigo}
                  </span>
                </Row>
                <Row label="Razão social">
                  {rnc.fornecedor.razaoSocial}
                </Row>
                <Row label="CNPJ">
                  <span className="font-mono text-[13px] text-neutral-700">
                    {rnc.fornecedor.cnpj}
                  </span>
                </Row>
              </Section>

              <Section title="Material & lote">
                <Row label="Produto">
                  {rnc.produto ? (
                    <>
                      <span className="font-medium text-neutral-900">
                        {rnc.produto.codigo}
                      </span>
                      <span className="text-neutral-500"> · {rnc.produto.descricao}</span>
                    </>
                  ) : (
                    <em className="text-neutral-400">não informado</em>
                  )}
                </Row>
                <Row label={rnc.lotes.length > 1 ? 'Lotes' : 'Lote'}>
                  {rnc.lotes.length > 0 ? (
                    <span className="flex flex-col gap-0.5">
                      {rnc.lotes.map((l) => (
                        <span
                          key={l.id}
                          className="inline-flex items-baseline gap-1.5"
                        >
                          <span className="inline-block rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[12px] text-neutral-800">
                            {l.numero}
                          </span>
                          {l.quantidade != null ? (
                            <span className="tabular-nums text-[12px] text-neutral-700">
                              {l.quantidade.toLocaleString('pt-BR')}
                              {rnc.produto && (
                                <span className="text-neutral-500">
                                  {' '}
                                  {rnc.produto.unidadeMedida}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-[12px] text-neutral-400">
                              sem qtd.
                            </span>
                          )}
                        </span>
                      ))}
                      {rnc.lotes.length > 1 &&
                        rnc.lotes.some((l) => l.quantidade != null) && (
                          <span className="mt-0.5 border-t border-neutral-200 pt-0.5 text-[12px] text-neutral-600">
                            Total:{' '}
                            <b className="tabular-nums">
                              {rnc.lotes
                                .reduce((s, l) => s + (l.quantidade ?? 0), 0)
                                .toLocaleString('pt-BR')}
                            </b>
                            {rnc.produto && (
                              <span className="text-neutral-500">
                                {' '}
                                {rnc.produto.unidadeMedida}
                              </span>
                            )}
                          </span>
                        )}
                    </span>
                  ) : (
                    <em className="text-neutral-400">—</em>
                  )}
                </Row>
                <Row label="Qtd. com defeito">
                  {rnc.quantidadeDefeito != null ? (
                    <span className="tabular-nums">
                      {rnc.quantidadeDefeito}
                      {rnc.produto && (
                        <span className="text-neutral-500"> {rnc.produto.unidadeMedida}</span>
                      )}
                    </span>
                  ) : (
                    <em className="text-neutral-400">—</em>
                  )}
                </Row>
                <Row label="Tempo de parada">
                  {rnc.tempoParadaMinutos != null ? (
                    <span className="tabular-nums">
                      {rnc.tempoParadaMinutos} min
                    </span>
                  ) : (
                    <em className="text-neutral-400">—</em>
                  )}
                </Row>
              </Section>

              <Section
                title={
                  rnc.notasFiscais.length > 1
                    ? 'Notas fiscais & datas'
                    : 'Nota fiscal & datas'
                }
              >
                {rnc.notasFiscais.length === 0 ? (
                  <Row label="Nota fiscal">
                    <em className="text-neutral-400">—</em>
                  </Row>
                ) : (
                  <div className="flex flex-col gap-2">
                    {rnc.notasFiscais.map((nf) => (
                      <div
                        key={nf.id}
                        className="rounded-md border border-neutral-200 bg-neutral-50/50 p-2"
                      >
                        <div className="mb-1 text-[13px] font-medium text-neutral-900">
                          NF{' '}
                          {nf.numero ? (
                            <span className="font-mono">{nf.numero}</span>
                          ) : (
                            <em className="font-normal text-neutral-400">
                              sem número
                            </em>
                          )}
                        </div>
                        <Row label="Fabricação">
                          {nf.dataFabricacao ? (
                            formatDataBR(nf.dataFabricacao)
                          ) : (
                            <em className="text-neutral-400">—</em>
                          )}
                        </Row>
                        <Row label="Validade">
                          {nf.dataValidade ? (
                            formatDataBR(nf.dataValidade)
                          ) : (
                            <em className="text-neutral-400">—</em>
                          )}
                        </Row>
                        <Row label="Recebimento">
                          {nf.dataRecebimento ? (
                            formatDataBR(nf.dataRecebimento)
                          ) : (
                            <em className="text-neutral-400">—</em>
                          )}
                        </Row>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Section title="Transporte">
                <Row label="Transportador">
                  {rnc.transportador ?? (
                    <em className="text-neutral-400">não informado</em>
                  )}
                </Row>
                <Row label="Placa do cavalo">
                  {rnc.placaCavalo ? (
                    <span className="font-mono text-[13px]">{rnc.placaCavalo}</span>
                  ) : (
                    <em className="text-neutral-400">—</em>
                  )}
                </Row>
                <Row label="Placa da carreta">
                  {rnc.placaCarreta ? (
                    <span className="font-mono text-[13px]">{rnc.placaCarreta}</span>
                  ) : (
                    <em className="text-neutral-400">—</em>
                  )}
                </Row>
                <Row label="Motorista">
                  {rnc.nomeMotorista ?? (
                    <em className="text-neutral-400">—</em>
                  )}
                </Row>
                <Row label="CNH">
                  {rnc.cnhMotorista ? (
                    <span className="font-mono text-[13px]">{rnc.cnhMotorista}</span>
                  ) : (
                    <em className="text-neutral-400">—</em>
                  )}
                </Row>
              </Section>

              <Section title="Disposição do material">
                {rnc.disposicaoMaterial ? (
                  <>
                    <Row label="Código">
                      <span className="font-medium text-neutral-900">
                        {rnc.disposicaoMaterial.codigo}
                      </span>
                    </Row>
                    <Row label="Descrição">
                      {rnc.disposicaoMaterial.descricao}
                    </Row>
                  </>
                ) : (
                  <Row label="Disposição">
                    <em className="text-neutral-400">não informada</em>
                  </Row>
                )}
              </Section>

              <Section
                title={`Matriz de aprovação · ${resumoAssinaturas(rnc).label}`}
              >
                {rnc.assinaturasConcluidasEm && (
                  <div className="mb-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800">
                    Todas as assinaturas concluídas em{' '}
                    {formatDataHoraBR(rnc.assinaturasConcluidasEm)} — e-mail de
                    conclusão enviado aos envolvidos.
                  </div>
                )}
                {rnc.aprovadores.length === 0 ? (
                  <Row label="Aprovadores">
                    <em className="text-neutral-400">
                      Nenhum aprovador cadastrado para a filial/turno desta
                      RNC.
                    </em>
                  </Row>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {rnc.aprovadores.map((a) => {
                      const assinado = !!a.assinadoEm
                      const ocupado = assinandoId === a.id
                      return (
                        <div
                          key={a.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 px-2.5 py-1.5"
                        >
                          <div className="flex min-w-0 flex-col">
                            <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                              {a.areaNome}
                              {a.nivel != null && a.nivel > 1 && (
                                <span className="rounded bg-neutral-100 px-1 py-px text-[9px] text-neutral-600">
                                  Nível {a.nivel}
                                </span>
                              )}
                              {a.viaEscalonamento && (
                                <span className="rounded bg-amber-100 px-1 py-px text-[9px] font-semibold text-amber-700">
                                  Escalonado
                                </span>
                              )}
                            </span>
                            <span className="truncate text-sm text-neutral-900">
                              <span className="font-medium">{a.nome}</span>
                              {a.cargo && (
                                <span className="text-neutral-500">
                                  {' '}
                                  · {a.cargo}
                                </span>
                              )}
                            </span>
                            {assinado && (
                              <span className="text-[11px] text-emerald-700">
                                Assinado em {formatDataHoraBR(a.assinadoEm)}
                              </span>
                            )}
                            {!assinado && a.lembreteEnviadoEm && (
                              <span className="text-[11px] text-amber-700">
                                Lembrete enviado em{' '}
                                {formatDataHoraBR(a.lembreteEnviadoEm)}
                              </span>
                            )}
                            {assinado &&
                              (a.assinaturaIp ||
                                a.assinaturaNavegador ||
                                a.assinaturaLatitude != null) && (
                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-neutral-500">
                                  {a.assinaturaIp && (
                                    <span>IP: {a.assinaturaIp}</span>
                                  )}
                                  {a.assinaturaNavegador && (
                                    <span>{a.assinaturaNavegador}</span>
                                  )}
                                  {a.assinaturaSo && <span>{a.assinaturaSo}</span>}
                                  {a.assinaturaDispositivo && (
                                    <span>{a.assinaturaDispositivo}</span>
                                  )}
                                  {a.assinaturaLatitude != null &&
                                    a.assinaturaLongitude != null && (
                                      <a
                                        href={`https://www.google.com/maps?q=${a.assinaturaLatitude},${a.assinaturaLongitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sky-600 underline-offset-2 hover:underline"
                                      >
                                        Local ({a.assinaturaLatitude.toFixed(5)},{' '}
                                        {a.assinaturaLongitude.toFixed(5)})
                                      </a>
                                    )}
                                </div>
                              )}
                          </div>
                          <Button
                            variant={assinado ? 'outline' : 'default'}
                            size="sm"
                            className="shrink-0"
                            disabled={ocupado}
                            onClick={() => toggleAssinatura(a.id, !assinado)}
                          >
                            {ocupado ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : assinado ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : null}
                            {assinado ? 'Assinado' : 'Registrar assinatura'}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Section>

              <Section title="Ciência do fornecedor">
                <CienciaFornecedorBloco rnc={rnc} onUpdated={onUpdated} />
              </Section>

              {rnc.contingenciaStatus && (
                <Section title="Ações de contingência">
                  <ContingenciaBloco rnc={rnc} onUpdated={onUpdated} />
                </Section>
              )}

              <Section title="Origem & severidade">
                <Row label="Origem da NC">
                  {rnc.origem ? (
                    <>
                      <span className="font-medium text-neutral-900">
                        {rnc.origem.codigo}
                      </span>
                      <span className="text-neutral-500"> · {rnc.origem.nome}</span>
                    </>
                  ) : (
                    <em className="text-neutral-400">não informada</em>
                  )}
                </Row>
                <Row label="Severidade aplicada">
                  {rnc.severidade ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor: rnc.severidade.cor ?? '#a3a3a3',
                        }}
                      />
                      <span className="text-neutral-900">
                        Nível {rnc.severidade.nivel} — {rnc.severidade.nome}
                      </span>
                    </span>
                  ) : (
                    <em className="text-neutral-400">não informada</em>
                  )}
                </Row>
              </Section>

              <Section title="Descrição do defeito">
                {rnc.descricaoDefeito ? (
                  <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-neutral-800">
                    {rnc.descricaoDefeito}
                  </p>
                ) : (
                  <em className="text-sm text-neutral-400">não informada</em>
                )}
              </Section>

              <Section title="Fotos">
                <RncFotosSection rncId={rnc.id} editable />
              </Section>

              <Section title="Auditoria">
                <Row label="Criado por">
                  <span className="text-neutral-900">{rnc.criadoPor.nome}</span>
                  <span className="text-neutral-500"> · {rnc.criadoPor.email}</span>
                </Row>
                <Row label="Criado em">{formatDataHoraBR(rnc.createdAt)}</Row>
                <Row label="Atualizado em">{formatDataHoraBR(rnc.updatedAt)}</Row>
              </Section>
            </div>
          </>
        )}
      </aside>
    </>
  )
}

/** Prazo já vencido? Fica fora do render para não depender do relógio. */
function prazoVencido(prazo: string | null | undefined): boolean {
  if (!prazo) return false
  const ms = new Date(prazo).getTime()
  return !Number.isNaN(ms) && ms <= Date.now()
}

/** Selo de situação de uma ação do plano. */
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

/**
 * Uma linha do plano com a decisão do aprovador. A recusa abre o campo de
 * parecer, que é o texto devolvido ao fornecedor para corrigir a ação.
 */
function AcaoLinha({
  rncId,
  acao,
  podeDecidir,
  onUpdated,
}: {
  rncId: string
  acao: AcaoContingencia
  podeDecidir: boolean
  onUpdated?: (rnc: Rnc) => void
}) {
  const [modo, setModo] = React.useState<'aprovar' | 'recusar' | null>(null)
  const [parecer, setParecer] = React.useState('')
  const [salvando, setSalvando] = React.useState(false)

  const decidir = async (aprovada: boolean) => {
    if (salvando) return
    if (!aprovada && !parecer.trim()) {
      toast.error('Informe o parecer que fundamenta a recusa da ação.')
      return
    }
    setSalvando(true)
    try {
      const atualizado = await rncApi.analisarAcaoContingencia(rncId, acao.id, {
        aprovada,
        parecer: parecer.trim() || null,
      })
      onUpdated?.(atualizado)
      setModo(null)
      setParecer('')
      toast.success(
        aprovada
          ? `Ação ${acao.ordem} aprovada`
          : `Ação ${acao.ordem} recusada — o fornecedor será avisado`,
      )
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Falha ao registrar a decisão.'
      toast.error('Não foi possível registrar', { description: message })
    } finally {
      setSalvando(false)
    }
  }

  const pendente = acao.status === 'PENDENTE'

  return (
    <div className="flex flex-col gap-2 border-b border-neutral-100 py-2.5 last:border-0">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 w-5 shrink-0 text-xs tabular-nums text-neutral-400">
          {acao.ordem}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-neutral-900">
            {acao.descricao}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
            <span>
              Responsável:{' '}
              <span className="text-neutral-700">{acao.responsavel || '—'}</span>
            </span>
            <span>
              Prazo:{' '}
              <span className="text-neutral-700">
                {acao.prazo ? formatDataBR(acao.prazo) : '—'}
              </span>
            </span>
            {acao.analisadaEm && (
              <span>
                {acao.status === 'APROVADA' ? 'Aprovada' : 'Recusada'} em{' '}
                {formatDataHoraBR(acao.analisadaEm)}
                {acao.analisadaPor ? ` · por ${acao.analisadaPor}` : ''}
              </span>
            )}
          </div>
          {acao.parecer && (
            <p
              className={cn(
                'whitespace-pre-wrap rounded-md border px-2 py-1 text-xs',
                acao.status === 'RECUSADA'
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : 'border-neutral-200 bg-neutral-50 text-neutral-700',
              )}
            >
              <b>Parecer:</b> {acao.parecer}
            </p>
          )}
        </div>
        <SeloAcao status={acao.status} />
      </div>

      {pendente && podeDecidir && (
        <div className="ml-8 flex flex-col gap-2">
          {modo === null ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                onClick={() => decidir(true)}
                disabled={salvando}
              >
                {salvando ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Aprovar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => setModo('recusar')}
                disabled={salvando}
              >
                <XCircle className="h-3.5 w-3.5" />
                Recusar
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <textarea
                value={parecer}
                onChange={(e) => setParecer(e.target.value)}
                rows={2}
                maxLength={4000}
                disabled={salvando}
                placeholder="Parecer que fundamenta a recusa (obrigatório) — o fornecedor recebe este texto para corrigir a ação."
                className="flex w-full rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="gap-1.5 bg-red-600 hover:bg-red-700"
                  disabled={salvando || !parecer.trim()}
                  onClick={() => decidir(false)}
                >
                  {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Confirmar recusa
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={salvando}
                  onClick={() => {
                    setModo(null)
                    setParecer('')
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Plano de ações de contingência: o fornecedor cadastra uma ação por
 * linha e o aprovador marcado aprova ou recusa cada uma delas.
 */
function ContingenciaBloco({
  rnc,
  onUpdated,
}: {
  rnc: Rnc
  onUpdated?: (rnc: Rnc) => void
}) {
  const auth = useAuth()
  const usuario = auth.status === 'authenticated' ? auth.user : null
  // Mesma regra da análise da recusa: ADMIN ou aprovador marcado da filial.
  const podeDecidir = podeAnalisarRecusa(usuario, rnc.filialId)

  const status = rnc.contingenciaStatus
  if (!status) return null

  const acoes = rnc.acoesContingencia ?? []
  const emAnalise = status === 'EM_ANALISE'
  const aprovada = status === 'APROVADA'
  const emAberto = status === 'PENDENTE' || status === 'AJUSTE_SOLICITADO'
  const atrasada = emAberto && prazoVencido(rnc.contingenciaPrazoEm)
  const pendentes = acoes.filter((a) => a.status === 'PENDENTE').length

  const cor = aprovada
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : atrasada
      ? 'border-red-200 bg-red-50 text-red-800'
      : emAnalise
        ? 'border-sky-200 bg-sky-50 text-sky-800'
        : 'border-amber-200 bg-amber-50 text-amber-800'
  const Icone = aprovada
    ? CheckCircle2
    : atrasada
      ? AlertTriangle
      : emAnalise
        ? ClipboardList
        : Clock

  return (
    <div className="flex flex-col gap-2">
      <div className={cn('flex items-start gap-2 rounded-md border px-2.5 py-2', cor)}>
        <Icone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div className="flex flex-col gap-0.5 text-xs">
          <span className="font-semibold">
            {atrasada
              ? `${CONTINGENCIA_RNC_LABEL[status]} — em atraso`
              : CONTINGENCIA_RNC_LABEL[status]}
          </span>
          {emAnalise ? (
            <span>
              Plano recebido em {formatDataHoraBR(rnc.contingenciaRespondidaEm)}
              {rnc.contingenciaRespondidaPor
                ? ` · por ${rnc.contingenciaRespondidaPor}`
                : ''}
              {pendentes > 0
                ? ` — ${pendentes} ação(ões) aguardando decisão.`
                : '.'}
            </span>
          ) : aprovada ? (
            <span>
              Aprovado em {formatDataHoraBR(rnc.contingenciaAnalisadaEm)}
              {rnc.contingenciaAnalisadaPor
                ? ` · por ${rnc.contingenciaAnalisadaPor}`
                : ''}
            </span>
          ) : (
            <span>
              {status === 'AJUSTE_SOLICITADO'
                ? 'Devolvido ao fornecedor para correção. '
                : ''}
              Prazo até {formatDataHoraBR(rnc.contingenciaPrazoEm)}
              {atrasada
                ? ` — ${rnc.contingenciaAlertas} alerta(s) enviado(s) ao fornecedor.`
                : '.'}
            </span>
          )}
        </div>
      </div>
      <Row label="Solicitadas em">
        {formatDataHoraBR(rnc.contingenciaSolicitadaEm) || '—'}
      </Row>

      {acoes.length === 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-xs text-neutral-600">
          <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" />
          <span>
            O fornecedor ainda não cadastrou nenhuma ação. A cobrança
            automática se repete até o plano chegar.
          </span>
        </div>
      ) : (
        <div className="rounded-md border border-neutral-200 px-3">
          {acoes.map((a) => (
            <AcaoLinha
              key={a.id}
              rncId={rnc.id}
              acao={a}
              podeDecidir={podeDecidir && emAnalise}
              onUpdated={onUpdated}
            />
          ))}
        </div>
      )}

      {emAnalise && !podeDecidir && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50/60 px-2.5 py-2 text-xs text-neutral-600">
          A aprovação das ações cabe aos aprovadores marcados para receber as
          respostas do fornecedor nesta filial (ou a um administrador).
        </div>
      )}
    </div>
  )
}

/**
 * Situação da ciência do fornecedor: enviada após todas as assinaturas,
 * com aceite/recusa do fornecedor ou aceite automático por decurso.
 */
function CienciaFornecedorBloco({
  rnc,
  onUpdated,
}: {
  rnc: Rnc
  onUpdated?: (rnc: Rnc) => void
}) {
  const auth = useAuth()
  const usuario = auth.status === 'authenticated' ? auth.user : null
  // Só admins e aprovadores marcados na filial decidem sobre a recusa;
  // a API aplica a mesma regra ao registrar a análise.
  const podeDecidir = podeAnalisarRecusa(usuario, rnc.filialId)
  const [modo, setModo] = React.useState<'acatar' | 'negar' | null>(null)
  const [parecer, setParecer] = React.useState('')
  const [decidindo, setDecidindo] = React.useState(false)

  const decidir = async (acatarRecusa: boolean) => {
    if (decidindo) return
    if (!acatarRecusa && !parecer.trim()) {
      toast.error('Informe o parecer que fundamenta a negativa da recusa.')
      return
    }
    setDecidindo(true)
    try {
      const atualizado = await rncApi.analisarRecusa(rnc.id, {
        acatarRecusa,
        justificativa: parecer.trim() || null,
      })
      onUpdated?.(atualizado)
      setModo(null)
      setParecer('')
      toast.success(
        acatarRecusa
          ? 'Recusa acatada'
          : 'Recusa negada — RNC enviada em definitivo ao fornecedor',
      )
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Falha ao registrar a análise.'
      toast.error('Não foi possível registrar', { description: message })
    } finally {
      setDecidindo(false)
    }
  }

  const status = rnc.cienciaStatus
  if (!status) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-xs text-neutral-600">
        <MailWarning className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" />
        <span>
          Ainda não enviada. O documento segue automaticamente ao contato de
          e-mail do fornecedor quando todas as assinaturas forem concluídas.
        </span>
      </div>
    )
  }

  const pendente = status === 'PENDENTE'
  const recusada = status === 'RECUSADA'
  const definitiva = status === 'MANTIDA_DEFINITIVA'
  const Icone = pendente ? Clock : recusada || definitiva ? XCircle : CheckCircle2
  const cor = pendente
    ? 'border-amber-200 bg-amber-50 text-amber-800'
    : recusada
      ? 'border-orange-200 bg-orange-50 text-orange-800'
      : definitiva
        ? 'border-red-200 bg-red-50 text-red-800'
        : 'border-emerald-200 bg-emerald-50 text-emerald-800'

  return (
    <div className="flex flex-col gap-2">
      <div className={cn('flex items-start gap-2 rounded-md border px-2.5 py-2', cor)}>
        <Icone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div className="flex flex-col gap-0.5 text-xs">
          <span className="font-semibold">{CIENCIA_RNC_LABEL[status]}</span>
          {pendente ? (
            <span>
              Prazo até {formatDataHoraBR(rnc.cienciaPrazoEm)} — sem resposta, o
              aceite é automático.
            </span>
          ) : (
            <span>
              Registrada em {formatDataHoraBR(rnc.cienciaRespondidaEm)}
              {rnc.cienciaRespondidaPor ? ` · por ${rnc.cienciaRespondidaPor}` : ''}
            </span>
          )}
          {recusada && (
            <span>
              Aguardando a análise do aprovador responsável (acatar ou negar a
              recusa). O fornecedor não pode recusar novamente.
            </span>
          )}
        </div>
      </div>
      <Row label="Enviada para">
        {rnc.cienciaEmail ?? <em className="text-neutral-400">—</em>}
      </Row>
      <Row label="Envio">{formatDataHoraBR(rnc.cienciaEnviadaEm) || '—'}</Row>
      {rnc.cienciaJustificativa && (
        <Row label="Justificativa do fornecedor">
          <span className="whitespace-pre-wrap">{rnc.cienciaJustificativa}</span>
        </Row>
      )}
      {rnc.cienciaAnaliseEm && (
        <Row label="Análise da recusa">
          {status === 'RECUSA_ACEITA' ? 'Recusa acatada' : 'Recusa negada'} em{' '}
          {formatDataHoraBR(rnc.cienciaAnaliseEm)}
          {rnc.cienciaAnalisePor ? ` · por ${rnc.cienciaAnalisePor}` : ''}
        </Row>
      )}
      {rnc.cienciaAnaliseJustificativa && (
        <Row label="Parecer da análise">
          <span className="whitespace-pre-wrap">
            {rnc.cienciaAnaliseJustificativa}
          </span>
        </Row>
      )}

      {/* Decisão pela plataforma — mesma ação do link enviado por e-mail. */}
      {recusada && !podeDecidir && (
        <div className="mt-1 rounded-md border border-neutral-200 bg-neutral-50/60 px-2.5 py-2 text-xs text-neutral-600">
          A decisão sobre a recusa cabe aos aprovadores marcados para receber
          as respostas do fornecedor nesta filial (ou a um administrador).
        </div>
      )}
      {recusada && podeDecidir && (
        <div className="mt-1 flex flex-col gap-2 rounded-md border border-neutral-200 bg-neutral-50/60 p-2.5">
          <span className="text-xs font-medium text-neutral-700">
            Analisar a recusa
          </span>
          {modo === null && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                onClick={() => setModo('acatar')}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Acatar a recusa
              </Button>
              <Button
                size="sm"
                className="gap-1.5 bg-red-600 hover:bg-red-700"
                onClick={() => setModo('negar')}
              >
                <XCircle className="h-3.5 w-3.5" />
                Negar (tornar definitiva)
              </Button>
            </div>
          )}
          {modo !== null && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-neutral-600">
                {modo === 'acatar'
                  ? 'A justificativa do fornecedor será acatada e a ciência encerrada a favor dele.'
                  : 'A RNC será mantida e enviada em definitivo ao fornecedor, sem possibilidade de nova recusa.'}
              </p>
              <textarea
                value={parecer}
                onChange={(e) => setParecer(e.target.value)}
                rows={3}
                maxLength={4000}
                disabled={decidindo}
                placeholder={
                  modo === 'acatar'
                    ? 'Parecer (opcional)'
                    : 'Parecer que fundamenta a negativa (obrigatório)'
                }
                className="flex w-full rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className={cn(
                    'gap-1.5',
                    modo === 'acatar'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-red-600 hover:bg-red-700',
                  )}
                  disabled={
                    decidindo || (modo === 'negar' && !parecer.trim())
                  }
                  onClick={() => decidir(modo === 'acatar')}
                >
                  {decidindo && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {modo === 'acatar'
                    ? 'Confirmar: acatar'
                    : 'Confirmar: negar e tornar definitiva'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={decidindo}
                  onClick={() => {
                    setModo(null)
                    setParecer('')
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
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
      <h3 className="mb-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-400">
        {title}
      </h3>
      <div className="flex flex-col gap-1 text-sm text-neutral-800">
        {children}
      </div>
    </section>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[180px_1fr] items-baseline gap-x-8">
      <div className="text-xs font-normal text-neutral-500">{label}</div>
      <div className="text-sm text-neutral-800">{children}</div>
    </div>
  )
}
