import * as React from 'react'
import { tokenStorage } from '@/lib/api/client'

/**
 * Busca uma URL protegida via Authorization Bearer e devolve um
 * blob URL utilizável em `<img src>`. Revoga automaticamente quando
 * o componente desmonta ou a URL muda.
 */
export function useAuthedBlobUrl(url: string | null): {
  src: string | null
  loading: boolean
  error: string | null
} {
  const [src, setSrc] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!url) {
      setSrc(null)
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    let created: string | null = null
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const token = tokenStorage.get()
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        if (cancelled) return
        created = URL.createObjectURL(blob)
        setSrc(created)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'falha ao carregar')
        setSrc(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [url])

  return { src, loading, error }
}
