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

export const rncCreateSchema = z.object({
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

export const rncUpdateSchema = rncCreateSchema.partial()

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
