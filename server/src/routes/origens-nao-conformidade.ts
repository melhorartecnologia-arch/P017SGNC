import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { HttpError } from '../middleware/error.js'
import {
  origemCreateSchema,
  origemQuerySchema,
  origemUpdateSchema,
} from '../schemas/origem-nao-conformidade.js'

export const origensRouter = Router()

const tipoRelatorioRef = {
  select: { id: true, codigo: true, descricao: true },
} as const

origensRouter.get('/', async (req, res, next) => {
  try {
    const { q, ativo, page, pageSize } = origemQuerySchema.parse(req.query)
    const where: Prisma.OrigemNaoConformidadeWhereInput = {}
    if (q) {
      where.OR = [
        { codigo: { contains: q, mode: 'insensitive' } },
        { nome: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (ativo !== undefined) where.ativo = ativo === 'true'

    const [total, items] = await Promise.all([
      prisma.origemNaoConformidade.count({ where }),
      prisma.origemNaoConformidade.findMany({
        where,
        include: { tiposRelatorio: tipoRelatorioRef },
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

origensRouter.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.origemNaoConformidade.findUnique({
      where: { id: req.params.id },
      include: { tiposRelatorio: tipoRelatorioRef },
    })
    if (!item) throw new HttpError(404, 'Origem não encontrada')
    res.json(item)
  } catch (err) {
    next(err)
  }
})

origensRouter.post('/', async (req, res, next) => {
  try {
    const { tiposRelatorioIds, ...data } = origemCreateSchema.parse(req.body)
    const created = await prisma.origemNaoConformidade.create({
      data: {
        ...data,
        tiposRelatorio: tiposRelatorioIds.length
          ? { connect: tiposRelatorioIds.map((id) => ({ id })) }
          : undefined,
      },
      include: { tiposRelatorio: tipoRelatorioRef },
    })
    res.status(201).json(created)
  } catch (err) {
    next(err)
  }
})

origensRouter.patch('/:id', async (req, res, next) => {
  try {
    const { tiposRelatorioIds, ...data } = origemUpdateSchema.parse(req.body)
    const updated = await prisma.origemNaoConformidade.update({
      where: { id: req.params.id },
      data: {
        ...data,
        tiposRelatorio:
          tiposRelatorioIds === undefined
            ? undefined
            : { set: tiposRelatorioIds.map((id) => ({ id })) },
      },
      include: { tiposRelatorio: tipoRelatorioRef },
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

origensRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.origemNaoConformidade.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})
