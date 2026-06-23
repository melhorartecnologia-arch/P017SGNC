import { Router } from 'express'
import { prisma } from '../db.js'
import { HttpError } from '../middleware/error.js'
import { streamRncPdf } from '../lib/rnc-pdf-loader.js'

/**
 * Acesso público (link mágico por token) para o aprovador ver e assinar
 * uma RNC sem precisar logar. Cada token identifica um único aprovador.
 */
export const assinaturaRouter = Router()

async function carregarPorToken(token: string) {
  const ap = await prisma.rncAprovador.findUnique({
    where: { tokenAssinatura: token },
    include: {
      rnc: {
        include: {
          filial: { select: { nome: true, codigo: true } },
          fornecedor: { select: { razaoSocial: true, codigo: true } },
          tipoNaoConformidade: { select: { codigo: true, descricao: true } },
          severidade: { select: { nivel: true, nome: true } },
          aprovadores: {
            select: { areaNome: true, nome: true, assinadoEm: true },
            orderBy: { areaNome: 'asc' },
          },
        },
      },
    },
  })
  return ap
}

// Resumo da RNC para a tela de assinatura.
assinaturaRouter.get('/:token', async (req, res, next) => {
  try {
    const ap = await carregarPorToken(req.params.token)
    if (!ap) throw new HttpError(404, 'Link de assinatura inválido ou expirado.')
    const r = ap.rnc
    res.json({
      aprovador: {
        nome: ap.nome,
        cargo: ap.cargo,
        areaNome: ap.areaNome,
        assinadoEm: ap.assinadoEm,
      },
      rnc: {
        numero: r.numero,
        status: r.status,
        dataIdentificacao: r.dataIdentificacao,
        descricaoDefeito: r.descricaoDefeito,
        filial: r.filial,
        fornecedor: r.fornecedor,
        tipoNaoConformidade: r.tipoNaoConformidade,
        severidade: r.severidade,
        aprovadores: r.aprovadores,
      },
    })
  } catch (err) {
    next(err)
  }
})

// PDF da RNC associada ao token.
assinaturaRouter.get('/:token/pdf', async (req, res, next) => {
  try {
    const ap = await prisma.rncAprovador.findUnique({
      where: { tokenAssinatura: req.params.token },
      select: { rncId: true },
    })
    if (!ap) throw new HttpError(404, 'Link de assinatura inválido ou expirado.')
    const ok = await streamRncPdf(ap.rncId, res)
    if (!ok) throw new HttpError(404, 'Relatório não encontrado')
  } catch (err) {
    next(err)
  }
})

// Registra a assinatura do aprovador dono do token.
assinaturaRouter.post('/:token/assinar', async (req, res, next) => {
  try {
    const ap = await prisma.rncAprovador.findUnique({
      where: { tokenAssinatura: req.params.token },
      select: { id: true, assinadoEm: true },
    })
    if (!ap) throw new HttpError(404, 'Link de assinatura inválido ou expirado.')
    if (!ap.assinadoEm) {
      await prisma.rncAprovador.update({
        where: { id: ap.id },
        data: { assinadoEm: new Date() },
      })
    }
    const atualizado = await prisma.rncAprovador.findUniqueOrThrow({
      where: { id: ap.id },
      select: { assinadoEm: true },
    })
    res.json({ ok: true, assinadoEm: atualizado.assinadoEm })
  } catch (err) {
    next(err)
  }
})
