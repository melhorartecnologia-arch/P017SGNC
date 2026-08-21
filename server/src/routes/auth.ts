import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../db.js'
import { HttpError } from '../middleware/error.js'
import { requireAuth, signToken } from '../middleware/auth.js'
import { loginSchema } from '../schemas/auth.js'

export const authRouter = Router()

/**
 * Filiais em que o usuário é aprovador marcado para receber as respostas
 * do fornecedor — quem pode analisar uma recusa pela plataforma (junto
 * com o perfil ADMIN). O front usa a lista para exibir ou não a decisão;
 * a autorização de fato é feita na rota que registra a análise.
 */
async function filiaisRespostaFornecedor(email: string): Promise<string[]> {
  const marcados = await prisma.aprovador.findMany({
    where: {
      ativo: true,
      recebeRespostaFornecedor: true,
      email: { equals: email, mode: 'insensitive' },
    },
    select: { filialId: true },
  })
  return [...new Set(marcados.map((m) => m.filialId))]
}

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
        filiaisRespostaFornecedor: await filiaisRespostaFornecedor(
          usuario.email,
        ),
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
    res.json({
      ...usuario,
      filiaisRespostaFornecedor: await filiaisRespostaFornecedor(usuario.email),
    })
  } catch (err) {
    next(err)
  }
})
