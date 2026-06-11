import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { HttpError } from '../middleware/error.js'
import {
  produtoCreateSchema,
  produtoQuerySchema,
  produtoUpdateSchema,
} from '../schemas/produto.js'

export const produtosRouter = Router()

produtosRouter.get('/', async (req, res, next) => {
  try {
    const { q, ativo, page, pageSize } = produtoQuerySchema.parse(req.query)
    const where: Prisma.ProdutoWhereInput = {}
    if (q) {
      where.OR = [
        { codigo: { contains: q, mode: 'insensitive' } },
        { descricao: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (ativo !== undefined) where.ativo = ativo === 'true'

    const [total, items] = await Promise.all([
      prisma.produto.count({ where }),
      prisma.produto.findMany({
        where,
        orderBy: [{ ativo: 'desc' }, { descricao: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])
    res.json({ items, page, pageSize, total })
  } catch (err) {
    next(err)
  }
})

produtosRouter.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.produto.findUnique({
      where: { id: req.params.id },
    })
    if (!item) throw new HttpError(404, 'Produto não encontrado')
    res.json(item)
  } catch (err) {
    next(err)
  }
})

produtosRouter.post('/', async (req, res, next) => {
  try {
    const data = produtoCreateSchema.parse(req.body)
    const created = await prisma.produto.create({ data })
    res.status(201).json(created)
  } catch (err) {
    next(err)
  }
})

produtosRouter.patch('/:id', async (req, res, next) => {
  try {
    const data = produtoUpdateSchema.parse(req.body)
    const updated = await prisma.produto.update({
      where: { id: req.params.id },
      data,
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

produtosRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.produto.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})
