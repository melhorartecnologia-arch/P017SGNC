import * as React from 'react'
import {
  Upload,
  Loader2,
  X,
  Trash2,
  ImageOff,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api/client'
import { rncFotosApi, type RncFoto } from '@/lib/api/rnc-fotos'
import { useAuthedBlobUrl } from '@/lib/hooks/useAuthedBlobUrl'

type Props = {
  rncId: string
  /** Quando `false`, o usuário só pode ver as fotos (sem upload/delete). */
  editable?: boolean
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

export function RncFotosSection({ rncId, editable = true }: Props) {
  const [fotos, setFotos] = React.useState<RncFoto[]>([])
  const [loading, setLoading] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [dragging, setDragging] = React.useState(false)
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const reload = React.useCallback(async () => {
    setLoading(true)
    try {
      const items = await rncFotosApi.list(rncId)
      setFotos(items)
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error('Falha ao carregar fotos', { description: err.message })
      }
    } finally {
      setLoading(false)
    }
  }, [rncId])

  React.useEffect(() => {
    reload()
  }, [reload])

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (arr.length === 0) {
      toast.error('Selecione apenas imagens.')
      return
    }
    setUploading(true)
    try {
      const created = await rncFotosApi.upload(rncId, arr)
      setFotos((cur) => [...cur, ...created])
      toast.success(
        `${created.length} foto${created.length > 1 ? 's' : ''} enviada${created.length > 1 ? 's' : ''}.`,
      )
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Falha ao enviar fotos.'
      toast.error('Não foi possível enviar', { description: message })
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleDelete = async (foto: RncFoto) => {
    if (!confirm(`Excluir a foto "${foto.originalName}"?`)) return
    setDeletingId(foto.id)
    try {
      await rncFotosApi.remove(foto.id)
      setFotos((cur) => cur.filter((f) => f.id !== foto.id))
      toast.success('Foto excluída.')
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Falha ao excluir.'
      toast.error('Não foi possível excluir', { description: message })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {editable && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handleFiles(e.dataTransfer.files)
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-6 text-center text-sm transition-colors',
            dragging
              ? 'border-neutral-900 bg-neutral-100'
              : 'border-neutral-300 bg-neutral-50/40 hover:bg-neutral-50',
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
              <span className="text-neutral-500">Enviando…</span>
            </>
          ) : (
            <>
              <Upload className="h-5 w-5 text-neutral-500" />
              <span className="font-medium text-neutral-700">
                Arraste imagens aqui ou clique para selecionar
              </span>
              <span className="text-[11px] text-neutral-500">
                JPG, PNG, WebP ou GIF · até 10 MB cada · até 20 por envio
              </span>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Carregando fotos…
        </div>
      ) : fotos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-neutral-200 bg-neutral-50/40 px-4 py-6 text-center text-xs text-neutral-500">
          <ImageOff className="h-5 w-5 text-neutral-400" />
          Nenhuma foto anexada a este RNC.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {fotos.map((f, idx) => (
            <Thumbnail
              key={f.id}
              foto={f}
              editable={editable}
              deleting={deletingId === f.id}
              onOpen={() => setLightboxIndex(idx)}
              onDelete={() => handleDelete(f)}
            />
          ))}
        </div>
      )}

      {lightboxIndex !== null && fotos[lightboxIndex] && (
        <Lightbox
          fotos={fotos}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  )
}

function Thumbnail({
  foto,
  editable,
  deleting,
  onOpen,
  onDelete,
}: {
  foto: RncFoto
  editable: boolean
  deleting: boolean
  onOpen: () => void
  onDelete: () => void
}) {
  const { src, loading, error } = useAuthedBlobUrl(
    `/api/rnc/fotos/${foto.id}/file`,
  )

  return (
    <div className="group relative overflow-hidden rounded-md border border-neutral-200 bg-neutral-100">
      <button
        type="button"
        onClick={onOpen}
        className="block aspect-square w-full overflow-hidden"
        title={foto.originalName}
      >
        {src ? (
          <img
            src={src}
            alt={foto.originalName}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : error ? (
              <ImageOff className="h-4 w-4" />
            ) : null}
          </div>
        )}
      </button>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="truncate text-[11px] font-medium text-white">
          {foto.originalName}
        </div>
        <div className="text-[10px] text-white/80">{formatBytes(foto.size)}</div>
      </div>
      {editable && (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-red-700 opacity-0 shadow-sm transition-opacity hover:bg-white group-hover:opacity-100 disabled:opacity-50"
          aria-label="Excluir foto"
          title="Excluir foto"
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      )}
    </div>
  )
}

function Lightbox({
  fotos,
  index,
  onIndexChange,
  onClose,
}: {
  fotos: RncFoto[]
  index: number
  onIndexChange: (next: number) => void
  onClose: () => void
}) {
  const total = fotos.length
  const foto = fotos[index]
  const { src, loading } = useAuthedBlobUrl(`/api/rnc/fotos/${foto.id}/file`)
  const hasPrev = total > 1
  const hasNext = total > 1

  const goPrev = React.useCallback(() => {
    if (!hasPrev) return
    onIndexChange((index - 1 + total) % total)
  }, [hasPrev, index, total, onIndexChange])

  const goNext = React.useCallback(() => {
    if (!hasNext) return
    onIndexChange((index + 1) % total)
  }, [hasNext, index, total, onIndexChange])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, goPrev, goNext])

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        className="absolute right-4 top-4 h-9 w-9 text-white hover:bg-white/10 hover:text-white"
        aria-label="Fechar"
      >
        <X className="h-5 w-5" />
      </Button>

      {hasPrev && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation()
            goPrev()
          }}
          className="absolute left-4 top-1/2 h-12 w-12 -translate-y-1/2 text-white hover:bg-white/10 hover:text-white"
          aria-label="Foto anterior"
          title="Foto anterior (←)"
        >
          <ChevronLeft className="h-7 w-7" />
        </Button>
      )}
      {hasNext && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation()
            goNext()
          }}
          className="absolute right-4 top-1/2 h-12 w-12 -translate-y-1/2 text-white hover:bg-white/10 hover:text-white"
          aria-label="Próxima foto"
          title="Próxima foto (→)"
        >
          <ChevronRight className="h-7 w-7" />
        </Button>
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] max-w-[90vw] flex-col items-center gap-2"
      >
        {loading || !src ? (
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        ) : (
          <img
            src={src}
            alt={foto.originalName}
            className="max-h-[80vh] max-w-[85vw] rounded-md object-contain"
          />
        )}
        <div className="flex flex-col items-center gap-0.5 text-xs text-white/80">
          <span>{foto.originalName}</span>
          {total > 1 && (
            <span className="font-mono tabular-nums text-white/60">
              {index + 1} / {total}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
