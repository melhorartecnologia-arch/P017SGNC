import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { HttpError } from '../middleware/error.js'
import {
  turnoCreateSchema,
  turnoQuerySchema,
  turnoUpdateSchema,
} from '../schemas/turno-trabalho.js'

export const turnosTrabalhoRouter = Router()

const filialRef = {
  select: { id: true, codigo: true, nome: true },
} as const

function mapConflict(err: unknown) {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002' &&
    Array.isArray(err.meta?.target)
  ) {
    const t = err.meta.target as string[]
    if (t.includes('filial_id') && t.includes('codigo')) {
      return new HttpError(409, 'Já existe um turno com esse código nessa filial.')
    }
  }
  return err
}

turnosTrabalhoRouter.get('/', async (req, res, next) => {
  try {
    const { q, filialId, ativo, page, pageSize } = turnoQuerySchema.parse(req.query)
    const where: Prisma.TurnoTrabalhoWhereInput = {}
    if (q) {
      where.OR = [
        { codigo: { contains: q, mode: 'insensitive' } },
        { nome: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (filialId) where.filialId = filialId
    if (ativo !== undefined) where.ativo = ativo === 'true'

    const [total, items] = await Promise.all([
      prisma.turnoTrabalho.count({ where }),
      prisma.turnoTrabalho.findMany({
        where,
        include: { filial: filialRef },
        orderBy: [{ ativo: 'desc' }, { horaInicio: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])
    res.json({ items, page, pageSize, total })
  } catch (err) {
    next(err)
  }
})

turnosTrabalhoRouter.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.turnoTrabalho.findUnique({
      where: { id: req.params.id },
      include: { filial: filialRef },
    })
    if (!item) throw new HttpError(404, 'Turno não encontrado')
    res.json(item)
  } catch (err) {
    next(err)
  }
})

turnosTrabalhoRouter.post('/', async (req, res, next) => {
  try {
    const data = turnoCreateSchema.parse(req.body)
    const created = await prisma.turnoTrabalho.create({
      data,
      include: { filial: filialRef },
    })
    res.status(201).json(created)
  } catch (err) {
    next(mapConflict(err))
  }
})

turnosTrabalhoRouter.patch('/:id', async (req, res, next) => {
  try {
    const data = turnoUpdateSchema.parse(req.body)
    const updated = await prisma.turnoTrabalho.update({
      where: { id: req.params.id },
      data,
      include: { filial: filialRef },
    })
    res.json(updated)
  } catch (err) {
    next(mapConflict(err))
  }
})

turnosTrabalhoRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.turnoTrabalho.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})
