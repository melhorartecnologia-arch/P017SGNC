import { Router } from 'express'
import { Prisma } from '@prisma/client'
import multer from 'multer'
import path from 'node:path'
import { mkdirSync, createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { prisma } from '../db.js'
import { HttpError } from '../middleware/error.js'
import {
  rncCreateSchema,
  rncQuerySchema,
  rncUpdateSchema,
} from '../schemas/rnc.js'

export const rncRouter = Router()

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'rnc-fotos')
mkdirSync(UPLOAD_DIR, { recursive: true })

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ''
      cb(null, `${randomUUID()}${ext}`)
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Formato não suportado (use JPG, PNG, WebP ou GIF).'))
  },
})

const includeRefs = {
  filial: { select: { id: true, codigo: true, nome: true } },
  fornecedor: { select: { id: true, codigo: true, razaoSocial: true, cnpj: true } },
  tipoNaoConformidade: {
    select: {
      id: true,
      codigo: true,
      descricao: true,
      severidade: { select: { id: true, codigo: true, nome: true, nivel: true, cor: true } },
    },
  },
  turno: { select: { id: true, codigo: true, nome: true } },
  disposicaoMaterial: { select: { id: true, codigo: true, descricao: true } },
  origem: { select: { id: true, codigo: true, nome: true } },
  severidade: { select: { id: true, codigo: true, nome: true, nivel: true, cor: true } },
  produto: { select: { id: true, codigo: true, descricao: true, unidadeMedida: true } },
  criadoPor: { select: { id: true, nome: true, email: true } },
  lotes: {
    select: { id: true, numero: true, quantidade: true },
    orderBy: { createdAt: 'asc' },
  },
} as const

rncRouter.get('/', async (req, res, next) => {
  try {
    const { fornecedorId, tipoNaoConformidadeId, filialId, status, limit, page, pageSize } =
      rncQuerySchema.parse(req.query)
    const where: Prisma.RelatorioNaoConformidadeWhereInput = {}
    if (fornecedorId) where.fornecedorId = fornecedorId
    if (tipoNaoConformidadeId) where.tipoNaoConformidadeId = tipoNaoConformidadeId
    if (filialId) where.filialId = filialId
    if (status) where.status = status

    const take = limit ?? pageSize
    const skip = limit ? 0 : (page - 1) * pageSize

    const [total, items] = await Promise.all([
      prisma.relatorioNaoConformidade.count({ where }),
      prisma.relatorioNaoConformidade.findMany({
        where,
        include: includeRefs,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take,
      }),
    ])
    res.json({ items, page, pageSize: take, total })
  } catch (err) {
    next(err)
  }
})

// ===== Fotos do RNC ===========================================
// Rotas montadas antes de /:id para evitar colisão com paths como
// /fotos/:fotoId.

const fotoSelect = {
  id: true,
  rncId: true,
  filename: true,
  originalName: true,
  mimeType: true,
  size: true,
  legenda: true,
  createdAt: true,
} as const

rncRouter.get('/:rncId/fotos', async (req, res, next) => {
  try {
    const fotos = await prisma.rncFoto.findMany({
      where: { rncId: req.params.rncId },
      select: fotoSelect,
      orderBy: [{ createdAt: 'asc' }],
    })
    res.json({ items: fotos })
  } catch (err) {
    next(err)
  }
})

rncRouter.post(
  '/:rncId/fotos',
  (req, res, next) => {
    upload.array('fotos', 20)(req, res, (err) => {
      if (err) return next(new HttpError(400, err.message))
      next()
    })
  },
  async (req, res, next) => {
    try {
      const files = (req.files as Express.Multer.File[]) ?? []
      if (files.length === 0) {
        throw new HttpError(400, 'Envie ao menos um arquivo no campo "fotos".')
      }
      const rncId = req.params.rncId
      const exists = await prisma.relatorioNaoConformidade.findUnique({
        where: { id: rncId },
        select: { id: true },
      })
      if (!exists) {
        // Limpa os arquivos órfãos que o multer já gravou em disco.
        await Promise.all(
          files.map((f) => fs.unlink(path.join(UPLOAD_DIR, f.filename)).catch(() => {})),
        )
        throw new HttpError(404, 'RNC não encontrado')
      }
      const created = await prisma.$transaction(
        files.map((f) =>
          prisma.rncFoto.create({
            data: {
              rncId,
              filename: f.filename,
              originalName: f.originalname,
              mimeType: f.mimetype,
              size: f.size,
            },
            select: fotoSelect,
          }),
        ),
      )
      res.status(201).json({ items: created })
    } catch (err) {
      next(err)
    }
  },
)

rncRouter.get('/fotos/:fotoId/file', async (req, res, next) => {
  try {
    const foto = await prisma.rncFoto.findUnique({
      where: { id: req.params.fotoId },
      select: { filename: true, mimeType: true, originalName: true },
    })
    if (!foto) throw new HttpError(404, 'Foto não encontrada')
    const filePath = path.join(UPLOAD_DIR, foto.filename)
    try {
      await fs.access(filePath)
    } catch {
      throw new HttpError(404, 'Arquivo da foto não está disponível.')
    }
    res.setHeader('Content-Type', foto.mimeType)
    res.setHeader('Cache-Control', 'private, max-age=300')
    createReadStream(filePath).pipe(res)
  } catch (err) {
    next(err)
  }
})

rncRouter.delete('/fotos/:fotoId', async (req, res, next) => {
  try {
    const foto = await prisma.rncFoto.findUnique({
      where: { id: req.params.fotoId },
      select: { id: true, filename: true },
    })
    if (!foto) throw new HttpError(404, 'Foto não encontrada')
    await prisma.rncFoto.delete({ where: { id: foto.id } })
    await fs.unlink(path.join(UPLOAD_DIR, foto.filename)).catch(() => {})
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

// ===== Operações principais do RNC ============================
rncRouter.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.relatorioNaoConformidade.findUnique({
      where: { id: req.params.id },
      include: includeRefs,
    })
    if (!item) throw new HttpError(404, 'Relatório não encontrado')
    res.json(item)
  } catch (err) {
    next(err)
  }
})

rncRouter.post('/', async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Não autenticado')
    const data = rncCreateSchema.parse(req.body)
    const criadoPorId = req.user.sub

    const filial = await prisma.filial.findUnique({
      where: { id: data.filialId },
      select: { codigo: true },
    })
    if (!filial) throw new HttpError(400, 'Filial inválida')

    const ano4 = data.dataIdentificacao.getUTCFullYear()
    const mes2 = String(data.dataIdentificacao.getUTCMonth() + 1).padStart(2, '0')
    const ano2 = String(ano4).slice(-2)
    const yearStart = new Date(Date.UTC(ano4, 0, 1))
    const yearEnd = new Date(Date.UTC(ano4 + 1, 0, 1))
    const codigoFilial = filial.codigo.trim().toUpperCase()

    const { lotes, ...rncData } = data
    const created = await prisma.$transaction(async (tx) => {
      // Lock advisory por (filial, ano) — liberado ao fim da transação.
      // Evita corrida quando dois POSTs caem na mesma combinação ao mesmo tempo.
      await tx.$executeRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',
        `rnc:${data.filialId}:${ano4}`,
      )
      const jaExistem = await tx.relatorioNaoConformidade.count({
        where: {
          filialId: data.filialId,
          dataIdentificacao: { gte: yearStart, lt: yearEnd },
        },
      })
      const numero =
        codigoFilial + mes2 + ano2 + String(jaExistem + 1).padStart(3, '0')
      return tx.relatorioNaoConformidade.create({
        data: {
          ...rncData,
          numero,
          criadoPorId,
          lotes: {
            create: lotes.map((l) => ({
              numero: l.numero,
              quantidade: l.quantidade,
            })),
          },
        },
        include: includeRefs,
      })
    })
    res.status(201).json(created)
  } catch (err) {
    next(err)
  }
})

rncRouter.patch('/:id', async (req, res, next) => {
  try {
    const { lotes, ...rest } = rncUpdateSchema.parse(req.body)

    // O schema valida quantidadeDefeito × lotes quando ambos vêm no
    // payload. Quando o PATCH altera só um dos dois, completa com os
    // valores atuais do banco para garantir a consistência final.
    if (rest.quantidadeDefeito !== undefined || lotes !== undefined) {
      const atual = await prisma.relatorioNaoConformidade.findUnique({
        where: { id: req.params.id },
        select: {
          quantidadeDefeito: true,
          lotes: { select: { quantidade: true } },
        },
      })
      if (!atual) throw new HttpError(404, 'RNC não encontrado')
      const qtd =
        rest.quantidadeDefeito !== undefined
          ? rest.quantidadeDefeito
          : atual.quantidadeDefeito
      const qtdsLotes = (lotes ?? atual.lotes).map((l) => l.quantidade)
      if (qtd != null) {
        const total = qtdsLotes.reduce<number>((acc, q) => acc + (q ?? 0), 0)
        if (total > 0 && qtd > total) {
          throw new HttpError(
            400,
            'A quantidade com defeito não pode ser maior que a quantidade total dos lotes.',
          )
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (lotes !== undefined) {
        await tx.rncLote.deleteMany({ where: { rncId: req.params.id } })
        if (lotes.length > 0) {
          await tx.rncLote.createMany({
            data: lotes.map((l) => ({
              rncId: req.params.id,
              numero: l.numero,
              quantidade: l.quantidade,
            })),
          })
        }
      }
      return tx.relatorioNaoConformidade.update({
        where: { id: req.params.id },
        data: rest,
        include: includeRefs,
      })
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})
