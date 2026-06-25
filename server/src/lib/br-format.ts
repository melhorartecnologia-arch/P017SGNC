/**
 * Utilitários de formatação de documentos/telefones brasileiros.
 * Usados para padronizar a máscara antes de gravar (Filiais/Fornecedores),
 * evitando cadastros fora do formato esperado.
 */

/** Remove tudo que não for dígito. */
export function soDigitos(v: string): string {
  return (v ?? '').replace(/\D/g, '')
}

/** CNPJ precisa ter exatamente 14 dígitos (validação de formato). */
export function cnpjFormatoValido(v: string): boolean {
  return soDigitos(v).length === 14
}

/** Formata um CNPJ na máscara 00.000.000/0001-00. */
export function formatarCnpj(v: string): string {
  const d = soDigitos(v).slice(0, 14)
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

/** Telefone válido: 10 dígitos (fixo) ou 11 (celular), ambos com DDD. */
export function telefoneFormatoValido(v: string): boolean {
  const n = soDigitos(v).length
  return n === 10 || n === 11
}

/** Formata telefone na máscara (00) 0000-0000 ou (00) 00000-0000. */
export function formatarTelefone(v: string): string {
  const d = soDigitos(v)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return v
}
