import * as React from 'react'
import { authApi, type AuthUser } from '@/lib/api/auth'
import { ApiError, tokenStorage } from '@/lib/api/client'

type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'unauthenticated'; user: null }

type AuthContextValue = AuthState & {
  login: (email: string, senha: string) => Promise<void>
  logout: () => void
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>(() =>
    tokenStorage.get() ? { status: 'loading', user: null } : { status: 'unauthenticated', user: null },
  )

  const logout = React.useCallback(() => {
    tokenStorage.clear()
    setState({ status: 'unauthenticated', user: null })
  }, [])

  React.useEffect(() => {
    tokenStorage.onUnauthorized(() => {
      setState({ status: 'unauthenticated', user: null })
    })
    return () => tokenStorage.onUnauthorized(null)
  }, [])

  React.useEffect(() => {
    if (state.status !== 'loading') return
    let cancelled = false
    authApi
      .me()
      .then((usuario) => {
        if (cancelled) return
        setState({ status: 'authenticated', user: usuario })
      })
      .catch(() => {
        if (cancelled) return
        tokenStorage.clear()
        setState({ status: 'unauthenticated', user: null })
      })
    return () => {
      cancelled = true
    }
  }, [state.status])

  const login = React.useCallback(async (email: string, senha: string) => {
    try {
      const { token, usuario } = await authApi.login(email, senha)
      tokenStorage.set(token)
      setState({ status: 'authenticated', user: usuario })
    } catch (err) {
      if (err instanceof ApiError) throw err
      throw new ApiError(0, 'Falha de conexão com o servidor')
    }
  }, [])

  const value = React.useMemo<AuthContextValue>(
    () => ({ ...state, login, logout }),
    [state, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
