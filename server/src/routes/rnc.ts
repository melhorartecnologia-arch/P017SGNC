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
import { randomBytes, randomInt } from 'node:crypto'
import { montarMatrizAprovadores } from '../lib/rnc-aprovadores.js'
import { streamRncPdf } from '../lib/rnc-pdf-loader.js'
import { pendenciasParaAssinatura } from '../lib/rnc-completude.js'
import { criarTransporteSmtp } from '../lib/smtp.js'
import { montarEmailAssinatura } from '../lib/rnc-email.js'
import {
  processarWorkflows,
  enviarLembreteManual,
  escalonarManual,
  finalizarSeConcluida,
} from '../lib/rnc-workflow.js'

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
  notasFiscais: {
    select: {
      id: true,
      numero: true,
      dataFabricacao: true,
      dataValidade: true,
      dataRecebimento: true,
    },
    orderBy: { createdAt: 'asc' },
  },
  aprovadores: {
    select: {
      id: true,
      areaNome: true,
      nome: true,
      cargo: true,
      email: true,
      nivel: true,
      assinadoEm: true,
      assinaturaIp: true,
      assinaturaNavegador: true,
      assinaturaSo: true,
      assinaturaDispositivo: true,
      assinaturaLatitude: true,
      assinaturaLongitude: true,
      assinaturaPrecisao: true,
      assinaturaMetadados: true,
      lembreteEnviadoEm: true,
      viaEscalonamento: true,
    },
    orderBy: { areaNome: 'asc' },
  },
  _count: { select: { fotos: true } },
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

// Registra ou cancela a assinatura de um aprovador da matriz da RNC.
rncRouter.patch('/:rncId/aprovadores/:id', async (req, res, next) => {
  try {
    const assinado = req.body?.assinado === true
    const alvo = await prisma.rncAprovador.findUnique({
      where: { id: req.params.id },
      select: { id: true, rncId: true },
    })
    if (!alvo || alvo.rncId !== req.params.rncId) {
      throw new HttpError(404, 'Aprovador não encontrado nesta RNC')
    }
    await prisma.rncAprovador.update({
      where: { id: alvo.id },
      data: { assinadoEm: assinado ? new Date() : null },
    })
    // Se foi a última assinatura, notifica a conclusão a todos.
    if (assinado) await finalizarSeConcluida(prisma, alvo.rncId)
    const rnc = await prisma.relatorioNaoConformidade.findUniqueOrThrow({
      where: { id: req.params.rncId },
      include: includeRefs,
    })
    res.json(rnc)
  } catch (err) {
    next(err)
  }
})

// ===== Operações principais do RNC ============================

// Download do RNC em PDF (layout do formulário FOR.IND.CQA.012).
// Antes de /:id para evitar colisão de rota.
rncRouter.get('/:id/pdf', async (req, res, next) => {
  try {
    const ok = await streamRncPdf(req.params.id, res)
    if (!ok) throw new HttpError(404, 'Relatório não encontrado')
  } catch (err) {
    next(err)
  }
})

// Envia a RNC para assinatura: valida a completude, gera tokens de acesso
// para os aprovadores e dispara um e-mail para cada um.
rncRouter.post('/:id/enviar-assinatura', async (req, res, next) => {
  try {
    const rnc = await prisma.relatorioNaoConformidade.findUnique({
      where: { id: req.params.id },
      include: {
        filial: { select: { nome: true } },
        fornecedor: { select: { razaoSocial: true } },
        tipoNaoConformidade: { select: { codigo: true, descricao: true } },
        severidade: { select: { nivel: true, nome: true } },
        lotes: { select: { id: true } },
        notasFiscais: { select: { id: true } },
        fotos: { select: { id: true } },
        aprovadores: true,
      },
    })
    if (!rnc) throw new HttpError(404, 'Relatório não encontrado')

    const pendencias = pendenciasParaAssinatura(rnc)
    if (pendencias.length > 0) {
      throw new HttpError(
        400,
        `Preencha os campos obrigatórios e anexe ao menos uma foto antes de enviar para assinatura. Pendências: ${pendencias.join(', ')}.`,
      )
    }

    const destinatarios = rnc.aprovadores.filter((a) => a.email)
    if (destinatarios.length === 0) {
      throw new HttpError(
        400,
        'Nenhum aprovador com e-mail cadastrado para esta RNC. Verifique o cadastro de aprovadores da filial/turno.',
      )
    }

    const transporte = await criarTransporteSmtp()
    if (!transporte) {
      throw new HttpError(
        400,
        'Servidor de e-mail (SMTP) não configurado ou desativado. Configure em Configurações Técnicas.',
      )
    }

    const enviados: string[] = []
    const falhas: { email: string; erro: string }[] = []
    for (const ap of destinatarios) {
      const token = ap.tokenAssinatura ?? randomBytes(24).toString('hex')
      // Senha de assinatura: 6 dígitos aleatórios, enviada no e-mail.
      const senha =
        ap.senhaAssinatura ?? String(randomInt(0, 1_000_000)).padStart(6, '0')
      if (!ap.tokenAssinatura || !ap.senhaAssinatura) {
        await prisma.rncAprovador.update({
          where: { id: ap.id },
          data: { tokenAssinatura: token, senhaAssinatura: senha },
        })
      }
      const { subject, text, html } = montarEmailAssinatura({
        numero: rnc.numero,
        filialNome: rnc.filial?.nome ?? '',
        fornecedorNome: rnc.fornecedor?.razaoSocial ?? '',
        tipoNc: rnc.tipoNaoConformidade
          ? `${rnc.tipoNaoConformidade.codigo} — ${rnc.tipoNaoConformidade.descricao}`
          : '',
        severidade: rnc.severidade
          ? `Nível ${rnc.severidade.nivel} — ${rnc.severidade.nome}`
          : null,
        dataIdentificacao: rnc.dataIdentificacao,
        descricaoDefeito: rnc.descricaoDefeito,
        aprovadorNome: ap.nome,
        areaNome: ap.areaNome,
        token,
        senha,
      })
      try {
        await transporte.transporter.sendMail({
          from: transporte.remetente,
          to: ap.email!,
          subject,
          text,
          html,
        })
        enviados.push(ap.email!)
      } catch (err) {
        falhas.push({
          email: ap.email!,
          erro: err instanceof Error ? err.message : 'erro desconhecido',
        })
      }
    }

    if (enviados.length === 0) {
      throw new HttpError(
        502,
        `Falha ao enviar os e-mails de assinatura: ${falhas
          .map((f) => f.erro)
          .join('; ')}`,
      )
    }

    // Houve ao menos um envio: a RNC sai de rascunho para "aberta" e marca
    // o início do prazo (SLA) na primeira vez que é enviada.
    await prisma.relatorioNaoConformidade.update({
      where: { id: rnc.id },
      data: {
        ...(rnc.status === 'DRAFT' ? { status: 'OPEN' as const } : {}),
        ...(rnc.assinaturaEnviadaEm ? {} : { assinaturaEnviadaEm: new Date() }),
      },
    })

    // Registra o envio no histórico de workflows.
    const usuarioEnvio = req.user?.sub
      ? await prisma.usuario.findUnique({
          where: { id: req.user.sub },
          select: { nome: true },
        })
      : null
    await prisma.rncEnvioAssinatura.create({
      data: {
        rncId: rnc.id,
        rncNumero: rnc.numero,
        enviadoPorId: req.user?.sub ?? null,
        enviadoPorNome: usuarioEnvio?.nome ?? req.user?.email ?? 'sistema',
        totalDestinatarios: enviados.length,
        destinatarios: destinatarios
          .filter((a) => enviados.includes(a.email!))
          .map((a) => ({ email: a.email, areaNome: a.areaNome, nome: a.nome })),
      },
    })

    const atualizado = await prisma.relatorioNaoConformidade.findUniqueOrThrow({
      where: { id: rnc.id },
      include: includeRefs,
    })
    res.json({ rnc: atualizado, enviados, falhas })
  } catch (err) {
    next(err)
  }
})

// Envia lembrete manual aos aprovadores ainda pendentes da RNC.
rncRouter.post('/:id/lembrete', async (req, res, next) => {
  try {
    const rnc = await prisma.relatorioNaoConformidade.findUnique({
      where: { id: req.params.id },
      select: { id: true, status: true },
    })
    if (!rnc) throw new HttpError(404, 'Relatório não encontrado')
    // "Enviada" = saiu de rascunho. Cobre também RNCs enviadas antes de
    // existir o campo assinaturaEnviadaEm.
    if (rnc.status === 'DRAFT') {
      throw new HttpError(
        400,
        'Envie a RNC para assinatura antes de mandar um lembrete.',
      )
    }
    const { enviados, falhas, semSmtp, semPendentes } =
      await enviarLembreteManual(prisma, rnc.id)
    if (semSmtp) {
      throw new HttpError(
        400,
        'Servidor de e-mail (SMTP) não configurado ou desativado. Configure em Configurações Técnicas.',
      )
    }
    if (semPendentes) {
      throw new HttpError(400, 'Não há aprovadores pendentes para lembrar.')
    }
    // Havia pendentes mas nenhum e-mail saiu: falha de SMTP — reporta.
    if (enviados === 0 && falhas.length > 0) {
      throw new HttpError(
        502,
        `Falha ao enviar o lembrete por e-mail: ${falhas[0]}`,
      )
    }
    const atualizado = await prisma.relatorioNaoConformidade.findUniqueOrThrow({
      where: { id: rnc.id },
      include: includeRefs,
    })
    res.json({ rnc: atualizado, enviados })
  } catch (err) {
    next(err)
  }
})

// Escalonamento manual: sobe um nível acima do atual nas áreas pendentes,
// mesmo antes do prazo expirar.
rncRouter.post('/:id/escalonar', async (req, res, next) => {
  try {
    const rnc = await prisma.relatorioNaoConformidade.findUnique({
      where: { id: req.params.id },
      select: { id: true, status: true },
    })
    if (!rnc) throw new HttpError(404, 'Relatório não encontrado')
    if (rnc.status === 'DRAFT') {
      throw new HttpError(
        400,
        'Envie a RNC para assinatura antes de escalonar.',
      )
    }
    const r = await escalonarManual(prisma, rnc.id)
    if (r.semSmtp) {
      throw new HttpError(
        400,
        'Servidor de e-mail (SMTP) não configurado ou desativado. Configure em Configurações Técnicas.',
      )
    }
    if (r.semPendentes) {
      throw new HttpError(400, 'Não há aprovadores pendentes para escalonar.')
    }
    if (r.semCandidatos) {
      throw new HttpError(
        400,
        'Não há nível acima disponível no cadastro de aprovadores para as áreas pendentes.',
      )
    }
    if (r.novos === 0 && r.falhas.length > 0) {
      throw new HttpError(
        502,
        `Falha ao enviar o escalonamento por e-mail: ${r.falhas[0]}`,
      )
    }
    const atualizado = await prisma.relatorioNaoConformidade.findUniqueOrThrow({
      where: { id: rnc.id },
      include: includeRefs,
    })
    res.json({ rnc: atualizado, novos: r.novos })
  } catch (err) {
    next(err)
  }
})

// Processa o SLA dos workflows (lembretes a 50% e escalonamento a 100%).
// Idempotente — pode ser chamado por um agendador (cron) externo.
rncRouter.post('/processar-workflows', async (_req, res, next) => {
  try {
    const resultado = await processarWorkflows(prisma)
    res.json(resultado)
  } catch (err) {
    next(err)
  }
})

// Histórico de envios de workflow para assinatura, filtrável por código.
// Antes de /:id para evitar colisão de rota.
rncRouter.get('/envios', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const page = Math.max(1, Number(req.query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20))

    const where: Prisma.RncEnvioAssinaturaWhereInput = q
      ? { rncNumero: { contains: q, mode: 'insensitive' } }
      : {}

    const [total, items] = await Promise.all([
      prisma.rncEnvioAssinatura.count({ where }),
      prisma.rncEnvioAssinatura.findMany({
        where,
        orderBy: { enviadoEm: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          rncNumero: true,
          enviadoPorNome: true,
          totalDestinatarios: true,
          destinatarios: true,
          enviadoEm: true,
          rnc: {
            select: {
              id: true,
              status: true,
              filial: { select: { codigo: true, nome: true } },
              fornecedor: { select: { codigo: true, razaoSocial: true } },
              aprovadores: {
                select: { areaNome: true, nome: true, assinadoEm: true },
                orderBy: { areaNome: 'asc' },
              },
            },
          },
        },
      }),
    ])
    res.json({ items, page, pageSize, total })
  } catch (err) {
    next(err)
  }
})

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

    const { lotes, notasFiscais, ...rncData } = data
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
      const novo = await tx.relatorioNaoConformidade.create({
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
          notasFiscais: {
            create: notasFiscais.map((n) => ({
              numero: n.numero,
              dataFabricacao: n.dataFabricacao,
              dataValidade: n.dataValidade,
              dataRecebimento: n.dataRecebimento,
            })),
          },
        },
        select: { id: true },
      })
      // Matriz de aprovação: uma pessoa por área da filial, respeitando
      // a restrição de turno do cadastro de aprovadores.
      await montarMatrizAprovadores(
        tx,
        novo.id,
        data.filialId,
        data.turnoId ?? null,
      )
      return tx.relatorioNaoConformidade.findUniqueOrThrow({
        where: { id: novo.id },
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
    const { lotes, notasFiscais, ...rest } = rncUpdateSchema.parse(req.body)

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
      if (notasFiscais !== undefined) {
        await tx.rncNotaFiscal.deleteMany({ where: { rncId: req.params.id } })
        if (notasFiscais.length > 0) {
          await tx.rncNotaFiscal.createMany({
            data: notasFiscais.map((n) => ({
              rncId: req.params.id,
              numero: n.numero,
              dataFabricacao: n.dataFabricacao,
              dataValidade: n.dataValidade,
              dataRecebimento: n.dataRecebimento,
            })),
          })
        }
      }
      const salvo = await tx.relatorioNaoConformidade.update({
        where: { id: req.params.id },
        data: rest,
        include: includeRefs,
      })
      // Filial ou turno alterados mudam quem deve assinar — remonta a
      // matriz de aprovação.
      if (rest.filialId !== undefined || rest.turnoId !== undefined) {
        await montarMatrizAprovadores(
          tx,
          salvo.id,
          salvo.filialId,
          salvo.turnoId,
        )
        return tx.relatorioNaoConformidade.findUniqueOrThrow({
          where: { id: salvo.id },
          include: includeRefs,
        })
      }
      return salvo
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})
