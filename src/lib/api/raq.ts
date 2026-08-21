import { apiRequest } from './client'
import type { Rnc, RncStatus } from './rnc'

/**
 * RAQ — Relatório de Alerta de Qualidade. Compartilha a estrutura e o
 * workflow de assinatura da RNC (fotos, envio para assinatura, lembrete,
 * escalonamento e PDF usam o rncApi); aqui ficam o CRUD e os campos
 * próprios: título, reincidência e RAQs relacionados.
 */

export type RaqRelacionado = {
  id: string
  numero: string
  titulo: string | null
  createdAt: string
  produto: { id: string; codigo: string; descricao: string } | null
  lotes: { numero: string }[]
}

export type Raq = Rnc & {
  reincidente: boolean | null
  reincidenteVezes: number | null
  observacoesComplementares: string | null
  enviadoFornecedorEm: string | null
  enviadoFornecedorPara: string | null
  raqRelacionados: RaqRelacionado[]
}

export type RaqCreateInput = {
  filialId: string
  fornecedorId: string
  titulo: string
  dataIdentificacao: string
  status?: RncStatus

  reincidente?: boolean | null
  reincidenteVezes?: number | null
  raqRelacionadosIds?: string[]

  produtoId: string
  lotes: { numero: string; quantidade?: number | null }[]
  quantidadeDefeito?: number | null
  tempoParadaMinutos?: number | null
  notasFiscais: {
    numero: string
    dataFabricacao?: string | null
    dataValidade?: string | null
    dataRecebimento?: string | null
  }[]

  disposicaoMaterialId: string
  origemId: string
  severidadeId: string
  descricaoDefeito: string
  observacoesComplementares?: string | null

  transportador?: string | null
  placaCavalo?: string | null
  placaCarreta?: string | null
  nomeMotorista?: string | null
  cnhMotorista?: string | null
}

export type RaqListParams = {
  fornecedorId?: string
  filialId?: string
  severidadeId?: string
  status?: RncStatus
  de?: string
  ate?: string
  page?: number
  pageSize?: number
}

export type RaqListResponse = {
  items: Raq[]
  page: number
  pageSize: number
  total: number
}

/** Pendências que impedem o envio para assinatura (espelha o servidor). */
export function pendenciasParaAssinaturaRaq(raq: Raq): string[] {
  const f: string[] = []
  if (!raq.titulo || !raq.titulo.trim()) f.push('Título do RAQ')
  if (!raq.produtoId) f.push('Produto')
  if (raq.lotes.length === 0) f.push('Lote')
  if (raq.quantidadeDefeito == null) f.push('Quantidade com defeito')
  if (raq.notasFiscais.length === 0) f.push('Nota fiscal')
  if (!raq.disposicaoMaterialId) f.push('Disposição do material')
  if (!raq.origemId) f.push('Origem da não conformidade')
  if (!raq.severidadeId) f.push('Severidade')
  if (!raq.descricaoDefeito || !raq.descricaoDefeito.trim())
    f.push('Descrição da ocorrência')
  if (raq._count.fotos === 0) f.push('Fotos da ocorrência')
  return f
}

export const raqApi = {
  list: (params: RaqListParams = {}) =>
    apiRequest<RaqListResponse>('/raq', {
      query: {
        fornecedorId: params.fornecedorId,
        filialId: params.filialId,
        severidadeId: params.severidadeId,
        status: params.status,
        de: params.de,
        ate: params.ate,
        page: params.page,
        pageSize: params.pageSize,
      },
    }),

  get: (id: string) => apiRequest<Raq>(`/raq/${id}`),

  create: (input: RaqCreateInput) =>
    apiRequest<Raq>('/raq', { method: 'POST', body: input }),

  update: (id: string, input: Partial<RaqCreateInput>) =>
    apiRequest<Raq>(`/raq/${id}`, { method: 'PATCH', body: input }),

  /** Reenvio manual ao fornecedor quando o envio automático falhou. */
  enviarFornecedor: (id: string) =>
    apiRequest<{ raq: Raq; email: string }>(`/raq/${id}/enviar-fornecedor`, {
      method: 'POST',
    }),
}
