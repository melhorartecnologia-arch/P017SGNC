import { apiRequest } from './client'

export type Area = {
  id: string
  codigo: string
  nome: string
  descricao: string | null
  ativo: boolean
  createdAt: string
  updatedAt: string
}

export type AreaInput = Omit<Area, 'id' | 'createdAt' | 'updatedAt'>

export type AreaListParams = {
  q?: string
  ativo?: boolean
  page?: number
  pageSize?: number
}

export type AreaListResponse = {
  items: Area[]
  page: number
  pageSize: number
  total: number
}

export const areasApi = {
  list: (params: AreaListParams = {}) =>
    apiRequest<AreaListResponse>('/areas', {
      query: {
        q: params.q,
        ativo: params.ativo === undefined ? undefined : String(params.ativo),
        page: params.page,
        pageSize: params.pageSize,
      },
    }),

  get: (id: string) => apiRequest<Area>(`/areas/${id}`),

  create: (input: Partial<AreaInput>) =>
    apiRequest<Area>('/areas', { method: 'POST', body: input }),

  update: (id: string, input: Partial<AreaInput>) =>
    apiRequest<Area>(`/areas/${id}`, { method: 'PATCH', body: input }),

  remove: (id: string) => apiRequest<void>(`/areas/${id}`, { method: 'DELETE' }),
}
