import { apiRequest } from './client'
import type { Rnc, RncStatus } from './rnc'

/**
 * RVT — Relatório de Visita Técnica. Mesmo desenho do RAQ: compartilha a
 * estrutura e o workflow de assinatura da RNC (fotos, envio para
 * assinatura, lembrete, escalonamento e PDF usam o rncApi); aqui ficam o
 * CRUD e os campos próprios: pauta, participantes, assuntos abordados e
 * conclusão. O fluxo termina com as assinaturas e o envio ao fornecedor.
 */

export type RvtParticipante = {
  id: string
  ordem: number
  nome: string
}

export type Rvt = Rnc & {
  pauta: string | null
  assuntosAbordados: string | null
  conclusao: string | null
  participantes: RvtParticipante[]
  enviadoFornecedorEm: string | null
  enviadoFornecedorPara: string | null
}

export type RvtCreateInput = {
  filialId: string
  fornecedorId: string
  produtoId: string
  /** Data da visita técnica. */
  dataIdentificacao: string
  status?: RncStatus
  pauta: string
  participantes: { nome: string }[]
  assuntosAbordados: string
  conclusao: string
  observacoesComplementares?: string | null
}

export type RvtListParams = {
  fornecedorId?: string
  filialId?: string
  status?: RncStatus
  page?: number
  pageSize?: number
}

export type RvtListResponse = {
  items: Rvt[]
  page: number
  pageSize: number
  total: number
}

/** Pendências que impedem o envio para assinatura (espelha o servidor). */
export function pendenciasParaAssinaturaRvt(rvt: Rvt): string[] {
  const f: string[] = []
  if (!rvt.produtoId) f.push('Produto')
  if (!rvt.pauta || !rvt.pauta.trim()) f.push('Pauta')
  if (rvt.participantes.length === 0) f.push('Participantes')
  if (!rvt.assuntosAbordados || !rvt.assuntosAbordados.trim())
    f.push('Assuntos abordados')
  if (!rvt.conclusao || !rvt.conclusao.trim()) f.push('Conclusão')
  if (rvt._count.fotos === 0) f.push('Fotos da visita técnica')
  return f
}

export const rvtApi = {
  list: (params: RvtListParams = {}) =>
    apiRequest<RvtListResponse>('/rvt', {
      query: {
        fornecedorId: params.fornecedorId,
        filialId: params.filialId,
        status: params.status,
        page: params.page,
        pageSize: params.pageSize,
      },
    }),

  get: (id: string) => apiRequest<Rvt>(`/rvt/${id}`),

  create: (input: RvtCreateInput) =>
    apiRequest<Rvt>('/rvt', { method: 'POST', body: input }),

  update: (id: string, input: Partial<RvtCreateInput>) =>
    apiRequest<Rvt>(`/rvt/${id}`, { method: 'PATCH', body: input }),

  /** Reenvio manual ao fornecedor quando o envio automático falhou. */
  enviarFornecedor: (id: string) =>
    apiRequest<{ rvt: Rvt; email: string }>(`/rvt/${id}/enviar-fornecedor`, {
      method: 'POST',
    }),
}
