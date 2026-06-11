import * as React from 'react'
import {
  GripVertical,
  MoreVertical,
  Loader2,
  CheckCircle2,
  Columns3,
  Plus,
  ChevronDown,
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

type Row = {
  id: number
  header: string
  type: string
  status: 'In Process' | 'Done'
  target: number
  limit: number
  reviewer: string
}

const ROWS: Row[] = [
  {
    id: 1,
    header: 'Cover page',
    type: 'Cover page',
    status: 'In Process',
    target: 18,
    limit: 5,
    reviewer: 'Eddie Lake',
  },
  {
    id: 2,
    header: 'Table of contents',
    type: 'Table of contents',
    status: 'Done',
    target: 29,
    limit: 24,
    reviewer: 'Eddie Lake',
  },
  {
    id: 3,
    header: 'Executive summary',
    type: 'Narrative',
    status: 'Done',
    target: 10,
    limit: 13,
    reviewer: 'Eddie Lake',
  },
  {
    id: 4,
    header: 'Technical approach',
    type: 'Narrative',
    status: 'Done',
    target: 27,
    limit: 23,
    reviewer: 'Jamik Tashpulatov',
  },
  {
    id: 5,
    header: 'Design',
    type: 'Narrative',
    status: 'In Process',
    target: 2,
    limit: 16,
    reviewer: 'Jamik Tashpulatov',
  },
  {
    id: 6,
    header: 'Capabilities',
    type: 'Narrative',
    status: 'In Process',
    target: 20,
    limit: 8,
    reviewer: 'Jamik Tashpulatov',
  },
  {
    id: 7,
    header: 'Integration with existing systems',
    type: 'Narrative',
    status: 'In Process',
    target: 19,
    limit: 21,
    reviewer: 'Jamik Tashpulatov',
  },
]

const TABS = [
  { key: 'outline', label: 'Outline', count: null as number | null },
  { key: 'past', label: 'Past Performance', count: 3 },
  { key: 'key', label: 'Key Personnel', count: 2 },
  { key: 'focus', label: 'Focus Documents', count: null },
]

function StatusBadge({ status }: { status: Row['status'] }) {
  if (status === 'Done') {
    return (
      <div className="inline-flex items-center gap-1.5 text-sm text-neutral-700">
        <CheckCircle2 className="h-3.5 w-3.5 fill-green-500 text-white" />
        Done
      </div>
    )
  }
  return (
    <div className="inline-flex items-center gap-1.5 text-sm text-neutral-700">
      <Loader2 className="h-3.5 w-3.5 text-neutral-500" />
      In Process
    </div>
  )
}

export function DocumentsTable() {
  const [activeTab, setActiveTab] = React.useState('outline')
  const [selected, setSelected] = React.useState<number[]>([])

  const allSelected = selected.length === ROWS.length
  const toggleAll = () => {
    setSelected(allSelected ? [] : ROWS.map((r) => r.id))
  }
  const toggleOne = (id: number) => {
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-9 bg-neutral-100">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.key}
                value={t.key}
                className="data-[state=active]:bg-white text-neutral-600 data-[state=active]:text-neutral-900"
              >
                {t.label}
                {t.count !== null && (
                  <span
                    className={cn(
                      'ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-medium',
                      activeTab === t.key
                        ? 'bg-neutral-200 text-neutral-700'
                        : 'bg-neutral-200/70 text-neutral-600',
                    )}
                  >
                    {t.count}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-sm">
            <Columns3 className="h-4 w-4" />
            Customize Columns
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
          <Button size="sm" className="h-8 gap-1.5 text-sm">
            <Plus className="h-4 w-4" />
            Add Section
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50/60 text-neutral-500">
              <th className="w-10 px-2 py-2.5"></th>
              <th className="w-10 px-2 py-2.5">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              </th>
              <th className="px-2 py-2.5 text-left font-medium">Header</th>
              <th className="px-3 py-2.5 text-left font-medium">Section Type</th>
              <th className="px-3 py-2.5 text-left font-medium">Status</th>
              <th className="px-3 py-2.5 text-right font-medium">Target</th>
              <th className="px-3 py-2.5 text-right font-medium">Limit</th>
              <th className="px-3 py-2.5 text-left font-medium">Reviewer</th>
              <th className="w-10 px-2 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr
                key={row.id}
                className="border-b border-neutral-200 last:border-b-0 hover:bg-neutral-50/60"
              >
                <td className="px-2 py-3">
                  <GripVertical className="h-4 w-4 text-neutral-400" />
                </td>
                <td className="px-2 py-3">
                  <Checkbox
                    checked={selected.includes(row.id)}
                    onCheckedChange={() => toggleOne(row.id)}
                  />
                </td>
                <td className="px-2 py-3 font-medium text-neutral-900">
                  {row.header}
                </td>
                <td className="px-3 py-3">
                  <span className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-xs font-medium text-neutral-700">
                    {row.type}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-neutral-700">
                  {row.target}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-neutral-700">
                  {row.limit}
                </td>
                <td className="px-3 py-3 text-neutral-700">{row.reviewer}</td>
                <td className="px-2 py-3">
                  <button className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between pt-1 text-sm text-neutral-500">
        <span>0 of {ROWS.length} row(s) selected.</span>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              10
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </div>
          <span>Page 1 of 1</span>
        </div>
      </div>
    </div>
  )
}
