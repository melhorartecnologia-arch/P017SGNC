import { Router } from 'express'
import { prisma } from '../db.js'
import { requireRole } from '../middleware/auth.js'
import { configuracaoSmtpSchema } from '../schemas/configuracao-smtp.js'

/**
 * Configurações técnicas do sistema. Somente administradores; a senha
 * SMTP nunca é retornada — apenas o indicador `senhaDefinida`.
 */
export const configuracoesRouter = Router()

configuracoesRouter.use(requireRole('ADMIN'))

// Linha única — sempre id 1.
const SMTP_ID = 1

const publicSelect = {
  host: true,
  porta: true,
  seguranca: true,
  usuario: true,
  remetenteNome: true,
  remetenteEmail: true,
  ativo: true,
  updatedAt: true,
} as const

function toPublic(
  cfg: { senha: string | null } & Record<string, unknown>,
): Record<string, unknown> {
  const { senha, ...rest } = cfg
  return { ...rest, senhaDefinida: !!senha }
}

configuracoesRouter.get('/smtp', async (_req, res, next) => {
  try {
    const cfg = await prisma.configuracaoSmtp.findUnique({
      where: { id: SMTP_ID },
      select: { ...publicSelect, senha: true },
    })
    res.json(cfg ? toPublic(cfg) : null)
  } catch (err) {
    next(err)
  }
})

configuracoesRouter.put('/smtp', async (req, res, next) => {
  try {
    const data = configuracaoSmtpSchema.parse(req.body)
    const { senha, ...resto } = data

    const atual = await prisma.configuracaoSmtp.findUnique({
      where: { id: SMTP_ID },
      select: { senha: true },
    })
    // Senha em branco/omitida mantém a atual; string preenchida substitui.
    const senhaFinal = senha ? senha : (atual?.senha ?? null)

    const salvo = await prisma.configuracaoSmtp.upsert({
      where: { id: SMTP_ID },
      create: { id: SMTP_ID, ...resto, senha: senhaFinal },
      update: { ...resto, senha: senhaFinal },
      select: { ...publicSelect, senha: true },
    })
    res.json(toPublic(salvo))
  } catch (err) {
    next(err)
  }
})
