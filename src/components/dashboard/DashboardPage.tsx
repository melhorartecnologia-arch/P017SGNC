import * as React from 'react'
import {
  Loader2,
  FileWarning,
  Factory,
  Truck,
  Package,
  AlertTriangle,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { Card } from '@/components/ui/card'
import { ApiError } from '@/lib/api/client'
import {
  dashboardApi,
  type Contagem,
  type DashboardRnc,
} from '@/lib/api/dashboard'

// Paleta para barras/pizza.
const CORES = [
  '#2563eb',
  '#16a34a',
  '#f59e0b',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#65a30d',
  '#ea580c',
  '#0d9488',
]

/** Encurta rótulos longos para os eixos. */
function curto(s: string, max = 26): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

export function DashboardPage() {
  const [data, setData] = React.useState<DashboardRnc | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    dashboardApi
      .rnc()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((err) => {
        if (cancelled) return
        setError(
          err instanceof ApiError
            ? err.message
            : 'Não foi possível carregar o painel.',
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error ?? 'Sem dados.'}
        </div>
      </div>
    )
  }

  const vazio = data.total === 0

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      {/* Cartões de resumo */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={FileWarning}
          label="Total de RNCs"
          valor={data.total}
        />
        <StatCard
          icon={Factory}
          label="Filiais com RNC"
          valor={data.porFilial.length}
        />
        <StatCard
          icon={Truck}
          label="Fornecedores com RNC"
          valor={data.topFornecedores.length}
        />
        <StatCard
          icon={AlertTriangle}
          label="Tipos de NC"
          valor={data.porTipo.length}
        />
      </div>

      {vazio && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Ainda não há RNCs cadastradas — os gráficos aparecem conforme os
          registros forem criados.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="RNCs por filial">
          <BarHorizontal dados={data.porFilial} />
        </ChartCard>
        <ChartCard title="RNCs por tipo de não conformidade">
          <BarHorizontal dados={data.porTipo} />
        </ChartCard>

        <ChartCard
          title="Top 5 fornecedores com mais RNCs"
          icon={Truck}
        >
          <BarHorizontal dados={data.topFornecedores} />
        </ChartCard>
        <ChartCard title="Top 5 produtos com mais RNCs" icon={Package}>
          <BarHorizontal dados={data.topProdutos} />
        </ChartCard>

        <ChartCard title="RNCs por disposição do material">
          <BarVertical dados={data.porDisposicao} />
        </ChartCard>
        <ChartCard title="RNCs por origem da não conformidade">
          <BarVertical dados={data.porOrigem} />
        </ChartCard>
      </div>

      <ChartCard title="RNCs por severidade">
        <RoscaSeveridade dados={data.porSeveridade} />
      </ChartCard>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  valor,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  valor: number
}) {
  return (
    <Card className="flex items-center gap-3 rounded-xl border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-2xl font-semibold tracking-tight text-neutral-900 tabular-nums">
          {valor.toLocaleString('pt-BR')}
        </span>
        <span className="truncate text-xs text-neutral-500">{label}</span>
      </div>
    </Card>
  )
}

function ChartCard({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon?: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <Card className="flex flex-col gap-3 rounded-xl border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-neutral-500" />}
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      </div>
      {children}
    </Card>
  )
}

function SemDados() {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-neutral-400">
      Sem dados
    </div>
  )
}

/** Barras horizontais (bom para rótulos longos: filial, fornecedor, etc.). */
function BarHorizontal({ dados }: { dados: Contagem[] }) {
  if (dados.length === 0) return <SemDados />
  const altura = Math.max(260, dados.length * 42 + 40)
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart
        data={dados}
        layout="vertical"
        margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
      >
        <CartesianGrid horizontal={false} stroke="#f1f5f9" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey="label"
          width={180}
          tick={{ fontSize: 11 }}
          tickFormatter={(v: string) => curto(v)}
        />
        <Tooltip
          formatter={(value) => `${value} RNCs`}
          labelStyle={{ fontSize: 12 }}
          contentStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="total" radius={[0, 4, 4, 0]}>
          {dados.map((_, i) => (
            <Cell key={i} fill={CORES[i % CORES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Barras verticais (colunas) — disposição e origem. */
function BarVertical({ dados }: { dados: Contagem[] }) {
  if (dados.length === 0) return <SemDados />
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={dados} margin={{ top: 8, right: 12, bottom: 48, left: 0 }}>
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          interval={0}
          angle={-25}
          textAnchor="end"
          height={60}
          tickFormatter={(v: string) => curto(v, 18)}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value) => `${value} RNCs`}
          labelStyle={{ fontSize: 12 }}
          contentStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="total" radius={[4, 4, 0, 0]}>
          {dados.map((_, i) => (
            <Cell key={i} fill={CORES[i % CORES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function RoscaSeveridade({
  dados,
}: {
  dados: { label: string; total: number; cor: string }[]
}) {
  if (dados.length === 0) return <SemDados />
  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={dados}
          dataKey="total"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={70}
          outerRadius={110}
          paddingAngle={2}
        >
          {dados.map((d, i) => (
            <Cell key={i} fill={d.cor} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => `${value} RNCs`} contentStyle={{ fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
