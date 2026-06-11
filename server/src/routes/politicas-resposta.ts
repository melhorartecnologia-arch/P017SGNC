import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { HttpError } from '../middleware/error.js'
import {
  politicaCreateSchema,
  politicaQuerySchema,
  politicaUpdateSchema,
} from '../schemas/politica-resposta.js'

export const politicasRespostaRouter = Router()

const tipoRef = {
  select: { id: true, codigo: true, descricao: true },
} as const

function mapConflict(err: unknown) {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002' &&
    Array.isArray(err.meta?.target) &&
    (err.meta.target as string[]).includes('tipo_relatorio_id')
  ) {
    return new HttpError(
      409,
      'Já existe uma política cadastrada para esse tipo de relatório.',
    )
  }
  return err
}

politicasRespostaRouter.get('/', async (req, res, next) => {
  try {
    const { q, tipoRelatorioId, ativo, page, pageSize } =
      politicaQuerySchema.parse(req.query)
    const where: Prisma.PoliticaRespostaWhereInput = {}
    if (tipoRelatorioId) where.tipoRelatorioId = tipoRelatorioId
    if (ativo !== undefined) where.ativo = ativo === 'true'
    if (q) {
      where.tipoRelatorio = {
        OR: [
          { codigo: { contains: q, mode: 'insensitive' } },
          { descricao: { contains: q, mode: 'insensitive' } },
        ],
      }
    }

    const [total, items] = await Promise.all([
      prisma.politicaResposta.count({ where }),
      prisma.politicaResposta.findMany({
        where,
        include: { tipoRelatorio: tipoRef },
        orderBy: [{ ativo: 'desc' }, { tipoRelatorio: { codigo: 'asc' } }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])
    res.json({ items, page, pageSize, total })
  } catch (err) {
    next(err)
  }
})

politicasRespostaRouter.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.politicaResposta.findUnique({
      where: { id: req.params.id },
      include: { tipoRelatorio: tipoRef },
    })
    if (!item) throw new HttpError(404, 'Política não encontrada')
    res.json(item)
  } catch (err) {
    next(err)
  }
})

politicasRespostaRouter.post('/', async (req, res, next) => {
  try {
    const data = politicaCreateSchema.parse(req.body)
    const created = await prisma.politicaResposta.create({
      data,
      include: { tipoRelatorio: tipoRef },
    })
    res.status(201).json(created)
  } catch (err) {
    next(mapConflict(err))
  }
})

politicasRespostaRouter.patch('/:id', async (req, res, next) => {
  try {
    const data = politicaUpdateSchema.parse(req.body)
    const updated = await prisma.politicaResposta.update({
      where: { id: req.params.id },
      data,
      include: { tipoRelatorio: tipoRef },
    })
    res.json(updated)
  } catch (err) {
    next(mapConflict(err))
  }
})

politicasRespostaRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.politicaResposta.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})
