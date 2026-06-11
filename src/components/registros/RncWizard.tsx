import * as React from 'react'
import { Loader2, FileWarning, ChevronRight, ChevronLeft, Check } from 'lucide-react'
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
import { filiaisApi, type Filial } from '@/lib/api/filiais'
import {
  tiposNaoConformidadeApi,
  type TipoNaoConformidade,
} from '@/lib/api/tipos-nao-conformidade'
import {
  turnosTrabalhoApi,
  type TurnoTrabalho,
} from '@/lib/api/turnos-trabalho'
import type { Fornecedor } from '@/lib/api/fornecedores'
import { disposicoesApi, type Disposicao } from '@/lib/api/disposicoes'
import { origensApi, type Origem } from '@/lib/api/origens'
import { severidadesApi, type Severidade } from '@/lib/api/severidades'
import type { Produto } from '@/lib/api/produtos'
import { rncApi, type Rnc } from '@/lib/api/rnc'
import { useAuth } from '@/lib/auth/AuthContext'
import { FornecedorCombobox } from './FornecedorCombobox'
import { ProdutoCombobox } from './ProdutoCombobox'
import { RncFotosSection } from './RncFotosSection'

type Props = {
  open: boolean
  onOpenChange: (next: boolean) => void
  /** Quando informado, o wizard entra em modo edição (PATCH). */
  initial?: Rnc | null
  onCreated?: (rnc: Rnc) => void
  onUpdated?: (rnc: Rnc) => void
}

type Step = 1 | 2 | 3 | 4 | 5

const selectClass =
  'flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900 disabled:cursor-not-allowed disabled:opacity-50'

function todayISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatDataBR(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function RncWizard({
  open,
  onOpenChange,
  initial,
  onCreated,
  onUpdated,
}: Props) {
  const editing = !!initial
  const auth = useAuth()
  const filialPadraoId =
    auth.status === 'authenticated' ? auth.user.filialPadraoId : null
  const [step, setStep] = React.useState<Step>(1)
  // Sub-etapas da etapa 3 (Material & transporte), para o conteúdo caber
  // no modal sem barra de rolagem: 1 = Material & lote, 2 = Notas
  // fiscais & datas, 3 = Transporte.
  const [subStep3, setSubStep3] = React.useState<1 | 2 | 3>(1)

  // Step 1 — dados básicos
  const [filiais, setFiliais] = React.useState<Filial[]>([])
  const [tipos, setTipos] = React.useState<TipoNaoConformidade[]>([])
  const [turnos, setTurnos] = React.useState<TurnoTrabalho[]>([])
  const [filialId, setFilialId] = React.useState('')
  const [data, setData] = React.useState(todayISO())
  const [tipoId, setTipoId] = React.useState('')
  const [turnoId, setTurnoId] = React.useState('')

  // Step 2 — fornecedor + últimas similares
  const [fornecedor, setFornecedor] = React.useState<Fornecedor | null>(null)
  const [ultimas, setUltimas] = React.useState<Rnc[] | null>(null)
  const [loadingUltimas, setLoadingUltimas] = React.useState(false)

  // Step 3 — material, lote, NF e transporte
  const [produto, setProduto] = React.useState<Produto | null>(null)
  const [lotes, setLotes] = React.useState<
    { numero: string; quantidade: string }[]
  >([])
  const [quantidadeDefeito, setQuantidadeDefeito] = React.useState('')
  const [tempoParadaMinutos, setTempoParadaMinutos] = React.useState('')
  const [notasFiscais, setNotasFiscais] = React.useState<
    {
      numero: string
      dataFabricacao: string
      dataValidade: string
      dataRecebimento: string
    }[]
  >([])
  const [transportador, setTransportador] = React.useState('')
  const [placaCavalo, setPlacaCavalo] = React.useState('')
  const [placaCarreta, setPlacaCarreta] = React.useState('')
  const [nomeMotorista, setNomeMotorista] = React.useState('')
  const [cnhMotorista, setCnhMotorista] = React.useState('')

  // Step 4 — disposição, origem, severidade e descrição do defeito
  const [disposicoes, setDisposicoes] = React.useState<Disposicao[]>([])
  const [origens, setOrigens] = React.useState<Origem[]>([])
  const [severidades, setSeveridades] = React.useState<Severidade[]>([])
  const [disposicaoId, setDisposicaoId] = React.useState('')
  const [origemId, setOrigemId] = React.useState('')
  const [severidadeId, setSeveridadeId] = React.useState('')
  const [descricaoDefeito, setDescricaoDefeito] = React.useState('')

  // RNC salvo no banco (já criado ou em edição). Necessário para a step
  // 4 (fotos), que precisa do id para fazer upload.
  const [savedRnc, setSavedRnc] = React.useState<Rnc | null>(initial ?? null)

  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Ao abrir/fechar: reseta ou popula a partir do `initial`.
  React.useEffect(() => {
    if (!open) {
      setStep(1)
      setSubStep3(1)
      setFilialId('')
      setData(todayISO())
      setTipoId('')
      setTurnoId('')
      setFornecedor(null)
      setUltimas(null)
      setDisposicaoId('')
      setOrigemId('')
      setSeveridadeId('')
      setDescricaoDefeito('')
      setProduto(null)
      setLotes([])
      setQuantidadeDefeito('')
      setTempoParadaMinutos('')
      setNotasFiscais([])
      setTransportador('')
      setPlacaCavalo('')
      setPlacaCarreta('')
      setNomeMotorista('')
      setCnhMotorista('')
      setSavedRnc(null)
      setError(null)
      return
    }
    if (initial) {
      setStep(1)
      setSubStep3(1)
      setFilialId(initial.filialId)
      setData(initial.dataIdentificacao.slice(0, 10))
      setTipoId(initial.tipoNaoConformidadeId)
      setTurnoId(initial.turnoId ?? '')
      // O combobox aceita um Fornecedor "parcial" baseado no que o RNC traz.
      setFornecedor({
        id: initial.fornecedor.id,
        codigo: initial.fornecedor.codigo,
        razaoSocial: initial.fornecedor.razaoSocial,
        nomeFantasia: null,
        cnpj: initial.fornecedor.cnpj,
        ativo: true,
        observacoes: null,
        contatos: [],
        createdAt: '',
        updatedAt: '',
      })
      setUltimas(null)
      setDisposicaoId(initial.disposicaoMaterialId ?? '')
      setOrigemId(initial.origemId ?? '')
      setSeveridadeId(initial.severidadeId ?? '')
      setDescricaoDefeito(initial.descricaoDefeito ?? '')
      // produto vem como ref — produz um Produto "parcial" suficiente para
      // o combobox.
      setProduto(
        initial.produto
          ? {
              id: initial.produto.id,
              codigo: initial.produto.codigo,
              descricao: initial.produto.descricao,
              unidadeMedida: initial.produto.unidadeMedida,
              ativo: true,
              createdAt: '',
              updatedAt: '',
            }
          : null,
      )
      setLotes(
        initial.lotes?.map((l) => ({
          numero: l.numero,
          quantidade: l.quantidade != null ? String(l.quantidade) : '',
        })) ?? [],
      )
      setQuantidadeDefeito(
        initial.quantidadeDefeito != null
          ? String(initial.quantidadeDefeito)
          : '',
      )
      setTempoParadaMinutos(
        initial.tempoParadaMinutos != null
          ? String(initial.tempoParadaMinutos)
          : '',
      )
      setNotasFiscais(
        initial.notasFiscais?.map((n) => ({
          numero: n.numero ?? '',
          dataFabricacao: n.dataFabricacao?.slice(0, 10) ?? '',
          dataValidade: n.dataValidade?.slice(0, 10) ?? '',
          dataRecebimento: n.dataRecebimento?.slice(0, 10) ?? '',
        })) ?? [],
      )
      setTransportador(initial.transportador ?? '')
      setPlacaCavalo(initial.placaCavalo ?? '')
      setPlacaCarreta(initial.placaCarreta ?? '')
      setNomeMotorista(initial.nomeMotorista ?? '')
      setCnhMotorista(initial.cnhMotorista ?? '')
      setSavedRnc(initial)
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id])

  // Lookups iniciais — só quando o modal abre.
  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    Promise.all([
      filiaisApi.list({ ativo: true, pageSize: 100 }),
      tiposNaoConformidadeApi.list({ ativo: true, pageSize: 100 }),
      disposicoesApi.list({ ativo: true, pageSize: 100 }),
      origensApi.list({ ativo: true, pageSize: 100 }),
      severidadesApi.list({ ativo: true, pageSize: 100 }),
    ])
      .then(([f, t, d, o, s]) => {
        if (cancelled) return
        setFiliais(f.items)
        setTipos(t.items)
        setDisposicoes(d.items)
        setOrigens(o.items)
        setSeveridades(s.items)
        // Ao criar, pré-seleciona a filial padrão do cadastro do usuário —
        // somente se ela estiver entre as filiais ativas e nada tiver sido
        // escolhido ainda. Em edição, a filial do RNC prevalece.
        if (
          !initial &&
          filialPadraoId &&
          f.items.some((x) => x.id === filialPadraoId)
        ) {
          setFilialId((cur) => cur || filialPadraoId)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Turnos da filial selecionada.
  React.useEffect(() => {
    if (!filialId) {
      setTurnos([])
      setTurnoId('')
      return
    }
    let cancelled = false
    turnosTrabalhoApi
      .list({ ativo: true, filialId, pageSize: 100 })
      .then((res) => {
        if (cancelled) return
        setTurnos(res.items)
        if (turnoId && !res.items.some((t) => t.id === turnoId)) {
          setTurnoId('')
        }
      })
      .catch(() => {
        if (!cancelled) setTurnos([])
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filialId])

  // Step 2: ao escolher fornecedor (e já temos tipoId), busca as últimas 3.
  React.useEffect(() => {
    if (step !== 2) return
    if (!fornecedor || !tipoId) {
      setUltimas(null)
      return
    }
    let cancelled = false
    setLoadingUltimas(true)
    rncApi
      .list({
        fornecedorId: fornecedor.id,
        tipoNaoConformidadeId: tipoId,
        limit: 3,
      })
      .then((res) => {
        if (!cancelled) setUltimas(res.items)
      })
      .catch(() => {
        if (!cancelled) setUltimas([])
      })
      .finally(() => {
        if (!cancelled) setLoadingUltimas(false)
      })
    return () => {
      cancelled = true
    }
  }, [step, fornecedor, tipoId])

  const tipoSelecionado = tipos.find((t) => t.id === tipoId) ?? null
  const filialSelecionada = filiais.find((f) => f.id === filialId) ?? null
  const turnoSelecionado = turnos.find((t) => t.id === turnoId) ?? null

  const lotesPreenchidos = React.useMemo(
    () => lotes.filter((l) => l.numero.trim() !== ''),
    [lotes],
  )
  // Lotes duplicados: comparação sem distinção de maiúsculas/minúsculas
  // ("L123" e "l123" são o mesmo lote).
  const numerosDeLote = lotesPreenchidos.map((l) =>
    l.numero.trim().toUpperCase(),
  )
  const lotesDuplicados =
    new Set(numerosDeLote).size !== numerosDeLote.length
  const totalLote = lotes.reduce((acc, l) => {
    const n = parseFloat(l.quantidade)
    return acc + (Number.isFinite(n) ? n : 0)
  }, 0)

  // Quantidade de lote, quando informada, deve ser maior que zero.
  const loteQtdInvalida = (quantidade: string) => {
    if (quantidade.trim() === '') return false
    const n = parseFloat(quantidade)
    return !Number.isFinite(n) || n <= 0
  }
  const lotesComQtdInvalida = lotes.some((l) => loteQtdInvalida(l.quantidade))

  // Qtd. com defeito: quando informada, deve ser > 0 e não pode exceder o
  // total dos lotes (quando houver quantidades informadas nos lotes).
  const qtdDefeitoNum = parseFloat(quantidadeDefeito)
  const qtdDefeitoInformada =
    quantidadeDefeito.trim() !== '' && Number.isFinite(qtdDefeitoNum)
  const qtdDefeitoZero = qtdDefeitoInformada && qtdDefeitoNum <= 0
  const qtdDefeitoExcede =
    qtdDefeitoInformada &&
    qtdDefeitoNum > 0 &&
    totalLote > 0 &&
    qtdDefeitoNum > totalLote
  const qtdDefeitoInvalida = qtdDefeitoZero || qtdDefeitoExcede

  // Notas fiscais: cada nota exige um número (datas são opcionais). Uma
  // linha que tem datas mas está sem número é inválida; números repetidos
  // (sem distinção de caixa) também não são permitidos.
  const notaSemNumero = (n: {
    numero: string
    dataFabricacao: string
    dataValidade: string
    dataRecebimento: string
  }) =>
    n.numero.trim() === '' &&
    (n.dataFabricacao !== '' ||
      n.dataValidade !== '' ||
      n.dataRecebimento !== '')
  const numerosNota = notasFiscais
    .filter((n) => n.numero.trim() !== '')
    .map((n) => n.numero.trim().toUpperCase())
  const notasDuplicadas =
    new Set(numerosNota).size !== numerosNota.length
  // Ao menos uma nota fiscal (com número) é obrigatória.
  const semNotaFiscal = numerosNota.length === 0
  const notasInvalidas = notasFiscais.some(notaSemNumero) || notasDuplicadas

  // Data de identificação não pode ser futura. Comparação por string
  // YYYY-MM-DD (mesmo formato de todayISO) é suficiente no cliente; a
  // validação definitiva é feita no servidor com o relógio dele.
  const dataFutura = !!data && data > todayISO()
  const step1Valid = filialId && data && !dataFutura && tipoId && turnoId
  const step2Valid = !!fornecedor
  // Validade por sub-etapa da etapa 3. Transporte é todo opcional.
  const materialValid =
    !!produto &&
    lotesPreenchidos.length > 0 &&
    !lotesDuplicados &&
    !lotesComQtdInvalida &&
    qtdDefeitoInformada &&
    !qtdDefeitoInvalida
  const notasValid = !semNotaFiscal && !notasInvalidas
  const step3Valid = materialValid && notasValid
  const subStep3Valid =
    subStep3 === 1 ? materialValid : subStep3 === 2 ? notasValid : step3Valid
  const stepFinalValid = step1Valid && step2Valid && step3Valid

  const addLoteRow = () => {
    if (lotes.length >= 50) return
    setLotes([...lotes, { numero: '', quantidade: '' }])
  }
  const updateLoteRow = (
    idx: number,
    patch: Partial<{ numero: string; quantidade: string }>,
  ) => {
    setLotes(lotes.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }
  const removeLoteRow = (idx: number) => {
    setLotes(lotes.filter((_, i) => i !== idx))
  }

  const addNotaRow = () => {
    if (notasFiscais.length >= 50) return
    setNotasFiscais([
      ...notasFiscais,
      { numero: '', dataFabricacao: '', dataValidade: '', dataRecebimento: '' },
    ])
  }
  const updateNotaRow = (
    idx: number,
    patch: Partial<{
      numero: string
      dataFabricacao: string
      dataValidade: string
      dataRecebimento: string
    }>,
  ) => {
    setNotasFiscais(
      notasFiscais.map((n, i) => (i === idx ? { ...n, ...patch } : n)),
    )
  }
  const removeNotaRow = (idx: number) => {
    setNotasFiscais(notasFiscais.filter((_, i) => i !== idx))
  }

  const persistRnc = async () => {
    if (!stepFinalValid || !filialId || !tipoId) return null
    const parseOptNum = (v: string) => {
      const t = v.trim()
      if (!t) return null
      const n = Number(t)
      return Number.isFinite(n) ? n : null
    }
    const isoOrNull = (v: string) =>
      v.trim() ? new Date(`${v}T00:00:00`).toISOString() : null
    const payload = {
      filialId,
      fornecedorId: fornecedor!.id,
      tipoNaoConformidadeId: tipoId,
      turnoId,
      disposicaoMaterialId: disposicaoId || null,
      origemId: origemId || null,
      severidadeId: severidadeId || null,
      descricaoDefeito: descricaoDefeito.trim() || null,
      dataIdentificacao: new Date(`${data}T00:00:00`).toISOString(),

      produtoId: produto!.id,
      lotes: lotesPreenchidos.map((l) => ({
        numero: l.numero.trim(),
        quantidade: parseOptNum(l.quantidade),
      })),
      quantidadeDefeito: parseOptNum(quantidadeDefeito),
      tempoParadaMinutos: parseOptNum(tempoParadaMinutos),

      notasFiscais: notasFiscais
        .filter((n) => n.numero.trim() !== '')
        .map((n) => ({
          numero: n.numero.trim(),
          dataFabricacao: isoOrNull(n.dataFabricacao),
          dataValidade: isoOrNull(n.dataValidade),
          dataRecebimento: isoOrNull(n.dataRecebimento),
        })),

      transportador: transportador.trim() || null,
      placaCavalo: placaCavalo.trim().toUpperCase() || null,
      placaCarreta: placaCarreta.trim().toUpperCase() || null,
      nomeMotorista: nomeMotorista.trim() || null,
      cnhMotorista: cnhMotorista.trim() || null,
    }
    if (savedRnc) {
      const updated = await rncApi.update(savedRnc.id, payload)
      setSavedRnc(updated)
      onUpdated?.(updated)
      return updated
    }
    const created = await rncApi.create({ ...payload, status: 'DRAFT' })
    setSavedRnc(created)
    onCreated?.(created)
    return created
  }

  const goNext = async () => {
    setError(null)
    if (step === 1 && step1Valid) {
      setStep(2)
      return
    }
    if (step === 2 && step2Valid) {
      setStep(3)
      setSubStep3(1)
      return
    }
    if (step === 3) {
      // Avança pelas sub-etapas; só sai da etapa 3 a partir da última.
      if (subStep3 === 1 && materialValid) {
        // Notas fiscais são obrigatórias: ao entrar na sub-etapa, já abre
        // uma linha em branco para preencher (evita o estado vazio).
        if (notasFiscais.length === 0) {
          setNotasFiscais([
            {
              numero: '',
              dataFabricacao: '',
              dataValidade: '',
              dataRecebimento: '',
            },
          ])
        }
        setSubStep3(2)
        return
      }
      if (subStep3 === 2 && notasValid) {
        setSubStep3(3)
        return
      }
      if (subStep3 === 3 && step3Valid) {
        setStep(4)
      }
      return
    }
    if (step === 4 && stepFinalValid) {
      setSaving(true)
      try {
        const persisted = await persistRnc()
        if (persisted) {
          toast.success(
            savedRnc ? 'Alterações salvas' : 'Rascunho do RNC salvo',
            { description: `Nº ${persisted.numero}` },
          )
          setStep(5)
        }
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Falha ao salvar.'
        setError(message)
        toast.error('Não foi possível salvar', { description: message })
      } finally {
        setSaving(false)
      }
    }
  }

  const goBack = () => {
    setError(null)
    if (step === 2) setStep(1)
    else if (step === 3) {
      if (subStep3 > 1) setSubStep3((subStep3 - 1) as 1 | 2)
      else setStep(2)
    } else if (step === 4) {
      setStep(3)
      setSubStep3(3)
    } else if (step === 5) setStep(4)
  }

  const handleConcluir = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="w-[85vw] max-w-[85vw] sm:max-w-[85vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileWarning className="h-5 w-5 text-neutral-500" />
            {editing
              ? `Editar RNC #${initial!.numero}`
              : 'Novo Relatório de Não Conformidade (RNC)'}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? 'Ajuste os dados em etapas. O status atual do RNC é preservado.'
              : 'Preencha as informações em 4 etapas. O rascunho é salvo automaticamente ao avançar para a etapa de fotos.'}
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-xs">
          <StepBadge active={step === 1} done={step > 1} index={1} label="Identificação" />
          <ChevronRight className="h-3 w-3 text-neutral-400" />
          <StepBadge active={step === 2} done={step > 2} index={2} label="Fornecedor & histórico" />
          <ChevronRight className="h-3 w-3 text-neutral-400" />
          <StepBadge active={step === 3} done={step > 3} index={3} label="Material & transporte" />
          <ChevronRight className="h-3 w-3 text-neutral-400" />
          <StepBadge active={step === 4} done={step > 4} index={4} label="Disposição & defeito" />
          <ChevronRight className="h-3 w-3 text-neutral-400" />
          <StepBadge active={step === 5} done={false} index={5} label="Fotos" />
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {step === 1 && (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-12">
            <Field label="Unidade (filial) *" className="sm:col-span-7">
              <select
                className={cn(selectClass)}
                value={filialId}
                onChange={(e) => setFilialId(e.target.value)}
                required
              >
                <option value="" disabled>
                  Selecione a filial onde foi identificada
                </option>
                {filiais.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.codigo} — {f.nome}
                  </option>
                ))}
              </select>
              {!editing && !!filialId && filialId === filialPadraoId && (
                <span className="text-xs text-neutral-500">
                  Filial padrão do seu cadastro — altere se necessário.
                </span>
              )}
            </Field>
            <Field label="Data da identificação *" className="sm:col-span-5">
              <Input
                type="date"
                value={data}
                max={todayISO()}
                onChange={(e) => setData(e.target.value)}
                required
              />
              {dataFutura && (
                <span className="text-xs text-red-600">
                  A data de identificação não pode ser futura.
                </span>
              )}
            </Field>
            <Field label="Tipo da não conformidade *" className="sm:col-span-12">
              <select
                className={cn(selectClass)}
                value={tipoId}
                onChange={(e) => {
                  const novoTipoId = e.target.value
                  setTipoId(novoTipoId)
                  // Preenche a severidade com a padrão do tipo escolhido
                  // (cadastro de Tipos de NC). Pode ser alterada na etapa 4.
                  const tipo = tipos.find((t) => t.id === novoTipoId)
                  setSeveridadeId(tipo?.severidade?.id ?? '')
                }}
                required
              >
                <option value="" disabled>
                  Selecione o tipo
                </option>
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.codigo} — {t.descricao}
                  </option>
                ))}
              </select>
              {tipoSelecionado?.severidade && (
                <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[11px] font-medium text-neutral-700">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full border border-neutral-200"
                    style={{ backgroundColor: tipoSelecionado.severidade.cor ?? '#a3a3a3' }}
                  />
                  Severidade típica: nível {tipoSelecionado.severidade.nivel} —{' '}
                  {tipoSelecionado.severidade.nome}
                </span>
              )}
            </Field>
            <Field label="Turno de trabalho" required className="sm:col-span-12">
              <select
                className={cn(selectClass)}
                value={turnoId}
                onChange={(e) => setTurnoId(e.target.value)}
                disabled={!filialId}
              >
                <option value="">
                  {filialId
                    ? 'Selecione um turno'
                    : 'Selecione a filial primeiro'}
                </option>
                {turnos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.codigo} — {t.nome} ({t.horaInicio}–{t.horaFim})
                  </option>
                ))}
              </select>
              {filialId && turnos.length === 0 && (
                <span className="text-xs text-red-600">
                  Esta filial não tem turnos cadastrados — cadastre um turno
                  antes de prosseguir.
                </span>
              )}
            </Field>
          </section>
        )}

        {step === 2 && (
          <section className="flex flex-col gap-4">
            {/* Resumo dos dados da Step 1 */}
            <div className="rounded-md border border-neutral-200 bg-neutral-50/60 p-3 text-xs text-neutral-700">
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <span>
                  <b className="text-neutral-500">Unidade:</b>{' '}
                  {filialSelecionada
                    ? `${filialSelecionada.codigo} — ${filialSelecionada.nome}`
                    : '—'}
                </span>
                <span>
                  <b className="text-neutral-500">Data:</b> {formatDataBR(data)}
                </span>
                <span>
                  <b className="text-neutral-500">Tipo NC:</b>{' '}
                  {tipoSelecionado
                    ? `${tipoSelecionado.codigo} — ${tipoSelecionado.descricao}`
                    : '—'}
                </span>
                {turnoSelecionado && (
                  <span>
                    <b className="text-neutral-500">Turno:</b>{' '}
                    {turnoSelecionado.codigo} — {turnoSelecionado.nome}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Fornecedor *</Label>
              <FornecedorCombobox value={fornecedor} onChange={setFornecedor} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Últimas RNCs com este fornecedor e tipo</Label>
              {!fornecedor ? (
                <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-3 py-3 text-xs text-neutral-500">
                  Selecione um fornecedor para ver o histórico.
                </div>
              ) : loadingUltimas ? (
                <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-3 text-xs text-neutral-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Buscando últimas RNCs…
                </div>
              ) : ultimas && ultimas.length === 0 ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs text-emerald-800">
                  Nenhuma RNC anterior deste fornecedor para este tipo de não
                  conformidade. Seria a primeira ocorrência.
                </div>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {ultimas?.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-md border border-neutral-200 bg-white p-2 text-xs"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-mono font-medium text-neutral-900">
                          RNC #{r.numero}
                        </span>
                        <span className="text-neutral-500">
                          {formatDataBR(r.dataIdentificacao)} · {r.filial.codigo}
                        </span>
                      </div>
                      <div className="mt-0.5 text-neutral-600">
                        {r.tipoNaoConformidade.codigo} — {r.tipoNaoConformidade.descricao}
                      </div>
                      <div className="mt-0.5 text-neutral-500">
                        Status:{' '}
                        <span className="font-medium text-neutral-700">
                          {r.status}
                        </span>{' '}
                        · Criado por {r.criadoPor.nome}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="flex flex-col gap-4">
            {/* Mini-stepper das sub-etapas da etapa 3 */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <SubStepBadge
                active={subStep3 === 1}
                done={subStep3 > 1}
                label="Material & lote"
              />
              <ChevronRight className="h-3 w-3 text-neutral-300" />
              <SubStepBadge
                active={subStep3 === 2}
                done={subStep3 > 2}
                label="Notas fiscais & datas"
              />
              <ChevronRight className="h-3 w-3 text-neutral-300" />
              <SubStepBadge
                active={subStep3 === 3}
                done={false}
                label="Transporte"
              />
            </div>

            {subStep3 === 1 && (
            <Section title="Material & lote">
              <Field label="Produto" required>
                <ProdutoCombobox
                  value={produto}
                  onChange={setProduto}
                  disabled={saving}
                />
              </Field>

              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <Label>
                    Lotes<span className="ml-0.5 text-red-600">*</span>
                    <span className="ml-2 text-xs font-normal text-neutral-500">
                      (informe a quantidade de cada lote)
                    </span>
                  </Label>
                  {lotesPreenchidos.length > 0 && (
                    <span className="text-xs text-neutral-600">
                      Total dos lotes:{' '}
                      <b className="tabular-nums">
                        {totalLote.toLocaleString('pt-BR')}
                      </b>
                      {produto ? ` ${produto.unidadeMedida}` : ''}
                    </span>
                  )}
                </div>

                {lotes.length === 0 ? (
                  <p className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
                    Nenhum lote informado. Clique em "Adicionar lote" para
                    registrar pelo menos um.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {lotes.map((l, idx) => {
                      // Repete um lote informado em uma linha anterior?
                      // Comparação sem distinção de maiúsculas/minúsculas.
                      const numeroNorm = l.numero.trim().toUpperCase()
                      const numeroDup =
                        numeroNorm !== '' &&
                        lotes.some(
                          (x, i) =>
                            i < idx &&
                            x.numero.trim().toUpperCase() === numeroNorm,
                        )
                      const qtdInvalida = loteQtdInvalida(l.quantidade)
                      return (
                        <div key={idx} className="flex flex-col gap-1">
                          <div className="grid grid-cols-12 items-center gap-2">
                            <Input
                              className={`col-span-7 ${numeroDup ? 'border-red-400' : ''}`}
                              value={l.numero}
                              onChange={(e) =>
                                updateLoteRow(idx, {
                                  numero: e.target.value.toUpperCase(),
                                })
                              }
                              placeholder="Nº do lote (ex.: L2024A123)"
                              maxLength={80}
                              disabled={saving}
                            />
                            <Input
                              className={`col-span-4 ${qtdInvalida ? 'border-red-400' : ''}`}
                              type="number"
                              inputMode="decimal"
                              step="any"
                              min={0}
                              value={l.quantidade}
                              onChange={(e) =>
                                updateLoteRow(idx, { quantidade: e.target.value })
                              }
                              placeholder={
                                produto
                                  ? `Qtd. (${produto.unidadeMedida})`
                                  : 'Qtd.'
                              }
                              disabled={saving}
                            />
                            <button
                              type="button"
                              onClick={() => removeLoteRow(idx)}
                              disabled={saving}
                              aria-label={`Remover lote ${idx + 1}`}
                              className="col-span-1 inline-flex h-9 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 disabled:opacity-50"
                            >
                              ×
                            </button>
                          </div>
                          {numeroDup && (
                            <span className="text-xs text-red-600">
                              Este lote já foi informado nesta RNC.
                            </span>
                          )}
                          {qtdInvalida && (
                            <span className="text-xs text-red-600">
                              A quantidade do lote deve ser maior que zero.
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {lotesDuplicados && (
                  <span className="text-xs text-red-600">
                    Há lotes com o mesmo número — remova ou renomeie as
                    duplicatas.
                  </span>
                )}

                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addLoteRow}
                    disabled={saving || lotes.length >= 50}
                  >
                    + Adicionar lote
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                <Field
                  label={`Qtd. com defeito (total)${produto ? ` — ${produto.unidadeMedida}` : ''}`}
                  required
                  className="sm:col-span-6"
                >
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min={0}
                    value={quantidadeDefeito}
                    onChange={(e) => setQuantidadeDefeito(e.target.value)}
                    placeholder="0"
                    className={qtdDefeitoInvalida ? 'border-red-400' : ''}
                  />
                  {qtdDefeitoZero && (
                    <span className="text-xs text-red-600">
                      A quantidade com defeito deve ser maior que zero.
                    </span>
                  )}
                  {qtdDefeitoExcede && (
                    <span className="text-xs text-red-600">
                      Não pode ser maior que o total dos lotes (
                      {totalLote.toLocaleString('pt-BR')}
                      {produto ? ` ${produto.unidadeMedida}` : ''}).
                    </span>
                  )}
                </Field>
                <Field
                  label="Tempo de parada (minutos)"
                  className="sm:col-span-6"
                >
                  <Input
                    type="number"
                    inputMode="numeric"
                    step={1}
                    min={0}
                    value={tempoParadaMinutos}
                    onChange={(e) => setTempoParadaMinutos(e.target.value)}
                    placeholder="0"
                  />
                </Field>
              </div>
            </Section>
            )}

            {subStep3 === 2 && (
            <Section title="Notas fiscais & datas *">
              <div className="flex flex-col gap-2">
                <span className="text-xs text-neutral-500">
                  Informe ao menos uma nota fiscal. Cada nota tem suas
                  próprias datas de fabricação, validade e recebimento.
                </span>

                {notasFiscais.length === 0 ? (
                  <p className="rounded-md border border-dashed border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    É obrigatório informar ao menos uma nota fiscal. Clique em
                    "Adicionar nota fiscal".
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {notasFiscais.map((n, idx) => {
                      const numeroNorm = n.numero.trim().toUpperCase()
                      const numeroDup =
                        numeroNorm !== '' &&
                        notasFiscais.some(
                          (x, i) =>
                            i < idx &&
                            x.numero.trim().toUpperCase() === numeroNorm,
                        )
                      const semNumero = notaSemNumero(n)
                      return (
                        <div
                          key={idx}
                          className="flex flex-col gap-1.5 rounded-md border border-neutral-200 bg-neutral-50/40 p-2.5"
                        >
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                            <Field
                              label="Nº da NF *"
                              className="sm:col-span-3"
                            >
                              <Input
                                value={n.numero}
                                onChange={(e) =>
                                  updateNotaRow(idx, { numero: e.target.value })
                                }
                                placeholder="123456"
                                maxLength={40}
                                disabled={saving}
                                className={
                                  numeroDup || semNumero ? 'border-red-400' : ''
                                }
                              />
                            </Field>
                            <Field
                              label="Data de fabricação"
                              className="sm:col-span-3"
                            >
                              <Input
                                type="date"
                                value={n.dataFabricacao}
                                onChange={(e) =>
                                  updateNotaRow(idx, {
                                    dataFabricacao: e.target.value,
                                  })
                                }
                                disabled={saving}
                              />
                            </Field>
                            <Field
                              label="Data de validade"
                              className="sm:col-span-3"
                            >
                              <Input
                                type="date"
                                value={n.dataValidade}
                                onChange={(e) =>
                                  updateNotaRow(idx, {
                                    dataValidade: e.target.value,
                                  })
                                }
                                disabled={saving}
                              />
                            </Field>
                            <div className="flex items-end gap-2 sm:col-span-3">
                              <Field
                                label="Data de recebimento"
                                className="flex-1"
                              >
                                <Input
                                  type="date"
                                  value={n.dataRecebimento}
                                  onChange={(e) =>
                                    updateNotaRow(idx, {
                                      dataRecebimento: e.target.value,
                                    })
                                  }
                                  disabled={saving}
                                />
                              </Field>
                              <button
                                type="button"
                                onClick={() => removeNotaRow(idx)}
                                disabled={saving}
                                aria-label={`Remover nota fiscal ${idx + 1}`}
                                className="mb-px inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 disabled:opacity-50"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                          {numeroDup && (
                            <span className="text-xs text-red-600">
                              Esta nota fiscal já foi informada nesta RNC.
                            </span>
                          )}
                          {semNumero && (
                            <span className="text-xs text-red-600">
                              Informe o número da nota fiscal (ou remova a
                              linha).
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addNotaRow}
                    disabled={saving || notasFiscais.length >= 50}
                  >
                    + Adicionar nota fiscal
                  </Button>
                </div>
              </div>
            </Section>
            )}

            {subStep3 === 3 && (
            <Section title="Transporte">
              <Field label="Transportador">
                <Input
                  value={transportador}
                  onChange={(e) => setTransportador(e.target.value)}
                  placeholder="Razão social ou nome do transportador"
                  maxLength={160}
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                <Field label="Placa do cavalo" className="sm:col-span-3">
                  <Input
                    value={placaCavalo}
                    onChange={(e) => setPlacaCavalo(e.target.value.toUpperCase())}
                    placeholder="ABC1D23"
                    maxLength={10}
                    className="font-mono uppercase"
                  />
                </Field>
                <Field label="Placa da carreta" className="sm:col-span-3">
                  <Input
                    value={placaCarreta}
                    onChange={(e) => setPlacaCarreta(e.target.value.toUpperCase())}
                    placeholder="ABC1D23"
                    maxLength={10}
                    className="font-mono uppercase"
                  />
                </Field>
                <Field label="Nome do motorista" className="sm:col-span-4">
                  <Input
                    value={nomeMotorista}
                    onChange={(e) => setNomeMotorista(e.target.value)}
                    placeholder="Nome completo"
                    maxLength={120}
                  />
                </Field>
                <Field label="CNH do motorista" className="sm:col-span-2">
                  <Input
                    value={cnhMotorista}
                    onChange={(e) => setCnhMotorista(e.target.value)}
                    placeholder="00000000000"
                    maxLength={20}
                    className="font-mono"
                  />
                </Field>
              </div>
            </Section>
            )}
          </section>
        )}

        {step === 4 && (
          <section className="flex flex-col gap-4">
            <Section title="Disposição do material">
              <Field label="Disposição">
                <select
                  className={cn(selectClass)}
                  value={disposicaoId}
                  onChange={(e) => setDisposicaoId(e.target.value)}
                >
                  <option value="">(Sem disposição definida)</option>
                  {disposicoes.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.codigo} — {d.descricao}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-neutral-500">
                  Destino dado ao material da não conformidade (retrabalho,
                  sucata, devolução, aceitar sob concessão, etc.).
                </span>
              </Field>
            </Section>

            <Section title="Origem, severidade e descrição do defeito">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Origem da não conformidade">
                  <select
                    className={cn(selectClass)}
                    value={origemId}
                    onChange={(e) => setOrigemId(e.target.value)}
                  >
                    <option value="">(Sem origem definida)</option>
                    {origens.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.codigo} — {o.nome}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Severidade">
                  <select
                    className={cn(selectClass)}
                    value={severidadeId}
                    onChange={(e) => setSeveridadeId(e.target.value)}
                  >
                    <option value="">(Sem severidade definida)</option>
                    {severidades.map((s) => (
                      <option key={s.id} value={s.id}>
                        Nível {s.nivel} — {s.codigo} — {s.nome}
                      </option>
                    ))}
                  </select>
                  {tipoSelecionado?.severidade &&
                    severidadeId === tipoSelecionado.severidade.id && (
                      <span className="text-xs text-neutral-500">
                        Severidade padrão do tipo de não conformidade —
                        altere se necessário.
                      </span>
                    )}
                  {tipoSelecionado?.severidade && !severidadeId && (
                    <span className="text-xs text-neutral-500">
                      Severidade típica do tipo:{' '}
                      <button
                        type="button"
                        onClick={() =>
                          setSeveridadeId(tipoSelecionado.severidade!.id)
                        }
                        className="text-neutral-700 underline-offset-2 hover:underline"
                      >
                        Nível {tipoSelecionado.severidade.nivel} —{' '}
                        {tipoSelecionado.severidade.nome}
                      </button>
                    </span>
                  )}
                </Field>
              </div>
              <Field label="Descrição do defeito / problema identificado">
                <textarea
                  value={descricaoDefeito}
                  onChange={(e) => setDescricaoDefeito(e.target.value)}
                  rows={5}
                  maxLength={4000}
                  placeholder="Descreva o que foi identificado, contexto, evidências observadas, etc."
                  className="flex w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900"
                />
              </Field>
            </Section>
          </section>
        )}

        {step === 5 && (
          <section className="flex flex-col gap-3">
            {savedRnc && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-800">
                RNC <b>Nº {savedRnc.numero}</b> salvo.
                Anexe as fotos que evidenciam o defeito identificado.
              </div>
            )}
            {savedRnc ? (
              <RncFotosSection rncId={savedRnc.id} editable />
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Salve o rascunho na etapa anterior para habilitar o anexo de
                fotos.
              </div>
            )}
          </section>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          <div className="text-xs text-neutral-500">
            Etapa {step} de 5
            {step === 3 && <> · parte {subStep3} de 3</>}
          </div>
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={goBack} disabled={saving}>
                <ChevronLeft className="h-4 w-4" />
                Voltar
              </Button>
            )}
            {step === 1 && (
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
            )}
            {step < 4 && (
              <Button
                onClick={goNext}
                disabled={
                  step === 1
                    ? !step1Valid
                    : step === 2
                      ? !step2Valid
                      : step === 3
                        ? !subStep3Valid
                        : false
                }
              >
                Próxima etapa
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            {step === 4 && (
              <Button onClick={goNext} disabled={!stepFinalValid || saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {savedRnc ? 'Salvar e ir para fotos' : 'Salvar rascunho e adicionar fotos'}
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            {step === 5 && (
              <Button onClick={handleConcluir}>
                <Check className="h-4 w-4" />
                Concluir
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function StepBadge({
  active,
  done,
  index,
  label,
}: {
  active: boolean
  done: boolean
  index: number
  label: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium',
        active
          ? 'bg-neutral-900 text-white'
          : done
            ? 'bg-emerald-100 text-emerald-800'
            : 'bg-white text-neutral-600 border border-neutral-200',
      )}
    >
      <span
        className={cn(
          'inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px]',
          active
            ? 'bg-white text-neutral-900'
            : done
              ? 'bg-emerald-700 text-white'
              : 'bg-neutral-100 text-neutral-700',
        )}
      >
        {done ? <Check className="h-2.5 w-2.5" /> : index}
      </span>
      {label}
    </span>
  )
}

function SubStepBadge({
  active,
  done,
  label,
}: {
  active: boolean
  done: boolean
  label: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium',
        active
          ? 'border-neutral-900 bg-neutral-900 text-white'
          : done
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-neutral-200 bg-white text-neutral-500',
      )}
    >
      {done && <Check className="h-2.5 w-2.5" />}
      {label}
    </span>
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
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </h3>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

function Field({
  label,
  children,
  className,
  required,
}: {
  label: string
  children: React.ReactNode
  className?: string
  required?: boolean
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
