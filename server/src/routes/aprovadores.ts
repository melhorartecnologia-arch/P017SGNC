import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { HttpError } from '../middleware/error.js'
import {
  aprovadorCreateSchema,
  aprovadorQuerySchema,
  aprovadorUpdateSchema,
} from '../schemas/aprovador.js'

export const aprovadoresRouter = Router()

/**
 * `recebeRespostaFornecedor` não é um dado cadastral qualquer: é uma
 * concessão de permissão — quem está marcado decide sobre a recusa do
 * fornecedor e sobre o plano de ações. Por isso só o ADMIN pode ligar a
 * marcação, ou mexer no e-mail de alguém que já está marcado (senão
 * bastaria apontar o registro marcado para o próprio e-mail).
 */
async function exigirAdminParaMarcacao(
  req: { user?: { sub: string }; body?: unknown },
  aprovadorId?: string,
): Promise<void> {
  const corpo = (req.body ?? {}) as Record<string, unknown>
  const mexeNaMarcacao = corpo.recebeRespostaFornecedor !== undefined
  const mexeNoEmail = corpo.email !== undefined
  if (!mexeNaMarcacao && !mexeNoEmail) return

  const jaMarcado = aprovadorId
    ? (
        await prisma.aprovador.findUnique({
          where: { id: aprovadorId },
          select: { recebeRespostaFornecedor: true },
        })
      )?.recebeRespostaFornecedor === true
    : false

  const viraMarcado = corpo.recebeRespostaFornecedor === true
  if (!viraMarcado && !jaMarcado) return

  if (!req.user) throw new HttpError(401, 'Não autenticado')
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.user.sub },
    select: { role: true, ativo: true },
  })
  if (usuario?.role !== 'ADMIN' || !usuario.ativo) {
    throw new HttpError(
      403,
      'Apenas administradores podem marcar um aprovador como receptor das respostas do fornecedor ou alterar o e-mail de quem já está marcado.',
    )
  }
}

const includeRefs = {
  filial: { select: { id: true, codigo: true, nome: true } },
  area: { select: { id: true, codigo: true, nome: true } },
  turno: { select: { id: true, codigo: true, nome: true, filialId: true } },
  tiposRelatorio: { select: { id: true, codigo: true, descricao: true } },
} as const

/** Confere que os tipos de relatório vinculados existem. */
async function validarTiposRelatorio(ids?: string[]): Promise<void> {
  if (!ids || ids.length === 0) return
  const achados = await prisma.tipoRelatorio.count({ where: { id: { in: ids } } })
  if (achados !== ids.length) {
    throw new HttpError(400, 'Tipo de relatório vinculado inexistente.')
  }
}

function mapConflict(err: unknown) {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002' &&
    Array.isArray(err.meta?.target) &&
    (err.meta.target as string[]).includes('nivel')
  ) {
    return new HttpError(
      409,
      'Já existe um aprovador nesse nível para essa filial e área.',
    )
  }
  return err
}

/** Verifica que o turno (se informado) pertence à filial do aprovador. */
async function ensureTurnoBelongsToFilial(
  turnoId: string | null | undefined,
  filialId: string | undefined,
) {
  if (!turnoId) return
  const turno = await prisma.turnoTrabalho.findUnique({
    where: { id: turnoId },
    select: { filialId: true },
  })
  if (!turno) {
    throw new HttpError(400, 'Turno não encontrado.')
  }
  if (filialId && turno.filialId !== filialId) {
    throw new HttpError(400, 'O turno informado pertence a outra filial.')
  }
}

aprovadoresRouter.get('/', async (req, res, next) => {
  try {
    const { q, filialId, areaId, ativo, page, pageSize } =
      aprovadorQuerySchema.parse(req.query)
    const where: Prisma.AprovadorWhereInput = {}
    if (q) {
      where.OR = [
        { nome: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { cargo: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (filialId) where.filialId = filialId
    if (areaId) where.areaId = areaId
    if (ativo !== undefined) where.ativo = ativo === 'true'

    const [total, items] = await Promise.all([
      prisma.aprovador.count({ where }),
      prisma.aprovador.findMany({
        where,
        orderBy: [
          { ativo: 'desc' },
          { filial: { nome: 'asc' } },
          { area: { nome: 'asc' } },
          { nivel: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: includeRefs,
      }),
    ])
    res.json({ items, page, pageSize, total })
  } catch (err) {
    next(err)
  }
})

aprovadoresRouter.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.aprovador.findUnique({
      where: { id: req.params.id },
      include: includeRefs,
    })
    if (!item) throw new HttpError(404, 'Aprovador não encontrado')
    res.json(item)
  } catch (err) {
    next(err)
  }
})

aprovadoresRouter.post('/', async (req, res, next) => {
  try {
    const { tiposRelatorioIds, ...data } = aprovadorCreateSchema.parse(req.body)
    await validarTiposRelatorio(tiposRelatorioIds)
    await exigirAdminParaMarcacao(req)
    await ensureTurnoBelongsToFilial(data.turnoId, data.filialId)
    const created = await prisma.aprovador.create({
      data: {
        ...data,
        ...(tiposRelatorioIds && tiposRelatorioIds.length > 0
          ? { tiposRelatorio: { connect: tiposRelatorioIds.map((id) => ({ id })) } }
          : {}),
      },
      include: includeRefs,
    })
    res.status(201).json(created)
  } catch (err) {
    next(mapConflict(err))
  }
})

aprovadoresRouter.patch('/:id', async (req, res, next) => {
  try {
    const { tiposRelatorioIds, ...data } = aprovadorUpdateSchema.parse(req.body)
    await validarTiposRelatorio(tiposRelatorioIds)
    await exigirAdminParaMarcacao(req, req.params.id)
    // Para validar o turno na atualização precisamos da filial atual (ou a nova).
    let filialId = data.filialId
    if (!filialId && data.turnoId !== undefined) {
      const atual = await prisma.aprovador.findUnique({
        where: { id: req.params.id },
        select: { filialId: true },
      })
      filialId = atual?.filialId
    }
    await ensureTurnoBelongsToFilial(data.turnoId, filialId)
    const updated = await prisma.aprovador.update({
      where: { id: req.params.id },
      data: {
        ...data,
        ...(tiposRelatorioIds !== undefined
          ? { tiposRelatorio: { set: tiposRelatorioIds.map((id) => ({ id })) } }
          : {}),
      },
      include: includeRefs,
    })
    res.json(updated)
  } catch (err) {
    next(mapConflict(err))
  }
})

aprovadoresRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.aprovador.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})
