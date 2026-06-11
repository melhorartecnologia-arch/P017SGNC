import * as React from 'react'
import { X, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Rnc, RncStatus } from '@/lib/api/rnc'
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
}

export function RncDetailPanel({ rnc, onClose, onEdit }: Props) {
  const open = !!rnc

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
      <div
        aria-hidden
        onClick={onClose}
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
