import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { HttpError } from '../middleware/error.js'
import {
  areaCreateSchema,
  areaQuerySchema,
  areaUpdateSchema,
} from '../schemas/area.js'

export const areasRouter = Router()

areasRouter.get('/', async (req, res, next) => {
  try {
    const { q, ativo, page, pageSize } = areaQuerySchema.parse(req.query)
    const where: Prisma.AreaWhereInput = {}
    if (q) {
      const or: Prisma.AreaWhereInput[] = [
        { codigo: { contains: q, mode: 'insensitive' } },
        { nome: { contains: q, mode: 'insensitive' } },
        { descricao: { contains: q, mode: 'insensitive' } },
      ]
      // Permite buscar pela situação textual ("ativa"/"inativa").
      const t = q.toLowerCase()
      if (t.length >= 2) {
        if ('inativa'.startsWith(t) || 'inativo'.startsWith(t)) or.push({ ativo: false })
        else if ('ativa'.startsWith(t) || 'ativo'.startsWith(t)) or.push({ ativo: true })
      }
      where.OR = or
    }
    if (ativo !== undefined) where.ativo = ativo === 'true'

    const [total, items] = await Promise.all([
      prisma.area.count({ where }),
      prisma.area.findMany({
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

areasRouter.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.area.findUnique({ where: { id: req.params.id } })
    if (!item) throw new HttpError(404, 'Área não encontrada')
    res.json(item)
  } catch (err) {
    next(err)
  }
})

areasRouter.post('/', async (req, res, next) => {
  try {
    const data = areaCreateSchema.parse(req.body)
    const created = await prisma.area.create({ data })
    res.status(201).json(created)
  } catch (err) {
    next(err)
  }
})

areasRouter.patch('/:id', async (req, res, next) => {
  try {
    const data = areaUpdateSchema.parse(req.body)
    const updated = await prisma.area.update({
      where: { id: req.params.id },
      data,
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

areasRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.area.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})
