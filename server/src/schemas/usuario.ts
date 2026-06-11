import { z } from 'zod'

const senhaSchema = z
  .string()
  .min(6, 'Senha deve ter ao menos 6 caracteres')
  .max(72, 'Senha muito longa')

export const usuarioCreateSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('E-mail inválido')
    .max(160),
  nome: z.string().trim().min(2).max(120),
  senha: senhaSchema,
  role: z.enum(['ADMIN', 'USUARIO']).default('USUARIO'),
  ativo: z.boolean().optional().default(true),
})

export const usuarioUpdateSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido').max(160).optional(),
  nome: z.string().trim().min(2).max(120).optional(),
  senha: senhaSchema.optional(),
  role: z.enum(['ADMIN', 'USUARIO']).optional(),
  ativo: z.boolean().optional(),
})

export const usuarioQuerySchema = z.object({
  q: z.string().trim().optional(),
  ativo: z.enum(['true', 'false']).optional(),
  role: z.enum(['ADMIN', 'USUARIO']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type UsuarioCreateInput = z.infer<typeof usuarioCreateSchema>
export type UsuarioUpdateInput = z.infer<typeof usuarioUpdateSchema>
export type UsuarioQuery = z.infer<typeof usuarioQuerySchema>
