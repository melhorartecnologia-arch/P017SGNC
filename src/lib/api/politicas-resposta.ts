import { apiRequest } from './client'

export type TipoRelatorioRef = {
  id: string
  codigo: string
  descricao: string
}

export type PoliticaResposta = {
  id: string
  tipoRelatorioId: string
  horasResposta: number
  descricao: string | null
  ativo: boolean
  tipoRelatorio: TipoRelatorioRef
  createdAt: string
  updatedAt: string
}

export type PoliticaRespostaInput = {
  tipoRelatorioId: string
  horasResposta: number
  descricao?: string | null
  ativo?: boolean
}

export type PoliticaRespostaListParams = {
  q?: string
  tipoRelatorioId?: string
  ativo?: boolean
  page?: number
  pageSize?: number
}

export type PoliticaRespostaListResponse = {
  items: PoliticaResposta[]
  page: number
  pageSize: number
  total: number
}

export const politicasRespostaApi = {
  list: (params: PoliticaRespostaListParams = {}) =>
    apiRequest<PoliticaRespostaListResponse>('/politicas-resposta', {
      query: {
        q: params.q,
        tipoRelatorioId: params.tipoRelatorioId,
        ativo: params.ativo === undefined ? undefined : String(params.ativo),
        page: params.page,
        pageSize: params.pageSize,
      },
    }),

  get: (id: string) => apiRequest<PoliticaResposta>(`/politicas-resposta/${id}`),

  create: (input: Partial<PoliticaRespostaInput>) =>
    apiRequest<PoliticaResposta>('/politicas-resposta', { method: 'POST', body: input }),

  update: (id: string, input: Partial<PoliticaRespostaInput>) =>
    apiRequest<PoliticaResposta>(`/politicas-resposta/${id}`, {
      method: 'PATCH',
      body: input,
    }),

  remove: (id: string) =>
    apiRequest<void>(`/politicas-resposta/${id}`, { method: 'DELETE' }),
}
