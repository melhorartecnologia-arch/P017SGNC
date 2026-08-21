import { apiRequest } from './client'
import type { Rnc, RncStatus } from './rnc'

/**
 * RHE — Relatório de Homologação de Embalagem (FOR.IND.CQA.031).
 * Compartilha a estrutura e o workflow de assinatura da RNC (fotos, envio
 * para assinatura, lembrete, escalonamento e PDF usam o rncApi); aqui
 * ficam o CRUD e os campos próprios. O fornecedor não tem devolução: os
 * representantes técnicos dele ASSINAM o documento junto com os
 * aprovadores internos do tipo RHE, e o fluxo termina com o envio do PDF
 * assinado por e-mail ao fornecedor.
 */

export type HomologacaoResultado =
  | 'APROVADO'
  | 'REPROVADO'
  | 'APROVADO_COM_RESTRICAO'

export const HOMOLOGACAO_LABELS: Record<HomologacaoResultado, string> = {
  APROVADO: 'Aprovado',
  REPROVADO: 'Reprovado',
  APROVADO_COM_RESTRICAO: 'Aprovado com restrição',
}

export type RheRepresentante = {
  id: string
  ordem: number
  nome: string
  email: string
}

export type Rhe = Rnc & {
  tipoProdutoAplicacao: string | null
  definicaoTeste: string | null
  linhaEnvase: string | null
  fabricacaoTexto: string | null
  validadeTexto: string | null
  quantidadeTexto: string | null
  analisadoPor: string | null
  avaliacaoConsideracoes: string | null
  homologacaoInicial: HomologacaoResultado | null
  homologacaoInicialData: string | null
  homologacaoFinal: HomologacaoResultado | null
  homologacaoFinalData: string | null
  representantes: RheRepresentante[]
  enviadoFornecedorEm: string | null
  enviadoFornecedorPara: string | null
}

export type RheCreateInput = {
  filialId: string
  fornecedorId: string
  /** Embalagem/material homologado (cadastro de produtos). */
  produtoId: string
  /** Data da homologação. */
  dataIdentificacao: string
  status?: RncStatus

  titulo: string
  tipoProdutoAplicacao?: string | null
  definicaoTeste: string
  linhaEnvase?: string | null

  fabricacaoTexto?: string | null
  validadeTexto?: string | null
  quantidadeTexto?: string | null
  lotes: { numero: string }[]
  notaFiscal?: string | null

  analisadoPor?: string | null
  avaliacaoConsideracoes?: string | null
  homologacaoInicial?: HomologacaoResultado | null
  homologacaoInicialData?: string | null

  /** Representantes técnicos do fornecedor que assinam (1 a 2). */
  representantes: { nome: string; email: string }[]
}

export type RheListParams = {
  fornecedorId?: string
  filialId?: string
  status?: RncStatus
  homologacaoInicial?: HomologacaoResultado
  page?: number
  pageSize?: number
}

export type RheListResponse = {
  items: Rhe[]
  page: number
  pageSize: number
  total: number
}

/** Pendências que impedem o envio para assinatura (espelha o servidor). */
export function pendenciasParaAssinaturaRhe(rhe: Rhe): string[] {
  const f: string[] = []
  if (!rhe.titulo || !rhe.titulo.trim()) f.push('Título do RHE')
  if (!rhe.produtoId) f.push('Embalagem (produto)')
  if (!rhe.definicaoTeste || !rhe.definicaoTeste.trim())
    f.push('Definição do teste')
  if (!rhe.avaliacaoConsideracoes || !rhe.avaliacaoConsideracoes.trim())
    f.push('Avaliação e considerações finais')
  if (!rhe.homologacaoInicial) f.push('Homologação inicial')
  if (rhe.representantes.length === 0)
    f.push('Representante técnico do fornecedor')
  if (rhe._count.fotos === 0) f.push('Fotos da homologação')
  return f
}

export const rheApi = {
  list: (params: RheListParams = {}) =>
    apiRequest<RheListResponse>('/rhe', {
      query: {
        fornecedorId: params.fornecedorId,
        filialId: params.filialId,
        status: params.status,
        homologacaoInicial: params.homologacaoInicial,
        page: params.page,
        pageSize: params.pageSize,
      },
    }),

  get: (id: string) => apiRequest<Rhe>(`/rhe/${id}`),

  create: (input: RheCreateInput) =>
    apiRequest<Rhe>('/rhe', { method: 'POST', body: input }),

  update: (id: string, input: Partial<RheCreateInput>) =>
    apiRequest<Rhe>(`/rhe/${id}`, { method: 'PATCH', body: input }),

  /** Registra a homologação final — permitido após o encerramento, uma vez. */
  homologacaoFinal: (id: string, resultado: HomologacaoResultado, data: string) =>
    apiRequest<Rhe>(`/rhe/${id}/homologacao-final`, {
      method: 'POST',
      body: { resultado, data },
    }),

  /** Reenvio manual ao fornecedor quando o envio automático falhou. */
  enviarFornecedor: (id: string) =>
    apiRequest<{ rhe: Rhe; email: string }>(`/rhe/${id}/enviar-fornecedor`, {
      method: 'POST',
    }),
}
