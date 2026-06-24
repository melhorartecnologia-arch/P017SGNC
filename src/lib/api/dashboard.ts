import { apiRequest } from './client'

export type Contagem = { id: string | null; label: string; total: number }
export type ContagemSeveridade = Contagem & { cor: string }

export type DashboardRnc = {
  total: number
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
