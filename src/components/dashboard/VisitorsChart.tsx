import * as React from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Point = { date: string; mobile: number; desktop: number }

function generateData(): Point[] {
  const start = new Date(2024, 3, 1) // Apr 1
  const days = 91 // ~3 months
  const data: Point[] = []
  let mobileBase = 220
  let desktopBase = 180
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    // Oscillate with a few cycles + small noise for that wavy look
    const phase = i / days
    const mobile = Math.max(
      40,
      Math.round(
        mobileBase +
          Math.sin(i * 0.45) * 120 +
          Math.sin(i * 0.18 + 1) * 60 +
          Math.sin(i * 0.9) * 35 +
          (Math.random() - 0.5) * 30 +
          phase * 60,
      ),
    )
    const desktop = Math.max(
      30,
      Math.round(
        desktopBase +
          Math.sin(i * 0.5 + 0.7) * 110 +
          Math.sin(i * 0.22) * 55 +
          Math.sin(i * 1.1 + 0.3) * 30 +
          (Math.random() - 0.5) * 25 +
          phase * 40,
      ),
    )
    data.push({
      date: d.toISOString().slice(0, 10),
      mobile,
      desktop,
    })
  }
  return data
}

const DATA = generateData()

const RANGES = [
  { key: '3m', label: 'Last 3 months', days: 91 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '7d', label: 'Last 7 days', days: 7 },
] as const

function formatTick(value: string) {
  const d = new Date(value)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string }>
  label?: string
}) {
  if (!active || !payload || !payload.length || !label) return null
  const d = new Date(label)
  const formatted = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  const mobile = payload.find((p) => p.dataKey === 'mobile')?.value ?? 0
  const desktop = payload.find((p) => p.dataKey === 'desktop')?.value ?? 0
  return (
    <div className="min-w-[140px] rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="mb-1.5 font-medium text-neutral-900">{formatted}</div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-[2px] bg-neutral-900" />
          <span className="text-neutral-600">Mobile</span>
        </div>
        <span className="font-medium text-neutral-900">{mobile}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-[2px] bg-neutral-400" />
          <span className="text-neutral-600">Desktop</span>
        </div>
        <span className="font-medium text-neutral-900">{desktop}</span>
      </div>
    </div>
  )
}

export function VisitorsChart() {
  const [range, setRange] = React.useState<typeof RANGES[number]['key']>('3m')

  const data = React.useMemo(() => {
    const days = RANGES.find((r) => r.key === range)?.days ?? 91
    return DATA.slice(-days)
  }, [range])

  // Build sparse ticks
  const ticks = React.useMemo(() => {
    const count = data.length
    const step = Math.max(1, Math.floor(count / 10))
    const out: string[] = []
    for (let i = 0; i < count; i += step) out.push(data[i].date)
    return out
  }, [data])

  return (
    <Card className="rounded-xl border-neutral-200 bg-gradient-to-t from-neutral-50 to-white shadow-sm">
      <div className="flex flex-col gap-4 px-6 pt-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-neutral-900">
              Total Visitors
            </h3>
            <p className="text-sm text-neutral-500">
              Total for the last 3 months
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-0.5 text-sm">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={cn(
                  'rounded-md px-3 py-1 text-sm font-normal transition-colors',
                  range === r.key
                    ? 'bg-neutral-100 text-neutral-900'
                    : 'text-neutral-500 hover:text-neutral-900',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="h-[280px] px-2 pb-4 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: 12, right: 12, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="fillMobile" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#171717" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#171717" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="fillDesktop" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a3a3a3" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#a3a3a3" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#e5e5e5" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={formatTick}
              ticks={ticks}
              stroke="#a3a3a3"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={20}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: '#a3a3a3', strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <Area
              type="monotone"
              dataKey="desktop"
              stroke="#a3a3a3"
              strokeWidth={1.5}
              fill="url(#fillDesktop)"
              stackId="1"
            />
            <Area
              type="monotone"
              dataKey="mobile"
              stroke="#171717"
              strokeWidth={1.5}
              fill="url(#fillMobile)"
              stackId="2"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
