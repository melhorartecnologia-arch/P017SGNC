import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3333),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // URL pública do app (front), usada nos links dos e-mails de assinatura.
  APP_BASE_URL: z.string().url().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().min(8).default('dev-secret-trocar-em-producao'),
  JWT_EXPIRES_IN: z.coerce.number().int().positive().default(43200),
  ADMIN_EMAIL: z.string().email().default('admin@sgnc.local'),
  ADMIN_PASSWORD: z.string().min(6).default('admin123'),
  ADMIN_NOME: z.string().min(2).default('Administrador'),
  // Integração bSynapse (correção de texto por IA) — opcional. Sem as duas
  // variáveis, o endpoint /api/ia/corrigir-texto responde 503.
  BSYNAPSE_API_URL: z.string().url().optional(),
  BSYNAPSE_API_KEY: z.string().min(1).optional(),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
