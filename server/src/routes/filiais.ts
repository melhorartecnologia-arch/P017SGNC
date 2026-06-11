import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { HttpError } from '../middleware/error.js'
import {
  filialCreateSchema,
  filialQuerySchema,
  filialUpdateSchema,
} from '../schemas/filial.js'

export const filiaisRouter = Router()

filiaisRouter.get('/', async (req, res, next) => {
  try {
    const { q, ativo, page, pageSize } = filialQuerySchema.parse(req.query)
    const where: Prisma.FilialWhereInput = {}
    if (q) {
      where.OR = [
        { codigo: { contains: q, mode: 'insensitive' } },
        { nome: { contains: q, mode: 'insensitive' } },
        { razaoSocial: { contains: q, mode: 'insensitive' } },
        { cnpj: { contains: q } },
        { cidade: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (ativo !== undefined) where.ativo = ativo === 'true'

    const [total, items] = await Promise.all([
      prisma.filial.count({ where }),
      prisma.filial.findMany({
        where,
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

filiaisRouter.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.filial.findUnique({ where: { id: req.params.id } })
    if (!item) throw new HttpError(404, 'Filial não encontrada')
    res.json(item)
  } catch (err) {
    next(err)
  }
})

filiaisRouter.post('/', async (req, res, next) => {
  try {
    const data = filialCreateSchema.parse(req.body)
    const created = await prisma.filial.create({ data })
    res.status(201).json(created)
  } catch (err) {
    next(err)
  }
})

filiaisRouter.patch('/:id', async (req, res, next) => {
  try {
    const data = filialUpdateSchema.parse(req.body)
    const updated = await prisma.filial.update({
      where: { id: req.params.id },
      data,
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

filiaisRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.filial.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})
