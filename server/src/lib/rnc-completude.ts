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
