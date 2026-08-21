import { ApiError, apiRequest, tokenStorage } from './client'

export type RncStatus = 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'CLOSED' | 'CANCELLED'

/** Situação da ciência do fornecedor sobre a RNC concluída. */
export type CienciaRncStatus =
  | 'PENDENTE'
  | 'ACEITA'
  | 'RECUSADA'
  | 'ACEITA_POR_DECURSO'
  | 'RECUSA_ACEITA'
  | 'MANTIDA_DEFINITIVA'

export const CIENCIA_RNC_LABEL: Record<CienciaRncStatus, string> = {
  PENDENTE: 'Aguardando fornecedor',
  ACEITA: 'Aceita pelo fornecedor',
  RECUSADA: 'Recusada — aguardando análise',
  ACEITA_POR_DECURSO: 'Aceita por decurso de prazo',
  RECUSA_ACEITA: 'Recusa acatada',
  MANTIDA_DEFINITIVA: 'Mantida em definitivo',
}

/** Situação do plano de ações de contingência do fornecedor. */
export type ContingenciaRncStatus =
  | 'PENDENTE'
  | 'EM_ANALISE'
  | 'APROVADA'
  | 'AJUSTE_SOLICITADO'

export const CONTINGENCIA_RNC_LABEL: Record<ContingenciaRncStatus, string> = {
  PENDENTE: 'Aguardando o plano',
  EM_ANALISE: 'Plano para aprovar',
  APROVADA: 'Plano aprovado',
  AJUSTE_SOLICITADO: 'Devolvido para ajuste',
}

/** Situação de cada ação do plano. */
export type AcaoContingenciaStatus = 'PENDENTE' | 'APROVADA' | 'RECUSADA'

export const ACAO_CONTINGENCIA_LABEL: Record<AcaoContingenciaStatus, string> = {
  PENDENTE: 'Aguardando análise',
  APROVADA: 'Aprovada',
  RECUSADA: 'Recusada',
}

/** Situação da análise de causa (Ishikawa + 5W2H). */
export type CausaRaizRncStatus =
  | 'PENDENTE'
  | 'EM_ANALISE'
  | 'APROVADA'
  | 'AJUSTE_SOLICITADO'

export const CAUSA_RAIZ_LABEL: Record<CausaRaizRncStatus, string> = {
  PENDENTE: 'Aguardando o fornecedor',
  EM_ANALISE: 'Análise para aprovar',
  APROVADA: 'Análise aprovada',
  AJUSTE_SOLICITADO: 'Rejeitada — em ajuste',
}

/** Situação da verificação de eficácia do plano de ação. */
export type EficaciaRncStatus =
  | 'AGUARDANDO_PRAZO'
  | 'PENDENTE'
  | 'EFICAZ'
  | 'NAO_EFICAZ'

export const EFICACIA_LABEL: Record<EficaciaRncStatus, string> = {
  AGUARDANDO_PRAZO: 'Aguardando o prazo',
  PENDENTE: 'Verificação liberada',
  EFICAZ: 'Eficaz',
  NAO_EFICAZ: 'Não eficaz',
}

export type CausaIshikawaRnc = {
  id: string
  categoria: string
  ordem: number
  descricao: string
}

/** Uma ação do plano de contingência, com o veredito do aprovador. */
export type AcaoContingencia = {
  id: string
  ordem: number
  descricao: string
  responsavel: string | null
  prazo: string | null
  status: AcaoContingenciaStatus
  informadaEm: string
  informadaPor: string | null
  analisadaEm: string | null
  analisadaPor: string | null
  parecer: string | null
}

export type SeveridadeRef = {
  id: string
  codigo: string
  nome: string
  nivel: number
  cor: string | null
}

export type ProdutoRef = {
  id: string
  codigo: string
  descricao: string
  unidadeMedida: string
}

export type Rnc = {
  id: string
  numero: string
  /** RNC, RAQ ou RVT — os endpoints de workflow servem os três tipos. */
  tipoDocumento: 'RNC' | 'RAQ' | 'RVT'
  titulo: string | null
  filialId: string
  fornecedorId: string
  tipoNaoConformidadeId: string
  turnoId: string | null
  disposicaoMaterialId: string | null
  origemId: string | null
  severidadeId: string | null
  descricaoDefeito: string | null
  dataIdentificacao: string
  status: RncStatus
  criadoPorId: string
  assinaturaEnviadaEm: string | null
  escalonadoEm: string | null
  assinaturasConcluidasEm: string | null

  /** Ciência do fornecedor (após todas as assinaturas). */
  cienciaStatus: CienciaRncStatus | null
  cienciaEmail: string | null
  cienciaEnviadaEm: string | null
  cienciaPrazoEm: string | null
  cienciaRespondidaEm: string | null
  cienciaRespondidaPor: string | null
  cienciaJustificativa: string | null
  cienciaAnaliseEm: string | null
  cienciaAnalisePor: string | null
  cienciaAnaliseJustificativa: string | null
  cienciaDefinitivaEm: string | null

  /** Ações de contingência devidas depois de confirmada a NC. */
  contingenciaStatus: ContingenciaRncStatus | null
  contingenciaSolicitadaEm: string | null
  contingenciaPrazoEm: string | null
  contingenciaRespondidaEm: string | null
  contingenciaRespondidaPor: string | null
  contingenciaAnalisadaEm: string | null
  contingenciaAnalisadaPor: string | null
  contingenciaAlertas: number
  acoesContingencia: AcaoContingencia[]

  /** Análise de causa: Ishikawa + 5W2H, aberta com o envio do plano. */
  causaRaizStatus: CausaRaizRncStatus | null
  causaRaizSolicitadaEm: string | null
  causaRaizEnviadaEm: string | null
  causaRaizEnviadaPor: string | null
  causaRaizAnalisadaEm: string | null
  causaRaizAnalisadaPor: string | null
  causaRaizParecer: string | null
  causaRaizEnvios: number
  causaOQue: string | null
  causaPorQue: string | null
  causaOnde: string | null
  causaQuando: string | null
  causaQuem: string | null
  causaComo: string | null
  causaQuantoCusta: string | null
  causasIshikawa: CausaIshikawaRnc[]

  /** Verificação de eficácia, aberta quando plano e causa são aprovados. */
  eficaciaStatus: EficaciaRncStatus | null
  eficaciaAbertaEm: string | null
  eficaciaDataBase: string | null
  eficaciaLiberadaEm: string | null
  eficaciaVerificadaEm: string | null
  eficaciaVerificadaPor: string | null
  eficaciaParecer: string | null

  // Material & lote
  produtoId: string | null
  lotes: { id: string; numero: string; quantidade: number | null }[]
  quantidadeDefeito: number | null
  tempoParadaMinutos: number | null

  // Notas fiscais & datas
  notasFiscais: {
    id: string
    numero: string | null
    dataFabricacao: string | null
    dataValidade: string | null
    dataRecebimento: string | null
  }[]

  // Transporte
  transportador: string | null
  placaCavalo: string | null
  placaCarreta: string | null
  nomeMotorista: string | null
  cnhMotorista: string | null

  /** Matriz de aprovação: quem deve assinar (uma pessoa por área). */
  aprovadores: {
    id: string
    areaNome: string
    nome: string
    cargo: string | null
    email: string | null
    nivel: number | null
    assinadoEm: string | null
    assinaturaIp: string | null
    assinaturaNavegador: string | null
    assinaturaSo: string | null
    assinaturaDispositivo: string | null
    assinaturaLatitude: number | null
    assinaturaLongitude: number | null
    assinaturaPrecisao: number | null
    assinaturaMetadados: Record<string, unknown> | null
    lembreteEnviadoEm: string | null
    viaEscalonamento: boolean
  }[]

  filial: { id: string; codigo: string; nome: string }
  fornecedor: { id: string; codigo: string; razaoSocial: string; cnpj: string }
  tipoNaoConformidade: {
    id: string
    codigo: string
    descricao: string
    severidade: SeveridadeRef | null
  }
  turno: { id: string; codigo: string; nome: string } | null
  disposicaoMaterial: { id: string; codigo: string; descricao: string } | null
  origem: { id: string; codigo: string; nome: string } | null
  severidade: SeveridadeRef | null
  produto: ProdutoRef | null
  criadoPor: { id: string; nome: string; email: string }
  _count: { fotos: number }
  createdAt: string
  updatedAt: string
}

export type RncCreateInput = {
  filialId: string
  fornecedorId: string
  tipoNaoConformidadeId: string
  turnoId: string
  disposicaoMaterialId: string
  origemId: string
  severidadeId: string
  descricaoDefeito: string
  dataIdentificacao: string
  status?: RncStatus

  produtoId: string
  lotes: { numero: string; quantidade?: number | null }[]
  quantidadeDefeito?: number | null
  tempoParadaMinutos?: number | null

  notasFiscais?: {
    numero: string
    dataFabricacao?: string | null
    dataValidade?: string | null
    dataRecebimento?: string | null
  }[]

  transportador?: string | null
  placaCavalo?: string | null
  placaCarreta?: string | null
  nomeMotorista?: string | null
  cnhMotorista?: string | null
}

export type RncListParams = {
  fornecedorId?: string
  tipoNaoConformidadeId?: string
  filialId?: string
  produtoId?: string
  disposicaoMaterialId?: string
  origemId?: string
  severidadeId?: string
  status?: RncStatus
  /** Ciência do fornecedor; "__none__" = ainda não enviada. */
  cienciaStatus?: CienciaRncStatus | '__none__'
  /** Ações de contingência; "__none__" = ainda não solicitadas. */
  contingenciaStatus?: ContingenciaRncStatus | '__none__'
  /** Só as RNCs com ações de contingência fora do prazo. */
  contingenciaAtrasada?: boolean
  /** Análise de causa; "__none__" = etapa ainda não aberta. */
  causaRaizStatus?: CausaRaizRncStatus | '__none__'
  /** Verificação de eficácia; "__none__" = etapa ainda não aberta. */
  eficaciaStatus?: EficaciaRncStatus | '__none__'
  de?: string
  ate?: string
  limit?: number
  page?: number
  pageSize?: number
}

export type RncListResponse = {
  items: Rnc[]
  page: number
  pageSize: number
  total: number
}

export type AssinaturaStatus = {
  total: number
  assinadas: number
  /** 'vazio' = sem aprovadores; senão pendente/parcial/completo. */
  estado: 'vazio' | 'pendente' | 'parcial' | 'completo'
  label: string
}

/** Resumo do andamento das assinaturas da matriz de aprovação. */
export function resumoAssinaturas(rnc: Rnc): AssinaturaStatus {
  const total = rnc.aprovadores.length
  const assinadas = rnc.aprovadores.filter((a) => a.assinadoEm).length
  if (total === 0) {
    return { total, assinadas, estado: 'vazio', label: 'Sem aprovadores' }
  }
  if (assinadas === 0) {
    return { total, assinadas, estado: 'pendente', label: `Pendente · 0/${total}` }
  }
  if (assinadas < total) {
    return { total, assinadas, estado: 'parcial', label: `Parcial · ${assinadas}/${total}` }
  }
  return { total, assinadas, estado: 'completo', label: `Assinado · ${total}/${total}` }
}

export type EnvioAssinatura = {
  id: string
  rncNumero: string
  enviadoPorNome: string
  totalDestinatarios: number
  destinatarios: { email: string; areaNome: string; nome: string }[]
  enviadoEm: string
  rnc: {
    id: string
    tipoDocumento: 'RNC' | 'RAQ' | 'RVT'
    status: RncStatus
    filial: { codigo: string; nome: string } | null
    fornecedor: { codigo: string; razaoSocial: string } | null
    aprovadores: { areaNome: string; nome: string; assinadoEm: string | null }[]
  } | null
}

/** Pendências que impedem o envio para assinatura (espelha o servidor). */
export function pendenciasParaAssinatura(rnc: Rnc): string[] {
  const f: string[] = []
  if (!rnc.produtoId) f.push('Produto')
  if (rnc.lotes.length === 0) f.push('Lotes')
  if (rnc.quantidadeDefeito == null) f.push('Quantidade com defeito')
  if (rnc.notasFiscais.length === 0) f.push('Nota fiscal')
  if (!rnc.disposicaoMaterialId) f.push('Disposição do material')
  if (!rnc.origemId) f.push('Origem da não conformidade')
  if (!rnc.severidadeId) f.push('Severidade')
  if (!rnc.descricaoDefeito || !rnc.descricaoDefeito.trim())
    f.push('Descrição do defeito')
  if (rnc._count.fotos === 0) f.push('Fotos da ocorrência')
  return f
}

export const rncApi = {
  list: (params: RncListParams = {}) =>
    apiRequest<RncListResponse>('/rnc', {
      query: {
        fornecedorId: params.fornecedorId,
        tipoNaoConformidadeId: params.tipoNaoConformidadeId,
        filialId: params.filialId,
        produtoId: params.produtoId,
        disposicaoMaterialId: params.disposicaoMaterialId,
        origemId: params.origemId,
        severidadeId: params.severidadeId,
        status: params.status,
        cienciaStatus: params.cienciaStatus,
        contingenciaStatus: params.contingenciaStatus,
        contingenciaAtrasada: params.contingenciaAtrasada,
        causaRaizStatus: params.causaRaizStatus,
        eficaciaStatus: params.eficaciaStatus,
        de: params.de,
        ate: params.ate,
        limit: params.limit,
        page: params.page,
        pageSize: params.pageSize,
      },
    }),

  get: (id: string) => apiRequest<Rnc>(`/rnc/${id}`),

  create: (input: RncCreateInput) =>
    apiRequest<Rnc>('/rnc', { method: 'POST', body: input }),

  update: (id: string, input: Partial<RncCreateInput>) =>
    apiRequest<Rnc>(`/rnc/${id}`, { method: 'PATCH', body: input }),

  /** Registra ou cancela a assinatura de um aprovador da matriz. */
  setAssinatura: (rncId: string, aprovadorId: string, assinado: boolean) =>
    apiRequest<Rnc>(`/rnc/${rncId}/aprovadores/${aprovadorId}`, {
      method: 'PATCH',
      body: { assinado },
    }),

  /** Envia a RNC para assinatura dos aprovadores (e-mail com link). */
  enviarParaAssinatura: (id: string) =>
    apiRequest<{
      rnc: Rnc
      enviados: string[]
      falhas: { email: string; erro: string }[]
    }>(`/rnc/${id}/enviar-assinatura`, { method: 'POST' }),

  /** Lembrete manual aos aprovadores ainda pendentes. */
  enviarLembrete: (id: string) =>
    apiRequest<{ rnc: Rnc; enviados: number }>(`/rnc/${id}/lembrete`, {
      method: 'POST',
    }),

  /**
   * Analisa a recusa do fornecedor pela plataforma: acata a recusa ou a
   * nega — e nesse caso a RNC é enviada em definitivo ao fornecedor.
   */
  analisarRecusa: (
    id: string,
    body: { acatarRecusa: boolean; justificativa?: string | null },
  ) =>
    apiRequest<Rnc>(`/rnc/${id}/ciencia/analisar`, {
      method: 'POST',
      body,
    }),

  /**
   * Aprova ou recusa UMA ação do plano de contingência. A recusa exige
   * parecer — é o texto que volta ao fornecedor para correção.
   */
  analisarAcaoContingencia: (
    rncId: string,
    acaoId: string,
    body: { aprovada: boolean; parecer?: string | null },
  ) =>
    apiRequest<Rnc>(`/rnc/${rncId}/contingencia/acoes/${acaoId}`, {
      method: 'POST',
      body,
    }),

  /** Aprova ou rejeita a análise de causa (Ishikawa e 5W2H). */
  analisarCausaRaiz: (
    id: string,
    body: { aprovada: boolean; parecer?: string | null },
  ) =>
    apiRequest<Rnc>(`/rnc/${id}/causa-raiz/analisar`, {
      method: 'POST',
      body,
    }),

  /** Registra a verificação de eficácia do plano de ação. */
  verificarEficacia: (
    id: string,
    body: { eficaz: boolean; parecer?: string | null },
  ) =>
    apiRequest<Rnc>(`/rnc/${id}/eficacia`, { method: 'POST', body }),

  /** Escalonamento manual: sobe um nível acima nas áreas pendentes. */
  escalonar: (id: string) =>
    apiRequest<{ rnc: Rnc; novos: number }>(`/rnc/${id}/escalonar`, {
      method: 'POST',
    }),

  /** Histórico de envios de workflow para assinatura (filtra por código). */
  listEnvios: (params: { q?: string; page?: number; pageSize?: number } = {}) =>
    apiRequest<{
      items: EnvioAssinatura[]
      page: number
      pageSize: number
      total: number
    }>('/rnc/envios', {
      query: {
        q: params.q,
        page: params.page,
        pageSize: params.pageSize,
      },
    }),

  /** Baixa o PDF da RNC (layout do formulário) e dispara o download. */
  downloadPdf: async (id: string, numero: string): Promise<void> => {
    const token = tokenStorage.get()
    const res = await fetch(`/api/rnc/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    if (!res.ok) {
      if (res.status === 401) tokenStorage.clear()
      const payload = await res.json().catch(() => null)
      throw new ApiError(res.status, payload?.message ?? res.statusText, payload)
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `RNC-${numero}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },
}
