import { ApiError } from './client'

export type AssinaturaResumo = {
  aprovador: {
    nome: string
    cargo: string | null
    areaNome: string
    assinadoEm: string | null
  }
  rnc: {
    numero: string
    status: string
    dataIdentificacao: string
    descricaoDefeito: string | null
    filial: { nome: string; codigo: string } | null
    fornecedor: { razaoSocial: string; codigo: string } | null
    tipoNaoConformidade: { codigo: string; descricao: string } | null
    severidade: { nivel: number; nome: string } | null
    aprovadores: { areaNome: string; nome: string; assinadoEm: string | null }[]
  }
}

// Rotas públicas (link mágico) — não enviam Authorization.
async function publicRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/assinatura${path}`, {
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  const payload = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(res.status, payload?.message ?? res.statusText, payload)
  }
  return payload as T
}

export const assinaturaApi = {
  get: (token: string) =>
    publicRequest<AssinaturaResumo>(`/${encodeURIComponent(token)}`),

  assinar: (token: string) =>
    publicRequest<{ ok: boolean; assinadoEm: string }>(
      `/${encodeURIComponent(token)}/assinar`,
      { method: 'POST' },
    ),

  pdfUrl: (token: string) =>
    `/api/assinatura/${encodeURIComponent(token)}/pdf`,
}
