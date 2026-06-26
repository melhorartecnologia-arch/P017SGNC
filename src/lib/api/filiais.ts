import { apiRequest } from './client'

export type Filial = {
  id: string
  codigo: string
  nome: string
  razaoSocial: string
  cnpj: string
  endereco: string
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string
  uf: string
  cep: string
  ativo: boolean
  observacoes: string | null
  /** Ponto de partida da numeração sequencial de RNC desta filial. */
  rncNumeroInicial: number
  createdAt: string
  updatedAt: string
}

export type FilialInput = Omit<Filial, 'id' | 'createdAt' | 'updatedAt'>

export type FilialListParams = {
  q?: string
  ativo?: boolean
  page?: number
  pageSize?: number
}

export type FilialListResponse = {
  items: Filial[]
  page: number
  pageSize: number
  total: number
}

export const filiaisApi = {
  list: (params: FilialListParams = {}) =>
    apiRequest<FilialListResponse>('/filiais', {
      query: {
        q: params.q,
        ativo: params.ativo === undefined ? undefined : String(params.ativo),
        page: params.page,
        pageSize: params.pageSize,
      },
    }),

  get: (id: string) => apiRequest<Filial>(`/filiais/${id}`),

  create: (input: Partial<FilialInput>) =>
    apiRequest<Filial>('/filiais', { method: 'POST', body: input }),

  update: (id: string, input: Partial<FilialInput>) =>
    apiRequest<Filial>(`/filiais/${id}`, { method: 'PATCH', body: input }),

  remove: (id: string) => apiRequest<void>(`/filiais/${id}`, { method: 'DELETE' }),
}
