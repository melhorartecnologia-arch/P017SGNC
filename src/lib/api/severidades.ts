import { apiRequest } from './client'

export type TipoRelatorioRef = {
  id: string
  codigo: string
  descricao: string
}

export type Severidade = {
  id: string
  codigo: string
  nome: string
  nivel: number
  cor: string | null
  descricao: string | null
  ativo: boolean
  tiposRelatorio: TipoRelatorioRef[]
  createdAt: string
  updatedAt: string
}

export type SeveridadeInput = Omit<
  Severidade,
  'id' | 'createdAt' | 'updatedAt' | 'tiposRelatorio'
> & {
  tiposRelatorioIds: string[]
}

export type SeveridadeListParams = {
  q?: string
  ativo?: boolean
  page?: number
  pageSize?: number
}

export type SeveridadeListResponse = {
  items: Severidade[]
  page: number
  pageSize: number
  total: number
}

export const severidadesApi = {
  list: (params: SeveridadeListParams = {}) =>
    apiRequest<SeveridadeListResponse>('/severidades', {
      query: {
        q: params.q,
        ativo: params.ativo === undefined ? undefined : String(params.ativo),
        page: params.page,
        pageSize: params.pageSize,
      },
    }),

  get: (id: string) => apiRequest<Severidade>(`/severidades/${id}`),

  create: (input: Partial<SeveridadeInput>) =>
    apiRequest<Severidade>('/severidades', { method: 'POST', body: input }),

  update: (id: string, input: Partial<SeveridadeInput>) =>
    apiRequest<Severidade>(`/severidades/${id}`, { method: 'PATCH', body: input }),

  remove: (id: string) =>
    apiRequest<void>(`/severidades/${id}`, { method: 'DELETE' }),
}
