import { PanelLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function TopBar({ title = 'Documents' }: { title?: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-600">
          <PanelLeft className="h-4 w-4" />
        </Button>
        <div className="h-5 w-px bg-neutral-200" />
        <h1 className="text-sm font-medium text-neutral-900">{title}</h1>
      </div>
    </header>
  )
}
