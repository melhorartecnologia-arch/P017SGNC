import { z } from 'zod'
import {
  cnpjFormatoValido,
  formatarCnpj,
  formatarTelefone,
  telefoneFormatoValido,
} from '../lib/br-format.js'

/** CNPJ: aceita com ou sem máscara, valida 14 dígitos e grava padronizado. */
const cnpjField = z
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
  cnpj: cnpjField,
  ativo: z.boolean().optional().default(true),
  observacoes: z.string().trim().max(2000).optional().nullable(),
  contatos: z.array(contatoSchema).max(20, 'Máximo de 20 contatos').optional(),
})

export const fornecedorUpdateSchema = fornecedorCreateSchema.partial()

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
