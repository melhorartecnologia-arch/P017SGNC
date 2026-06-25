import { z } from 'zod'
import { cnpjFormatoValido, formatarCnpj } from '../lib/br-format.js'

const cepRegex = /^\d{5}-?\d{3}$/
const ufRegex = /^[A-Z]{2}$/

/** CNPJ: aceita com ou sem máscara, valida 14 dígitos e grava padronizado. */
const cnpjField = z
  .string()
  .trim()
  .refine(cnpjFormatoValido, 'CNPJ deve conter 14 dígitos')
  .transform(formatarCnpj)

export const filialCreateSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(2, 'Código muito curto')
    .max(20, 'Código muito longo')
    .transform((v) => v.toUpperCase()),
  nome: z.string().trim().min(2).max(120),
  razaoSocial: z.string().trim().min(2).max(160),
  cnpj: cnpjField,
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
  cep: z.string().trim().regex(cepRegex, 'CEP inválido'),
  ativo: z.boolean().optional().default(true),
  observacoes: z.string().trim().max(2000).optional().nullable(),
})

export const filialUpdateSchema = filialCreateSchema.partial()

export const filialQuerySchema = z.object({
  q: z.string().trim().optional(),
  ativo: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type FilialCreateInput = z.infer<typeof filialCreateSchema>
export type FilialUpdateInput = z.infer<typeof filialUpdateSchema>
export type FilialQuery = z.infer<typeof filialQuerySchema>
