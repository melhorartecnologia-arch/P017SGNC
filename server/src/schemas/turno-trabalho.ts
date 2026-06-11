import { z } from 'zod'

const horaRegex = /^([01]\d|2[0-3]):[0-5]\d$/

export const turnoCreateSchema = z.object({
  filialId: z.string().uuid('Filial inválida'),
  codigo: z
    .string()
    .trim()
    .min(2, 'Código muito curto')
    .max(20, 'Código muito longo')
    .transform((v) => v.toUpperCase()),
  nome: z.string().trim().min(2).max(80),
  horaInicio: z
    .string()
    .trim()
    .regex(horaRegex, 'Use o formato HH:MM (24h)'),
  horaFim: z
    .string()
    .trim()
    .regex(horaRegex, 'Use o formato HH:MM (24h)'),
  descricao: z.string().trim().max(2000).optional().nullable(),
  ativo: z.boolean().optional().default(true),
})

export const turnoUpdateSchema = turnoCreateSchema.partial()

export const turnoQuerySchema = z.object({
  q: z.string().trim().optional(),
  filialId: z.string().uuid().optional(),
  ativo: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type TurnoCreateInput = z.infer<typeof turnoCreateSchema>
export type TurnoUpdateInput = z.infer<typeof turnoUpdateSchema>
export type TurnoQuery = z.infer<typeof turnoQuerySchema>
