import { ApiError, tokenStorage } from './client'

export type RncFoto = {
  id: string
  rncId: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  legenda: string | null
  createdAt: string
}

export const rncFotosApi = {
  list: async (rncId: string): Promise<RncFoto[]> => {
    const token = tokenStorage.get()
    const res = await fetch(`/api/rnc/${rncId}/fotos`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    if (!res.ok) {
      const payload = await res.json().catch(() => null)
      const message = payload?.message ?? res.statusText
      if (res.status === 401) tokenStorage.clear()
      throw new ApiError(res.status, message, payload)
    }
    const body = (await res.json()) as { items: RncFoto[] }
    return body.items
  },

  upload: async (rncId: string, files: File[]): Promise<RncFoto[]> => {
    const form = new FormData()
    for (const f of files) form.append('fotos', f)
    const token = tokenStorage.get()
    const res = await fetch(`/api/rnc/${rncId}/fotos`, {
      method: 'POST',
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    if (!res.ok) {
      const payload = await res.json().catch(() => null)
      const message = payload?.message ?? res.statusText
      if (res.status === 401) tokenStorage.clear()
      throw new ApiError(res.status, message, payload)
    }
    const body = (await res.json()) as { items: RncFoto[] }
    return body.items
  },

  remove: async (fotoId: string): Promise<void> => {
    const token = tokenStorage.get()
    const res = await fetch(`/api/rnc/fotos/${fotoId}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    if (!res.ok && res.status !== 204) {
      const payload = await res.json().catch(() => null)
      const message = payload?.message ?? res.statusText
      if (res.status === 401) tokenStorage.clear()
      throw new ApiError(res.status, message, payload)
    }
  },

  /** URL para uso em outras chamadas autenticadas (não funciona direto
   *  em <img src> porque exige header Authorization). */
  fileUrl: (fotoId: string) => `/api/rnc/fotos/${fotoId}/file`,
}
