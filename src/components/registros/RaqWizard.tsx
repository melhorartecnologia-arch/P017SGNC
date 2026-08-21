import * as React from 'react'
import { Loader2, ShieldAlert, X } from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
import { ApiError } from '@/lib/api/client'
import { filiaisApi, type Filial } from '@/lib/api/filiais'
import type { Fornecedor } from '@/lib/api/fornecedores'
import { disposicoesApi, type Disposicao } from '@/lib/api/disposicoes'
import { origensApi, type Origem } from '@/lib/api/origens'
import { severidadesApi, type Severidade } from '@/lib/api/severidades'
import type { Produto } from '@/lib/api/produtos'
import { raqApi, type Raq, type RaqCreateInput } from '@/lib/api/raq'
import { FornecedorCombobox } from './FornecedorCombobox'
import { ProdutoCombobox } from './ProdutoCombobox'
import { RncFotosSection } from './RncFotosSection'

/**
 * Formulário do RAQ — Relatório de Alerta de Qualidade (FOR.IND.CQA.023).
 * Mais curto que o wizard da RNC: uma página com as seções do modelo,
 * lote e nota fiscal únicos, título e controle de reincidência.
 */

type Props = {
  open: boolean
  onOpenChange: (next: boolean) => void
  /** Quando informado, o formulário entra em modo edição (PATCH). */
  initial?: Raq | null
  onCreated?: (raq: Raq) => void
  onUpdated?: (raq: Raq) => void
}

const selectClass =
  'flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900 disabled:cursor-not-allowed disabled:opacity-50'

function todayISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Quantidades usam vírgula como separador decimal (padrão brasileiro).
function sanitizarDecimal(v: string): string {
  let s = v.replace(/[^\d,]/g, '')
  const i = s.indexOf(',')
  if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/,/g, '')
  return s
}

function sanitizarInteiro(v: string): string {
  return v.replace(/\D/g, '')
}

function numeroDecimal(v: string): number {
  return Number(v.trim().replace(',', '.'))
}

function exibeDecimal(n: number | null | undefined): string {
  return n == null ? '' : String(n).replace('.', ',')
}

function Section({
  titulo,
  children,
}: {
  titulo: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="border-b border-neutral-100 pb-1.5 text-[13px] font-semibold text-neutral-800">
        {titulo}
      </h3>
      {children}
    </section>
  )
}

function Field({
  label,
  required,
  children,
  className,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <Label>
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </Label>
      {children}
    </div>
  )
}

export function RaqWizard({ open, onOpenChange, initial, onCreated, onUpdated }: Props) {
  const [filiais, setFiliais] = React.useState<Filial[]>([])
  const [disposicoes, setDisposicoes] = React.useState<Disposicao[]>([])
  const [origens, setOrigens] = React.useState<Origem[]>([])
  const [severidades, setSeveridades] = React.useState<Severidade[]>([])
  // RAQs existentes para o vínculo de relacionados (reincidência).
  const [raqsExistentes, setRaqsExistentes] = React.useState<Raq[]>([])

  const [filialId, setFilialId] = React.useState('')
  const [titulo, setTitulo] = React.useState('')
  const [data, setData] = React.useState(todayISO())
  const [reincidente, setReincidente] = React.useState(false)
  const [reincidenteVezes, setReincidenteVezes] = React.useState('')
  const [relacionadosIds, setRelacionadosIds] = React.useState<string[]>([])

  const [fornecedor, setFornecedor] = React.useState<Fornecedor | null>(null)
  const [produto, setProduto] = React.useState<Produto | null>(null)
  const [loteNumero, setLoteNumero] = React.useState('')
  const [loteQuantidade, setLoteQuantidade] = React.useState('')
  const [quantidadeDefeito, setQuantidadeDefeito] = React.useState('')
  const [tempoParada, setTempoParada] = React.useState('')
  const [nfNumero, setNfNumero] = React.useState('')
  const [nfFabricacao, setNfFabricacao] = React.useState('')
  const [nfValidade, setNfValidade] = React.useState('')
  const [nfRecebimento, setNfRecebimento] = React.useState('')

  const [transportador, setTransportador] = React.useState('')
  const [placaCavalo, setPlacaCavalo] = React.useState('')
  const [placaCarreta, setPlacaCarreta] = React.useState('')
  const [nomeMotorista, setNomeMotorista] = React.useState('')
  const [documentoMotorista, setDocumentoMotorista] = React.useState('')

  const [disposicaoId, setDisposicaoId] = React.useState('')
  const [origemId, setOrigemId] = React.useState('')
  const [severidadeId, setSeveridadeId] = React.useState('')
  const [descricao, setDescricao] = React.useState('')
  const [observacoes, setObservacoes] = React.useState('')

  const [savedRaq, setSavedRaq] = React.useState<Raq | null>(initial ?? null)
  const [saving, setSaving] = React.useState(false)
  const salvandoRef = React.useRef(false)
  const [error, setError] = React.useState<string | null>(null)

  // Ao abrir/fechar: reseta ou popula a partir do `initial`.
  React.useEffect(() => {
    if (!open) {
      setFilialId('')
      setTitulo('')
      setData(todayISO())
      setReincidente(false)
      setReincidenteVezes('')
      setRelacionadosIds([])
      setFornecedor(null)
      setProduto(null)
      setLoteNumero('')
      setLoteQuantidade('')
      setQuantidadeDefeito('')
      setTempoParada('')
      setNfNumero('')
      setNfFabricacao('')
      setNfValidade('')
      setNfRecebimento('')
      setTransportador('')
      setPlacaCavalo('')
      setPlacaCarreta('')
      setNomeMotorista('')
      setDocumentoMotorista('')
      setDisposicaoId('')
      setOrigemId('')
      setSeveridadeId('')
      setDescricao('')
      setObservacoes('')
      setSavedRaq(null)
      setError(null)
      return
    }
    if (initial) {
      setFilialId(initial.filialId)
      setTitulo(initial.titulo ?? '')
      setData(initial.dataIdentificacao.slice(0, 10))
      setReincidente(initial.reincidente ?? false)
      setReincidenteVezes(
        initial.reincidenteVezes != null ? String(initial.reincidenteVezes) : '',
      )
      setRelacionadosIds(initial.raqRelacionados?.map((r) => r.id) ?? [])
      setFornecedor({
        id: initial.fornecedor.id,
        codigo: initial.fornecedor.codigo,
        razaoSocial: initial.fornecedor.razaoSocial,
        nomeFantasia: null,
        cnpj: initial.fornecedor.cnpj,
        ativo: true,
        observacoes: null,
        origemCadastro: 'PLATAFORMA',
        contatos: [],
      } as unknown as Fornecedor)
      setProduto(
        initial.produto
          ? ({
              id: initial.produto.id,
              codigo: initial.produto.codigo,
              descricao: initial.produto.descricao,
              unidadeMedida: initial.produto.unidadeMedida,
              ativo: true,
              origemCadastro: 'PLATAFORMA',
            } as unknown as Produto)
          : null,
      )
      const lote = initial.lotes[0]
      setLoteNumero(lote?.numero ?? '')
      setLoteQuantidade(exibeDecimal(lote?.quantidade))
      setQuantidadeDefeito(exibeDecimal(initial.quantidadeDefeito))
      setTempoParada(
        initial.tempoParadaMinutos != null ? String(initial.tempoParadaMinutos) : '',
      )
      const nf = initial.notasFiscais[0]
      setNfNumero(nf?.numero ?? '')
      setNfFabricacao(nf?.dataFabricacao?.slice(0, 10) ?? '')
      setNfValidade(nf?.dataValidade?.slice(0, 10) ?? '')
      setNfRecebimento(nf?.dataRecebimento?.slice(0, 10) ?? '')
      setTransportador(initial.transportador ?? '')
      setPlacaCavalo(initial.placaCavalo ?? '')
      setPlacaCarreta(initial.placaCarreta ?? '')
      setNomeMotorista(initial.nomeMotorista ?? '')
      setDocumentoMotorista(initial.cnhMotorista ?? '')
      setDisposicaoId(initial.disposicaoMaterialId ?? '')
      setOrigemId(initial.origemId ?? '')
      setSeveridadeId(initial.severidadeId ?? '')
      setDescricao(initial.descricaoDefeito ?? '')
      setObservacoes(initial.observacoesComplementares ?? '')
      setSavedRaq(initial)
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id])

  // Lookups quando o modal abre.
  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    Promise.all([
      filiaisApi.list({ ativo: true, pageSize: 100 }),
      disposicoesApi.list({ ativo: true, pageSize: 100 }),
      origensApi.list({ ativo: true, pageSize: 100 }),
      severidadesApi.list({ ativo: true, pageSize: 100 }),
      raqApi.list({ pageSize: 50 }),
    ])
      .then(([f, d, o, s, r]) => {
        if (cancelled) return
        setFiliais(f.items)
        setDisposicoes(d.items)
        setOrigens(o.items)
        setSeveridades(s.items)
        setRaqsExistentes(r.items)
      })
      .catch(() => {
        if (!cancelled) setError('Falha ao carregar os cadastros de apoio.')
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const montarPayload = (status: 'DRAFT' | 'OPEN'): RaqCreateInput => ({
    filialId,
    fornecedorId: fornecedor?.id ?? '',
    titulo: titulo.trim(),
    dataIdentificacao: data,
    status,
    reincidente,
    reincidenteVezes:
      reincidente && reincidenteVezes !== '' ? Number(reincidenteVezes) : null,
    raqRelacionadosIds: relacionadosIds,
    produtoId: produto?.id ?? '',
    lotes: [
      {
        numero: loteNumero.trim(),
        quantidade:
          loteQuantidade.trim() !== '' ? numeroDecimal(loteQuantidade) : null,
      },
    ],
    quantidadeDefeito:
      quantidadeDefeito.trim() !== '' ? numeroDecimal(quantidadeDefeito) : null,
    tempoParadaMinutos: tempoParada.trim() !== '' ? Number(tempoParada) : null,
    notasFiscais: [
      {
        numero: nfNumero.trim(),
        dataFabricacao: nfFabricacao || null,
        dataValidade: nfValidade || null,
        dataRecebimento: nfRecebimento || null,
      },
    ],
    disposicaoMaterialId: disposicaoId,
    origemId,
    severidadeId,
    descricaoDefeito: descricao.trim(),
    observacoesComplementares: observacoes.trim() || null,
    transportador: transportador.trim() || null,
    placaCavalo: placaCavalo.trim() || null,
    placaCarreta: placaCarreta.trim() || null,
    nomeMotorista: nomeMotorista.trim() || null,
    cnhMotorista: documentoMotorista.trim() || null,
  })

  const camposValidos =
    !!filialId &&
    !!fornecedor &&
    titulo.trim() !== '' &&
    !!produto &&
    loteNumero.trim() !== '' &&
    quantidadeDefeito.trim() !== '' &&
    nfNumero.trim() !== '' &&
    !!disposicaoId &&
    !!origemId &&
    !!severidadeId &&
    descricao.trim() !== ''

  const salvar = async (status: 'DRAFT' | 'OPEN') => {
    if (salvandoRef.current) return
    salvandoRef.current = true
    setSaving(true)
    setError(null)
    try {
      const payload = montarPayload(status)
      let salvo: Raq
      if (savedRaq) {
        salvo = await raqApi.update(savedRaq.id, payload)
        onUpdated?.(salvo)
        toast.success(`RAQ ${salvo.numero} atualizado`)
      } else {
        salvo = await raqApi.create(payload)
        onCreated?.(salvo)
        toast.success(`RAQ ${salvo.numero} criado`, {
          description: 'Agora anexe as fotos da ocorrência.',
        })
      }
      setSavedRaq(salvo)
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Não foi possível salvar o RAQ.'
      setError(message)
      toast.error('Falha ao salvar', { description: message })
    } finally {
      salvandoRef.current = false
      setSaving(false)
    }
  }

  const relacionadosDisponiveis = raqsExistentes.filter(
    (r) => r.id !== savedRaq?.id && !relacionadosIds.includes(r.id),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[92vh] w-[min(96vw,880px)] max-w-none flex-col overflow-hidden p-0"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="border-b border-neutral-100 px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-neutral-600" />
            {savedRaq
              ? `RAQ ${savedRaq.numero}`
              : 'Novo Relatório de Alerta de Qualidade'}
          </DialogTitle>
          <DialogDescription>
            Formulário FOR.IND.CQA.023 — assinado pelos aprovadores do tipo
            RAQ e enviado por e-mail ao fornecedor.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <Section titulo="1. Identificação do RAQ">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
              <Field label="Unidade (filial)" required className="sm:col-span-5">
                <select
                  className={selectClass}
                  value={filialId}
                  onChange={(e) => setFilialId(e.target.value)}
                  disabled={saving}
                >
                  <option value="">Selecione…</option>
                  {filiais.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.codigo} — {f.nome}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Data da ocorrência" required className="sm:col-span-3">
                <Input
                  type="date"
                  value={data}
                  max={todayISO()}
                  onChange={(e) => setData(e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Título do RAQ" required className="sm:col-span-12">
                <Input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex.: Alerta de qualidade — vazamento na selagem do lote L998"
                  maxLength={200}
                  disabled={saving}
                />
              </Field>
            </div>
          </Section>

          <Section titulo="2. RAQs relacionados (reincidência)">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
              <div className="flex items-center gap-3 sm:col-span-4">
                <Switch
                  id="raq-reincidente"
                  checked={reincidente}
                  onCheckedChange={setReincidente}
                  disabled={saving}
                />
                <Label htmlFor="raq-reincidente" className="cursor-pointer">
                  Reincidente
                </Label>
              </div>
              {reincidente && (
                <Field label="Quantas vezes?" required className="sm:col-span-3">
                  <Input
                    inputMode="numeric"
                    value={reincidenteVezes}
                    onChange={(e) =>
                      setReincidenteVezes(sanitizarInteiro(e.target.value))
                    }
                    maxLength={3}
                    disabled={saving}
                  />
                </Field>
              )}
              <Field
                label="Vincular RAQ relacionado (até 3)"
                className="sm:col-span-12"
              >
                <select
                  className={selectClass}
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return
                    if (relacionadosIds.length >= 3) {
                      toast.error('No máximo 3 RAQs relacionados.')
                      return
                    }
                    setRelacionadosIds([...relacionadosIds, e.target.value])
                  }}
                  disabled={saving || relacionadosIds.length >= 3}
                >
                  <option value="">
                    {relacionadosIds.length >= 3
                      ? 'Limite de 3 relacionados atingido'
                      : 'Selecionar um RAQ existente…'}
                  </option>
                  {relacionadosDisponiveis.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.numero}
                      {r.titulo ? ` — ${r.titulo}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              {relacionadosIds.length > 0 && (
                <div className="flex flex-wrap gap-2 sm:col-span-12">
                  {relacionadosIds.map((id) => {
                    const r = raqsExistentes.find((x) => x.id === id)
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-700"
                      >
                        {r?.numero ?? id}
                        <button
                          type="button"
                          onClick={() =>
                            setRelacionadosIds(
                              relacionadosIds.filter((x) => x !== id),
                            )
                          }
                          disabled={saving}
                          aria-label={`Remover RAQ relacionado ${r?.numero ?? ''}`}
                          className="text-neutral-400 hover:text-red-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          </Section>

          <Section titulo="3. Dados do fornecedor e material">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
              <Field label="Fornecedor" required className="sm:col-span-7">
                <FornecedorCombobox value={fornecedor} onChange={setFornecedor} />
              </Field>
              <Field label="Item (produto)" required className="sm:col-span-5">
                <ProdutoCombobox value={produto} onChange={setProduto} />
              </Field>
              <Field label="Lote" required className="sm:col-span-4">
                <Input
                  value={loteNumero}
                  onChange={(e) => setLoteNumero(e.target.value.toUpperCase())}
                  placeholder="Ex.: L2026A123"
                  maxLength={80}
                  disabled={saving}
                />
              </Field>
              <Field label="Quantidade do lote" className="sm:col-span-3">
                <Input
                  inputMode="decimal"
                  value={loteQuantidade}
                  onChange={(e) =>
                    setLoteQuantidade(sanitizarDecimal(e.target.value))
                  }
                  placeholder={produto ? `Qtd. (${produto.unidadeMedida})` : 'Qtd.'}
                  disabled={saving}
                />
              </Field>
              <Field label="Quantidade com defeito" required className="sm:col-span-3">
                <Input
                  inputMode="decimal"
                  value={quantidadeDefeito}
                  onChange={(e) =>
                    setQuantidadeDefeito(sanitizarDecimal(e.target.value))
                  }
                  disabled={saving}
                />
              </Field>
              <Field label="Tempo de parada (min)" className="sm:col-span-2">
                <Input
                  inputMode="numeric"
                  value={tempoParada}
                  onChange={(e) => setTempoParada(sanitizarInteiro(e.target.value))}
                  disabled={saving}
                />
              </Field>
              <Field label="Número da NF" required className="sm:col-span-3">
                <Input
                  value={nfNumero}
                  onChange={(e) => setNfNumero(e.target.value)}
                  maxLength={40}
                  disabled={saving}
                />
              </Field>
              <Field label="Data de fabricação" className="sm:col-span-3">
                <Input
                  type="date"
                  value={nfFabricacao}
                  max={todayISO()}
                  onChange={(e) => setNfFabricacao(e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Data de validade" className="sm:col-span-3">
                <Input
                  type="date"
                  value={nfValidade}
                  min={nfFabricacao || undefined}
                  onChange={(e) => setNfValidade(e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Data de recebimento" className="sm:col-span-3">
                <Input
                  type="date"
                  value={nfRecebimento}
                  min={nfFabricacao || undefined}
                  onChange={(e) => setNfRecebimento(e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Transportadora" className="sm:col-span-6">
                <Input
                  value={transportador}
                  onChange={(e) => setTransportador(e.target.value)}
                  maxLength={160}
                  disabled={saving}
                />
              </Field>
              <Field label="Placa do cavalo" className="sm:col-span-3">
                <Input
                  value={placaCavalo}
                  onChange={(e) => setPlacaCavalo(e.target.value.toUpperCase())}
                  maxLength={10}
                  disabled={saving}
                />
              </Field>
              <Field label="Placa da carreta" className="sm:col-span-3">
                <Input
                  value={placaCarreta}
                  onChange={(e) => setPlacaCarreta(e.target.value.toUpperCase())}
                  maxLength={10}
                  disabled={saving}
                />
              </Field>
              <Field label="Nome do motorista" className="sm:col-span-7">
                <Input
                  value={nomeMotorista}
                  onChange={(e) => setNomeMotorista(e.target.value)}
                  maxLength={120}
                  disabled={saving}
                />
              </Field>
              <Field label="Documento do motorista" className="sm:col-span-5">
                <Input
                  value={documentoMotorista}
                  onChange={(e) => setDocumentoMotorista(e.target.value)}
                  maxLength={20}
                  disabled={saving}
                />
              </Field>
            </div>
          </Section>

          <Section titulo="4. Disposição do material e dados da não conformidade">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
              <Field label="Disposição do material" required className="sm:col-span-4">
                <select
                  className={selectClass}
                  value={disposicaoId}
                  onChange={(e) => setDisposicaoId(e.target.value)}
                  disabled={saving}
                >
                  <option value="">Selecione…</option>
                  {disposicoes.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.codigo} — {d.descricao}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Origem da NC" required className="sm:col-span-4">
                <select
                  className={selectClass}
                  value={origemId}
                  onChange={(e) => setOrigemId(e.target.value)}
                  disabled={saving}
                >
                  <option value="">Selecione…</option>
                  {origens.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.codigo} — {o.nome}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Severidade" required className="sm:col-span-4">
                <select
                  className={selectClass}
                  value={severidadeId}
                  onChange={(e) => setSeveridadeId(e.target.value)}
                  disabled={saving}
                >
                  <option value="">Selecione…</option>
                  {severidades.map((s) => (
                    <option key={s.id} value={s.id}>
                      Nível {s.nivel} — {s.nome}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Defeito / problema identificado (descrição da ocorrência)"
                required
                className="sm:col-span-12"
              >
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={4}
                  maxLength={4000}
                  disabled={saving}
                  className="flex w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900"
                />
              </Field>
              <Field label="Observações complementares" className="sm:col-span-12">
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={2}
                  maxLength={4000}
                  disabled={saving}
                  className="flex w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900"
                />
              </Field>
            </div>
          </Section>

          {savedRaq && (
            <Section titulo="5. Fotos da ocorrência">
              <RncFotosSection rncId={savedRaq.id} />
            </Section>
          )}
          {!savedRaq && (
            <p className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
              Salve o RAQ para anexar as fotos da ocorrência — elas são
              obrigatórias para o envio à assinatura.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-neutral-100 px-6 py-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Fechar
          </Button>
          <Button
            variant="outline"
            onClick={() => salvar('DRAFT')}
            disabled={saving || !camposValidos}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar rascunho
          </Button>
          <Button onClick={() => salvar('OPEN')} disabled={saving || !camposValidos}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {savedRaq ? 'Salvar alterações' : 'Salvar RAQ'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
