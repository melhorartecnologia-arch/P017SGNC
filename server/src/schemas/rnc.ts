import { z } from 'zod'

export const rncStatusEnum = z.enum([
  'DRAFT',
  'OPEN',
  'IN_PROGRESS',
  'CLOSED',
  'CANCELLED',
])

const optionalUuid = (msg: string) =>
  z
    .string()
    .uuid(msg)
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null))

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

/**
 * Dia de calendário (YYYY-MM-DD) no fuso de operação da cervejaria
 * (America/Sao_Paulo). Usado para comparar a data de identificação contra
 * "hoje" sem depender do fuso em que o servidor está hospedado.
 */
function diaOperacao(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/**
 * A data de identificação não pode ser futura. A comparação usa o relógio
 * do SERVIDOR — não a data enviada pelo cliente — para que adiantar o
 * relógio da máquina do usuário não permita registrar uma data futura.
 */
function dataIdentificacaoNaoFutura(
  dataIdentificacao: Date | null | undefined,
  ctx: z.RefinementCtx,
) {
  if (!dataIdentificacao) return
  if (diaOperacao(dataIdentificacao) > diaOperacao(new Date())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dataIdentificacao'],
      message: 'A data de identificação não pode ser futura.',
    })
  }
}

const rncBaseSchema = z.object({
  filialId: z.string().uuid('Filial inválida'),
  fornecedorId: z.string().uuid('Fornecedor inválido'),
  tipoNaoConformidadeId: z.string().uuid('Tipo de não conformidade inválido'),
  turnoId: z.string().uuid('Turno de trabalho é obrigatório'),
  disposicaoMaterialId: optionalUuid('Disposição inválida'),
  origemId: optionalUuid('Origem inválida'),
  severidadeId: optionalUuid('Severidade inválida'),
  descricaoDefeito: z.string().trim().max(4000).optional().nullable(),
  dataIdentificacao: z.coerce.date({
    invalid_type_error: 'Data de identificação inválida',
  }),
  status: rncStatusEnum.optional().default('DRAFT'),

  // Material & lote
  produtoId: z.string().uuid('Produto é obrigatório'),
  lotes: z
    .array(
      z.object({
        numero: z.string().trim().min(1, 'Lote vazio').max(80),
        quantidade: z
          .union([
            z.coerce.number({ invalid_type_error: 'Quantidade do lote inválida' }),
            z.literal(''),
          ])
          .optional()
          .nullable()
          .transform((v) => (v === '' || v === undefined ? null : v)),
      }),
    )
    .min(1, 'Informe ao menos um lote')
    .max(50, 'Máximo de 50 lotes por RNC')
    .refine(
      (arr) => new Set(arr.map((l) => l.numero)).size === arr.length,
      { message: 'Não pode haver lotes duplicados' },
    ),
  quantidadeDefeito: optionalNumber('Quantidade com defeito inválida'),
  tempoParadaMinutos: optionalNumber('Tempo de parada inválido'),

  // Nota fiscal & datas
  numeroNf: optionalString(40),
  dataFabricacao: optionalDate('Data de fabricação inválida'),
  dataValidade: optionalDate('Data de validade inválida'),
  dataRecebimento: optionalDate('Data de recebimento inválida'),

  // Transporte
  transportador: optionalString(160),
  placaCavalo: optionalString(10),
  placaCarreta: optionalString(10),
  nomeMotorista: optionalString(120),
  cnhMotorista: optionalString(20),
})

export const rncCreateSchema = rncBaseSchema.superRefine((val, ctx) =>
  dataIdentificacaoNaoFutura(val.dataIdentificacao, ctx),
)

export const rncUpdateSchema = rncBaseSchema
  .partial()
  .superRefine((val, ctx) =>
    dataIdentificacaoNaoFutura(val.dataIdentificacao, ctx),
  )

export const rncQuerySchema = z.object({
  fornecedorId: z.string().uuid().optional(),
  tipoNaoConformidadeId: z.string().uuid().optional(),
  filialId: z.string().uuid().optional(),
  status: rncStatusEnum.optional(),
  /** Quantos registros retornar quando usado como lookup ("últimas 3"). */
  limit: z.coerce.number().int().min(1).max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type RncCreateInput = z.infer<typeof rncCreateSchema>
export type RncUpdateInput = z.infer<typeof rncUpdateSchema>
export type RncQuery = z.infer<typeof rncQuerySchema>
