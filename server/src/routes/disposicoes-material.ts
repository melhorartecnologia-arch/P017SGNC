import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { HttpError } from '../middleware/error.js'
import {
  disposicaoCreateSchema,
  disposicaoQuerySchema,
  disposicaoUpdateSchema,
} from '../schemas/disposicao-material.js'

export const disposicoesRouter = Router()

const tipoRelatorioRef = {
  select: { id: true, codigo: true, descricao: true },
} as const

disposicoesRouter.get('/', async (req, res, next) => {
  try {
    const { q, ativo, page, pageSize } = disposicaoQuerySchema.parse(req.query)
    const where: Prisma.DisposicaoMaterialWhereInput = {}
    if (q) {
      where.OR = [
        { codigo: { contains: q, mode: 'insensitive' } },
        { descricao: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (ativo !== undefined) where.ativo = ativo === 'true'

    const [total, items] = await Promise.all([
      prisma.disposicaoMaterial.count({ where }),
      prisma.disposicaoMaterial.findMany({
        where,
        include: { tiposRelatorio: tipoRelatorioRef },
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

disposicoesRouter.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.disposicaoMaterial.findUnique({
      where: { id: req.params.id },
      include: { tiposRelatorio: tipoRelatorioRef },
    })
    if (!item) throw new HttpError(404, 'Disposição não encontrada')
    res.json(item)
  } catch (err) {
    next(err)
  }
})

disposicoesRouter.post('/', async (req, res, next) => {
  try {
    const { tiposRelatorioIds, ...data } = disposicaoCreateSchema.parse(req.body)
    const created = await prisma.disposicaoMaterial.create({
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

disposicoesRouter.patch('/:id', async (req, res, next) => {
  try {
    const { tiposRelatorioIds, ...data } = disposicaoUpdateSchema.parse(req.body)
    const updated = await prisma.disposicaoMaterial.update({
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

disposicoesRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.disposicaoMaterial.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})
