import { apiRequest } from './client'

export type Produto = {
  id: string
  codigo: string
  descricao: string
  unidadeMedida: string
  ativo: boolean
  createdAt: string
  updatedAt: string
}

export type ProdutoInput = Omit<Produto, 'id' | 'createdAt' | 'updatedAt'>

export type ProdutoListParams = {
  q?: string
  ativo?: boolean
  page?: number
  pageSize?: number
}

export type ProdutoListResponse = {
  items: Produto[]
  page: number
  pageSize: number
  total: number
}

export const produtosApi = {
  list: (params: ProdutoListParams = {}) =>
    apiRequest<ProdutoListResponse>('/produtos', {
      query: {
        q: params.q,
        ativo: params.ativo === undefined ? undefined : String(params.ativo),
        page: params.page,
        pageSize: params.pageSize,
      },
    }),

  get: (id: string) => apiRequest<Produto>(`/produtos/${id}`),

  create: (input: Partial<ProdutoInput>) =>
    apiRequest<Produto>('/produtos', { method: 'POST', body: input }),

  update: (id: string, input: Partial<ProdutoInput>) =>
    apiRequest<Produto>(`/produtos/${id}`, { method: 'PATCH', body: input }),

  remove: (id: string) =>
    apiRequest<void>(`/produtos/${id}`, { method: 'DELETE' }),
}
