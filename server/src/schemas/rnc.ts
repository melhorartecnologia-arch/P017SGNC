import { z } from 'zod'

export const rncStatusEnum = z.enum([
  'DRAFT',
  'OPEN',
  'IN_PROGRESS',
  'CLOSED',
  'CANCELLED',
])

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

/**
 * A quantidade com defeito, quando informada, deve ser maior que zero e
 * não pode exceder a soma das quantidades dos lotes (quando houver
 * quantidades informadas nos lotes).
 */
function quantidadeDefeitoConsistente(
  val: {
    quantidadeDefeito?: number | null
    lotes?: { quantidade: number | null }[]
  },
  ctx: z.RefinementCtx,
) {
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
  if (!val.lotes) return
  const total = val.lotes.reduce((acc, l) => acc + (l.quantidade ?? 0), 0)
  if (total > 0 && qtd > total) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['quantidadeDefeito'],
      message:
        'A quantidade com defeito não pode ser maior que a quantidade total dos lotes.',
    })
  }
}

const rncBaseSchema = z.object({
  filialId: z.string().uuid('Filial inválida'),
  fornecedorId: z.string().uuid('Fornecedor inválido'),
  tipoNaoConformidadeId: z.string().uuid('Tipo de não conformidade inválido'),
  turnoId: z.string().uuid('Turno de trabalho é obrigatório'),
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
    .string({ required_error: 'Descrição do defeito é obrigatória' })
    .trim()
    .min(1, 'Descrição do defeito é obrigatória')
    .max(4000),
  dataIdentificacao: z.coerce.date({
    invalid_type_error: 'Data de identificação inválida',
  }),
  status: rncStatusEnum.optional().default('DRAFT'),

  // Material & lote
  produtoId: z.string().uuid('Produto é obrigatório'),
  lotes: z
    .array(
      z.object({
        // Normalizado para maiúsculas: "l123" e "L123" são o mesmo lote.
        // O refine de duplicidade abaixo roda após esta transformação.
        numero: z
          .string()
          .trim()
          .min(1, 'Lote vazio')
          .max(80)
          .transform((v) => v.toUpperCase()),
        quantidade: z
          .union([
            z.coerce.number({ invalid_type_error: 'Quantidade do lote inválida' }),
            z.literal(''),
          ])
          .optional()
          .nullable()
          .transform((v) => (v === '' || v === undefined ? null : v))
          .refine((v) => v === null || v > 0, {
            message: 'A quantidade do lote deve ser maior que zero',
          }),
      }),
    )
    .min(1, 'Informe ao menos um lote')
    .max(50, 'Máximo de 50 lotes por RNC')
    .refine(
      (arr) => new Set(arr.map((l) => l.numero)).size === arr.length,
      { message: 'Não pode haver lotes duplicados' },
    ),
  // Obrigatória; o superRefine abaixo garante > 0 e <= total dos lotes.
  // No update (partial) pode ser omitida, mas não enviada como null.
  quantidadeDefeito: z.coerce.number({
    required_error: 'Quantidade com defeito é obrigatória',
    invalid_type_error: 'Quantidade com defeito inválida',
  }),
  tempoParadaMinutos: optionalNumber('Tempo de parada inválido'),

  // Notas fiscais & datas — uma RNC deve ter ao menos uma nota; cada nota
  // exige um número e as datas são opcionais.
  notasFiscais: z
    .array(
      z.object({
        numero: z
          .string()
          .trim()
          .min(1, 'Nº da nota fiscal é obrigatório')
          .max(40),
        dataFabricacao: optionalDate('Data de fabricação inválida'),
        dataValidade: optionalDate('Data de validade inválida'),
        dataRecebimento: optionalDate('Data de recebimento inválida'),
      }),
    )
    .min(1, 'Informe ao menos uma nota fiscal')
    .max(50, 'Máximo de 50 notas fiscais por RNC')
    .refine(
      (arr) =>
        new Set(arr.map((n) => n.numero.toUpperCase())).size === arr.length,
      { message: 'Não pode haver notas fiscais com o mesmo número' },
    ),

  // Transporte
  transportador: optionalString(160),
  placaCavalo: optionalString(10),
  placaCarreta: optionalString(10),
  nomeMotorista: optionalString(120),
  cnhMotorista: optionalString(20),
})

export const rncCreateSchema = rncBaseSchema.superRefine((val, ctx) => {
  dataIdentificacaoNaoFutura(val.dataIdentificacao, ctx)
  quantidadeDefeitoConsistente(val, ctx)
})

export const rncUpdateSchema = rncBaseSchema
  .partial()
  .superRefine((val, ctx) => {
    dataIdentificacaoNaoFutura(val.dataIdentificacao, ctx)
    quantidadeDefeitoConsistente(val, ctx)
  })

export const rncQuerySchema = z.object({
  fornecedorId: z.string().uuid().optional(),
  tipoNaoConformidadeId: z.string().uuid().optional(),
  filialId: z.string().uuid().optional(),
  // Filtros adicionais para drill-down do dashboard. Aceitam o sentinel
  // "__none__" para filtrar registros sem o vínculo (campo nulo).
  produtoId: z.string().optional(),
  disposicaoMaterialId: z.string().optional(),
  origemId: z.string().optional(),
  severidadeId: z.string().optional(),
  status: rncStatusEnum.optional(),
  /** Quantos registros retornar quando usado como lookup ("últimas 3"). */
  limit: z.coerce.number().int().min(1).max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type RncCreateInput = z.infer<typeof rncCreateSchema>
export type RncUpdateInput = z.infer<typeof rncUpdateSchema>
export type RncQuery = z.infer<typeof rncQuerySchema>
