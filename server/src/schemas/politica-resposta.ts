import { z } from 'zod'

export const politicaCreateSchema = z.object({
  tipoRelatorioId: z.string().uuid('Tipo de relatório inválido'),
  // Prazo em horas fracionárias (1.5 = 1h30). Mínimo de 1 minuto.
  horasResposta: z.coerce
    .number({ invalid_type_error: 'Prazo inválido' })
    .max(8760, 'Máximo de 8760 horas (1 ano)')
    .refine((v) => v >= 1 / 60 - 1e-9, 'Mínimo de 1 minuto'),
  descricao: z.string().trim().max(2000).optional().nullable(),
  ativo: z.boolean().optional().default(true),
})

export const politicaUpdateSchema = politicaCreateSchema.partial()

export const politicaQuerySchema = z.object({
  q: z.string().trim().optional(),
  tipoRelatorioId: z.string().uuid().optional(),
  ativo: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type PoliticaCreateInput = z.infer<typeof politicaCreateSchema>
export type PoliticaUpdateInput = z.infer<typeof politicaUpdateSchema>
export type PoliticaQuery = z.infer<typeof politicaQuerySchema>
