import { Router, type Request } from 'express'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
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
import { montarMatrizAprovadores } from '../lib/rnc-aprovadores.js'
import { streamRncPdf } from '../lib/rnc-pdf-loader.js'
import { pendenciasParaAssinatura } from '../lib/rnc-completude.js'
import { criarTransporteSmtp } from '../lib/smtp.js'
import { criarContextoWa } from '../lib/wa.js'
import {
  registrarAnaliseRecusa,
  analisarAcaoContingencia,
} from '../lib/rnc-ciencia.js'
import {
  processarWorkflows,
  enviarLembreteManual,
  escalonarManual,
  finalizarSeConcluida,
  enviarWorkflowAprovador,
  horasRespostaRnc,
} from '../lib/rnc-workflow.js'

export const rncRouter = Router()

/**
 * URL pública do app a partir da requisição (respeitando o proxy/nginx).
 * Usada nos links dos e-mails de assinatura para não cair em localhost
 * quando APP_BASE_URL não estiver configurada no servidor.
 */
function baseUrlPublica(req: Request): string {
  const fwdProto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim()
  const fwdHost = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim()
  const proto = fwdProto || req.protocol || 'https'
  const host = fwdHost || req.get('host') || ''
  return host ? `${proto}://${host}` : ''
}

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
  acoesContingencia: {
    select: {
      id: true,
      ordem: true,
      descricao: true,
      responsavel: true,
      prazo: true,
      status: true,
      informadaEm: true,
      informadaPor: true,
      analisadaEm: true,
      analisadaPor: true,
      parecer: true,
    },
    orderBy: { ordem: 'asc' },
  },
  _count: { select: { fotos: true } },
} as const

/**
 * Quem pode decidir sobre as respostas do fornecedor (recusa da ciência e
 * ações de contingência): perfil ADMIN ou aprovador ativo marcado como
 * receptor das respostas na filial da RNC. Devolve o usuário para que a
 * decisão fique nominal; lança 403 quando não pode.
 */
async function exigirAnalistaDoFornecedor(
  usuarioId: string,
  emailFallback: string,
  rncId: string,
): Promise<{ nome: string; email: string }> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { nome: true, email: true, role: true, ativo: true },
  })
  // O token vive algumas horas: um usuário desativado nesse intervalo
  // ainda apresentaria um JWT válido, então a conta é conferida aqui.
  if (!usuario || !usuario.ativo) {
    throw new HttpError(403, 'Usuário inativo ou inexistente.')
  }
  const identidade = {
    nome: usuario.nome ?? emailFallback,
    email: usuario.email ?? emailFallback,
  }
  if (usuario.role === 'ADMIN') return identidade

  const rnc = await prisma.relatorioNaoConformidade.findUnique({
    where: { id: rncId },
    select: { filialId: true },
  })
  // E-mail vazio nunca casa: sem isso um aprovador cadastrado sem e-mail
  // abriria a decisão para qualquer usuário também sem e-mail.
  const email = usuario.email?.trim() ?? ''
  const marcado = email
    ? await prisma.aprovador.findFirst({
        where: {
          filialId: rnc?.filialId,
          ativo: true,
          recebeRespostaFornecedor: true,
          email: { equals: email, mode: 'insensitive' },
        },
        select: { id: true },
      })
    : null
  if (!marcado) {
    throw new HttpError(
      403,
      'Apenas administradores ou aprovadores marcados para receber as respostas do fornecedor podem registrar esta análise.',
    )
  }
  return identidade
}

rncRouter.get('/', async (req, res, next) => {
  try {
    const {
      fornecedorId,
      tipoNaoConformidadeId,
      filialId,
      produtoId,
      disposicaoMaterialId,
      origemId,
      severidadeId,
      status,
      cienciaStatus,
      contingenciaStatus,
      contingenciaAtrasada,
      de,
      ate,
      limit,
      page,
      pageSize,
    } = rncQuerySchema.parse(req.query)
    const where: Prisma.RelatorioNaoConformidadeWhereInput = {}
    if (fornecedorId) where.fornecedorId = fornecedorId
    if (tipoNaoConformidadeId) where.tipoNaoConformidadeId = tipoNaoConformidadeId
    if (filialId) where.filialId = filialId
    if (de || ate) {
      where.dataIdentificacao = {}
      if (de) where.dataIdentificacao.gte = de
      if (ate) where.dataIdentificacao.lt = ate
    }
    // "__none__" filtra registros sem o vínculo (campo nulo).
    const opt = (v: string | undefined) =>
      v === '__none__' ? null : v || undefined
    if (produtoId) where.produtoId = opt(produtoId)
    if (disposicaoMaterialId) where.disposicaoMaterialId = opt(disposicaoMaterialId)
    if (origemId) where.origemId = opt(origemId)
    if (severidadeId) where.severidadeId = opt(severidadeId)
    if (status) where.status = status
    // Ciência do fornecedor: "__none__" = ainda não enviada (campo nulo).
    if (cienciaStatus) {
      where.cienciaStatus = cienciaStatus === '__none__' ? null : cienciaStatus
    }
    // Ações de contingência: "__none__" = ainda não solicitadas.
    if (contingenciaStatus) {
      where.contingenciaStatus =
        contingenciaStatus === '__none__' ? null : contingenciaStatus
    }
    // Em atraso: plano ainda devido (nunca enviado ou devolvido para
    // ajuste) com o prazo já vencido.
    if (contingenciaAtrasada) {
      where.contingenciaStatus = { in: ['PENDENTE', 'AJUSTE_SOLICITADO'] }
      where.contingenciaPrazoEm = { lte: new Date() }
    }

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
    if (assinado) await finalizarSeConcluida(prisma, alvo.rncId, baseUrlPublica(req))
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

    const destinatarios = rnc.aprovadores.filter((a) => a.email || a.whatsapp)
    if (destinatarios.length === 0) {
      throw new HttpError(
        400,
        'Nenhum aprovador com e-mail ou WhatsApp cadastrado para esta RNC. Verifique o cadastro de aprovadores da filial/turno.',
      )
    }

    const transporte = await criarTransporteSmtp()
    if (!transporte) {
      throw new HttpError(
        400,
        'Servidor de e-mail (SMTP) não configurado ou desativado. Configure em Configurações Técnicas.',
      )
    }

    const wa = criarContextoWa()
    const horasSla = await horasRespostaRnc(prisma)
    const enviados: string[] = []
    const falhas: { email: string; erro: string }[] = []
    for (const ap of destinatarios) {
      const r = await enviarWorkflowAprovador(
        prisma,
        transporte,
        wa,
        rnc,
        ap,
        'solicitacao',
        horasSla,
        baseUrlPublica(req),
      )
      if (r.ok) enviados.push(ap.email ?? ap.nome)
      else falhas.push({ email: ap.email ?? ap.nome, erro: r.erro ?? 'erro' })
    }

    if (enviados.length === 0) {
      throw new HttpError(
        502,
        `Falha ao notificar os aprovadores: ${falhas
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
          .filter((a) => enviados.includes(a.email ?? a.nome))
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
      await enviarLembreteManual(prisma, rnc.id, baseUrlPublica(req))
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
    const r = await escalonarManual(prisma, rnc.id, baseUrlPublica(req))
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

// Análise da recusa do fornecedor pela plataforma (usuário logado).
// Mesma decisão disponível no link enviado por e-mail ao aprovador marcado.
/** Decisão do aprovador sobre uma ação: recusar exige parecer. */
const acaoDecisaoSchema = z
  .object({
    aprovada: z.boolean({
      required_error: 'Informe se a ação é aprovada ou recusada.',
    }),
    parecer: z
      .string()
      .trim()
      .max(4000, 'O parecer não pode passar de 4000 caracteres.')
      .optional()
      .nullable()
      .transform((v) => v || null),
  })
  .superRefine((d, ctx) => {
    if (!d.aprovada && !d.parecer) {
      ctx.addIssue({
        code: 'custom',
        path: ['parecer'],
        message: 'Informe o parecer que fundamenta a recusa da ação.',
      })
    }
  })

/**
 * Aprova ou recusa UMA ação do plano de contingência do fornecedor.
 * Restrito a ADMIN e aos aprovadores marcados da filial. A recusa exige
 * parecer — é o texto que volta ao fornecedor para correção.
 */
rncRouter.post(
  '/:id/contingencia/acoes/:acaoId',
  async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, 'Não autenticado')
      const { aprovada, parecer } = acaoDecisaoSchema.parse(req.body)
      if (!/^[0-9a-f-]{36}$/i.test(req.params.acaoId)) {
        throw new HttpError(400, 'Ação de contingência inválida.')
      }

      const rnc = await prisma.relatorioNaoConformidade.findUnique({
        where: { id: req.params.id },
        select: { id: true, contingenciaStatus: true },
      })
      if (!rnc) throw new HttpError(404, 'RNC não encontrada')
      if (rnc.contingenciaStatus !== 'EM_ANALISE') {
        throw new HttpError(
          409,
          'A análise só é possível enquanto o plano de ações está aguardando avaliação.',
        )
      }

      const analista = await exigirAnalistaDoFornecedor(
        req.user.sub,
        req.user.email,
        rnc.id,
      )

      try {
        await analisarAcaoContingencia(prisma, rnc.id, req.params.acaoId, {
          aprovada,
          analisadaPor: analista.nome,
          parecer: parecer ?? null,
          baseUrl: baseUrlPublica(req),
        })
      } catch (err) {
        throw new HttpError(
          409,
          err instanceof Error ? err.message : 'Não foi possível registrar.',
        )
      }

      const atualizado = await prisma.relatorioNaoConformidade.findUniqueOrThrow({
        where: { id: rnc.id },
        include: includeRefs,
      })
      res.json(atualizado)
    } catch (err) {
      next(err)
    }
  },
)

rncRouter.post('/:id/ciencia/analisar', async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Não autenticado')
    const acatarRecusa = req.body?.acatarRecusa
    if (typeof acatarRecusa !== 'boolean') {
      throw new HttpError(400, 'Informe se a recusa é acatada ou negada.')
    }
    const justificativa =
      typeof req.body?.justificativa === 'string'
        ? req.body.justificativa.trim()
        : ''
    // Negar torna a RNC definitiva: exige parecer fundamentado.
    if (!acatarRecusa && !justificativa) {
      throw new HttpError(
        400,
        'Informe o parecer que fundamenta a negativa da recusa.',
      )
    }

    const rnc = await prisma.relatorioNaoConformidade.findUnique({
      where: { id: req.params.id },
      select: { id: true, cienciaStatus: true },
    })
    if (!rnc) throw new HttpError(404, 'RNC não encontrada')
    if (rnc.cienciaStatus !== 'RECUSADA') {
      throw new HttpError(
        409,
        'A análise só é possível quando o fornecedor recusou a não conformidade.',
      )
    }

    const analista = await exigirAnalistaDoFornecedor(
      req.user.sub,
      req.user.email,
      rnc.id,
    )

    try {
      await registrarAnaliseRecusa(prisma, rnc.id, {
        acatarRecusa,
        analisadoPor: analista.nome,
        justificativa: justificativa || null,
        baseUrl: baseUrlPublica(req),
      })
    } catch (err) {
      throw new HttpError(
        409,
        err instanceof Error ? err.message : 'Não foi possível registrar.',
      )
    }

    const atualizado = await prisma.relatorioNaoConformidade.findUniqueOrThrow({
      where: { id: rnc.id },
      include: includeRefs,
    })
    res.json(atualizado)
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
      select: { codigo: true, rncNumeroInicial: true },
    })
    if (!filial) throw new HttpError(400, 'Filial inválida')

    const ano4 = data.dataIdentificacao.getUTCFullYear()
    const mes2 = String(data.dataIdentificacao.getUTCMonth() + 1).padStart(2, '0')
    const ano2 = String(ano4).slice(-2)
    const codigoFilial = filial.codigo.trim().toUpperCase()

    const { lotes, notasFiscais, ...rncData } = data
    const prefixo = codigoFilial + mes2 + ano2
    const montarNumero = (seq: number) => prefixo + String(seq).padStart(3, '0')

    const criarComNumeracao = () =>
      prisma.$transaction(async (tx) => {
      // Lock advisory por filial — liberado ao fim da transação. Evita corrida
      // quando dois POSTs da mesma filial chegam ao mesmo tempo.
      await tx.$executeRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',
        `rnc:${data.filialId}`,
      )
      // Numeração contínua por filial: parte do maior entre o número inicial
      // informado no cadastro da filial (controle atual), o último sequencial
      // já usado e a própria quantidade de RNCs da filial (este piso cobre
      // registros legados sem sequencial preenchido).
      const agg = await tx.relatorioNaoConformidade.aggregate({
        where: { filialId: data.filialId },
        _max: { sequencialFilial: true },
        _count: { _all: true },
      })
      // Números já usados neste prefixo (filial + mês/ano). Uma consulta só:
      // evita uma ida ao banco por tentativa e cobre registros legados, que
      // podem ter numeração fora da sequência atual.
      const usados = new Set(
        (
          await tx.relatorioNaoConformidade.findMany({
            where: { numero: { startsWith: prefixo } },
            select: { numero: true },
          })
        ).map((r) => r.numero),
      )
      let sequencial =
        Math.max(
          filial.rncNumeroInicial ?? 0,
          agg._max.sequencialFilial ?? 0,
          agg._count._all ?? 0,
        ) + 1
      let numero = montarNumero(sequencial)
      // Avança até um número livre. Como o conjunto é finito, o laço termina.
      while (usados.has(numero)) {
        sequencial += 1
        numero = montarNumero(sequencial)
      }
      const novo = await tx.relatorioNaoConformidade.create({
        data: {
          ...rncData,
          numero,
          sequencialFilial: sequencial,
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

    // Rede de segurança: se ainda assim o número colidir (dado legado
    // inserido por fora, restauração de backup, integração), refaz a
    // transação — que recalcula a numeração — em vez de devolver o erro
    // "já existe registro com este número" para o usuário.
    let created
    for (let tentativa = 1; ; tentativa++) {
      try {
        created = await criarComNumeracao()
        break
      } catch (err) {
        const colisaoDeNumero =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          (err.meta?.target as string[] | undefined)?.includes('numero')
        if (!colisaoDeNumero || tentativa >= 5) throw err
      }
    }
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
