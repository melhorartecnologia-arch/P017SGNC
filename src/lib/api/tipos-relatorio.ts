import { apiRequest } from './client'

export type TipoRelatorio = {
  id: string
  codigo: string
  descricao: string
  ativo: boolean
  createdAt: string
  updatedAt: string
}

export type TipoRelatorioInput = Omit<TipoRelatorio, 'id' | 'createdAt' | 'updatedAt'>

export type TipoRelatorioListParams = {
  q?: string
  ativo?: boolean
  page?: number
  pageSize?: number
}

export type TipoRelatorioListResponse = {
  items: TipoRelatorio[]
  page: number
  pageSize: number
  total: number
}

export const tiposRelatorioApi = {
  list: (params: TipoRelatorioListParams = {}) =>
    apiRequest<TipoRelatorioListResponse>('/tipos-relatorio', {
      query: {
        q: params.q,
        ativo: params.ativo === undefined ? undefined : String(params.ativo),
        page: params.page,
        pageSize: params.pageSize,
      },
    }),

  get: (id: string) => apiRequest<TipoRelatorio>(`/tipos-relatorio/${id}`),

  create: (input: Partial<TipoRelatorioInput>) =>
    apiRequest<TipoRelatorio>('/tipos-relatorio', { method: 'POST', body: input }),

  update: (id: string, input: Partial<TipoRelatorioInput>) =>
    apiRequest<TipoRelatorio>(`/tipos-relatorio/${id}`, {
      method: 'PATCH',
      body: input,
    }),

  remove: (id: string) =>
    apiRequest<void>(`/tipos-relatorio/${id}`, { method: 'DELETE' }),
}
