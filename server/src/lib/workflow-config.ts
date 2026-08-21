import type { PrismaClient } from '@prisma/client'

/**
 * Parâmetros dos workflows de resposta do fornecedor (linha única, id 1).
 * Enquanto a linha não existir, valem os padrões abaixo — assim o sistema
 * funciona antes de alguém abrir a tela de parâmetros.
 */

export const CONFIG_WORKFLOW_ID = 1

export type ParametrosWorkflow = {
  /** Prazo (horas) da ciência antes do aceite automático por decurso. */
  cienciaPrazoHoras: number
  /** Prazo (horas) para o fornecedor devolver as ações de contingência. */
  contingenciaPrazoHoras: number
  /** Alertas por dia ao fornecedor após vencer o prazo das ações. */
  contingenciaAlertasPorDia: number
}

export const PARAMETROS_WORKFLOW_PADRAO: ParametrosWorkflow = {
  cienciaPrazoHoras: 48,
  contingenciaPrazoHoras: 72,
  contingenciaAlertasPorDia: 2,
}

export async function obterParametrosWorkflow(
  prisma: PrismaClient,
): Promise<ParametrosWorkflow> {
  const cfg = await prisma.configuracaoWorkflow.findUnique({
    where: { id: CONFIG_WORKFLOW_ID },
    select: {
      cienciaPrazoHoras: true,
      contingenciaPrazoHoras: true,
      contingenciaAlertasPorDia: true,
    },
  })
  return cfg ?? PARAMETROS_WORKFLOW_PADRAO
}

/**
 * Intervalo entre alertas, em milissegundos: o dia dividido pelo número de
 * alertas configurado (2 por dia = um a cada 12h).
 */
export function intervaloEntreAlertasMs(alertasPorDia: number): number {
  const porDia = Math.max(1, Math.min(24, Math.round(alertasPorDia)))
  return Math.round(86_400_000 / porDia)
}
