import { apiRequest } from './client'

export type Aprovador = {
  id: string
  filialId: string
  areaId: string
  turnoId: string | null
  nivel: number
  nome: string
  cargo: string | null
  email: string
  telefone: string | null
  whatsapp: string | null
  ativo: boolean
  /** Recebe as respostas do fornecedor (aceite/recusa) por e-mail. */
  recebeRespostaFornecedor: boolean
  observacoes: string | null
  /** Tipos de relatório que assina. Vazio = assina todos os tipos. */
  tiposRelatorio: { id: string; codigo: string; descricao: string }[]
  filial: { id: string; codigo: string; nome: string }
  area: { id: string; codigo: string; nome: string }
  turno: { id: string; codigo: string; nome: string; filialId: string } | null
  createdAt: string
  updatedAt: string
}

export type AprovadorInput = {
  filialId: string
  areaId: string
  turnoId?: string | null
  nivel: number
  nome: string
  cargo?: string | null
  email: string
  telefone?: string | null
  whatsapp?: string | null
  ativo?: boolean
  recebeRespostaFornecedor?: boolean
  observacoes?: string | null
  /** Ids dos tipos de relatório que assina. Vazio = todos. */
  tiposRelatorioIds?: string[]
}

export type AprovadorListParams = {
  q?: string
  filialId?: string
  areaId?: string
  ativo?: boolean
  page?: number
  pageSize?: number
}

export type AprovadorListResponse = {
  items: Aprovador[]
  page: number
  pageSize: number
  total: number
}

export const aprovadoresApi = {
  list: (params: AprovadorListParams = {}) =>
    apiRequest<AprovadorListResponse>('/aprovadores', {
      query: {
        q: params.q,
        filialId: params.filialId,
        areaId: params.areaId,
        ativo: params.ativo === undefined ? undefined : String(params.ativo),
        page: params.page,
        pageSize: params.pageSize,
      },
    }),

  get: (id: string) => apiRequest<Aprovador>(`/aprovadores/${id}`),

  create: (input: Partial<AprovadorInput>) =>
    apiRequest<Aprovador>('/aprovadores', { method: 'POST', body: input }),

  update: (id: string, input: Partial<AprovadorInput>) =>
    apiRequest<Aprovador>(`/aprovadores/${id}`, { method: 'PATCH', body: input }),

  remove: (id: string) =>
    apiRequest<void>(`/aprovadores/${id}`, { method: 'DELETE' }),
}
