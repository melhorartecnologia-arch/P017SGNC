import * as React from 'react'
import { Loader2, Save, Timer, BellRing, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api/client'
import {
  configuracoesApi,
  horaMinutoParaHoras,
  horasParaHoraMinuto,
} from '@/lib/api/configuracoes'

/**
 * Parâmetros dos workflows de resposta do fornecedor: prazo da ciência,
 * prazo das ações de contingência e a cadência de alertas em atraso.
 */

type FormState = {
  cienciaHoras: string
  cienciaMinutos: string
  contingenciaHoras: string
  contingenciaMinutos: string
  alertasPorDia: string
  eficaciaEsperaDias: string
}

const empty: FormState = {
  cienciaHoras: '48',
  cienciaMinutos: '0',
  contingenciaHoras: '72',
  contingenciaMinutos: '0',
  alertasPorDia: '2',
  eficaciaEsperaDias: '30',
}

/** Só dígitos: evita "1,5h" e outros formatos ambíguos no campo. */
function somenteDigitos(v: string): string {
  return v.replace(/\D/g, '')
}

function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <Label>{label}</Label>
      {children}
      {hint && !error && <span className="text-xs text-neutral-500">{hint}</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}

/** "72h 30min" a partir de horas fracionárias. */
function textoPrazo(horas: number, minutos: number): string {
  if (horas === 0 && minutos === 0) return '—'
  const dias = Math.floor(horas / 24)
  const partes = [
    horas > 0 ? `${horas}h` : '',
    minutos > 0 ? `${minutos}min` : '',
  ].filter(Boolean)
  const base = partes.join(' ')
  return dias >= 1 ? `${base} (≈ ${dias} dia${dias > 1 ? 's' : ''})` : base
}

export function WorkflowConfigPage() {
  const [form, setForm] = React.useState<FormState>(empty)
  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string[]>
  >({})

  React.useEffect(() => {
    let cancelled = false
    configuracoesApi
      .getWorkflow()
      .then((cfg) => {
        if (cancelled) return
        const c = horasParaHoraMinuto(cfg.cienciaPrazoHoras)
        const k = horasParaHoraMinuto(cfg.contingenciaPrazoHoras)
        setForm({
          cienciaHoras: String(c.horas),
          cienciaMinutos: String(c.minutos),
          contingenciaHoras: String(k.horas),
          contingenciaMinutos: String(k.minutos),
          alertasPorDia: String(cfg.contingenciaAlertasPorDia),
          eficaciaEsperaDias: String(cfg.eficaciaEsperaDias),
        })
      })
      .catch((err) => {
        if (cancelled) return
        setError(
          err instanceof ApiError
            ? err.message
            : 'Não foi possível carregar os parâmetros. A API está rodando?',
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((s) => ({ ...s, [key]: value }))

  const cienciaHoras = Number(form.cienciaHoras || 0)
  const cienciaMinutos = Number(form.cienciaMinutos || 0)
  const contingenciaHoras = Number(form.contingenciaHoras || 0)
  const contingenciaMinutos = Number(form.contingenciaMinutos || 0)
  const alertas = Number(form.alertasPorDia || 0)
  const esperaEficacia = Number(form.eficaciaEsperaDias || 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setFieldErrors({})
    try {
      const salvo = await configuracoesApi.saveWorkflow({
        cienciaPrazoHoras: horaMinutoParaHoras(cienciaHoras, cienciaMinutos),
        contingenciaPrazoHoras: horaMinutoParaHoras(
          contingenciaHoras,
          contingenciaMinutos,
        ),
        contingenciaAlertasPorDia: alertas,
        eficaciaEsperaDias: esperaEficacia,
      })
      const c = horasParaHoraMinuto(salvo.cienciaPrazoHoras)
      const k = horasParaHoraMinuto(salvo.contingenciaPrazoHoras)
      setForm({
        cienciaHoras: String(c.horas),
        cienciaMinutos: String(c.minutos),
        contingenciaHoras: String(k.horas),
        contingenciaMinutos: String(k.minutos),
        alertasPorDia: String(salvo.contingenciaAlertasPorDia),
        eficaciaEsperaDias: String(salvo.eficaciaEsperaDias),
      })
      toast.success('Parâmetros do workflow salvos')
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
        toast.error('Não foi possível salvar', { description: err.message })
        const details = err.details as
          | { details?: { fieldErrors?: Record<string, string[]> } }
          | undefined
        if (details?.details?.fieldErrors) {
          setFieldErrors(details.details.fieldErrors)
        }
      } else {
        setError('Erro inesperado ao salvar.')
        toast.error('Erro inesperado ao salvar')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const intervaloAlertas = alertas > 0 ? 24 / alertas : 0

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-neutral-500" />
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
            Prazos do fornecedor
          </h1>
        </div>
        <p className="text-sm text-neutral-500">
          Prazos e cobranças do fluxo pós-assinatura: ciência da não
          conformidade e devolutiva das ações de contingência. Apenas
          administradores podem alterar.
        </p>
      </header>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="max-w-3xl rounded-xl border-neutral-200 bg-white p-4 shadow-sm md:p-6">
        {loading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <section className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-[13px] font-semibold text-neutral-800">
                  Ciência da não conformidade
                </h2>
                <p className="text-xs text-neutral-500">
                  Tempo que o fornecedor tem para aceitar ou recusar a RNC
                  depois de concluídas as assinaturas internas. Sem
                  manifestação, o aceite é registrado por decurso de prazo.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                <Field
                  label="Horas"
                  error={fieldErrors.cienciaPrazoHoras?.[0]}
                  className="sm:col-span-3"
                >
                  <Input
                    inputMode="numeric"
                    value={form.cienciaHoras}
                    onChange={(e) =>
                      set('cienciaHoras', somenteDigitos(e.target.value))
                    }
                    maxLength={4}
                  />
                </Field>
                <Field label="Minutos" className="sm:col-span-3">
                  <Input
                    inputMode="numeric"
                    value={form.cienciaMinutos}
                    onChange={(e) =>
                      set('cienciaMinutos', somenteDigitos(e.target.value))
                    }
                    maxLength={2}
                  />
                </Field>
                <div className="flex items-end sm:col-span-6">
                  <span className="pb-2 text-sm text-neutral-500">
                    Prazo total:{' '}
                    <b className="text-neutral-800">
                      {textoPrazo(cienciaHoras, cienciaMinutos)}
                    </b>
                  </span>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-3 border-t border-neutral-100 pt-5">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-[13px] font-semibold text-neutral-800">
                  Ações de contingência
                </h2>
                <p className="text-xs text-neutral-500">
                  Confirmada a não conformidade, o fornecedor precisa informar
                  as ações que vai executar. Vencido o prazo, ele passa a
                  receber alertas até enviar a devolutiva.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                <Field
                  label="Horas"
                  error={fieldErrors.contingenciaPrazoHoras?.[0]}
                  className="sm:col-span-3"
                >
                  <Input
                    inputMode="numeric"
                    value={form.contingenciaHoras}
                    onChange={(e) =>
                      set('contingenciaHoras', somenteDigitos(e.target.value))
                    }
                    maxLength={4}
                  />
                </Field>
                <Field label="Minutos" className="sm:col-span-3">
                  <Input
                    inputMode="numeric"
                    value={form.contingenciaMinutos}
                    onChange={(e) =>
                      set('contingenciaMinutos', somenteDigitos(e.target.value))
                    }
                    maxLength={2}
                  />
                </Field>
                <div className="flex items-end sm:col-span-6">
                  <span className="pb-2 text-sm text-neutral-500">
                    Prazo total:{' '}
                    <b className="text-neutral-800">
                      {textoPrazo(contingenciaHoras, contingenciaMinutos)}
                    </b>
                  </span>
                </div>
                <Field
                  label="Alertas por dia após o prazo *"
                  error={fieldErrors.contingenciaAlertasPorDia?.[0]}
                  hint={
                    alertas > 0
                      ? `Um alerta a cada ${
                          Number.isInteger(intervaloAlertas)
                            ? intervaloAlertas
                            : intervaloAlertas.toFixed(1)
                        } horas, até a devolutiva chegar.`
                      : 'Informe de 1 a 24 alertas por dia.'
                  }
                  className="sm:col-span-6"
                >
                  <Input
                    inputMode="numeric"
                    value={form.alertasPorDia}
                    onChange={(e) =>
                      set('alertasPorDia', somenteDigitos(e.target.value))
                    }
                    maxLength={2}
                    required
                  />
                </Field>
                <div className="flex items-end sm:col-span-6">
                  <span className="flex items-center gap-1.5 pb-2 text-xs text-neutral-500">
                    <BellRing className="h-3.5 w-3.5" />
                    Os alertas param assim que o fornecedor registra as ações.
                  </span>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-3 border-t border-neutral-100 pt-5">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-[13px] font-semibold text-neutral-800">
                  Verificação de eficácia
                </h2>
                <p className="text-xs text-neutral-500">
                  Tempo de espera entre a última data planejada do plano de
                  ação e a liberação da verificação — o intervalo em que as
                  ações precisam rodar para poderem ser julgadas.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                <Field
                  label="Dias de espera *"
                  error={fieldErrors.eficaciaEsperaDias?.[0]}
                  hint={
                    esperaEficacia > 0
                      ? `A verificação abre ${esperaEficacia} dia(s) depois da última ação planejada.`
                      : 'Com 0, a verificação abre já na última data planejada.'
                  }
                  className="sm:col-span-4"
                >
                  <Input
                    inputMode="numeric"
                    value={form.eficaciaEsperaDias}
                    onChange={(e) =>
                      set('eficaciaEsperaDias', somenteDigitos(e.target.value))
                    }
                    maxLength={3}
                    required
                  />
                </Field>
                <div className="flex items-end sm:col-span-8">
                  <span className="flex items-center gap-1.5 pb-2 text-xs text-neutral-500">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Só os aprovadores marcados (ou um administrador) registram a
                    verificação.
                  </span>
                </div>
              </div>
            </section>

            <div className="flex justify-end border-t border-neutral-100 pt-4">
              <Button type="submit" disabled={submitting} className="gap-1.5">
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar parâmetros
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}
