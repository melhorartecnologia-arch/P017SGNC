import { apiRequest } from './client'

export type Contagem = { id: string | null; label: string; total: number }
export type ContagemSeveridade = Contagem & {
  nivel: number | null
  cor: string
}
export type ContagemStatus = { status: string; total: number }

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
}

export const dashboardApi = {
  rnc: () => apiRequest<DashboardRnc>('/dashboard/rnc'),
}
