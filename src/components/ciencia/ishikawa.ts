/**
 * Vocabulário do diagrama de Ishikawa (6M): categorias, rótulos em
 * português e a dica do que costuma entrar em cada uma. Fica separado do
 * componente para não misturar constantes com o que é renderizado.
 */

export type CausaIshikawa = {
  categoria: string
  descricao: string
}

export const ISHIKAWA_CATEGORIAS = [
  'METODO',
  'MAQUINA',
  'MAO_DE_OBRA',
  'MATERIAL',
  'MEDICAO',
  'MEIO_AMBIENTE',
] as const

export type IshikawaCategoria = (typeof ISHIKAWA_CATEGORIAS)[number]

export const ISHIKAWA_LABEL: Record<string, string> = {
  METODO: 'Método',
  MAQUINA: 'Máquina',
  MAO_DE_OBRA: 'Mão de obra',
  MATERIAL: 'Material',
  MEDICAO: 'Medição',
  MEIO_AMBIENTE: 'Meio ambiente',
}

/** Dica do que costuma entrar em cada categoria. */
export const ISHIKAWA_AJUDA: Record<string, string> = {
  METODO: 'Procedimento, instrução de trabalho, sequência de operação',
  MAQUINA: 'Equipamento, ferramental, manutenção, ajuste',
  MAO_DE_OBRA: 'Treinamento, experiência, turno, sobrecarga',
  MATERIAL: 'Matéria-prima, insumo, lote, fornecedor',
  MEDICAO: 'Instrumento, calibração, critério de inspeção, amostragem',
  MEIO_AMBIENTE: 'Temperatura, umidade, limpeza, layout, iluminação',
}

