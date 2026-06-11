import { z } from 'zod'

export const produtoCreateSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(1, 'Código obrigatório')
    .max(20, 'Código muito longo')
    .transform((v) => v.toUpperCase()),
  descricao: z.string().trim().min(2).max(160),
  unidadeMedida: z
    .string()
    .trim()
    .min(1, 'Unidade obrigatória')
    .max(10, 'Unidade muito longa')
    .transform((v) => v.toUpperCase()),
  ativo: z.boolean().optional().default(true),
})

export const produtoUpdateSchema = produtoCreateSchema.partial()

export const produtoQuerySchema = z.object({
  q: z.string().trim().optional(),
  ativo: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type ProdutoCreateInput = z.infer<typeof produtoCreateSchema>
export type ProdutoUpdateInput = z.infer<typeof produtoUpdateSchema>
export type ProdutoQuery = z.infer<typeof produtoQuerySchema>
