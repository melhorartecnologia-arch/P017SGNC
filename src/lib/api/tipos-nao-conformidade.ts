import { apiRequest } from './client'

export type ProdutoRef = {
  id: string
  codigo: string
  descricao: string
  unidadeMedida: string
}

export type SeveridadeRef = {
  id: string
  codigo: string
  nome: string
  nivel: number
  cor: string | null
}

export type TipoNaoConformidade = {
  id: string
  codigo: string
  descricao: string
  severidadeId: string | null
  ativo: boolean
  produtos: ProdutoRef[]
  severidade: SeveridadeRef | null
  createdAt: string
  updatedAt: string
}

export type TipoNaoConformidadeInput = {
  codigo: string
  descricao: string
  severidadeId?: string | null
  ativo: boolean
  produtosIds: string[]
}

export type TipoNaoConformidadeListParams = {
  q?: string
  ativo?: boolean
  page?: number
  pageSize?: number
}

export type TipoNaoConformidadeListResponse = {
  items: TipoNaoConformidade[]
  page: number
  pageSize: number
  total: number
}

export const tiposNaoConformidadeApi = {
  list: (params: TipoNaoConformidadeListParams = {}) =>
    apiRequest<TipoNaoConformidadeListResponse>('/tipos-nao-conformidade', {
      query: {
        q: params.q,
        ativo: params.ativo === undefined ? undefined : String(params.ativo),
        page: params.page,
        pageSize: params.pageSize,
      },
    }),

  get: (id: string) =>
    apiRequest<TipoNaoConformidade>(`/tipos-nao-conformidade/${id}`),

  create: (input: Partial<TipoNaoConformidadeInput>) =>
    apiRequest<TipoNaoConformidade>('/tipos-nao-conformidade', {
      method: 'POST',
      body: input,
    }),

  update: (id: string, input: Partial<TipoNaoConformidadeInput>) =>
    apiRequest<TipoNaoConformidade>(`/tipos-nao-conformidade/${id}`, {
      method: 'PATCH',
      body: input,
    }),

  remove: (id: string) =>
    apiRequest<void>(`/tipos-nao-conformidade/${id}`, { method: 'DELETE' }),
}
