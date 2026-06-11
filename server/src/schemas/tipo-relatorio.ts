import { z } from 'zod'

export const tipoRelatorioCreateSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(2, 'Código muito curto')
    .max(20, 'Código muito longo')
    .transform((v) => v.toUpperCase()),
  descricao: z.string().trim().min(2).max(160),
  ativo: z.boolean().optional().default(true),
})

export const tipoRelatorioUpdateSchema = tipoRelatorioCreateSchema.partial()

export const tipoRelatorioQuerySchema = z.object({
  q: z.string().trim().optional(),
  ativo: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type TipoRelatorioCreateInput = z.infer<typeof tipoRelatorioCreateSchema>
export type TipoRelatorioUpdateInput = z.infer<typeof tipoRelatorioUpdateSchema>
export type TipoRelatorioQuery = z.infer<typeof tipoRelatorioQuerySchema>
