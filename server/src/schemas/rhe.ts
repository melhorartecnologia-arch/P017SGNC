import { z } from 'zod'
import { rncStatusEnum } from './rnc.js'

/**
 * RHE — Relatório de Homologação de Embalagem (FOR.IND.CQA.031).
 * O fornecedor não tem devolução: o representante técnico dele ASSINA o
 * documento junto com os aprovadores internos do tipo RHE.
 */

export const homologacaoResultadoEnum = z.enum([
  'APROVADO',
  'REPROVADO',
  'APROVADO_COM_RESTRICAO',
])

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v === '' ? null : v))

const optionalDate = (msg: string) =>
  z
    .union([z.coerce.date({ invalid_type_error: msg }), z.literal('')])
    .optional()
    .nullable()
    .transform((v) => (v === '' || v === undefined ? null : v))

/** Dia de calendário no fuso de operação (America/Sao_Paulo). */
function diaOperacao(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

const rheBaseSchema = z.object({
  filialId: z.string().uuid('Filial inválida'),
  fornecedorId: z.string().uuid('Fornecedor inválido'),
  /** Embalagem/material homologado (cadastro de produtos). */
  produtoId: z.string().uuid('Embalagem (produto) é obrigatória'),
  /** Data da homologação (referência da numeração). */
  dataIdentificacao: z.coerce.date({
    invalid_type_error: 'Data da homologação inválida',
  }),
  status: rncStatusEnum.optional().default('DRAFT'),

  titulo: z
    .string({ required_error: 'Título do RHE é obrigatório' })
    .trim()
    .min(1, 'Título do RHE é obrigatório')
    .max(200),
  tipoProdutoAplicacao: optionalString(200),
  definicaoTeste: z
    .string({ required_error: 'Definição do teste é obrigatória' })
    .trim()
    .min(1, 'Definição do teste é obrigatória')
    .max(4000),
  linhaEnvase: optionalString(80),

  // Rastreabilidade do material testado (texto livre, como no formulário).
  fabricacaoTexto: optionalString(200),
  validadeTexto: optionalString(100),
  quantidadeTexto: optionalString(100),
  lotes: z
    .array(
      z.object({
        numero: z
          .string()
          .trim()
          .min(1, 'Lote vazio')
          .max(80)
          .transform((v) => v.toUpperCase()),
      }),
    )
    .max(10, 'Máximo de 10 lotes')
    .optional()
    .default([]),
  notaFiscal: optionalString(40),

  // Avaliação e resultado.
  analisadoPor: optionalString(200),
  avaliacaoConsideracoes: optionalString(8000),
  homologacaoInicial: homologacaoResultadoEnum.optional().nullable(),
  homologacaoInicialData: optionalDate('Data da homologação inicial inválida'),

  /**
   * Representantes técnicos do fornecedor que ASSINAM o documento —
   * o formulário prevê até 2, cada um com nome e e-mail.
   */
  representantes: z
    .array(
      z.object({
        nome: z.string().trim().min(1, 'Nome do representante vazio').max(160),
        email: z
          .string()
          .trim()
          .email('E-mail do representante inválido')
          .max(160),
      }),
    )
    .min(1, 'Informe ao menos um representante técnico do fornecedor')
    .max(2, 'O formulário prevê no máximo 2 representantes técnicos'),
})

/** A data da homologação não pode ser futura (relógio do servidor). */
function dataNaoFutura(
  dataIdentificacao: Date | null | undefined,
  ctx: z.RefinementCtx,
) {
  if (!dataIdentificacao) return
  if (diaOperacao(dataIdentificacao) > diaOperacao(new Date())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dataIdentificacao'],
      message: 'A data da homologação não pode ser futura.',
    })
  }
}

export const rheCreateSchema = rheBaseSchema.superRefine((val, ctx) => {
  dataNaoFutura(val.dataIdentificacao, ctx)
})

export const rheUpdateSchema = rheBaseSchema
  .partial()
  .superRefine((val, ctx) => {
    dataNaoFutura(val.dataIdentificacao, ctx)
  })

/** Registro (posterior) da homologação final — o campo fica em aberto
 * no formulário até a decisão, que pode vir meses depois do encerramento. */
export const rheHomologacaoFinalSchema = z
  .object({
    resultado: homologacaoResultadoEnum,
    data: z.coerce.date({ invalid_type_error: 'Data inválida' }),
  })
  .superRefine((val, ctx) => {
    if (diaOperacao(val.data) > diaOperacao(new Date())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['data'],
        message: 'A data da homologação final não pode ser futura.',
      })
    }
  })

export const rheQuerySchema = z.object({
  fornecedorId: z.string().uuid().optional(),
  filialId: z.string().uuid().optional(),
  status: rncStatusEnum.optional(),
  homologacaoInicial: homologacaoResultadoEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type RheCreateInput = z.infer<typeof rheCreateSchema>
export type RheUpdateInput = z.infer<typeof rheUpdateSchema>
