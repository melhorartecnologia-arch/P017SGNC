import { z } from 'zod'
import { rncStatusEnum } from './rnc.js'

/**
 * RVT — Relatório de Visita Técnica. O mais curto dos três formulários:
 * fornecedor/produto/data, pauta, participantes (até 5, como no modelo),
 * fotos, assuntos abordados e conclusão.
 */

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null))

/** Dia de calendário no fuso de operação (America/Sao_Paulo). */
function diaOperacao(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

const rvtBaseSchema = z.object({
  filialId: z.string().uuid('Filial inválida'),
  fornecedorId: z.string().uuid('Fornecedor inválido'),
  produtoId: z.string().uuid('Produto é obrigatório'),
  /** Data da visita técnica. */
  dataIdentificacao: z.coerce.date({
    invalid_type_error: 'Data da visita inválida',
  }),
  status: rncStatusEnum.optional().default('DRAFT'),

  pauta: z
    .string({ required_error: 'Pauta da visita é obrigatória' })
    .trim()
    .min(1, 'Pauta da visita é obrigatória')
    .max(200),
  participantes: z
    .array(
      z.object({
        nome: z
          .string()
          .trim()
          .min(1, 'Nome do participante vazio')
          .max(160),
      }),
    )
    .min(1, 'Informe ao menos um participante')
    .max(5, 'O formulário prevê no máximo 5 participantes'),
  assuntosAbordados: z
    .string({ required_error: 'Assuntos abordados são obrigatórios' })
    .trim()
    .min(1, 'Assuntos abordados são obrigatórios')
    .max(8000),
  conclusao: z
    .string({ required_error: 'Conclusão é obrigatória' })
    .trim()
    .min(1, 'Conclusão é obrigatória')
    .max(8000),
  observacoesComplementares: optionalString(4000),
})

/** A data da visita não pode ser futura (relógio do servidor). */
function dataNaoFutura(
  dataIdentificacao: Date | null | undefined,
  ctx: z.RefinementCtx,
) {
  if (!dataIdentificacao) return
  if (diaOperacao(dataIdentificacao) > diaOperacao(new Date())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dataIdentificacao'],
      message: 'A data da visita não pode ser futura.',
    })
  }
}

export const rvtCreateSchema = rvtBaseSchema.superRefine((val, ctx) => {
  dataNaoFutura(val.dataIdentificacao, ctx)
})

export const rvtUpdateSchema = rvtBaseSchema
  .partial()
  .superRefine((val, ctx) => {
    dataNaoFutura(val.dataIdentificacao, ctx)
  })

export const rvtQuerySchema = z.object({
  fornecedorId: z.string().uuid().optional(),
  filialId: z.string().uuid().optional(),
  status: rncStatusEnum.optional(),
  /** Período por data (painel/drill-down): de inclusivo, ate exclusivo. */
  de: z.coerce.date().optional(),
  ate: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type RvtCreateInput = z.infer<typeof rvtCreateSchema>
export type RvtUpdateInput = z.infer<typeof rvtUpdateSchema>
