import { z } from 'zod'

export const disposicaoCreateSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(2, 'Código muito curto')
    .max(20, 'Código muito longo')
    .transform((v) => v.toUpperCase()),
  descricao: z.string().trim().min(2).max(160),
  ativo: z.boolean().optional().default(true),
  tiposRelatorioIds: z.array(z.string().uuid()).optional().default([]),
})

export const disposicaoUpdateSchema = disposicaoCreateSchema.partial()

export const disposicaoQuerySchema = z.object({
  q: z.string().trim().optional(),
  ativo: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type DisposicaoCreateInput = z.infer<typeof disposicaoCreateSchema>
export type DisposicaoUpdateInput = z.infer<typeof disposicaoUpdateSchema>
export type DisposicaoQuery = z.infer<typeof disposicaoQuerySchema>
