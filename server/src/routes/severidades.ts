import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { HttpError } from '../middleware/error.js'
import {
  severidadeCreateSchema,
  severidadeQuerySchema,
  severidadeUpdateSchema,
} from '../schemas/severidade.js'

export const severidadesRouter = Router()

const tipoRelatorioRef = {
  select: { id: true, codigo: true, descricao: true },
} as const

function mapConflict(err: unknown) {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002' &&
    Array.isArray(err.meta?.target)
  ) {
    const t = err.meta.target as string[]
    if (t.includes('nivel')) {
      return new HttpError(409, 'Já existe uma severidade nesse nível.')
    }
    if (t.includes('codigo')) {
      return new HttpError(409, 'Já existe uma severidade com esse código.')
    }
  }
  return err
}

severidadesRouter.get('/', async (req, res, next) => {
  try {
    const { q, ativo, page, pageSize } = severidadeQuerySchema.parse(req.query)
    const where: Prisma.SeveridadeWhereInput = {}
    if (q) {
      where.OR = [
        { codigo: { contains: q, mode: 'insensitive' } },
        { nome: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (ativo !== undefined) where.ativo = ativo === 'true'

    const [total, items] = await Promise.all([
      prisma.severidade.count({ where }),
      prisma.severidade.findMany({
        where,
        include: { tiposRelatorio: tipoRelatorioRef },
        orderBy: [{ nivel: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])
    res.json({ items, page, pageSize, total })
  } catch (err) {
    next(err)
  }
})

severidadesRouter.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.severidade.findUnique({
      where: { id: req.params.id },
      include: { tiposRelatorio: tipoRelatorioRef },
    })
    if (!item) throw new HttpError(404, 'Severidade não encontrada')
    res.json(item)
  } catch (err) {
    next(err)
  }
})

severidadesRouter.post('/', async (req, res, next) => {
  try {
    const { tiposRelatorioIds, ...data } = severidadeCreateSchema.parse(req.body)
    const created = await prisma.severidade.create({
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
    next(mapConflict(err))
  }
})

severidadesRouter.patch('/:id', async (req, res, next) => {
  try {
    const { tiposRelatorioIds, ...data } = severidadeUpdateSchema.parse(req.body)
    const updated = await prisma.severidade.update({
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
    next(mapConflict(err))
  }
})

severidadesRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.severidade.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})
