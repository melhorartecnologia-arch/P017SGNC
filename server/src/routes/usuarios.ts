import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { HttpError } from '../middleware/error.js'
import { requireRole } from '../middleware/auth.js'
import {
  usuarioCreateSchema,
  usuarioQuerySchema,
  usuarioUpdateSchema,
} from '../schemas/usuario.js'

export const usuariosRouter = Router()

// Todas as operações exigem ADMIN.
usuariosRouter.use(requireRole('ADMIN'))

const publicFields = {
  id: true,
  email: true,
  nome: true,
  role: true,
  ativo: true,
  filialPadraoId: true,
  filialPadrao: { select: { id: true, codigo: true, nome: true } },
  createdAt: true,
  updatedAt: true,
} as const

/** Garante que a filial padrão informada existe — erro 400 amigável em vez
 *  de violação de FK (500). */
async function ensureFilialExiste(filialPadraoId: string | null | undefined) {
  if (!filialPadraoId) return
  const filial = await prisma.filial.findUnique({
    where: { id: filialPadraoId },
    select: { id: true },
  })
  if (!filial) throw new HttpError(400, 'Filial padrão não encontrada')
}

usuariosRouter.get('/', async (req, res, next) => {
  try {
    const { q, ativo, role, page, pageSize } = usuarioQuerySchema.parse(req.query)
    const where: Prisma.UsuarioWhereInput = {}
    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { nome: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (ativo !== undefined) where.ativo = ativo === 'true'
    if (role) where.role = role

    const [total, items] = await Promise.all([
      prisma.usuario.count({ where }),
      prisma.usuario.findMany({
        where,
        select: publicFields,
        orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])
    res.json({ items, page, pageSize, total })
  } catch (err) {
    next(err)
  }
})

usuariosRouter.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.usuario.findUnique({
      where: { id: req.params.id },
      select: publicFields,
    })
    if (!item) throw new HttpError(404, 'Usuário não encontrado')
    res.json(item)
  } catch (err) {
    next(err)
  }
})

usuariosRouter.post('/', async (req, res, next) => {
  try {
    const data = usuarioCreateSchema.parse(req.body)
    await ensureFilialExiste(data.filialPadraoId)
    const created = await prisma.usuario.create({
      data: {
        email: data.email,
        nome: data.nome,
        senhaHash: await bcrypt.hash(data.senha, 10),
        role: data.role,
        ativo: data.ativo ?? true,
        filialPadraoId: data.filialPadraoId ?? null,
      },
      select: publicFields,
    })
    res.status(201).json(created)
  } catch (err) {
    next(err)
  }
})

usuariosRouter.patch('/:id', async (req, res, next) => {
  try {
    const data = usuarioUpdateSchema.parse(req.body)
    const alvo = await prisma.usuario.findUnique({
      where: { id: req.params.id },
      select: { id: true, role: true, ativo: true },
    })
    if (!alvo) throw new HttpError(404, 'Usuário não encontrado')

    const ehOMesmo = req.user!.sub === alvo.id
    if (ehOMesmo && data.role && data.role !== 'ADMIN') {
      throw new HttpError(400, 'Você não pode remover seu próprio acesso de administrador.')
    }
    if (ehOMesmo && data.ativo === false) {
      throw new HttpError(400, 'Você não pode desativar seu próprio usuário.')
    }

    const updateData: Prisma.UsuarioUncheckedUpdateInput = {}
    if (data.email !== undefined) updateData.email = data.email
    if (data.nome !== undefined) updateData.nome = data.nome
    if (data.role !== undefined) updateData.role = data.role
    if (data.ativo !== undefined) updateData.ativo = data.ativo
    if (data.senha !== undefined) updateData.senhaHash = await bcrypt.hash(data.senha, 10)
    if (data.filialPadraoId !== undefined) {
      await ensureFilialExiste(data.filialPadraoId)
      updateData.filialPadraoId = data.filialPadraoId
    }

    const updated = await prisma.usuario.update({
      where: { id: req.params.id },
      data: updateData,
      select: publicFields,
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

usuariosRouter.delete('/:id', async (req, res, next) => {
  try {
    if (req.user!.sub === req.params.id) {
      throw new HttpError(400, 'Você não pode excluir seu próprio usuário.')
    }
    await prisma.usuario.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})
