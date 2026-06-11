import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Stat = {
  label: string
  value: string
  delta: string
  trend: 'up' | 'down'
  caption: string
  sub: string
}

const stats: Stat[] = [
  {
    label: 'Total Revenue',
    value: '$1,250.00',
    delta: '+12.5%',
    trend: 'up',
    caption: 'Trending up this month',
    sub: 'Visitors for the last 6 months',
  },
  {
    label: 'New Customers',
    value: '1,234',
    delta: '-20%',
    trend: 'down',
    caption: 'Down 20% this period',
    sub: 'Acquisition needs attention',
  },
  {
    label: 'Active Accounts',
    value: '45,678',
    delta: '+12.5%',
    trend: 'up',
    caption: 'Strong user retention',
    sub: 'Engagement exceed targets',
  },
  {
    label: 'Growth Rate',
    value: '4.5%',
    delta: '+4.5%',
    trend: 'up',
    caption: 'Steady performance increase',
    sub: 'Meets growth projections',
  },
]

export function StatCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => {
        const Trend = s.trend === 'up' ? TrendingUp : TrendingDown
        return (
          <Card
            key={s.label}
            className={cn(
              'relative overflow-hidden rounded-xl border-neutral-200',
              'bg-gradient-to-t from-neutral-100 to-white shadow-sm',
            )}
          >
            <div className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between">
                <span className="text-sm font-medium text-neutral-600">
                  {s.label}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-xs font-medium text-neutral-700">
                  <Trend className="h-3 w-3" />
                  {s.delta}
                </span>
              </div>

              <div className="text-3xl font-semibold tracking-tight text-neutral-900">
                {s.value}
              </div>

              <div className="mt-4 flex flex-col gap-1">
                <div className="flex items-center gap-1 text-sm font-medium text-neutral-900">
                  {s.caption}
                  <Trend className="h-3.5 w-3.5" />
                </div>
                <div className="text-xs text-neutral-500">{s.sub}</div>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
