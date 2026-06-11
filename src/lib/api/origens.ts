import { apiRequest } from './client'
import type { TipoRelatorioRef } from './severidades'

export type Origem = {
  id: string
  codigo: string
  nome: string
  descricao: string | null
  ativo: boolean
  tiposRelatorio: TipoRelatorioRef[]
  createdAt: string
  updatedAt: string
}

export type OrigemInput = Omit<
  Origem,
  'id' | 'createdAt' | 'updatedAt' | 'tiposRelatorio'
> & {
  tiposRelatorioIds: string[]
}

export type OrigemListParams = {
  q?: string
  ativo?: boolean
  page?: number
  pageSize?: number
}

export type OrigemListResponse = {
  items: Origem[]
  page: number
  pageSize: number
  total: number
}

export const origensApi = {
  list: (params: OrigemListParams = {}) =>
    apiRequest<OrigemListResponse>('/origens-nao-conformidade', {
      query: {
        q: params.q,
        ativo: params.ativo === undefined ? undefined : String(params.ativo),
        page: params.page,
        pageSize: params.pageSize,
      },
    }),

  get: (id: string) =>
    apiRequest<Origem>(`/origens-nao-conformidade/${id}`),

  create: (input: Partial<OrigemInput>) =>
    apiRequest<Origem>('/origens-nao-conformidade', { method: 'POST', body: input }),

  update: (id: string, input: Partial<OrigemInput>) =>
    apiRequest<Origem>(`/origens-nao-conformidade/${id}`, {
      method: 'PATCH',
      body: input,
    }),

  remove: (id: string) =>
    apiRequest<void>(`/origens-nao-conformidade/${id}`, { method: 'DELETE' }),
}
