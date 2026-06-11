import { apiRequest } from './client'

export type FilialRef = {
  id: string
  codigo: string
  nome: string
}

export type TurnoTrabalho = {
  id: string
  filialId: string
  codigo: string
  nome: string
  horaInicio: string
  horaFim: string
  descricao: string | null
  ativo: boolean
  filial: FilialRef
  createdAt: string
  updatedAt: string
}

export type TurnoTrabalhoInput = Omit<
  TurnoTrabalho,
  'id' | 'createdAt' | 'updatedAt' | 'filial'
>

export type TurnoTrabalhoListParams = {
  q?: string
  filialId?: string
  ativo?: boolean
  page?: number
  pageSize?: number
}

export type TurnoTrabalhoListResponse = {
  items: TurnoTrabalho[]
  page: number
  pageSize: number
  total: number
}

export const turnosTrabalhoApi = {
  list: (params: TurnoTrabalhoListParams = {}) =>
    apiRequest<TurnoTrabalhoListResponse>('/turnos-trabalho', {
      query: {
        q: params.q,
        filialId: params.filialId,
        ativo: params.ativo === undefined ? undefined : String(params.ativo),
        page: params.page,
        pageSize: params.pageSize,
      },
    }),

  get: (id: string) => apiRequest<TurnoTrabalho>(`/turnos-trabalho/${id}`),

  create: (input: Partial<TurnoTrabalhoInput>) =>
    apiRequest<TurnoTrabalho>('/turnos-trabalho', { method: 'POST', body: input }),

  update: (id: string, input: Partial<TurnoTrabalhoInput>) =>
    apiRequest<TurnoTrabalho>(`/turnos-trabalho/${id}`, {
      method: 'PATCH',
      body: input,
    }),

  remove: (id: string) =>
    apiRequest<void>(`/turnos-trabalho/${id}`, { method: 'DELETE' }),
}
