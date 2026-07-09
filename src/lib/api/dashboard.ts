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

export const dashboardApi = {
  rnc: (periodo?: { de?: string; ate?: string }) =>
    apiRequest<DashboardRnc>('/dashboard/rnc', {
      query: { de: periodo?.de, ate: periodo?.ate },
    }),
}
