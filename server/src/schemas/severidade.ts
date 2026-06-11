import { z } from 'zod'

const hexColorRegex = /^#([0-9a-fA-F]{6})$/

export const severidadeCreateSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(2, 'Código muito curto')
    .max(20, 'Código muito longo')
    .transform((v) => v.toUpperCase()),
  nome: z.string().trim().min(2).max(80),
  nivel: z.coerce
    .number({ invalid_type_error: 'Nível inválido' })
    .int('Nível deve ser inteiro')
    .min(1, 'Nível mínimo é 1')
    .max(99, 'Nível máximo é 99'),
  cor: z
    .string()
    .trim()
    .regex(hexColorRegex, 'Use o formato #rrggbb')
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null)),
  descricao: z.string().trim().max(2000).optional().nullable(),
  ativo: z.boolean().optional().default(true),
  tiposRelatorioIds: z.array(z.string().uuid()).optional().default([]),
})

export const severidadeUpdateSchema = severidadeCreateSchema.partial()

export const severidadeQuerySchema = z.object({
  q: z.string().trim().optional(),
  ativo: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type SeveridadeCreateInput = z.infer<typeof severidadeCreateSchema>
export type SeveridadeUpdateInput = z.infer<typeof severidadeUpdateSchema>
export type SeveridadeQuery = z.infer<typeof severidadeQuerySchema>
