import { apiRequest } from './client'

export type Contagem = { id: string | null; label: string; total: number }
export type ContagemSeveridade = Contagem & {
  nivel: number | null
  cor: string
}
export type ContagemStatus = { status: string; total: number }

export type ContagemMes = { label: string; ano: number; total: number }
export type ContagemDia = { label: string; total: number }
export type ComparativoAnterior = {
  total: number
  abertas: number
  encerradas: number
}

export type DashboardRnc = {
  total: number
  porStatus: ContagemStatus[]
  porFilial: Contagem[]
  porTipo: Contagem[]
  topFornecedores: Contagem[]
  topProdutos: Contagem[]
  porDisposicao: Contagem[]
  porOrigem: Contagem[]
  porSeveridade: ContagemSeveridade[]
  porMes: ContagemMes[]
  porDia: ContagemDia[]
  anterior: ComparativoAnterior | null
  /** Horas de parada: soma dos minutos de parada das RNCs no período. */
  paradaTotalMinutos: number
  /** Nº de RNCs com tempo de parada informado. */
  paradaRncs: number
  /** Minutos de parada agrupados (total = minutos). */
  paradaPorFilial: Contagem[]
  paradaPorTipo: Contagem[]
  paradaTopFornecedores: Contagem[]
}

export type TipoPainelDocs = 'RAQ' | 'RVT' | 'RHE'

export type ContagemHomologacao = { valor: string | null; total: number }

/** Painel dos demais tipos (RAQ/RVT/RHE) — dimensões comuns + específicas. */
export type DashboardDocs = {
  tipo: TipoPainelDocs
  total: number
  porStatus: ContagemStatus[]
  porFilial: Contagem[]
  topFornecedores: Contagem[]
  topProdutos: Contagem[]
  porMes: ContagemMes[]
  porDia: ContagemDia[]
  anterior: ComparativoAnterior | null
  /** Documentos com o PDF assinado já enviado ao fornecedor. */
  enviadosFornecedor: number
  /** Documentos com todas as assinaturas concluídas. */
  assinaturasConcluidas: number
  // Específicas do RAQ (vazias nos demais tipos).
  porSeveridade: ContagemSeveridade[]
  porOrigem: Contagem[]
  porDisposicao: Contagem[]
  reincidentes: number
  // Específicas do RHE (vazias nos demais tipos).
  porHomologacaoInicial: ContagemHomologacao[]
  porHomologacaoFinal: ContagemHomologacao[]
}

export const dashboardApi = {
  rnc: (periodo?: { de?: string; ate?: string }) =>
    apiRequest<DashboardRnc>('/dashboard/rnc', {
      query: { de: periodo?.de, ate: periodo?.ate },
    }),

  documentos: (tipo: TipoPainelDocs, periodo?: { de?: string; ate?: string }) =>
    apiRequest<DashboardDocs>('/dashboard/documentos', {
      query: { tipo, de: periodo?.de, ate: periodo?.ate },
    }),
}
