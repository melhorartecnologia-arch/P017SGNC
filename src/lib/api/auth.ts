import { apiRequest } from './client'

export type AuthUser = {
  id: string
  email: string
  nome: string
  role: 'ADMIN' | 'USUARIO'
  filialPadraoId: string | null
  filialPadrao: { id: string; codigo: string; nome: string } | null
  /**
   * Filiais em que o usuário é aprovador marcado para receber as respostas
   * do fornecedor. Com o perfil ADMIN, define quem decide sobre uma recusa.
   */
  filiaisRespostaFornecedor?: string[]
}

/**
 * Só administradores e os aprovadores marcados na filial da RNC podem
 * analisar a recusa do fornecedor (a API aplica a mesma regra).
 */
export function podeAnalisarRecusa(
  user: AuthUser | null | undefined,
  filialId: string | null | undefined,
): boolean {
  if (!user) return false
  if (user.role === 'ADMIN') return true
  if (!filialId) return false
  return (user.filiaisRespostaFornecedor ?? []).includes(filialId)
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
