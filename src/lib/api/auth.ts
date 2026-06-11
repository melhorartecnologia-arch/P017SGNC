import { apiRequest } from './client'

export type AuthUser = {
  id: string
  email: string
  nome: string
  role: 'ADMIN' | 'USUARIO'
  filialPadraoId: string | null
  filialPadrao: { id: string; codigo: string; nome: string } | null
}

export type LoginResponse = {
  token: string
  usuario: AuthUser
}

export const authApi = {
  login: (email: string, senha: string) =>
    apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { email, senha },
      skipAuth: true,
    }),

  me: () => apiRequest<AuthUser>('/auth/me'),
}
