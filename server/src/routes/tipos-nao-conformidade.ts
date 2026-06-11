import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { HttpError } from '../middleware/error.js'
import {
  tipoNaoConformidadeCreateSchema,
  tipoNaoConformidadeQuerySchema,
  tipoNaoConformidadeUpdateSchema,
} from '../schemas/tipo-nao-conformidade.js'

export const tiposNaoConformidadeRouter = Router()

const includeRefs = {
  produtos: {
    select: { id: true, codigo: true, descricao: true, unidadeMedida: true },
  },
  severidade: {
    select: { id: true, codigo: true, nome: true, nivel: true, cor: true },
  },
} as const

tiposNaoConformidadeRouter.get('/', async (req, res, next) => {
  try {
    const { q, severidadeId, ativo, page, pageSize } =
      tipoNaoConformidadeQuerySchema.parse(req.query)
    const where: Prisma.TipoNaoConformidadeWhereInput = {}
    if (q) {
      where.OR = [
        { codigo: { contains: q, mode: 'insensitive' } },
        { descricao: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (severidadeId) where.severidadeId = severidadeId
    if (ativo !== undefined) where.ativo = ativo === 'true'

    const [total, items] = await Promise.all([
      prisma.tipoNaoConformidade.count({ where }),
      prisma.tipoNaoConformidade.findMany({
        where,
        include: includeRefs,
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

tiposNaoConformidadeRouter.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.tipoNaoConformidade.findUnique({
      where: { id: req.params.id },
      include: includeRefs,
    })
    if (!item) throw new HttpError(404, 'Tipo de não conformidade não encontrado')
    res.json(item)
  } catch (err) {
    next(err)
  }
})

tiposNaoConformidadeRouter.post('/', async (req, res, next) => {
  try {
    const { produtosIds, ...data } = tipoNaoConformidadeCreateSchema.parse(req.body)
    const created = await prisma.tipoNaoConformidade.create({
      data: {
        ...data,
        produtos: produtosIds.length
          ? { connect: produtosIds.map((id) => ({ id })) }
          : undefined,
      },
      include: includeRefs,
    })
    res.status(201).json(created)
  } catch (err) {
    next(err)
  }
})

tiposNaoConformidadeRouter.patch('/:id', async (req, res, next) => {
  try {
    const { produtosIds, ...data } = tipoNaoConformidadeUpdateSchema.parse(req.body)
    const updated = await prisma.tipoNaoConformidade.update({
      where: { id: req.params.id },
      data: {
        ...data,
        produtos:
          produtosIds === undefined
            ? undefined
            : { set: produtosIds.map((id) => ({ id })) },
      },
      include: includeRefs,
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

tiposNaoConformidadeRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.tipoNaoConformidade.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})
