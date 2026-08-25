import twilio from 'twilio'
import { env } from '../env.js'

export type WaContexto = {
  client: ReturnType<typeof twilio>
  from: string
}

/**
 * Cria o cliente Twilio a partir das credenciais do ambiente. Retorna
 * null quando não configurado (o WhatsApp é então ignorado).
 */
export function criarContextoWa(): WaContexto | null {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return null
  const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
  return { client, from: `whatsapp:${formatarE164(env.TWILIO_WHATSAPP_FROM)}` }
}

/** Normaliza um número para o formato E.164 (+55...). Assume Brasil. */
export function formatarE164(numero: string): string {
  const dig = (numero || '').replace(/\D/g, '')
  if (!dig) return ''
  if (numero.trim().startsWith('+')) return `+${dig}`
  // 55 + DDD + número (12-13 dígitos) já tem código do país.
  if (dig.startsWith('55') && dig.length >= 12) return `+${dig}`
  // DDD + número (10-11 dígitos) → prefixa Brasil.
  if (dig.length === 10 || dig.length === 11) return `+55${dig}`
  return `+${dig}`
}

/** Endereço whatsapp:+E164 a partir de um número livre; null se inválido. */
export function paraWhatsapp(numero: string | null | undefined): string | null {
  if (!numero) return null
  const e164 = formatarE164(numero)
  // E.164 plausível: + e ao menos 10 dígitos.
  if (!/^\+\d{10,15}$/.test(e164)) return null
  return `whatsapp:${e164}`
}

export type TipoTemplateWa = 'solicitacao' | 'lembrete' | 'concluida'

function contentSid(tipo: TipoTemplateWa): string {
  switch (tipo) {
    case 'lembrete':
      return env.TWILIO_TEMPLATE_LEMBRETE
    case 'concluida':
      return env.TWILIO_TEMPLATE_CONCLUIDA
    default:
      return env.TWILIO_TEMPLATE_SOLICITACAO
  }
}

/**
 * Envia uma mensagem WhatsApp via Content Template. `variaveis` mapeia
 * "1","2",... para os valores das variáveis do template. Best-effort:
 * retorna ok/erro sem lançar.
 */
export async function enviarTemplateWa(
  wa: WaContexto,
  paraNumero: string | null | undefined,
  tipo: TipoTemplateWa,
  variaveis: Record<string, string>,
): Promise<{ ok: boolean; erro?: string }> {
  const to = paraWhatsapp(paraNumero)
  if (!to) return { ok: false, erro: 'sem WhatsApp válido' }
  try {
    await wa.client.messages.create({
      from: wa.from,
      to,
      contentSid: contentSid(tipo),
      contentVariables: JSON.stringify(variaveis),
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : 'erro Twilio' }
  }
}
