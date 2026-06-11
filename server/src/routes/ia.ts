import { Router } from 'express'
import { z } from 'zod'
import { env } from '../env.js'
import { HttpError } from '../middleware/error.js'

/**
 * Proxy para o serviço bSynapse de correção ortográfica por IA.
 * A chamada é feita pelo servidor para não expor a BSYNAPSE_API_KEY
 * no navegador.
 */
export const iaRouter = Router()

const corrigirSchema = z.object({
  text: z.string().trim().min(1, 'Informe um texto para corrigir').max(4000),
})

/** Extrai o texto corrigido das formas de resposta mais comuns da API. */
function extrairTextoCorrigido(data: unknown): string | null {
  if (typeof data === 'string') return data.trim() || null
  if (!data || typeof data !== 'object') return null
  const obj = data as Record<string, unknown>
  const chaves = [
    'text',
    'textoCorrigido',
    'texto_corrigido',
    'correctedText',
    'corrected_text',
    'result',
    'output',
    'response',
    'content',
    'message',
  ]
  for (const chave of chaves) {
    const v = obj[chave]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  // Um nível de aninhamento (ex.: { data: { text: "..." } })
  if ('data' in obj) return extrairTextoCorrigido(obj.data)
  return null
}

/** Remove um par de aspas que envolva o texto inteiro (ex.: "texto" → texto). */
function removerAspasEnvolventes(texto: string): string {
  const pares: Array<[string, string]> = [
    ['"', '"'],
    ['“', '”'],
  ]
  for (const [abre, fecha] of pares) {
    if (texto.length >= 2 && texto.startsWith(abre) && texto.endsWith(fecha)) {
      return texto.slice(1, -1).trim()
    }
  }
  return texto
}

iaRouter.post('/corrigir-texto', async (req, res, next) => {
  try {
    const { text } = corrigirSchema.parse(req.body)

    if (!env.BSYNAPSE_API_URL || !env.BSYNAPSE_API_KEY) {
      throw new HttpError(
        503,
        'Correção de texto por IA não configurada. Defina BSYNAPSE_API_URL e BSYNAPSE_API_KEY no server/.env.',
      )
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30_000)
    let resposta: Response
    try {
      resposta = await fetch(env.BSYNAPSE_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': env.BSYNAPSE_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      })
    } catch {
      throw new HttpError(
        502,
        'Não foi possível contatar o serviço de correção de texto. Tente novamente.',
      )
    } finally {
      clearTimeout(timer)
    }

    if (!resposta.ok) {
      console.error(`bSynapse: serviço respondeu HTTP ${resposta.status}`)
      throw new HttpError(502, 'O serviço de correção de texto retornou erro.')
    }

    const data: unknown = await resposta.json().catch(() => null)
    // Log temporário do formato da resposta para mapear o campo correto
    // (ative BSYNAPSE_DEBUG=1 no server/.env). Ajuda a identificar onde
    // vem o texto corrigido vs. a análise.
    if (process.env.BSYNAPSE_DEBUG === '1') {
      console.log('bSynapse resposta crua:', JSON.stringify(data))
    }
    const textoCorrigido = extrairTextoCorrigido(data)
    if (!textoCorrigido) {
      // Loga só as chaves (não o conteúdo) para diagnosticar o formato.
      console.error(
        'bSynapse: resposta em formato inesperado. Chaves:',
        data && typeof data === 'object' ? Object.keys(data) : typeof data,
      )
      throw new HttpError(
        502,
        'Resposta do serviço de correção em formato inesperado.',
      )
    }

    res.json({ textoCorrigido: removerAspasEnvolventes(textoCorrigido) })
  } catch (err) {
    next(err)
  }
})
