import { apiRequest } from './client'

export type UsuarioRole = 'ADMIN' | 'USUARIO'

export type Usuario = {
  id: string
  email: string
  nome: string
  role: UsuarioRole
  ativo: boolean
  createdAt: string
  updatedAt: string
}

export type UsuarioCreateInput = {
  email: string
  nome: string
  senha: string
  role: UsuarioRole
  ativo: boolean
}

export type UsuarioUpdateInput = {
  email?: string
  nome?: string
  senha?: string
  role?: UsuarioRole
  ativo?: boolean
}

export type UsuarioListParams = {
  q?: string
  ativo?: boolean
  role?: UsuarioRole
  page?: number
  pageSize?: number
}

export type UsuarioListResponse = {
  items: Usuario[]
  page: number
  pageSize: number
  total: number
}

export const usuariosApi = {
  list: (params: UsuarioListParams = {}) =>
    apiRequest<UsuarioListResponse>('/usuarios', {
      query: {
        q: params.q,
        ativo: params.ativo === undefined ? undefined : String(params.ativo),
        role: params.role,
        page: params.page,
        pageSize: params.pageSize,
      },
    }),

  get: (id: string) => apiRequest<Usuario>(`/usuarios/${id}`),

  create: (input: UsuarioCreateInput) =>
    apiRequest<Usuario>('/usuarios', { method: 'POST', body: input }),

  update: (id: string, input: UsuarioUpdateInput) =>
    apiRequest<Usuario>(`/usuarios/${id}`, { method: 'PATCH', body: input }),

  remove: (id: string) =>
    apiRequest<void>(`/usuarios/${id}`, { method: 'DELETE' }),
}
