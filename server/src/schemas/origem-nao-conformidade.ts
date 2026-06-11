import { z } from 'zod'

export const origemCreateSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(2, 'Código muito curto')
    .max(20, 'Código muito longo')
    .transform((v) => v.toUpperCase()),
  nome: z.string().trim().min(2).max(120),
  descricao: z.string().trim().max(2000).optional().nullable(),
  ativo: z.boolean().optional().default(true),
  tiposRelatorioIds: z.array(z.string().uuid()).optional().default([]),
})

export const origemUpdateSchema = origemCreateSchema.partial()

export const origemQuerySchema = z.object({
  q: z.string().trim().optional(),
  ativo: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type OrigemCreateInput = z.infer<typeof origemCreateSchema>
export type OrigemUpdateInput = z.infer<typeof origemUpdateSchema>
export type OrigemQuery = z.infer<typeof origemQuerySchema>
