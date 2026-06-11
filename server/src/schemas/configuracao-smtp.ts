import { z } from 'zod'

export const smtpSegurancaEnum = z.enum(['NONE', 'SSL', 'TLS'])

export const configuracaoSmtpSchema = z.object({
  host: z.string().trim().min(1, 'Servidor (host) é obrigatório').max(160),
  porta: z.coerce
    .number({ invalid_type_error: 'Porta inválida' })
    .int('Porta inválida')
    .min(1, 'Porta inválida')
    .max(65535, 'Porta inválida'),
  seguranca: smtpSegurancaEnum.default('TLS'),
  usuario: z.string().trim().max(160).optional().nullable()
    .or(z.literal('').transform(() => null)),
  /** Em branco/omitida no update mantém a senha atual. */
  senha: z.string().max(255).optional().nullable(),
  remetenteNome: z
    .string()
    .trim()
    .min(1, 'Nome do remetente é obrigatório')
    .max(120),
  remetenteEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email('E-mail do remetente inválido')
    .max(160),
  ativo: z.boolean().optional().default(true),
})

export const smtpTesteSchema = z.object({
  para: z
    .string()
    .trim()
    .toLowerCase()
    .email('E-mail de destino inválido')
    .max(160),
})

export type ConfiguracaoSmtpInput = z.infer<typeof configuracaoSmtpSchema>
export type SmtpTesteInput = z.infer<typeof smtpTesteSchema>
