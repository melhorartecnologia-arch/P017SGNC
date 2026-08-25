import { Router, type Request } from 'express'
import { z } from 'zod'
import { UAParser } from 'ua-parser-js'
import { prisma } from '../db.js'
import { HttpError } from '../middleware/error.js'
import { streamRncPdf } from '../lib/rnc-pdf-loader.js'
import { finalizarSeConcluida } from '../lib/rnc-workflow.js'

const assinarSchema = z.object({
  senha: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Informe a senha de 6 dígitos enviada por e-mail.'),
  geolocalizacao: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      precisao: z.number().optional().nullable(),
    })
    .optional()
    .nullable(),
  metadados: z.record(z.unknown()).optional().nullable(),
})

/** IP de origem considerando proxies (X-Forwarded-For). */
function ipOrigem(req: import('express').Request): string {
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim()
  return req.ip ?? req.socket.remoteAddress ?? ''
}

/** URL pública do app a partir da requisição (respeitando o proxy/nginx). */
function baseUrlPublica(req: Request): string {
  const fwdProto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim()
  const fwdHost = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim()
  const proto = fwdProto || req.protocol || 'https'
  const host = fwdHost || req.get('host') || ''
  return host ? `${proto}://${host}` : ''
}

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
    // Superado por escalonamento: o link deixa de valer (mesmo para ver).
    if (ap.escalonadoEm && !ap.assinadoEm) {
      throw new HttpError(
        410,
        'Este link deixou de valer: o prazo da política de resposta expirou e a aprovação foi escalonada ao nível superior. A assinatura desta área não cabe mais a você.',
      )
    }
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
        tipoDocumento: r.tipoDocumento,
        titulo: r.titulo ?? r.pauta,
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
    const disposition = req.query.inline === '1' ? 'inline' : 'attachment'
    const ok = await streamRncPdf(ap.rncId, res, disposition)
    if (!ok) throw new HttpError(404, 'Relatório não encontrado')
  } catch (err) {
    next(err)
  }
})

// Registra a assinatura do aprovador dono do token. Exige a senha de 6
// dígitos enviada por e-mail e captura metadados técnicos da assinatura.
assinaturaRouter.post('/:token/assinar', async (req, res, next) => {
  try {
    const { senha, geolocalizacao, metadados } = assinarSchema.parse(req.body)

    const ap = await prisma.rncAprovador.findUnique({
      where: { tokenAssinatura: req.params.token },
      select: {
        id: true,
        rncId: true,
        assinadoEm: true,
        escalonadoEm: true,
        senhaAssinatura: true,
      },
    })
    if (!ap) throw new HttpError(404, 'Link de assinatura inválido ou expirado.')

    // Superado por escalonamento não assina mais, com senha certa ou não.
    if (ap.escalonadoEm && !ap.assinadoEm) {
      throw new HttpError(
        410,
        'Este link deixou de valer: o prazo da política de resposta expirou e a aprovação foi escalonada ao nível superior. A assinatura desta área não cabe mais a você.',
      )
    }

    if (ap.assinadoEm) {
      return res.json({ ok: true, assinadoEm: ap.assinadoEm, jaAssinado: true })
    }

    if (!ap.senhaAssinatura || senha !== ap.senhaAssinatura) {
      throw new HttpError(400, 'Senha de assinatura incorreta.')
    }

    const ua = req.headers['user-agent'] ?? ''
    const r = UAParser(ua)
    const ip = ipOrigem(req)
    const navegador = [r.browser.name, r.browser.version]
      .filter(Boolean)
      .join(' ')
    const so = [r.os.name, r.os.version].filter(Boolean).join(' ')
    const dispositivo =
      [r.device.vendor, r.device.model].filter(Boolean).join(' ') ||
      (r.device.type ?? 'Desktop')

    // JSON com tudo que pudermos coletar (servidor + cliente).
    const metaCompleto = {
      capturadoEm: new Date().toISOString(),
      ip,
      userAgent: ua,
      navegador: r.browser,
      sistemaOperacional: r.os,
      dispositivo: r.device,
      engine: r.engine,
      cpu: r.cpu,
      headers: {
        accept: req.headers['accept'],
        acceptLanguage: req.headers['accept-language'],
        referer: req.headers['referer'],
        secChUa: req.headers['sec-ch-ua'],
        secChUaPlatform: req.headers['sec-ch-ua-platform'],
        secChUaMobile: req.headers['sec-ch-ua-mobile'],
      },
      geolocalizacao: geolocalizacao ?? null,
      cliente: metadados ?? null,
    }

    // Condicionado a não ter sido superado: fecha a corrida entre a
    // assinatura e o escalonamento automático do agendador.
    const gravou = await prisma.rncAprovador.updateMany({
      where: { id: ap.id, assinadoEm: null, escalonadoEm: null },
      data: {
        assinadoEm: new Date(),
        assinaturaIp: ip.slice(0, 64),
        assinaturaUserAgent: String(ua),
        assinaturaNavegador: navegador.slice(0, 120) || null,
        assinaturaSo: so.slice(0, 120) || null,
        assinaturaDispositivo: dispositivo.slice(0, 120) || null,
        assinaturaLatitude: geolocalizacao?.latitude ?? null,
        assinaturaLongitude: geolocalizacao?.longitude ?? null,
        assinaturaPrecisao: geolocalizacao?.precisao ?? null,
        // Roundtrip JSON: remove undefined e satisfaz o tipo Json do Prisma.
        assinaturaMetadados: JSON.parse(JSON.stringify(metaCompleto)),
      },
    })
    if (gravou.count === 0) {
      throw new HttpError(
        410,
        'Este link deixou de valer: a aprovação foi escalonada ao nível superior enquanto a assinatura era registrada.',
      )
    }
    const atualizado = await prisma.rncAprovador.findUniqueOrThrow({
      where: { id: ap.id },
      select: { assinadoEm: true },
    })
    // Se esta foi a última assinatura, notifica a conclusão a todos.
    await finalizarSeConcluida(prisma, ap.rncId, baseUrlPublica(req))
    res.json({ ok: true, assinadoEm: atualizado.assinadoEm })
  } catch (err) {
    next(err)
  }
})
