import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { HttpError } from '../middleware/error.js'
import {
  tipoRelatorioCreateSchema,
  tipoRelatorioQuerySchema,
  tipoRelatorioUpdateSchema,
} from '../schemas/tipo-relatorio.js'

export const tiposRelatorioRouter = Router()

tiposRelatorioRouter.get('/', async (req, res, next) => {
  try {
    const { q, ativo, page, pageSize } = tipoRelatorioQuerySchema.parse(req.query)
    const where: Prisma.TipoRelatorioWhereInput = {}
    if (q) {
      where.OR = [
        { codigo: { contains: q, mode: 'insensitive' } },
        { descricao: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (ativo !== undefined) where.ativo = ativo === 'true'

    const [total, items] = await Promise.all([
      prisma.tipoRelatorio.count({ where }),
      prisma.tipoRelatorio.findMany({
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

tiposRelatorioRouter.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.tipoRelatorio.findUnique({
      where: { id: req.params.id },
    })
    if (!item) throw new HttpError(404, 'Tipo de relatório não encontrado')
    res.json(item)
  } catch (err) {
    next(err)
  }
})

tiposRelatorioRouter.post('/', async (req, res, next) => {
  try {
    const data = tipoRelatorioCreateSchema.parse(req.body)
    const created = await prisma.tipoRelatorio.create({ data })
    res.status(201).json(created)
  } catch (err) {
    next(err)
  }
})

tiposRelatorioRouter.patch('/:id', async (req, res, next) => {
  try {
    const data = tipoRelatorioUpdateSchema.parse(req.body)
    const updated = await prisma.tipoRelatorio.update({
      where: { id: req.params.id },
      data,
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

tiposRelatorioRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.tipoRelatorio.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})
