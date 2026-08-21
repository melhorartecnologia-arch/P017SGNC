import { z } from 'zod'
import {
  cepFormatoValido,
  cnpjFormatoValido,
  cnpjValido,
  formatarCep,
  formatarCnpj,
} from '../lib/br-format.js'

const ufRegex = /^[A-Z]{2}$/

/** CNPJ (criação): valida 14 dígitos + dígitos verificadores e padroniza. */
const cnpjFieldStrict = z
  .string()
  .trim()
  .refine(cnpjFormatoValido, 'CNPJ deve conter 14 dígitos')
  .refine(cnpjValido, 'CNPJ inválido (dígitos verificadores)')
  .transform(formatarCnpj)

/** CNPJ (edição): valida só o formato e padroniza — DV é checado na rota
 *  para preservar registros antigos que já estavam fora do padrão. */
const cnpjFieldFormato = z
  .string()
  .trim()
  .refine(cnpjFormatoValido, 'CNPJ deve conter 14 dígitos')
  .transform(formatarCnpj)

/** CEP: aceita com ou sem máscara, valida 8 dígitos e grava padronizado. */
const cepField = z
  .string()
  .trim()
  .refine(cepFormatoValido, 'CEP deve conter 8 dígitos')
  .transform(formatarCep)

export const filialCreateSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(2, 'Código muito curto')
    .max(20, 'Código muito longo')
    .transform((v) => v.toUpperCase()),
  nome: z.string().trim().min(2).max(120),
  razaoSocial: z.string().trim().min(2).max(160),
  cnpj: cnpjFieldStrict,
  endereco: z.string().trim().min(2).max(200),
  numero: z.string().trim().max(20).optional().nullable(),
  complemento: z.string().trim().max(60).optional().nullable(),
  bairro: z.string().trim().max(80).optional().nullable(),
  cidade: z.string().trim().min(2).max(80),
  uf: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(ufRegex, 'UF inválida')),
  cep: cepField,
  ativo: z.boolean().optional().default(true),
  observacoes: z.string().trim().max(2000).optional().nullable(),
  // Ponto de partida da numeração de RNC (último número do controle atual).
  rncNumeroInicial: z.coerce.number().int().min(0).max(9_999_999).optional().default(0),
  raqNumeroInicial: z.coerce.number().int().min(0).max(9_999_999).optional().default(0),
  rvtNumeroInicial: z.coerce.number().int().min(0).max(9_999_999).optional().default(0),
})

// Na edição o CNPJ valida apenas o formato; os dígitos verificadores são
// checados na rota somente quando o valor muda (preserva legados).
export const filialUpdateSchema = filialCreateSchema
  .partial()
  .extend({ cnpj: cnpjFieldFormato.optional() })

export const filialQuerySchema = z.object({
  q: z.string().trim().optional(),
  ativo: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type FilialCreateInput = z.infer<typeof filialCreateSchema>
export type FilialUpdateInput = z.infer<typeof filialUpdateSchema>
export type FilialQuery = z.infer<typeof filialQuerySchema>
