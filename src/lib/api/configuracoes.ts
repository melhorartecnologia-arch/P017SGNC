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

  /** Envia um e-mail de teste usando a configuração salva. */
  testarSmtp: (para: string) =>
    apiRequest<{ ok: boolean; para: string }>('/configuracoes/smtp/teste', {
      method: 'POST',
      body: { para },
    }),

  getWorkflow: () =>
    apiRequest<ConfiguracaoWorkflow>('/configuracoes/workflow'),

  saveWorkflow: (input: ConfiguracaoWorkflowInput) =>
    apiRequest<ConfiguracaoWorkflow>('/configuracoes/workflow', {
      method: 'PUT',
      body: input,
    }),
}

/** Parâmetros dos workflows de resposta do fornecedor. */
export type ConfiguracaoWorkflow = {
  /** Prazo da ciência em horas fracionárias (1.5 = 1h30). */
  cienciaPrazoHoras: number
  /** Prazo das ações de contingência em horas fracionárias. */
  contingenciaPrazoHoras: number
  /** Alertas por dia depois de vencido o prazo das ações. */
  contingenciaAlertasPorDia: number
  /** Dias de espera entre a última data planejada e a verificação. */
  eficaciaEsperaDias: number
  updatedAt: string | null
}

export type ConfiguracaoWorkflowInput = {
  cienciaPrazoHoras: number
  contingenciaPrazoHoras: number
  contingenciaAlertasPorDia: number
  eficaciaEsperaDias: number
}

/** Horas fracionárias → horas e minutos inteiros (48.5 → 48h 30min). */
export function horasParaHoraMinuto(horas: number): {
  horas: number
  minutos: number
} {
  const total = Math.max(0, Math.round(horas * 60))
  return { horas: Math.floor(total / 60), minutos: total % 60 }
}

/** Horas e minutos inteiros → horas fracionárias (48h 30min → 48.5). */
export function horaMinutoParaHoras(horas: number, minutos: number): number {
  return Math.round((horas * 60 + minutos)) / 60
}
