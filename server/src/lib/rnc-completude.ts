/** Campos obrigatórios da RNC + ao menos uma foto para envio à assinatura. */
export type RncParaValidar = {
  filialId: string | null
  fornecedorId: string | null
  tipoNaoConformidadeId: string | null
  turnoId: string | null
  produtoId: string | null
  disposicaoMaterialId: string | null
  origemId: string | null
  severidadeId: string | null
  descricaoDefeito: string | null
  quantidadeDefeito: number | null
  lotes: unknown[]
  notasFiscais: unknown[]
  fotos: unknown[]
}

/** Retorna a lista de pendências; vazio significa RNC pronta. */
export function pendenciasParaAssinatura(rnc: RncParaValidar): string[] {
  const faltando: string[] = []
  if (!rnc.filialId) faltando.push('Unidade (filial)')
  if (!rnc.fornecedorId) faltando.push('Fornecedor')
  if (!rnc.tipoNaoConformidadeId) faltando.push('Tipo de não conformidade')
  if (!rnc.turnoId) faltando.push('Turno de trabalho')
  if (!rnc.produtoId) faltando.push('Produto')
  if (!rnc.lotes || rnc.lotes.length === 0) faltando.push('Lotes')
  if (rnc.quantidadeDefeito == null) faltando.push('Quantidade com defeito')
  if (!rnc.notasFiscais || rnc.notasFiscais.length === 0)
    faltando.push('Nota fiscal')
  if (!rnc.disposicaoMaterialId) faltando.push('Disposição do material')
  if (!rnc.origemId) faltando.push('Origem da não conformidade')
  if (!rnc.severidadeId) faltando.push('Severidade')
  if (!rnc.descricaoDefeito || !rnc.descricaoDefeito.trim())
    faltando.push('Descrição do defeito')
  if (!rnc.fotos || rnc.fotos.length === 0) faltando.push('Fotos da ocorrência')
  return faltando
}

/** Campos obrigatórios do RAQ + ao menos uma foto para envio à assinatura. */
export type RaqParaValidar = {
  filialId: string | null
  fornecedorId: string | null
  titulo?: string | null
  produtoId: string | null
  disposicaoMaterialId: string | null
  origemId: string | null
  severidadeId: string | null
  descricaoDefeito: string | null
  quantidadeDefeito: number | null
  lotes: unknown[]
  notasFiscais: unknown[]
  fotos: unknown[]
}

/** Pendências do RAQ; vazio significa pronto para assinatura. */
export function pendenciasParaAssinaturaRaq(raq: RaqParaValidar): string[] {
  const faltando: string[] = []
  if (!raq.filialId) faltando.push('Unidade (filial)')
  if (!raq.titulo || !raq.titulo.trim()) faltando.push('Título do RAQ')
  if (!raq.fornecedorId) faltando.push('Fornecedor')
  if (!raq.produtoId) faltando.push('Produto')
  if (!raq.lotes || raq.lotes.length === 0) faltando.push('Lote')
  if (raq.quantidadeDefeito == null) faltando.push('Quantidade com defeito')
  if (!raq.notasFiscais || raq.notasFiscais.length === 0)
    faltando.push('Nota fiscal')
  if (!raq.disposicaoMaterialId) faltando.push('Disposição do material')
  if (!raq.origemId) faltando.push('Origem da não conformidade')
  if (!raq.severidadeId) faltando.push('Severidade')
  if (!raq.descricaoDefeito || !raq.descricaoDefeito.trim())
    faltando.push('Descrição da ocorrência')
  if (!raq.fotos || raq.fotos.length === 0) faltando.push('Fotos da ocorrência')
  return faltando
}

/** Campos obrigatórios do RVT + ao menos uma foto para envio à assinatura. */
export type RvtParaValidar = {
  filialId: string | null
  fornecedorId: string | null
  produtoId: string | null
  pauta?: string | null
  assuntosAbordados?: string | null
  conclusao?: string | null
  participantes?: unknown[]
  fotos: unknown[]
}

/** Pendências do RVT; vazio significa pronto para assinatura. */
export function pendenciasParaAssinaturaRvt(rvt: RvtParaValidar): string[] {
  const faltando: string[] = []
  if (!rvt.filialId) faltando.push('Unidade (filial)')
  if (!rvt.fornecedorId) faltando.push('Fornecedor')
  if (!rvt.produtoId) faltando.push('Produto')
  if (!rvt.pauta || !rvt.pauta.trim()) faltando.push('Pauta')
  if (!rvt.participantes || rvt.participantes.length === 0)
    faltando.push('Participantes')
  if (!rvt.assuntosAbordados || !rvt.assuntosAbordados.trim())
    faltando.push('Assuntos abordados')
  if (!rvt.conclusao || !rvt.conclusao.trim()) faltando.push('Conclusão')
  if (!rvt.fotos || rvt.fotos.length === 0)
    faltando.push('Fotos da visita técnica')
  return faltando
}
