import { Construction } from 'lucide-react'
import { Card } from '@/components/ui/card'

export function UnderConstruction({ title }: { title: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="flex max-w-md flex-col items-center gap-4 rounded-xl border-neutral-200 bg-gradient-to-t from-neutral-50 to-white px-8 py-10 text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 text-white">
          <Construction className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900">
            {title}
          </h2>
          <p className="text-sm text-neutral-500">
            Em construção. Esta tela ainda será implementada.
          </p>
        </div>
      </Card>
    </div>
  )
}
