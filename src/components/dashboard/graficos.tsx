/* eslint-disable react-refresh/only-export-components -- módulo de blocos
 * de gráfico compartilhados entre os painéis; exporta componentes e
 * utilitários juntos por design. */
import * as React from 'react'
import { TrendingUp, TrendingDown, Activity } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Contagem, ContagemDia, ContagemMes } from '@/lib/api/dashboard'

/**
 * Blocos de gráfico compartilhados entre os painéis do dashboard
 * (RNC, RAQ, RVT e RHE): paleta sóbria com um único acento, barras
 * "fantasma" e uma barra de destaque com balão de valor.
 */

export const ACENTO = '#4f46e5'
export const FANTASMA = '#e8edf3'
export const SLATE = ['#1e293b', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1']

// Índice da barra de destaque (maior volume). -1 quando tudo é zero.
export function indiceDestaque(dados: { total: number }[]): number {
  let idx = -1
  let max = 0
  dados.forEach((d, i) => {
    if (d.total > max) {
      max = d.total
      idx = i
    }
  })
  return idx
}

// Rótulo de coluna vertical: balão escuro no destaque, número discreto nos demais.
// O recharts tipa as coordenadas como string | number — normalizamos aqui.
export function rotuloColuna(destaque: number) {
  return function Rotulo(props: {
    x?: string | number
    y?: string | number
    width?: string | number
    value?: unknown
    index?: number
  }) {
    const x = Number(props.x ?? 0)
    const y = Number(props.y ?? 0)
    const width = Number(props.width ?? 0)
    const value = Number(props.value ?? 0)
    const { index } = props
    const cx = x + width / 2
    if (index === destaque) {
      const w = Math.max(34, String(value).length * 9 + 18)
      return (
        <g>
          <rect x={cx - w / 2} y={y - 28} width={w} height={19} rx={6} fill="#0f172a" />
          <text
            x={cx}
            y={y - 14.5}
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            fill="#fff"
          >
            {value}
          </text>
        </g>
      )
    }
    if (!value) return null
    return (
      <text x={cx} y={y - 5} textAnchor="middle" fontSize={10} fontWeight={600} fill="#94a3b8">
        {value}
      </text>
    )
  }
}

// Rótulo de barra horizontal: balão escuro no destaque, número discreto nos demais.
export function rotuloBarra(destaque: number) {
  return function Rotulo(props: {
    x?: string | number
    y?: string | number
    width?: string | number
    height?: string | number
    value?: unknown
    index?: number
  }) {
    const x = Number(props.x ?? 0)
    const y = Number(props.y ?? 0)
    const width = Number(props.width ?? 0)
    const height = Number(props.height ?? 0)
    const value = Number(props.value ?? 0)
    const { index } = props
    const ex = x + width
    const ey = y + height / 2
    if (index === destaque) {
      const w = Math.max(30, String(value).length * 8 + 16)
      return (
        <g>
          <rect x={ex + 5} y={ey - 9.5} width={w} height={19} rx={6} fill="#0f172a" />
          <text
            x={ex + 5 + w / 2}
            y={ey + 3.5}
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            fill="#fff"
          >
            {value}
          </text>
        </g>
      )
    }
    if (!value) return null
    return (
      <text x={ex + 6} y={ey + 3.5} fontSize={10} fontWeight={600} fill="#94a3b8">
        {value}
      </text>
    )
  }
}

export function curto(s: string, max = 22): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

export function fmtDataBR(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

export const tooltipStyle = {
  fontSize: 12,
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
  padding: '6px 10px',
}

export function SemDados({ altura = 220 }: { altura?: number }) {
  return (
    <div
      className="flex items-center justify-center text-xs text-neutral-300"
      style={{ height: altura }}
    >
      Sem dados
    </div>
  )
}

export const TONS_BADGE: Record<string, string> = {
  indigo: 'bg-indigo-50 text-indigo-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  sky: 'bg-sky-50 text-sky-600',
  violet: 'bg-violet-50 text-violet-600',
  teal: 'bg-teal-50 text-teal-600',
}

export function Kpi({
  icon: Icon,
  tom,
  label,
  valor,
  anterior,
  bomQuandoSobe,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  tom: keyof typeof TONS_BADGE
  label: string
  valor: number
  anterior?: number
  bomQuandoSobe?: boolean
  onClick?: () => void
}) {
  const delta =
    anterior != null && anterior > 0
      ? Math.round(((valor - anterior) / anterior) * 100)
      : null
  const subiu = delta != null && delta > 0
  const bom = delta != null && delta !== 0 && subiu === !!bomQuandoSobe
  return (
    <Card
      onClick={onClick}
      className={cn(
        'flex flex-col gap-2.5 rounded-2xl border-neutral-200/70 bg-white p-4 shadow-sm transition-all',
        onClick &&
          'cursor-pointer hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md',
      )}
    >
      <div className="flex items-center justify-between">
        <div
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-xl',
            TONS_BADGE[tom],
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
        {delta != null && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold',
              delta === 0
                ? 'bg-neutral-100 text-neutral-500'
                : bom
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-rose-50 text-rose-600',
            )}
          >
            {delta > 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : delta < 0 ? (
              <TrendingDown className="h-3 w-3" />
            ) : null}
            {delta > 0 ? '+' : ''}
            {delta}%
          </span>
        )}
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-2xl font-semibold tracking-tight text-neutral-900 tabular-nums">
          {valor.toLocaleString('pt-BR')}
        </span>
        <span className="text-[11px] uppercase tracking-wide text-neutral-400">
          {label}
        </span>
      </div>
      {anterior != null && (
        <span className="text-[11px] text-neutral-400">
          Período anterior:{' '}
          <span className="font-medium text-neutral-500 tabular-nums">{anterior}</span>
        </span>
      )}
    </Card>
  )
}

export function Secao({
  titulo,
  children,
}: {
  titulo: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
          {titulo}
        </span>
        <div className="h-px flex-1 bg-neutral-100" />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{children}</div>
    </section>
  )
}

export function Painel({
  titulo,
  icon: Icon,
  children,
}: {
  titulo: string
  icon?: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <Card className="flex flex-col gap-2 rounded-2xl border-neutral-200/70 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-neutral-400" />}
        <h2 className="text-[13px] font-semibold text-neutral-800">{titulo}</h2>
      </div>
      {children}
    </Card>
  )
}

// ── Herói: evolução mensal (barras fantasma + barra de destaque + balão) ──
export function HeroEvolucao({
  dados,
  titulo,
  sufixo = 'RNCs',
  onPick,
}: {
  dados: ContagemMes[]
  titulo: string
  sufixo?: string
  onPick: (m: ContagemMes) => void
}) {
  const [hover, setHover] = React.useState<number | null>(null)
  const totalPeriodo = dados.reduce((a, m) => a + m.total, 0)
  const destaque = indiceDestaque(dados)
  const Rotulo = rotuloColuna(destaque)

  return (
    <Card className="flex h-full flex-col gap-1 rounded-2xl border-neutral-200/70 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <h2 className="text-[13px] font-semibold text-neutral-800">{titulo}</h2>
          <span className="text-[11px] text-neutral-400">Últimos 12 meses</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xl font-semibold tracking-tight text-neutral-900 tabular-nums">
            {totalPeriodo.toLocaleString('pt-BR')}
          </span>
          <span className="text-[11px] text-neutral-400">no período</span>
        </div>
      </div>
      {totalPeriodo === 0 ? (
        <SemDados altura={240} />
      ) : (
        <ResponsiveContainer width="100%" height={252}>
          <BarChart data={dados} margin={{ top: 30, right: 6, bottom: 4, left: -18 }}>
            <CartesianGrid vertical={false} stroke="#f3f4f6" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10.5, fill: '#94a3b8' }}
              interval={0}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: '#cbd5e1' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: '#f8fafc' }}
              formatter={(value) => [`${value} ${sufixo}`, '']}
              labelFormatter={(l, p) => {
                const ano = (p?.[0]?.payload as ContagemMes | undefined)?.ano
                return ano ? `${l}/${ano}` : String(l)
              }}
              contentStyle={tooltipStyle}
              labelStyle={{ fontSize: 11, color: '#64748b' }}
            />
            <Bar dataKey="total" radius={[6, 6, 0, 0]} barSize={28}>
              {dados.map((m, i) => (
                <Cell
                  key={i}
                  cursor="pointer"
                  fill={i === destaque || hover === i ? ACENTO : FANTASMA}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onPick(m)}
                />
              ))}
              <LabelList dataKey="total" content={Rotulo} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

// ── Atividade diária — barrinhas finas estilo "código de barras" ──
export function AtividadeDiaria({
  dados,
  sufixo = 'RNC',
}: {
  dados: ContagemDia[]
  sufixo?: string
}) {
  const totalPeriodo = dados.reduce((a, d) => a + d.total, 0)
  const max = Math.max(1, ...dados.map((d) => d.total))
  const maxIdx = dados.reduce((mi, d, i) => (d.total > dados[mi].total ? i : mi), 0)
  const diaPico = dados[maxIdx]
  return (
    <Card className="flex flex-col gap-3 rounded-2xl border-neutral-200/70 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-neutral-400" />
          <div className="flex flex-col">
            <h2 className="text-[13px] font-semibold text-neutral-800">
              Atividade diária
            </h2>
            <span className="text-[11px] text-neutral-400">Últimos 30 dias</span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-lg font-semibold tracking-tight text-neutral-900 tabular-nums">
            {totalPeriodo}
          </span>
          <span className="text-[11px] text-neutral-400">
            pico {diaPico ? `${diaPico.total} em ${fmtDataBR(diaPico.label).slice(0, 5)}` : '—'}
          </span>
        </div>
      </div>
      {totalPeriodo === 0 ? (
        <SemDados altura={72} />
      ) : (
        <div className="flex h-[72px] items-end gap-[3px]">
          {dados.map((d, i) => (
            <div
              key={i}
              title={`${fmtDataBR(d.label)} · ${d.total} ${sufixo}${d.total === 1 ? '' : 's'}`}
              className="group flex h-full flex-1 items-end"
            >
              <div
                className="w-full rounded-sm transition-colors"
                style={{
                  height: `${Math.max(4, (d.total / max) * 100)}%`,
                  backgroundColor: i === maxIdx && d.total > 0 ? ACENTO : FANTASMA,
                }}
              />
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-between text-[10px] text-neutral-300">
        <span>{dados[0] ? fmtDataBR(dados[0].label) : ''}</span>
        <span>{dados.length ? fmtDataBR(dados[dados.length - 1].label) : ''}</span>
      </div>
    </Card>
  )
}

/** Barras horizontais clicáveis (rótulos longos) — mesmo padrão do herói. */
export function Barras({
  dados,
  onPick,
  sufixo = 'RNCs',
}: {
  dados: Contagem[]
  onPick: (d: Contagem) => void
  sufixo?: string
}) {
  const [hover, setHover] = React.useState<number | null>(null)
  if (dados.length === 0) return <SemDados />
  const destaque = indiceDestaque(dados)
  const Rotulo = rotuloBarra(destaque)
  const altura = Math.max(190, dados.length * 42 + 24)
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart data={dados} layout="vertical" margin={{ top: 2, right: 46, bottom: 2, left: 4 }}>
        <CartesianGrid horizontal={false} stroke="#f3f4f6" />
        <XAxis type="number" tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={150}
          tick={{ fontSize: 10.5, fill: '#475569' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: string) => curto(v)}
        />
        <Tooltip
          cursor={{ fill: '#f8fafc' }}
          formatter={(value) => [`${value} ${sufixo}`, '']}
          contentStyle={tooltipStyle}
          labelStyle={{ fontSize: 11, color: '#64748b' }}
        />
        <Bar dataKey="total" radius={[0, 6, 6, 0]} barSize={30}>
          {dados.map((d, i) => (
            <Cell
              key={i}
              cursor="pointer"
              fill={i === destaque || hover === i ? ACENTO : FANTASMA}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onPick(d)}
            />
          ))}
          <LabelList dataKey="total" content={Rotulo} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Colunas verticais clicáveis — mesmo padrão do gráfico herói. */
export function Colunas({
  dados,
  onPick,
  sufixo = 'RNCs',
}: {
  dados: Contagem[]
  onPick: (d: Contagem) => void
  sufixo?: string
}) {
  const [hover, setHover] = React.useState<number | null>(null)
  if (dados.length === 0) return <SemDados />
  const destaque = indiceDestaque(dados)
  const Rotulo = rotuloColuna(destaque)
  return (
    <ResponsiveContainer width="100%" height={244}>
      <BarChart data={dados} margin={{ top: 30, right: 8, bottom: 44, left: -16 }}>
        <CartesianGrid vertical={false} stroke="#f3f4f6" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#64748b' }}
          interval={0}
          angle={-22}
          textAnchor="end"
          height={56}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: string) => curto(v, 14)}
        />
        <YAxis tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: '#f8fafc' }}
          formatter={(value) => [`${value} ${sufixo}`, '']}
          contentStyle={tooltipStyle}
          labelStyle={{ fontSize: 11, color: '#64748b' }}
        />
        <Bar dataKey="total" radius={[6, 6, 0, 0]} barSize={44}>
          {dados.map((d, i) => (
            <Cell
              key={i}
              cursor="pointer"
              fill={i === destaque || hover === i ? ACENTO : FANTASMA}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onPick(d)}
            />
          ))}
          <LabelList dataKey="total" content={Rotulo} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/**
 * Composição: barra empilhada segmentada + lista com percentual — usada
 * para severidade (RAQ), status (RVT) e homologação (RHE).
 */
export type ComposicaoItem = {
  chave: string
  label: string
  cor: string
  total: number
}

export function Composicao({
  titulo,
  subtitulo,
  badge,
  dados,
  rotuloTotal,
  onPick,
}: {
  titulo: string
  subtitulo: string
  badge?: React.ReactNode
  dados: ComposicaoItem[]
  rotuloTotal: string
  onPick?: (d: ComposicaoItem) => void
}) {
  const soma = dados.reduce((a, d) => a + d.total, 0)
  return (
    <Card className="flex h-full flex-col gap-3 rounded-2xl border-neutral-200/70 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <h2 className="text-[13px] font-semibold text-neutral-800">{titulo}</h2>
          <span className="text-[11px] text-neutral-400">{subtitulo}</span>
        </div>
        {badge}
      </div>

      <div>
        <span className="text-2xl font-semibold tracking-tight text-neutral-900 tabular-nums">
          {soma.toLocaleString('pt-BR')}
        </span>
        <span className="ml-1.5 text-[11px] text-neutral-400">{rotuloTotal}</span>
      </div>

      {soma === 0 ? (
        <SemDados altura={120} />
      ) : (
        <>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
            {dados.map((d) =>
              d.total > 0 ? (
                <button
                  key={d.chave}
                  onClick={() => onPick?.(d)}
                  title={`${d.label}: ${d.total}`}
                  className="h-full transition-opacity hover:opacity-80"
                  style={{
                    width: `${(d.total / soma) * 100}%`,
                    backgroundColor: d.cor,
                  }}
                />
              ) : null,
            )}
          </div>
          <div className="flex flex-col gap-1">
            {dados.map((d) => (
              <button
                key={d.chave}
                onClick={() => onPick?.(d)}
                className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-[12px] text-neutral-600 transition-colors hover:bg-neutral-50"
              >
                <span className="flex items-center gap-2 truncate">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: d.cor }}
                  />
                  {d.label}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-[11px] text-neutral-400 tabular-nums">
                    {Math.round((d.total / soma) * 100)}%
                  </span>
                  <span className="font-medium tabular-nums text-neutral-700">
                    {d.total}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}

/** Janela [de, ate) do mês clicado no gráfico de evolução. */
export function mesRange(
  serie: ContagemMes[],
  m: ContagemMes,
): { de: string; ate: string } | null {
  const idx = serie.findIndex((x) => x.label === m.label && x.ano === m.ano)
  if (idx < 0) return null
  // O índice da série representa meses recuando a partir do atual.
  const mesesAtras = serie.length - 1 - idx
  const agora = new Date()
  const ini = new Date(agora.getFullYear(), agora.getMonth() - mesesAtras, 1)
  const fim = new Date(agora.getFullYear(), agora.getMonth() - mesesAtras + 1, 1)
  return { de: ini.toISOString(), ate: fim.toISOString() }
}

export function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
        ativo
          ? 'border-neutral-900 bg-neutral-900 text-white'
          : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50',
      )}
    >
      {children}
    </button>
  )
}
