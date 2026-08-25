import * as React from 'react'
import { Loader2, PackageCheck, Plus, Trash2 } from 'lucide-react'
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
import { ApiError } from '@/lib/api/client'
import { filiaisApi, type Filial } from '@/lib/api/filiais'
import type { Fornecedor } from '@/lib/api/fornecedores'
import type { Produto } from '@/lib/api/produtos'
import {
  rheApi,
  HOMOLOGACAO_LABELS,
  type HomologacaoResultado,
  type Rhe,
  type RheCreateInput,
} from '@/lib/api/rhe'
import { FornecedorCombobox } from './FornecedorCombobox'
import { ProdutoCombobox } from './ProdutoCombobox'
import { RncFotosSection } from './RncFotosSection'

/**
 * Formulário do RHE — Relatório de Homologação de Embalagem
 * (FOR.IND.CQA.031). Seções do modelo: identificação, dados do
 * fornecedor/produto e rastreabilidade, definição do teste, fotos,
 * avaliação/considerações com a homologação inicial e os representantes
 * técnicos do fornecedor (até 2) que assinam o documento.
 */

type Props = {
  open: boolean
  onOpenChange: (next: boolean) => void
  /** Quando informado, o formulário entra em modo edição (PATCH). */
  initial?: Rhe | null
  onCreated?: (rhe: Rhe) => void
  onUpdated?: (rhe: Rhe) => void
}

const selectClass =
  'flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900 disabled:cursor-not-allowed disabled:opacity-50'

const textareaClass =
  'flex w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900'

const MAX_REPRESENTANTES = 2
const MAX_LOTES = 10

function todayISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
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

type RepresentanteForm = { nome: string; email: string }

export function RheWizard({ open, onOpenChange, initial, onCreated, onUpdated }: Props) {
  const [filiais, setFiliais] = React.useState<Filial[]>([])

  const [filialId, setFilialId] = React.useState('')
  const [fornecedor, setFornecedor] = React.useState<Fornecedor | null>(null)
  const [produto, setProduto] = React.useState<Produto | null>(null)
  const [data, setData] = React.useState(todayISO())
  const [titulo, setTitulo] = React.useState('')
  const [tipoProduto, setTipoProduto] = React.useState('')
  const [definicaoTeste, setDefinicaoTeste] = React.useState('')
  const [linhaEnvase, setLinhaEnvase] = React.useState('')
  const [fabricacao, setFabricacao] = React.useState('')
  const [validade, setValidade] = React.useState('')
  const [quantidade, setQuantidade] = React.useState('')
  const [lotes, setLotes] = React.useState<string[]>([''])
  const [notaFiscal, setNotaFiscal] = React.useState('')
  const [analisadoPor, setAnalisadoPor] = React.useState('')
  const [avaliacao, setAvaliacao] = React.useState('')
  const [homologacao, setHomologacao] = React.useState<'' | HomologacaoResultado>('')
  const [homologacaoData, setHomologacaoData] = React.useState('')
  const [representantes, setRepresentantes] = React.useState<RepresentanteForm[]>([
    { nome: '', email: '' },
  ])

  const [savedRhe, setSavedRhe] = React.useState<Rhe | null>(initial ?? null)
  const [saving, setSaving] = React.useState(false)
  const salvandoRef = React.useRef(false)
  const [error, setError] = React.useState<string | null>(null)

  // Ao abrir/fechar: reseta ou popula a partir do `initial`.
  React.useEffect(() => {
    if (!open) {
      setFilialId('')
      setFornecedor(null)
      setProduto(null)
      setData(todayISO())
      setTitulo('')
      setTipoProduto('')
      setDefinicaoTeste('')
      setLinhaEnvase('')
      setFabricacao('')
      setValidade('')
      setQuantidade('')
      setLotes([''])
      setNotaFiscal('')
      setAnalisadoPor('')
      setAvaliacao('')
      setHomologacao('')
      setHomologacaoData('')
      setRepresentantes([{ nome: '', email: '' }])
      setSavedRhe(null)
      setError(null)
      return
    }
    if (initial) {
      setFilialId(initial.filialId)
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
      setData(initial.dataIdentificacao.slice(0, 10))
      setTitulo(initial.titulo ?? '')
      setTipoProduto(initial.tipoProdutoAplicacao ?? '')
      setDefinicaoTeste(initial.definicaoTeste ?? '')
      setLinhaEnvase(initial.linhaEnvase ?? '')
      setFabricacao(initial.fabricacaoTexto ?? '')
      setValidade(initial.validadeTexto ?? '')
      setQuantidade(initial.quantidadeTexto ?? '')
      setLotes(
        initial.lotes.length > 0 ? initial.lotes.map((l) => l.numero) : [''],
      )
      setNotaFiscal(initial.notasFiscais[0]?.numero ?? '')
      setAnalisadoPor(initial.analisadoPor ?? '')
      setAvaliacao(initial.avaliacaoConsideracoes ?? '')
      setHomologacao(initial.homologacaoInicial ?? '')
      setHomologacaoData(
        initial.homologacaoInicialData
          ? initial.homologacaoInicialData.slice(0, 10)
          : '',
      )
      setRepresentantes(
        initial.representantes.length > 0
          ? initial.representantes.map((r) => ({ nome: r.nome, email: r.email }))
          : [{ nome: '', email: '' }],
      )
      setSavedRhe(initial)
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id])

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    filiaisApi
      .list({ ativo: true, pageSize: 100 })
      .then((f) => !cancelled && setFiliais(f.items))
      .catch(() => !cancelled && setError('Falha ao carregar as filiais.'))
    return () => {
      cancelled = true
    }
  }, [open])

  // Depois de coletada alguma assinatura, os signatários do fornecedor
  // não podem mais ser trocados (o servidor também bloqueia).
  const temAssinatura =
    !!savedRhe && savedRhe.aprovadores.some((a) => a.assinadoEm)

  const representantesPreenchidos = representantes.filter(
    (r) => r.nome.trim() !== '' && r.email.trim() !== '',
  )
  const lotesPreenchidos = lotes.filter((l) => l.trim() !== '')

  const camposValidos =
    !!filialId &&
    !!fornecedor &&
    !!produto &&
    titulo.trim() !== '' &&
    definicaoTeste.trim() !== '' &&
    representantesPreenchidos.length > 0

  const montarPayload = (status: 'DRAFT' | 'OPEN'): RheCreateInput => ({
    filialId,
    fornecedorId: fornecedor?.id ?? '',
    produtoId: produto?.id ?? '',
    dataIdentificacao: data,
    status,
    titulo: titulo.trim(),
    tipoProdutoAplicacao: tipoProduto.trim() || null,
    definicaoTeste: definicaoTeste.trim(),
    linhaEnvase: linhaEnvase.trim() || null,
    fabricacaoTexto: fabricacao.trim() || null,
    validadeTexto: validade.trim() || null,
    quantidadeTexto: quantidade.trim() || null,
    lotes: lotesPreenchidos.map((numero) => ({ numero: numero.trim() })),
    notaFiscal: notaFiscal.trim() || null,
    analisadoPor: analisadoPor.trim() || null,
    avaliacaoConsideracoes: avaliacao.trim() || null,
    homologacaoInicial: homologacao || null,
    homologacaoInicialData: homologacao && homologacaoData ? homologacaoData : null,
    representantes: representantesPreenchidos.map((r) => ({
      nome: r.nome.trim(),
      email: r.email.trim(),
    })),
  })

  const salvar = async (status: 'DRAFT' | 'OPEN') => {
    if (salvandoRef.current) return
    salvandoRef.current = true
    setSaving(true)
    setError(null)
    try {
      const payload = montarPayload(status)
      let salvo: Rhe
      if (savedRhe) {
        // Com assinatura coletada o servidor rejeita troca de
        // representantes — não reenvia o campo intacto.
        const { representantes: reps, ...resto } = payload
        salvo = await rheApi.update(
          savedRhe.id,
          temAssinatura ? resto : { ...resto, representantes: reps },
        )
        onUpdated?.(salvo)
        toast.success(`RHE ${salvo.numero} atualizado`)
      } else {
        salvo = await rheApi.create(payload)
        onCreated?.(salvo)
        toast.success(`RHE ${salvo.numero} criado`, {
          description: 'Agora anexe as fotos da homologação.',
        })
      }
      setSavedRhe(salvo)
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Não foi possível salvar o RHE.'
      setError(message)
      toast.error('Falha ao salvar', { description: message })
    } finally {
      salvandoRef.current = false
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[92vh] w-[min(96vw,860px)] max-w-none flex-col overflow-hidden p-0"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="border-b border-neutral-100 px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-neutral-600" />
            {savedRhe
              ? `RHE ${savedRhe.numero}`
              : 'Novo Relatório de Homologação de Embalagem'}
          </DialogTitle>
          <DialogDescription>
            FOR.IND.CQA.031 — assinado pelos aprovadores do tipo RHE e pelos
            representantes técnicos do fornecedor; ao final o PDF assinado é
            enviado por e-mail ao fornecedor.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <Section titulo="1. Identificação">
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
              <Field label="Data da homologação" required className="sm:col-span-3">
                <Input
                  type="date"
                  value={data}
                  max={todayISO()}
                  onChange={(e) => setData(e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Título do RHE" required className="sm:col-span-12">
                <Input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex.: Homologação de filme stretch — Lord Embalagens"
                  maxLength={200}
                  disabled={saving}
                />
              </Field>
            </div>
          </Section>

          <Section titulo="2. Dados do fornecedor e do produto">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
              <Field label="Fornecedor" required className="sm:col-span-7">
                <FornecedorCombobox value={fornecedor} onChange={setFornecedor} />
              </Field>
              <Field label="Embalagem (produto)" required className="sm:col-span-5">
                <ProdutoCombobox value={produto} onChange={setProduto} />
              </Field>
              <Field
                label="Tipo de produto / aplicação"
                className="sm:col-span-7"
              >
                <Input
                  value={tipoProduto}
                  onChange={(e) => setTipoProduto(e.target.value)}
                  placeholder="Ex.: Filme stretch para paletização"
                  maxLength={200}
                  disabled={saving}
                />
              </Field>
              <Field label="Linha de envase" className="sm:col-span-5">
                <Input
                  value={linhaEnvase}
                  onChange={(e) => setLinhaEnvase(e.target.value)}
                  placeholder="Ex.: Linha 2 — lata"
                  maxLength={80}
                  disabled={saving}
                />
              </Field>
              <Field label="Fabricação" className="sm:col-span-4">
                <Input
                  value={fabricacao}
                  onChange={(e) => setFabricacao(e.target.value)}
                  placeholder="Ex.: 10/03/2026"
                  maxLength={200}
                  disabled={saving}
                />
              </Field>
              <Field label="Validade" className="sm:col-span-4">
                <Input
                  value={validade}
                  onChange={(e) => setValidade(e.target.value)}
                  placeholder="Ex.: 10/03/2028"
                  maxLength={100}
                  disabled={saving}
                />
              </Field>
              <Field label="Quantidade" className="sm:col-span-4">
                <Input
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  placeholder="Ex.: 12 bobinas"
                  maxLength={100}
                  disabled={saving}
                />
              </Field>
              <div className="flex flex-col gap-1.5 sm:col-span-7">
                <Label>
                  Lote(s)
                  <span className="ml-2 text-xs font-normal text-neutral-500">
                    (até {MAX_LOTES})
                  </span>
                </Label>
                <div className="flex flex-col gap-1.5">
                  {lotes.map((l, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <Input
                        value={l}
                        onChange={(e) =>
                          setLotes(
                            lotes.map((x, i) => (i === idx ? e.target.value : x)),
                          )
                        }
                        placeholder={`Lote ${idx + 1}`}
                        maxLength={80}
                        disabled={saving}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setLotes(
                            lotes.length === 1
                              ? ['']
                              : lotes.filter((_, i) => i !== idx),
                          )
                        }
                        disabled={saving}
                        aria-label={`Remover lote ${idx + 1}`}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit gap-1.5"
                  onClick={() => lotes.length < MAX_LOTES && setLotes([...lotes, ''])}
                  disabled={saving || lotes.length >= MAX_LOTES}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar lote
                </Button>
              </div>
              <Field label="Nota fiscal" className="sm:col-span-5">
                <Input
                  value={notaFiscal}
                  onChange={(e) => setNotaFiscal(e.target.value)}
                  placeholder="Nº da NF do material testado"
                  maxLength={40}
                  disabled={saving}
                />
              </Field>
            </div>
          </Section>

          <Section titulo="3. Definição do teste">
            <textarea
              value={definicaoTeste}
              onChange={(e) => setDefinicaoTeste(e.target.value)}
              rows={4}
              maxLength={4000}
              disabled={saving}
              placeholder="Descreva o teste realizado: condições, período, linha, critérios avaliados."
              className={textareaClass}
            />
          </Section>

          <Section titulo="4. Avaliação, performance e considerações finais">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
              <div className="sm:col-span-12">
                <textarea
                  value={avaliacao}
                  onChange={(e) => setAvaliacao(e.target.value)}
                  rows={5}
                  maxLength={8000}
                  disabled={saving}
                  placeholder="Resultado da avaliação do material durante o teste — performance, ocorrências e considerações finais."
                  className={textareaClass}
                />
              </div>
              <Field
                label="Controle de qualidade (analistas)"
                className="sm:col-span-6"
              >
                <Input
                  value={analisadoPor}
                  onChange={(e) => setAnalisadoPor(e.target.value)}
                  placeholder="Analista(s) responsável(is) pela análise"
                  maxLength={200}
                  disabled={saving}
                />
              </Field>
              <Field label="Homologação inicial" className="sm:col-span-3">
                <select
                  className={selectClass}
                  value={homologacao}
                  onChange={(e) =>
                    setHomologacao(e.target.value as '' | HomologacaoResultado)
                  }
                  disabled={saving}
                >
                  <option value="">Selecione…</option>
                  {(
                    Object.keys(HOMOLOGACAO_LABELS) as HomologacaoResultado[]
                  ).map((h) => (
                    <option key={h} value={h}>
                      {HOMOLOGACAO_LABELS[h]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Data da homologação inicial" className="sm:col-span-3">
                <Input
                  type="date"
                  value={homologacaoData}
                  onChange={(e) => setHomologacaoData(e.target.value)}
                  disabled={saving || !homologacao}
                />
              </Field>
            </div>
            <p className="text-xs text-neutral-500">
              A homologação inicial é obrigatória antes do envio para
              assinatura. A homologação <b>final</b> é registrada depois, no
              painel do RHE — mesmo com o documento já encerrado.
            </p>
          </Section>

          <Section titulo="5. Representantes técnicos do fornecedor">
            <p className="text-xs text-neutral-500">
              O fornecedor não tem devolução: os representantes abaixo (até{' '}
              {MAX_REPRESENTANTES}) recebem o link de assinatura por e-mail e
              assinam o documento junto com os aprovadores internos.
            </p>
            {temAssinatura && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Já há assinaturas coletadas — os representantes não podem mais
                ser alterados.
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              {representantes.map((r, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <Input
                    value={r.nome}
                    onChange={(e) =>
                      setRepresentantes(
                        representantes.map((x, i) =>
                          i === idx ? { ...x, nome: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder={`Representante ${idx + 1} — nome`}
                    maxLength={160}
                    disabled={saving || temAssinatura}
                  />
                  <Input
                    type="email"
                    value={r.email}
                    onChange={(e) =>
                      setRepresentantes(
                        representantes.map((x, i) =>
                          i === idx ? { ...x, email: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="E-mail"
                    maxLength={160}
                    disabled={saving || temAssinatura}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setRepresentantes(
                        representantes.length === 1
                          ? [{ nome: '', email: '' }]
                          : representantes.filter((_, i) => i !== idx),
                      )
                    }
                    disabled={saving || temAssinatura}
                    aria-label={`Remover representante ${idx + 1}`}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit gap-1.5"
              onClick={() =>
                representantes.length < MAX_REPRESENTANTES &&
                setRepresentantes([...representantes, { nome: '', email: '' }])
              }
              disabled={
                saving || temAssinatura || representantes.length >= MAX_REPRESENTANTES
              }
            >
              <Plus className="h-4 w-4" />
              Adicionar representante
            </Button>
          </Section>

          {savedRhe ? (
            <Section titulo="6. Fotos da homologação">
              <RncFotosSection rncId={savedRhe.id} />
            </Section>
          ) : (
            <p className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
              Salve o RHE para anexar as fotos da homologação — elas são
              obrigatórias para o envio à assinatura.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-neutral-100 px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
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
            {savedRhe ? 'Salvar alterações' : 'Salvar RHE'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
