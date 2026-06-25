/**
 * Máscaras de digitação para documentos/telefones brasileiros.
 * Aplicadas no onChange dos campos para manter o formato esperado
 * enquanto o usuário digita (Filiais/Fornecedores).
 */

const digitos = (v: string) => v.replace(/\D/g, '')

/** Máscara de CNPJ progressiva: 00.000.000/0001-00. */
export function maskCnpj(v: string): string {
  const d = digitos(v).slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

/**
 * Máscara de telefone progressiva. Até 10 dígitos usa o padrão de fixo
 * (00) 0000-0000; com 11 dígitos, o de celular (00) 00000-0000.
 */
export function maskTelefone(v: string): string {
  const d = digitos(v).slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** Máscara de CEP progressiva: 00000-000. */
export function maskCep(v: string): string {
  const d = digitos(v).slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}
