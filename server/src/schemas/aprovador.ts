import { z } from 'zod'

const phoneRegex = /^[\d().\-\s+]+$/

export const aprovadorCreateSchema = z
  .object({
    filialId: z.string().uuid('Filial inválida'),
    areaId: z.string().uuid('Área inválida'),
    turnoId: z
      .string()
      .uuid('Turno inválido')
      .optional()
      .nullable()
      .or(z.literal('').transform(() => null)),
    nivel: z.coerce
      .number({ invalid_type_error: 'Nível inválido' })
      .int('Nível deve ser inteiro')
      .min(1, 'Nível mínimo é 1')
      .max(99, 'Nível máximo é 99'),
    nome: z.string().trim().min(2).max(120),
    // Recebe as respostas do fornecedor após a conclusão das assinaturas.
    recebeRespostaFornecedor: z.boolean().optional().default(false),
    cargo: z.string().trim().max(120).optional().nullable(),
    email: z.string().trim().email('E-mail inválido').max(160),
    telefone: z
      .string()
      .trim()
      .max(20)
      .regex(phoneRegex, 'Telefone inválido')
      .optional()
      .nullable()
      .or(z.literal('').transform(() => null)),
    whatsapp: z
      .string()
      .trim()
      .max(20)
      .regex(phoneRegex, 'WhatsApp inválido')
      .optional()
      .nullable()
      .or(z.literal('').transform(() => null)),
    ativo: z.boolean().optional().default(true),
    observacoes: z.string().trim().max(2000).optional().nullable(),
    /**
     * Tipos de relatório que o aprovador assina. Lista vazia (ou ausente)
     * = sem restrição: assina todos os tipos, como a restrição de turno.
     */
    tiposRelatorioIds: z
      .array(z.string().uuid('Tipo de relatório inválido'))
      .max(20)
      .optional(),
  })

export const aprovadorUpdateSchema = aprovadorCreateSchema.partial()

export const aprovadorQuerySchema = z.object({
  q: z.string().trim().optional(),
  filialId: z.string().uuid().optional(),
  areaId: z.string().uuid().optional(),
  ativo: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type AprovadorCreateInput = z.infer<typeof aprovadorCreateSchema>
export type AprovadorUpdateInput = z.infer<typeof aprovadorUpdateSchema>
export type AprovadorQuery = z.infer<typeof aprovadorQuerySchema>
