import { ApiError } from './client'

/** Situação da ciência do fornecedor sobre a RNC. */
export type CienciaStatus =
  | 'PENDENTE'
  | 'ACEITA'
  | 'RECUSADA'
  | 'ACEITA_POR_DECURSO'
  | 'RECUSA_ACEITA'
  | 'MANTIDA_DEFINITIVA'

/** Situação do plano de ações de contingência do fornecedor. */
export type ContingenciaStatus =
  | 'PENDENTE'
  | 'EM_ANALISE'
  | 'APROVADA'
  | 'AJUSTE_SOLICITADO'

/** Situação de cada ação do plano, decidida pelo aprovador marcado. */
export type AcaoContingenciaStatus = 'PENDENTE' | 'APROVADA' | 'RECUSADA'

/** Uma ação do plano, como o fornecedor a vê. */
export type AcaoContingencia = {
  id: string
  ordem: number
  descricao: string
  responsavel: string | null
  prazo: string | null
  status: AcaoContingenciaStatus
  analisadaEm: string | null
  parecer: string | null
}

export const ACAO_CONTINGENCIA_LABEL: Record<AcaoContingenciaStatus, string> = {
  PENDENTE: 'Em análise',
  APROVADA: 'Aprovada',
  RECUSADA: 'Recusada',
}

/** Situação da análise de causa (Ishikawa + 5W2H). */
export type CausaRaizStatus =
  | 'PENDENTE'
  | 'EM_ANALISE'
  | 'APROVADA'
  | 'AJUSTE_SOLICITADO'

export type CausaIshikawa = {
  id: string
  categoria: string
  ordem: number
  descricao: string
}

/** Campos do 5W2H, como trafegam na API pública. */
export type Cinco2H = {
  oQue: string | null
  porQue: string | null
  onde: string | null
  quando: string | null
  quem: string | null
  como: string | null
  quantoCusta: string | null
}

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
  cienciaAnaliseEm: string | null
  cienciaAnaliseJustificativa: string | null
  contingenciaStatus: ContingenciaStatus | null
  contingenciaSolicitadaEm: string | null
  contingenciaPrazoEm: string | null
  contingenciaRespondidaEm: string | null
  contingenciaRespondidaPor: string | null
  contingenciaAnalisadaEm: string | null
  acoesContingencia: AcaoContingencia[]

  causaRaizStatus: CausaRaizStatus | null
  causaRaizSolicitadaEm: string | null
  causaRaizEnviadaEm: string | null
  causaRaizEnviadaPor: string | null
  causaRaizAnalisadaEm: string | null
  causaRaizParecer: string | null
  causaOQue: string | null
  causaPorQue: string | null
  causaOnde: string | null
  causaQuando: string | null
  causaQuem: string | null
  causaComo: string | null
  causaQuantoCusta: string | null
  causasIshikawa: CausaIshikawa[]
  eficaciaStatus:
    | 'AGUARDANDO_PRAZO'
    | 'PENDENTE'
    | 'EFICAZ'
    | 'NAO_EFICAZ'
    | null
  eficaciaVerificadaEm: string | null
  eficaciaParecer: string | null
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

  /**
   * Envia o plano de ações — uma linha por ação. Vale tanto para o
   * primeiro envio quanto para a correção depois de uma recusa.
   */
  registrarContingencia: (
    token: string,
    body: {
      acoes: {
        descricao: string
        responsavel?: string | null
        prazo?: string | null
      }[]
      nome?: string | null
    },
  ) =>
    publicRequest<CienciaRnc>(`/${token}/contingencia`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  /**
   * Grava a análise de causa. `enviar: false` salva rascunho; `true`
   * valida a completude e manda para o aprovador marcado.
   */
  salvarCausaRaiz: (
    token: string,
    body: {
      causas: { categoria: string; descricao: string }[]
      oQue?: string | null
      porQue?: string | null
      onde?: string | null
      quando?: string | null
      quem?: string | null
      como?: string | null
      quantoCusta?: string | null
      enviar: boolean
      nome?: string | null
    },
  ) =>
    publicRequest<CienciaRnc>(`/${token}/causa-raiz`, {
      method: 'PUT',
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
  RECUSADA: 'Recusada — em análise',
  ACEITA_POR_DECURSO: 'Aceita por decurso de prazo',
  RECUSA_ACEITA: 'Recusa acatada',
  MANTIDA_DEFINITIVA: 'Mantida em definitivo',
}

/** RNC em análise de recusa, vista pelo aprovador marcado. */
export type AnaliseRecusa = {
  id: string
  numero: string
  dataIdentificacao: string
  descricaoDefeito: string | null
  cienciaStatus: CienciaStatus | null
  cienciaRespondidaEm: string | null
  cienciaRespondidaPor: string | null
  cienciaJustificativa: string | null
  cienciaAnaliseEm: string | null
  cienciaAnalisePor: string | null
  cienciaAnaliseJustificativa: string | null
  filial: { codigo: string; nome: string } | null
  fornecedor: { razaoSocial: string; cnpj: string } | null
  tipoNaoConformidade: { codigo: string; descricao: string } | null
  severidade: { nivel: number; nome: string } | null
}

export const analiseApi = {
  get: (token: string) => publicRequest<AnaliseRecusa>(`/analise/${token}`),

  /** Acata a recusa do fornecedor ou a nega (tornando a RNC definitiva). */
  decidir: (
    token: string,
    body: {
      acatarRecusa: boolean
      nome?: string | null
      justificativa?: string | null
    },
  ) =>
    publicRequest<AnaliseRecusa>(`/analise/${token}/decidir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  pdfUrl: (token: string, inline = false) =>
    `/api/ciencia/analise/${encodeURIComponent(token)}/pdf${inline ? '?inline=1' : ''}`,
}
