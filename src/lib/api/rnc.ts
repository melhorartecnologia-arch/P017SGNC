import { apiRequest } from './client'

export type RncStatus = 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'CLOSED' | 'CANCELLED'

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
  createdAt: string
  updatedAt: string
}

export type RncCreateInput = {
  filialId: string
  fornecedorId: string
  tipoNaoConformidadeId: string
  turnoId: string
  disposicaoMaterialId?: string | null
  origemId?: string | null
  severidadeId?: string | null
  descricaoDefeito?: string | null
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
  status?: RncStatus
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

export const rncApi = {
  list: (params: RncListParams = {}) =>
    apiRequest<RncListResponse>('/rnc', {
      query: {
        fornecedorId: params.fornecedorId,
        tipoNaoConformidadeId: params.tipoNaoConformidadeId,
        filialId: params.filialId,
        status: params.status,
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
}
