import { z } from 'zod'

export const areaCreateSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(2, 'Código muito curto')
    .max(20, 'Código muito longo')
    .transform((v) => v.toUpperCase()),
  nome: z.string().trim().min(2).max(120),
  descricao: z.string().trim().max(2000).optional().nullable(),
  ativo: z.boolean().optional().default(true),
})

export const areaUpdateSchema = areaCreateSchema.partial()

export const areaQuerySchema = z.object({
  q: z.string().trim().optional(),
  ativo: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type AreaCreateInput = z.infer<typeof areaCreateSchema>
export type AreaUpdateInput = z.infer<typeof areaUpdateSchema>
export type AreaQuery = z.infer<typeof areaQuerySchema>
