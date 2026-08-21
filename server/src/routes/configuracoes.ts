import { Router } from 'express'
import nodemailer from 'nodemailer'
import { prisma } from '../db.js'
import { HttpError } from '../middleware/error.js'
import { requireRole } from '../middleware/auth.js'
import {
  configuracaoSmtpSchema,
  smtpTesteSchema,
} from '../schemas/configuracao-smtp.js'
import { configuracaoWorkflowSchema } from '../schemas/configuracao-workflow.js'
import {
  CONFIG_WORKFLOW_ID,
  PARAMETROS_WORKFLOW_PADRAO,
} from '../lib/workflow-config.js'

/**
 * Configurações técnicas do sistema. Somente administradores; a senha
 * SMTP nunca é retornada — apenas o indicador `senhaDefinida`.
 */
export const configuracoesRouter = Router()

configuracoesRouter.use(requireRole('ADMIN'))

// Linha única — sempre id 1.
const SMTP_ID = 1

const publicSelect = {
  host: true,
  porta: true,
  seguranca: true,
  usuario: true,
  remetenteNome: true,
  remetenteEmail: true,
  ativo: true,
  updatedAt: true,
} as const

function toPublic(
  cfg: { senha: string | null } & Record<string, unknown>,
): Record<string, unknown> {
  const { senha, ...rest } = cfg
  return { ...rest, senhaDefinida: !!senha }
}

configuracoesRouter.get('/smtp', async (_req, res, next) => {
  try {
    const cfg = await prisma.configuracaoSmtp.findUnique({
      where: { id: SMTP_ID },
      select: { ...publicSelect, senha: true },
    })
    res.json(cfg ? toPublic(cfg) : null)
  } catch (err) {
    next(err)
  }
})

configuracoesRouter.put('/smtp', async (req, res, next) => {
  try {
    const data = configuracaoSmtpSchema.parse(req.body)
    const { senha, ...resto } = data

    const atual = await prisma.configuracaoSmtp.findUnique({
      where: { id: SMTP_ID },
      select: { senha: true },
    })
    // Senha em branco/omitida mantém a atual; string preenchida substitui.
    const senhaFinal = senha ? senha : (atual?.senha ?? null)

    const salvo = await prisma.configuracaoSmtp.upsert({
      where: { id: SMTP_ID },
      create: { id: SMTP_ID, ...resto, senha: senhaFinal },
      update: { ...resto, senha: senhaFinal },
      select: { ...publicSelect, senha: true },
    })
    res.json(toPublic(salvo))
  } catch (err) {
    next(err)
  }
})

/**
 * Envia um e-mail de teste usando a configuração SALVA no banco —
 * valida host, porta, segurança e credenciais da conta.
 */
configuracoesRouter.post('/smtp/teste', async (req, res, next) => {
  try {
    const { para } = smtpTesteSchema.parse(req.body)

    const cfg = await prisma.configuracaoSmtp.findUnique({
      where: { id: SMTP_ID },
    })
    if (!cfg) {
      throw new HttpError(
        400,
        'Salve a configuração SMTP antes de enviar o e-mail de teste.',
      )
    }

    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.porta,
      secure: cfg.seguranca === 'SSL',
      requireTLS: cfg.seguranca === 'TLS',
      ignoreTLS: cfg.seguranca === 'NONE',
      auth:
        cfg.usuario && cfg.senha
          ? { user: cfg.usuario, pass: cfg.senha }
          : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    })

    try {
      await transporter.sendMail({
        from: `"${cfg.remetenteNome}" <${cfg.remetenteEmail}>`,
        to: para,
        subject: 'SGNC — E-mail de teste',
        text: [
          'Este é um e-mail de teste do SGNC (Sistema de Gestão de Não Conformidade).',
          '',
          `Servidor: ${cfg.host}:${cfg.porta} (${cfg.seguranca})`,
          `Enviado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
          '',
          'Se você recebeu esta mensagem, a configuração SMTP do workflow está funcionando.',
        ].join('\n'),
      })
    } catch (err) {
      const detalhe = err instanceof Error ? err.message : 'erro desconhecido'
      throw new HttpError(502, `Falha no envio do e-mail de teste: ${detalhe}`)
    }

    res.json({ ok: true, para })
  } catch (err) {
    next(err)
  }
})

// ── Parâmetros dos workflows de resposta do fornecedor ──────────────

const workflowSelect = {
  cienciaPrazoHoras: true,
  contingenciaPrazoHoras: true,
  contingenciaAlertasPorDia: true,
  updatedAt: true,
} as const

configuracoesRouter.get('/workflow', async (_req, res, next) => {
  try {
    const cfg = await prisma.configuracaoWorkflow.findUnique({
      where: { id: CONFIG_WORKFLOW_ID },
      select: workflowSelect,
    })
    // Sem linha gravada, devolve os padrões para a tela abrir preenchida.
    res.json(cfg ?? { ...PARAMETROS_WORKFLOW_PADRAO, updatedAt: null })
  } catch (err) {
    next(err)
  }
})

configuracoesRouter.put('/workflow', async (req, res, next) => {
  try {
    const data = configuracaoWorkflowSchema.parse(req.body)
    const salvo = await prisma.configuracaoWorkflow.upsert({
      where: { id: CONFIG_WORKFLOW_ID },
      create: { id: CONFIG_WORKFLOW_ID, ...data },
      update: data,
      select: workflowSelect,
    })
    res.json(salvo)
  } catch (err) {
    next(err)
  }
})
