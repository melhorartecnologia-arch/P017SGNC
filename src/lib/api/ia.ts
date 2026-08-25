import { apiRequest } from './client'

export const iaApi = {
  /** Corrige erros de digitação/ortografia via bSynapse (proxy na API). */
  corrigirTexto: (text: string) =>
    apiRequest<{ textoCorrigido: string }>('/ia/corrigir-texto', {
      method: 'POST',
      body: { text },
    }),
}
