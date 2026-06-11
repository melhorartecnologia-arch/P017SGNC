import { apiRequest } from './client'

export type SmtpSeguranca = 'NONE' | 'SSL' | 'TLS'

export type ConfiguracaoSmtp = {
  host: string
  porta: number
  seguranca: SmtpSeguranca
  usuario: string | null
  remetenteNome: string
  remetenteEmail: string
  ativo: boolean
  /** A senha nunca é retornada — apenas se há uma definida. */
  senhaDefinida: boolean
  updatedAt: string
}

export type ConfiguracaoSmtpInput = {
  host: string
  porta: number
  seguranca: SmtpSeguranca
  usuario?: string | null
  /** Em branco mantém a senha atual. */
  senha?: string | null
  remetenteNome: string
  remetenteEmail: string
  ativo: boolean
}

export const configuracoesApi = {
  getSmtp: () => apiRequest<ConfiguracaoSmtp | null>('/configuracoes/smtp'),

  saveSmtp: (input: ConfiguracaoSmtpInput) =>
    apiRequest<ConfiguracaoSmtp>('/configuracoes/smtp', {
      method: 'PUT',
      body: input,
    }),
}
