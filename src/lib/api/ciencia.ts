import { ApiError } from './client'

/** Situação da ciência do fornecedor sobre a RNC. */
export type CienciaStatus =
  | 'PENDENTE'
  | 'ACEITA'
  | 'RECUSADA'
  | 'ACEITA_POR_DECURSO'

export type CienciaRnc = {
  id: string
  numero: string
  dataIdentificacao: string
  descricaoDefeito: string | null
  quantidadeDefeito: number | null
  cienciaStatus: CienciaStatus | null
  cienciaPrazoEm: string | null
  cienciaRespondidaEm: string | null
  cienciaRespondidaPor: string | null
  cienciaJustificativa: string | null
  filial: { codigo: string; nome: string } | null
  fornecedor: { razaoSocial: string; cnpj: string } | null
  tipoNaoConformidade: { codigo: string; descricao: string } | null
  produto: { codigo: string; descricao: string; unidadeMedida: string } | null
  severidade: { nivel: number; nome: string } | null
  disposicaoMaterial: { descricao: string } | null
  origem: { nome: string } | null
  lotes: { numero: string; quantidade: number | null }[]
}

// Rota pública (link por token) — não envia Authorization.
async function publicRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/ciencia${path}`, {
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  const payload = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(res.status, payload?.message ?? res.statusText, payload)
  }
  return payload as T
}

export const cienciaApi = {
  get: (token: string) => publicRequest<CienciaRnc>(`/${token}`),

  /** Registra o aceite ou a recusa (com justificativa) do fornecedor. */
  responder: (
    token: string,
    body: { aceita: boolean; nome?: string | null; justificativa?: string | null },
  ) =>
    publicRequest<CienciaRnc>(`/${token}/responder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  /** URL do PDF: inline para visualizar, com download caso contrário. */
  pdfUrl: (token: string, inline = false) =>
    `/api/ciencia/${encodeURIComponent(token)}/pdf${inline ? '?inline=1' : ''}`,
}

export const CIENCIA_LABEL: Record<CienciaStatus, string> = {
  PENDENTE: 'Aguardando resposta',
  ACEITA: 'Aceita pelo fornecedor',
  RECUSADA: 'Recusada/questionada',
  ACEITA_POR_DECURSO: 'Aceita por decurso de prazo',
}
