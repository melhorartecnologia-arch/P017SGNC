import { z } from 'zod'
import {
  cnpjFormatoValido,
  cnpjValido,
  formatarCnpj,
  formatarTelefone,
  telefoneFormatoValido,
} from '../lib/br-format.js'

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

export const contatoTipoEnum = z.enum(['TELEFONE_FIXO', 'WHATSAPP', 'EMAIL'])
export type ContatoTipo = z.infer<typeof contatoTipoEnum>

export const contatoSchema = z
  .object({
    tipo: contatoTipoEnum,
    valor: z.string().trim().min(1, 'Valor obrigatório').max(160),
    nome: z.string().trim().max(120).optional().nullable(),
    principal: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.tipo === 'EMAIL') {
      const r = z.string().email().safeParse(data.valor)
      if (!r.success) {
        ctx.addIssue({
          code: 'custom',
          path: ['valor'],
          message: 'E-mail inválido',
        })
      }
    } else if (!telefoneFormatoValido(data.valor)) {
      // telefone fixo (10 dígitos) ou celular/WhatsApp (11), ambos com DDD
      ctx.addIssue({
        code: 'custom',
        path: ['valor'],
        message: 'Telefone deve ter DDD + 8 ou 9 dígitos',
      })
    }
  })
  // Padroniza a máscara do telefone antes de gravar.
  .transform((data) =>
    data.tipo === 'EMAIL'
      ? data
      : { ...data, valor: formatarTelefone(data.valor) },
  )

export const fornecedorCreateSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(2, 'Código muito curto')
    .max(20, 'Código muito longo')
    .transform((v) => v.toUpperCase()),
  razaoSocial: z.string().trim().min(2).max(160),
  nomeFantasia: z.string().trim().max(160).optional().nullable(),
  cnpj: cnpjFieldStrict,
  ativo: z.boolean().optional().default(true),
  observacoes: z.string().trim().max(2000).optional().nullable(),
  contatos: z.array(contatoSchema).max(20, 'Máximo de 20 contatos').optional(),
})

// Na edição o CNPJ valida apenas o formato; os dígitos verificadores são
// checados na rota somente quando o valor muda (preserva legados).
export const fornecedorUpdateSchema = fornecedorCreateSchema
  .partial()
  .extend({ cnpj: cnpjFieldFormato.optional() })

export const fornecedorQuerySchema = z.object({
  q: z.string().trim().optional(),
  ativo: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type FornecedorCreateInput = z.infer<typeof fornecedorCreateSchema>
export type FornecedorUpdateInput = z.infer<typeof fornecedorUpdateSchema>
export type FornecedorQuery = z.infer<typeof fornecedorQuerySchema>
export type ContatoInput = z.infer<typeof contatoSchema>
