export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  query?: Record<string, string | number | boolean | undefined | null>
  /** Se true, NÃO envia o header Authorization (ex.: /auth/login). */
  skipAuth?: boolean
}

const TOKEN_KEY = 'sgnc_token'

let onUnauthorized: (() => void) | null = null

export const tokenStorage = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      // ignore
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      // ignore
    }
  },
  onUnauthorized(handler: (() => void) | null) {
    onUnauthorized = handler
  },
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, query, headers, skipAuth, ...rest } = options
  const qs = query
    ? '?' +
      new URLSearchParams(
        Object.entries(query)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : ''

  const authHeader: Record<string, string> = {}
  if (!skipAuth) {
    const token = tokenStorage.get()
    if (token) authHeader.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`/api${path}${qs}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeader,
      ...(headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && !skipAuth) {
    tokenStorage.clear()
    onUnauthorized?.()
  }

  if (res.status === 204) return undefined as T

  const contentType = res.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json') ? await res.json() : await res.text()

  if (!res.ok) {
    const message =
      (payload && typeof payload === 'object' && 'message' in payload
        ? String(payload.message)
        : null) ?? res.statusText
    throw new ApiError(res.status, message, payload)
  }

  return payload as T
}
