import { z } from 'zod'

const cnpjRegex = /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/

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
    } else {
      // telefone fixo / whatsapp: exige ao menos 8 dígitos
      const digits = data.valor.replace(/\D/g, '')
      if (digits.length < 8) {
        ctx.addIssue({
          code: 'custom',
          path: ['valor'],
          message: 'Telefone inválido',
        })
      }
    }
  })

export const fornecedorCreateSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(2, 'Código muito curto')
    .max(20, 'Código muito longo')
    .transform((v) => v.toUpperCase()),
  razaoSocial: z.string().trim().min(2).max(160),
  nomeFantasia: z.string().trim().max(160).optional().nullable(),
  cnpj: z.string().trim().regex(cnpjRegex, 'CNPJ inválido'),
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
