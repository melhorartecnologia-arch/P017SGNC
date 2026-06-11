import { z } from 'zod'

export const tipoNaoConformidadeCreateSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(2, 'Código muito curto')
    .max(20, 'Código muito longo')
    .transform((v) => v.toUpperCase()),
  descricao: z.string().trim().min(2).max(160),
  severidadeId: z
    .string()
    .uuid('Severidade inválida')
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null)),
  ativo: z.boolean().optional().default(true),
  produtosIds: z.array(z.string().uuid()).optional().default([]),
})

export const tipoNaoConformidadeUpdateSchema =
  tipoNaoConformidadeCreateSchema.partial()

export const tipoNaoConformidadeQuerySchema = z.object({
  q: z.string().trim().optional(),
  severidadeId: z.string().uuid().optional(),
  ativo: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type TipoNaoConformidadeCreateInput = z.infer<
  typeof tipoNaoConformidadeCreateSchema
>
export type TipoNaoConformidadeUpdateInput = z.infer<
  typeof tipoNaoConformidadeUpdateSchema
>
export type TipoNaoConformidadeQuery = z.infer<typeof tipoNaoConformidadeQuerySchema>
