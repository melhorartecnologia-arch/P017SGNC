import { z } from 'zod'

/**
 * Parâmetros dos workflows de resposta do fornecedor. Os prazos são
 * gravados em horas fracionárias (1.5 = 1h30), então a tela pode oferecer
 * horas e minutos.
 */
export const configuracaoWorkflowSchema = z.object({
  cienciaPrazoHoras: z.coerce
    .number({ invalid_type_error: 'Prazo de ciência inválido' })
    .min(1 / 60, 'O prazo de ciência deve ser de ao menos 1 minuto')
    .max(8760, 'O prazo de ciência não pode passar de 1 ano'),
  contingenciaPrazoHoras: z.coerce
    .number({ invalid_type_error: 'Prazo das ações de contingência inválido' })
    .min(1 / 60, 'O prazo das ações deve ser de ao menos 1 minuto')
    .max(8760, 'O prazo das ações não pode passar de 1 ano'),
  contingenciaAlertasPorDia: z.coerce
    .number({ invalid_type_error: 'Quantidade de alertas inválida' })
    .int('Informe um número inteiro de alertas por dia')
    .min(1, 'Envie ao menos 1 alerta por dia')
    .max(24, 'No máximo 24 alertas por dia'),
  eficaciaEsperaDias: z.coerce
    .number({ invalid_type_error: 'Tempo de espera inválido' })
    .int('Informe um número inteiro de dias')
    .min(0, 'O tempo de espera não pode ser negativo')
    .max(730, 'O tempo de espera não pode passar de 2 anos'),
})

export type ConfiguracaoWorkflowInput = z.infer<
  typeof configuracaoWorkflowSchema
>
