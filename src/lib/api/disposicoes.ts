import { apiRequest } from './client'
import type { TipoRelatorioRef } from './severidades'

export type Disposicao = {
  id: string
  codigo: string
  descricao: string
  ativo: boolean
  tiposRelatorio: TipoRelatorioRef[]
  createdAt: string
  updatedAt: string
}

export type DisposicaoInput = Omit<
  Disposicao,
  'id' | 'createdAt' | 'updatedAt' | 'tiposRelatorio'
> & {
  tiposRelatorioIds: string[]
}

export type DisposicaoListParams = {
  q?: string
  ativo?: boolean
  page?: number
  pageSize?: number
}

export type DisposicaoListResponse = {
  items: Disposicao[]
  page: number
  pageSize: number
  total: number
}

export const disposicoesApi = {
  list: (params: DisposicaoListParams = {}) =>
    apiRequest<DisposicaoListResponse>('/disposicoes-material', {
      query: {
        q: params.q,
        ativo: params.ativo === undefined ? undefined : String(params.ativo),
        page: params.page,
        pageSize: params.pageSize,
      },
    }),

  get: (id: string) =>
    apiRequest<Disposicao>(`/disposicoes-material/${id}`),

  create: (input: Partial<DisposicaoInput>) =>
    apiRequest<Disposicao>('/disposicoes-material', { method: 'POST', body: input }),

  update: (id: string, input: Partial<DisposicaoInput>) =>
    apiRequest<Disposicao>(`/disposicoes-material/${id}`, {
      method: 'PATCH',
      body: input,
    }),

  remove: (id: string) =>
    apiRequest<void>(`/disposicoes-material/${id}`, { method: 'DELETE' }),
}
