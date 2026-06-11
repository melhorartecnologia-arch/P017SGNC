import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../db.js'
import { HttpError } from '../middleware/error.js'
import { requireAuth, signToken } from '../middleware/auth.js'
import { loginSchema } from '../schemas/auth.js'

export const authRouter = Router()

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, senha } = loginSchema.parse(req.body)
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      include: { filialPadrao: { select: { id: true, codigo: true, nome: true } } },
    })
    if (!usuario || !usuario.ativo) {
      throw new HttpError(401, 'Credenciais inválidas')
    }
    const ok = await bcrypt.compare(senha, usuario.senhaHash)
    if (!ok) {
      throw new HttpError(401, 'Credenciais inválidas')
    }
    const token = signToken({
      sub: usuario.id,
      email: usuario.email,
      role: usuario.role,
    })
    res.json({
      token,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
        role: usuario.role,
        filialPadraoId: usuario.filialPadraoId,
        filialPadrao: usuario.filialPadrao,
      },
    })
  } catch (err) {
    next(err)
  }
})

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.user!.sub },
      select: {
        id: true,
        email: true,
        nome: true,
        role: true,
        ativo: true,
        filialPadraoId: true,
        filialPadrao: { select: { id: true, codigo: true, nome: true } },
      },
    })
    if (!usuario || !usuario.ativo) {
      throw new HttpError(401, 'Usuário inválido')
    }
    res.json(usuario)
  } catch (err) {
    next(err)
  }
})
