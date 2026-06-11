import { apiRequest } from './client'

export type ContatoTipo = 'TELEFONE_FIXO' | 'WHATSAPP' | 'EMAIL'

export type ContatoFornecedor = {
  id: string
  fornecedorId: string
  tipo: ContatoTipo
  valor: string
  nome: string | null
  principal: boolean
  createdAt: string
  updatedAt: string
}

export type Fornecedor = {
  id: string
  codigo: string
  razaoSocial: string
  nomeFantasia: string | null
  cnpj: string
  ativo: boolean
  observacoes: string | null
  contatos: ContatoFornecedor[]
  createdAt: string
  updatedAt: string
}

export type ContatoInput = {
  tipo: ContatoTipo
  valor: string
  nome?: string | null
  principal?: boolean
}

export type FornecedorInput = Omit<
  Fornecedor,
  'id' | 'createdAt' | 'updatedAt' | 'contatos'
> & {
  contatos: ContatoInput[]
}

export type FornecedorListParams = {
  q?: string
  ativo?: boolean
  page?: number
  pageSize?: number
}

export type FornecedorListResponse = {
  items: Fornecedor[]
  page: number
  pageSize: number
  total: number
}

export const TIPO_LABEL: Record<ContatoTipo, string> = {
  TELEFONE_FIXO: 'Telefone fixo',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'E-mail',
}

export const fornecedoresApi = {
  list: (params: FornecedorListParams = {}) =>
    apiRequest<FornecedorListResponse>('/fornecedores', {
      query: {
        q: params.q,
        ativo: params.ativo === undefined ? undefined : String(params.ativo),
        page: params.page,
        pageSize: params.pageSize,
      },
    }),

  get: (id: string) => apiRequest<Fornecedor>(`/fornecedores/${id}`),

  create: (input: Partial<FornecedorInput>) =>
    apiRequest<Fornecedor>('/fornecedores', { method: 'POST', body: input }),

  update: (id: string, input: Partial<FornecedorInput>) =>
    apiRequest<Fornecedor>(`/fornecedores/${id}`, { method: 'PATCH', body: input }),

  remove: (id: string) => apiRequest<void>(`/fornecedores/${id}`, { method: 'DELETE' }),
}
