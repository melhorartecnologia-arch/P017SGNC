import nodemailer from 'nodemailer'
import { prisma } from '../db.js'

export type Transporte = {
  transporter: nodemailer.Transporter
  remetente: string
}

/**
 * Cria um transporte SMTP a partir da configuração salva no banco.
 * Retorna null quando não há configuração ou o envio está desativado.
 */
export async function criarTransporteSmtp(): Promise<Transporte | null> {
  const cfg = await prisma.configuracaoSmtp.findUnique({ where: { id: 1 } })
  if (!cfg || !cfg.ativo) return null

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

  return {
    transporter,
    remetente: `"${cfg.remetenteNome}" <${cfg.remetenteEmail}>`,
  }
}
