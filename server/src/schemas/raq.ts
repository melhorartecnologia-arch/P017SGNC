import { z } from 'zod'
import { rncStatusEnum } from './rnc.js'

/**
 * RAQ — Relatório de Alerta de Qualidade (FOR.IND.CQA.023). Formulário
 * mais curto que o da RNC: lote e nota fiscal únicos, título, controle
 * de reincidência e vínculo com até 3 RAQs relacionados.
 */

const optionalDate = (msg: string) =>
  z
    .union([z.coerce.date({ invalid_type_error: msg }), z.literal('')])
    .optional()
    .nullable()
    .transform((v) => (v === '' || v === undefined ? null : v))

const optionalNumber = (msg: string) =>
  z
    .union([z.coerce.number({ invalid_type_error: msg }), z.literal('')])
    .optional()
    .nullable()
    .transform((v) => (v === '' || v === undefined ? null : v))

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

const raqBaseSchema = z.object({
  filialId: z.string().uuid('Filial inválida'),
  fornecedorId: z.string().uuid('Fornecedor inválido'),
  titulo: z
    .string({ required_error: 'Título do RAQ é obrigatório' })
    .trim()
    .min(1, 'Título do RAQ é obrigatório')
    .max(200),
  dataIdentificacao: z.coerce.date({
    invalid_type_error: 'Data da ocorrência inválida',
  }),
  status: rncStatusEnum.optional().default('DRAFT'),

  // Reincidência e RAQs relacionados (até 3).
  reincidente: z.boolean().optional().nullable(),
  reincidenteVezes: optionalNumber('Quantidade de reincidências inválida').refine(
    (v) => v === null || (Number.isInteger(v) && v >= 1),
    { message: 'Informe um número inteiro de reincidências (mínimo 1)' },
  ),
  raqRelacionadosIds: z
    .array(z.string().uuid('RAQ relacionado inválido'))
    .max(3, 'No máximo 3 RAQs relacionados')
    .optional(),

  // Material — lote e nota fiscal únicos, como no formulário.
  produtoId: z.string().uuid('Produto é obrigatório'),
  lotes: z
    .array(
      z.object({
        numero: z
          .string()
          .trim()
          .min(1, 'Lote vazio')
          .max(80)
          .transform((v) => v.toUpperCase()),
        quantidade: optionalNumber('Quantidade do lote inválida').refine(
          (v) => v === null || v > 0,
          { message: 'A quantidade do lote deve ser maior que zero' },
        ),
      }),
    )
    .min(1, 'Informe o lote')
    .max(1, 'O RAQ registra um único lote'),
  quantidadeDefeito: z.coerce.number({
    required_error: 'Quantidade com defeito é obrigatória',
    invalid_type_error: 'Quantidade com defeito inválida',
  }),
  tempoParadaMinutos: optionalNumber('Tempo de parada inválido'),

  notasFiscais: z
    .array(
      z
        .object({
          numero: z
            .string()
            .trim()
            .min(1, 'Nº da nota fiscal é obrigatório')
            .max(40),
          dataFabricacao: optionalDate('Data de fabricação inválida'),
          dataValidade: optionalDate('Data de validade inválida'),
          dataRecebimento: optionalDate('Data de recebimento inválida'),
        })
        .superRefine((n, ctx) => {
          if (n.dataFabricacao) {
            if (diaOperacao(n.dataFabricacao) > diaOperacao(new Date())) {
              ctx.addIssue({
                code: 'custom',
                path: ['dataFabricacao'],
                message:
                  'A data de fabricação não pode ser futura (no máximo a data atual)',
              })
            }
            if (n.dataValidade && n.dataValidade < n.dataFabricacao) {
              ctx.addIssue({
                code: 'custom',
                path: ['dataValidade'],
                message:
                  'A data de validade não pode ser anterior à data de fabricação',
              })
            }
            if (n.dataRecebimento && n.dataRecebimento < n.dataFabricacao) {
              ctx.addIssue({
                code: 'custom',
                path: ['dataRecebimento'],
                message:
                  'A data de recebimento não pode ser anterior à data de fabricação',
              })
            }
          }
        }),
    )
    .min(1, 'Informe a nota fiscal')
    .max(1, 'O RAQ registra uma única nota fiscal'),

  // Disposição, origem, severidade e descrição.
  disposicaoMaterialId: z
    .string({ required_error: 'Disposição do material é obrigatória' })
    .uuid('Disposição inválida'),
  origemId: z
    .string({ required_error: 'Origem da não conformidade é obrigatória' })
    .uuid('Origem inválida'),
  severidadeId: z
    .string({ required_error: 'Severidade é obrigatória' })
    .uuid('Severidade inválida'),
  descricaoDefeito: z
    .string({ required_error: 'Descrição da ocorrência é obrigatória' })
    .trim()
    .min(1, 'Descrição da ocorrência é obrigatória')
    .max(4000),
  observacoesComplementares: optionalString(4000),

  // Transporte
  transportador: optionalString(160),
  placaCavalo: optionalString(10),
  placaCarreta: optionalString(10),
  nomeMotorista: optionalString(120),
  cnhMotorista: optionalString(20),
})

/** A data da ocorrência não pode ser futura (relógio do servidor). */
function dataNaoFutura(
  dataIdentificacao: Date | null | undefined,
  ctx: z.RefinementCtx,
) {
  if (!dataIdentificacao) return
  if (diaOperacao(dataIdentificacao) > diaOperacao(new Date())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dataIdentificacao'],
      message: 'A data da ocorrência não pode ser futura.',
    })
  }
}

/** Reincidente exige a quantidade; qtd. defeito > 0 e ≤ lote. */
function consistencia(
  val: {
    reincidente?: boolean | null
    reincidenteVezes?: number | null
    quantidadeDefeito?: number | null
    lotes?: { quantidade: number | null }[]
  },
  ctx: z.RefinementCtx,
) {
  if (val.reincidente && val.reincidenteVezes == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reincidenteVezes'],
      message: 'Informe quantas vezes o alerta é reincidente.',
    })
  }
  const qtd = val.quantidadeDefeito
  if (qtd == null) return
  if (qtd <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['quantidadeDefeito'],
      message: 'A quantidade com defeito deve ser maior que zero.',
    })
    return
  }
  const total = (val.lotes ?? []).reduce((acc, l) => acc + (l.quantidade ?? 0), 0)
  if (total > 0 && qtd > total) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['quantidadeDefeito'],
      message:
        'A quantidade com defeito não pode ser maior que a quantidade do lote.',
    })
  }
}

export const raqCreateSchema = raqBaseSchema.superRefine((val, ctx) => {
  dataNaoFutura(val.dataIdentificacao, ctx)
  consistencia(val, ctx)
})

export const raqUpdateSchema = raqBaseSchema
  .partial()
  .superRefine((val, ctx) => {
    dataNaoFutura(val.dataIdentificacao, ctx)
    consistencia(val, ctx)
  })

export const raqQuerySchema = z.object({
  fornecedorId: z.string().uuid().optional(),
  filialId: z.string().uuid().optional(),
  severidadeId: z.string().optional(),
  status: rncStatusEnum.optional(),
  /** Período por data (painel/drill-down): de inclusivo, ate exclusivo. */
  de: z.coerce.date().optional(),
  ate: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type RaqCreateInput = z.infer<typeof raqCreateSchema>
export type RaqUpdateInput = z.infer<typeof raqUpdateSchema>
