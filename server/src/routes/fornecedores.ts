import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { HttpError } from '../middleware/error.js'
import { cnpjValido, soDigitos } from '../lib/br-format.js'
import {
  fornecedorCreateSchema,
  fornecedorQuerySchema,
  fornecedorUpdateSchema,
} from '../schemas/fornecedor.js'

export const fornecedoresRouter = Router()

fornecedoresRouter.get('/', async (req, res, next) => {
  try {
    const { q, ativo, page, pageSize } = fornecedorQuerySchema.parse(req.query)
    const where: Prisma.FornecedorWhereInput = {}
    if (q) {
      where.OR = [
        { codigo: { contains: q, mode: 'insensitive' } },
        { razaoSocial: { contains: q, mode: 'insensitive' } },
        { nomeFantasia: { contains: q, mode: 'insensitive' } },
        { cnpj: { contains: q } },
      ]
    }
    if (ativo !== undefined) where.ativo = ativo === 'true'

    const [total, items] = await Promise.all([
      prisma.fornecedor.count({ where }),
      prisma.fornecedor.findMany({
        where,
        orderBy: [{ ativo: 'desc' }, { razaoSocial: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { contatos: { orderBy: [{ principal: 'desc' }, { tipo: 'asc' }] } },
      }),
    ])
    res.json({ items, page, pageSize, total })
  } catch (err) {
    next(err)
  }
})

fornecedoresRouter.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.fornecedor.findUnique({
      where: { id: req.params.id },
      include: { contatos: { orderBy: [{ principal: 'desc' }, { tipo: 'asc' }] } },
    })
    if (!item) throw new HttpError(404, 'Fornecedor não encontrado')
    res.json(item)
  } catch (err) {
    next(err)
  }
})

fornecedoresRouter.post('/', async (req, res, next) => {
  try {
    const { contatos, ...data } = fornecedorCreateSchema.parse(req.body)
    const created = await prisma.fornecedor.create({
      data: {
        ...data,
        contatos: contatos && contatos.length ? { create: contatos } : undefined,
      },
      include: { contatos: { orderBy: [{ principal: 'desc' }, { tipo: 'asc' }] } },
    })
    res.status(201).json(created)
  } catch (err) {
    next(err)
  }
})

fornecedoresRouter.patch('/:id', async (req, res, next) => {
  try {
    const { contatos, ...data } = fornecedorUpdateSchema.parse(req.body)
    // Valida os dígitos verificadores apenas se o CNPJ tiver mudado, para
    // não bloquear a edição de fornecedores antigos fora do padrão.
    if (data.cnpj) {
      const atual = await prisma.fornecedor.findUnique({
        where: { id: req.params.id },
        select: { cnpj: true },
      })
      if (!atual) throw new HttpError(404, 'Fornecedor não encontrado')
      if (soDigitos(data.cnpj) !== soDigitos(atual.cnpj) && !cnpjValido(data.cnpj)) {
        throw new HttpError(400, 'Dados inválidos', {
          fieldErrors: { cnpj: ['CNPJ inválido (dígitos verificadores)'] },
        })
      }
    }
    const updated = await prisma.fornecedor.update({
      where: { id: req.params.id },
      data: {
        ...data,
        contatos:
          contatos !== undefined
            ? {
                deleteMany: {},
                create: contatos,
              }
            : undefined,
      },
      include: { contatos: { orderBy: [{ principal: 'desc' }, { tipo: 'asc' }] } },
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

fornecedoresRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.fornecedor.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})
