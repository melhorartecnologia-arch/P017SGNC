import * as React from 'react'
import { Loader2, MapPin, Plus, Trash2 } from 'lucide-react'
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
import { rvtApi, type Rvt, type RvtCreateInput } from '@/lib/api/rvt'
import { FornecedorCombobox } from './FornecedorCombobox'
import { ProdutoCombobox } from './ProdutoCombobox'
import { RncFotosSection } from './RncFotosSection'

/**
 * Formulário do RVT — Relatório de Visita Técnica. As seções do modelo:
 * fornecedor/produto/data, pauta e participantes (até 5), fotos,
 * assuntos abordados e conclusão.
 */

type Props = {
  open: boolean
  onOpenChange: (next: boolean) => void
  /** Quando informado, o formulário entra em modo edição (PATCH). */
  initial?: Rvt | null
  onCreated?: (rvt: Rvt) => void
  onUpdated?: (rvt: Rvt) => void
}

const selectClass =
  'flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900 disabled:cursor-not-allowed disabled:opacity-50'

const MAX_PARTICIPANTES = 5

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

export function RvtWizard({ open, onOpenChange, initial, onCreated, onUpdated }: Props) {
  const [filiais, setFiliais] = React.useState<Filial[]>([])

  const [filialId, setFilialId] = React.useState('')
  const [fornecedor, setFornecedor] = React.useState<Fornecedor | null>(null)
  const [produto, setProduto] = React.useState<Produto | null>(null)
  const [data, setData] = React.useState(todayISO())
  const [pauta, setPauta] = React.useState('')
  const [participantes, setParticipantes] = React.useState<string[]>([''])
  const [assuntos, setAssuntos] = React.useState('')
  const [conclusao, setConclusao] = React.useState('')

  const [savedRvt, setSavedRvt] = React.useState<Rvt | null>(initial ?? null)
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
      setPauta('')
      setParticipantes([''])
      setAssuntos('')
      setConclusao('')
      setSavedRvt(null)
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
      setPauta(initial.pauta ?? '')
      setParticipantes(
        initial.participantes.length > 0
          ? initial.participantes.map((p) => p.nome)
          : [''],
      )
      setAssuntos(initial.assuntosAbordados ?? '')
      setConclusao(initial.conclusao ?? '')
      setSavedRvt(initial)
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

  const participantesPreenchidos = participantes.filter((p) => p.trim() !== '')

  const camposValidos =
    !!filialId &&
    !!fornecedor &&
    !!produto &&
    pauta.trim() !== '' &&
    participantesPreenchidos.length > 0 &&
    assuntos.trim() !== '' &&
    conclusao.trim() !== ''

  const montarPayload = (status: 'DRAFT' | 'OPEN'): RvtCreateInput => ({
    filialId,
    fornecedorId: fornecedor?.id ?? '',
    produtoId: produto?.id ?? '',
    dataIdentificacao: data,
    status,
    pauta: pauta.trim(),
    participantes: participantesPreenchidos.map((nome) => ({ nome: nome.trim() })),
    assuntosAbordados: assuntos.trim(),
    conclusao: conclusao.trim(),
  })

  const salvar = async (status: 'DRAFT' | 'OPEN') => {
    if (salvandoRef.current) return
    salvandoRef.current = true
    setSaving(true)
    setError(null)
    try {
      const payload = montarPayload(status)
      let salvo: Rvt
      if (savedRvt) {
        salvo = await rvtApi.update(savedRvt.id, payload)
        onUpdated?.(salvo)
        toast.success(`RVT ${salvo.numero} atualizado`)
      } else {
        salvo = await rvtApi.create(payload)
        onCreated?.(salvo)
        toast.success(`RVT ${salvo.numero} criado`, {
          description: 'Agora anexe as fotos da visita técnica.',
        })
      }
      setSavedRvt(salvo)
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Não foi possível salvar o RVT.'
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
        className="flex max-h-[92vh] w-[min(96vw,820px)] max-w-none flex-col overflow-hidden p-0"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="border-b border-neutral-100 px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-neutral-600" />
            {savedRvt ? `RVT ${savedRvt.numero}` : 'Novo Relatório de Visita Técnica'}
          </DialogTitle>
          <DialogDescription>
            Registro da visita técnica — assinado pelos aprovadores do tipo
            RVT e enviado por e-mail ao fornecedor.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <Section titulo="1. Dados do fornecedor e produto">
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
              <Field label="Data da visita" required className="sm:col-span-3">
                <Input
                  type="date"
                  value={data}
                  max={todayISO()}
                  onChange={(e) => setData(e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Fornecedor" required className="sm:col-span-7">
                <FornecedorCombobox value={fornecedor} onChange={setFornecedor} />
              </Field>
              <Field label="Produto" required className="sm:col-span-5">
                <ProdutoCombobox value={produto} onChange={setProduto} />
              </Field>
            </div>
          </Section>

          <Section titulo="2. Informações gerais da visita técnica">
            <div className="grid grid-cols-1 gap-3">
              <Field label="Pauta" required>
                <Input
                  value={pauta}
                  onChange={(e) => setPauta(e.target.value)}
                  placeholder="Ex.: Acompanhamento do plano de ação do lote L998 e auditoria da linha 2"
                  maxLength={200}
                  disabled={saving}
                />
              </Field>
              <div className="flex flex-col gap-1.5">
                <Label>
                  Participantes<span className="ml-0.5 text-red-600">*</span>
                  <span className="ml-2 text-xs font-normal text-neutral-500">
                    (até {MAX_PARTICIPANTES}, como no formulário)
                  </span>
                </Label>
                <div className="flex flex-col gap-1.5">
                  {participantes.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <Input
                        value={p}
                        onChange={(e) =>
                          setParticipantes(
                            participantes.map((x, i) =>
                              i === idx ? e.target.value : x,
                            ),
                          )
                        }
                        placeholder={`Participante ${idx + 1} — nome e empresa/área`}
                        maxLength={160}
                        disabled={saving}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setParticipantes(
                            participantes.length === 1
                              ? ['']
                              : participantes.filter((_, i) => i !== idx),
                          )
                        }
                        disabled={saving}
                        aria-label={`Remover participante ${idx + 1}`}
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
                  onClick={() =>
                    participantes.length < MAX_PARTICIPANTES &&
                    setParticipantes([...participantes, ''])
                  }
                  disabled={saving || participantes.length >= MAX_PARTICIPANTES}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar participante
                </Button>
              </div>
            </div>
          </Section>

          <Section titulo="3. Assuntos abordados">
            <textarea
              value={assuntos}
              onChange={(e) => setAssuntos(e.target.value)}
              rows={5}
              maxLength={8000}
              disabled={saving}
              placeholder="Descreva os assuntos tratados durante a visita técnica."
              className="flex w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900"
            />
          </Section>

          <Section titulo="4. Conclusão">
            <textarea
              value={conclusao}
              onChange={(e) => setConclusao(e.target.value)}
              rows={4}
              maxLength={8000}
              disabled={saving}
              placeholder="Conclusão da visita: o que ficou definido, prazos e responsáveis."
              className="flex w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900"
            />
          </Section>

          {savedRvt ? (
            <Section titulo="5. Fotos da visita técnica">
              <RncFotosSection rncId={savedRvt.id} />
            </Section>
          ) : (
            <p className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
              Salve o RVT para anexar as fotos da visita — elas são
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
            {savedRvt ? 'Salvar alterações' : 'Salvar RVT'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
