import { ApiError, apiRequest, tokenStorage } from './client'

export type RncStatus = 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'CLOSED' | 'CANCELLED'

/** Situação da ciência do fornecedor sobre a RNC concluída. */
export type CienciaRncStatus =
  | 'PENDENTE'
  | 'ACEITA'
  | 'RECUSADA'
  | 'ACEITA_POR_DECURSO'

export const CIENCIA_RNC_LABEL: Record<CienciaRncStatus, string> = {
  PENDENTE: 'Aguardando fornecedor',
  ACEITA: 'Aceita pelo fornecedor',
  RECUSADA: 'Recusada/questionada',
  ACEITA_POR_DECURSO: 'Aceita por decurso de prazo',
}

export type SeveridadeRef = {
  id: string
  codigo: string
  nome: string
  nivel: number
  cor: string | null
}

export type ProdutoRef = {
  id: string
  codigo: string
  descricao: string
  unidadeMedida: string
}

export type Rnc = {
  id: string
  numero: string
  filialId: string
  fornecedorId: string
  tipoNaoConformidadeId: string
  turnoId: string | null
  disposicaoMaterialId: string | null
  origemId: string | null
  severidadeId: string | null
  descricaoDefeito: string | null
  dataIdentificacao: string
  status: RncStatus
  criadoPorId: string
  assinaturaEnviadaEm: string | null
  escalonadoEm: string | null
  assinaturasConcluidasEm: string | null

  /** Ciência do fornecedor (após todas as assinaturas). */
  cienciaStatus: CienciaRncStatus | null
  cienciaEmail: string | null
  cienciaEnviadaEm: string | null
  cienciaPrazoEm: string | null
  cienciaRespondidaEm: string | null
  cienciaRespondidaPor: string | null
  cienciaJustificativa: string | null

  // Material & lote
  produtoId: string | null
  lotes: { id: string; numero: string; quantidade: number | null }[]
  quantidadeDefeito: number | null
  tempoParadaMinutos: number | null

  // Notas fiscais & datas
  notasFiscais: {
    id: string
    numero: string | null
    dataFabricacao: string | null
    dataValidade: string | null
    dataRecebimento: string | null
  }[]

  // Transporte
  transportador: string | null
  placaCavalo: string | null
  placaCarreta: string | null
  nomeMotorista: string | null
  cnhMotorista: string | null

  /** Matriz de aprovação: quem deve assinar (uma pessoa por área). */
  aprovadores: {
    id: string
    areaNome: string
    nome: string
    cargo: string | null
    email: string | null
    nivel: number | null
    assinadoEm: string | null
    assinaturaIp: string | null
    assinaturaNavegador: string | null
    assinaturaSo: string | null
    assinaturaDispositivo: string | null
    assinaturaLatitude: number | null
    assinaturaLongitude: number | null
    assinaturaPrecisao: number | null
    assinaturaMetadados: Record<string, unknown> | null
    lembreteEnviadoEm: string | null
    viaEscalonamento: boolean
  }[]

  filial: { id: string; codigo: string; nome: string }
  fornecedor: { id: string; codigo: string; razaoSocial: string; cnpj: string }
  tipoNaoConformidade: {
    id: string
    codigo: string
    descricao: string
    severidade: SeveridadeRef | null
  }
  turno: { id: string; codigo: string; nome: string } | null
  disposicaoMaterial: { id: string; codigo: string; descricao: string } | null
  origem: { id: string; codigo: string; nome: string } | null
  severidade: SeveridadeRef | null
  produto: ProdutoRef | null
  criadoPor: { id: string; nome: string; email: string }
  _count: { fotos: number }
  createdAt: string
  updatedAt: string
}

export type RncCreateInput = {
  filialId: string
  fornecedorId: string
  tipoNaoConformidadeId: string
  turnoId: string
  disposicaoMaterialId: string
  origemId: string
  severidadeId: string
  descricaoDefeito: string
  dataIdentificacao: string
  status?: RncStatus

  produtoId: string
  lotes: { numero: string; quantidade?: number | null }[]
  quantidadeDefeito?: number | null
  tempoParadaMinutos?: number | null

  notasFiscais?: {
    numero: string
    dataFabricacao?: string | null
    dataValidade?: string | null
    dataRecebimento?: string | null
  }[]

  transportador?: string | null
  placaCavalo?: string | null
  placaCarreta?: string | null
  nomeMotorista?: string | null
  cnhMotorista?: string | null
}

export type RncListParams = {
  fornecedorId?: string
  tipoNaoConformidadeId?: string
  filialId?: string
  produtoId?: string
  disposicaoMaterialId?: string
  origemId?: string
  severidadeId?: string
  status?: RncStatus
  /** Ciência do fornecedor; "__none__" = ainda não enviada. */
  cienciaStatus?: CienciaRncStatus | '__none__'
  de?: string
  ate?: string
  limit?: number
  page?: number
  pageSize?: number
}

export type RncListResponse = {
  items: Rnc[]
  page: number
  pageSize: number
  total: number
}

export type AssinaturaStatus = {
  total: number
  assinadas: number
  /** 'vazio' = sem aprovadores; senão pendente/parcial/completo. */
  estado: 'vazio' | 'pendente' | 'parcial' | 'completo'
  label: string
}

/** Resumo do andamento das assinaturas da matriz de aprovação. */
export function resumoAssinaturas(rnc: Rnc): AssinaturaStatus {
  const total = rnc.aprovadores.length
  const assinadas = rnc.aprovadores.filter((a) => a.assinadoEm).length
  if (total === 0) {
    return { total, assinadas, estado: 'vazio', label: 'Sem aprovadores' }
  }
  if (assinadas === 0) {
    return { total, assinadas, estado: 'pendente', label: `Pendente · 0/${total}` }
  }
  if (assinadas < total) {
    return { total, assinadas, estado: 'parcial', label: `Parcial · ${assinadas}/${total}` }
  }
  return { total, assinadas, estado: 'completo', label: `Assinado · ${total}/${total}` }
}

export type EnvioAssinatura = {
  id: string
  rncNumero: string
  enviadoPorNome: string
  totalDestinatarios: number
  destinatarios: { email: string; areaNome: string; nome: string }[]
  enviadoEm: string
  rnc: {
    id: string
    status: RncStatus
    filial: { codigo: string; nome: string } | null
    fornecedor: { codigo: string; razaoSocial: string } | null
    aprovadores: { areaNome: string; nome: string; assinadoEm: string | null }[]
  } | null
}

/** Pendências que impedem o envio para assinatura (espelha o servidor). */
export function pendenciasParaAssinatura(rnc: Rnc): string[] {
  const f: string[] = []
  if (!rnc.produtoId) f.push('Produto')
  if (rnc.lotes.length === 0) f.push('Lotes')
  if (rnc.quantidadeDefeito == null) f.push('Quantidade com defeito')
  if (rnc.notasFiscais.length === 0) f.push('Nota fiscal')
  if (!rnc.disposicaoMaterialId) f.push('Disposição do material')
  if (!rnc.origemId) f.push('Origem da não conformidade')
  if (!rnc.severidadeId) f.push('Severidade')
  if (!rnc.descricaoDefeito || !rnc.descricaoDefeito.trim())
    f.push('Descrição do defeito')
  if (rnc._count.fotos === 0) f.push('Fotos da ocorrência')
  return f
}

export const rncApi = {
  list: (params: RncListParams = {}) =>
    apiRequest<RncListResponse>('/rnc', {
      query: {
        fornecedorId: params.fornecedorId,
        tipoNaoConformidadeId: params.tipoNaoConformidadeId,
        filialId: params.filialId,
        produtoId: params.produtoId,
        disposicaoMaterialId: params.disposicaoMaterialId,
        origemId: params.origemId,
        severidadeId: params.severidadeId,
        status: params.status,
        cienciaStatus: params.cienciaStatus,
        de: params.de,
        ate: params.ate,
        limit: params.limit,
        page: params.page,
        pageSize: params.pageSize,
      },
    }),

  get: (id: string) => apiRequest<Rnc>(`/rnc/${id}`),

  create: (input: RncCreateInput) =>
    apiRequest<Rnc>('/rnc', { method: 'POST', body: input }),

  update: (id: string, input: Partial<RncCreateInput>) =>
    apiRequest<Rnc>(`/rnc/${id}`, { method: 'PATCH', body: input }),

  /** Registra ou cancela a assinatura de um aprovador da matriz. */
  setAssinatura: (rncId: string, aprovadorId: string, assinado: boolean) =>
    apiRequest<Rnc>(`/rnc/${rncId}/aprovadores/${aprovadorId}`, {
      method: 'PATCH',
      body: { assinado },
    }),

  /** Envia a RNC para assinatura dos aprovadores (e-mail com link). */
  enviarParaAssinatura: (id: string) =>
    apiRequest<{
      rnc: Rnc
      enviados: string[]
      falhas: { email: string; erro: string }[]
    }>(`/rnc/${id}/enviar-assinatura`, { method: 'POST' }),

  /** Lembrete manual aos aprovadores ainda pendentes. */
  enviarLembrete: (id: string) =>
    apiRequest<{ rnc: Rnc; enviados: number }>(`/rnc/${id}/lembrete`, {
      method: 'POST',
    }),

  /** Escalonamento manual: sobe um nível acima nas áreas pendentes. */
  escalonar: (id: string) =>
    apiRequest<{ rnc: Rnc; novos: number }>(`/rnc/${id}/escalonar`, {
      method: 'POST',
    }),

  /** Histórico de envios de workflow para assinatura (filtra por código). */
  listEnvios: (params: { q?: string; page?: number; pageSize?: number } = {}) =>
    apiRequest<{
      items: EnvioAssinatura[]
      page: number
      pageSize: number
      total: number
    }>('/rnc/envios', {
      query: {
        q: params.q,
        page: params.page,
        pageSize: params.pageSize,
      },
    }),

  /** Baixa o PDF da RNC (layout do formulário) e dispara o download. */
  downloadPdf: async (id: string, numero: string): Promise<void> => {
    const token = tokenStorage.get()
    const res = await fetch(`/api/rnc/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    if (!res.ok) {
      if (res.status === 401) tokenStorage.clear()
      const payload = await res.json().catch(() => null)
      throw new ApiError(res.status, payload?.message ?? res.statusText, payload)
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `RNC-${numero}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },
}
