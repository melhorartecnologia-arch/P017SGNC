import type { Prisma, PrismaClient } from '@prisma/client'

type Db = Prisma.TransactionClient | PrismaClient

export type AprovadorSelecionado = {
  aprovadorId: string
  areaId: string
  areaNome: string
  nome: string
  cargo: string | null
  email: string | null
  nivel: number
}

/**
 * Seleciona quem deve assinar uma RNC: UMA pessoa por área cadastrada
 * no cadastro de Aprovadores para a filial da RNC.
 *
 * Regras:
 * - Aprovador com restrição de turno só é elegível quando a RNC é do
 *   turno correspondente; sem restrição (turno nulo) vale para todos.
 * - Dentro da área, quem casa exatamente com o turno da RNC tem
 *   prioridade sobre quem não tem restrição; em empate vence o menor
 *   nível (nível 1 = principal).
 * - Área sem nenhum elegível fica fora da matriz.
 */
export async function selecionarAprovadores(
  db: Db,
  filialId: string,
  turnoId: string | null,
): Promise<AprovadorSelecionado[]> {
  const candidatos = await db.aprovador.findMany({
    where: { filialId, ativo: true },
    select: {
      id: true,
      areaId: true,
      turnoId: true,
      nivel: true,
      nome: true,
      cargo: true,
      email: true,
      area: { select: { nome: true } },
    },
  })

  const porArea = new Map<string, typeof candidatos>()
  for (const c of candidatos) {
    // Restrição de turno: só entra se for do mesmo turno da RNC.
    if (c.turnoId && c.turnoId !== turnoId) continue
    const lista = porArea.get(c.areaId) ?? []
    lista.push(c)
    porArea.set(c.areaId, lista)
  }

  const escolhidos: AprovadorSelecionado[] = []
  for (const lista of porArea.values()) {
    lista.sort((a, b) => {
      const aMatch = a.turnoId ? 0 : 1
      const bMatch = b.turnoId ? 0 : 1
      return aMatch - bMatch || a.nivel - b.nivel
    })
    const e = lista[0]
    escolhidos.push({
      aprovadorId: e.id,
      areaId: e.areaId,
      areaNome: e.area.nome,
      nome: e.nome,
      cargo: e.cargo,
      email: e.email,
      nivel: e.nivel,
    })
  }

  escolhidos.sort((a, b) => a.areaNome.localeCompare(b.areaNome, 'pt-BR'))
  return escolhidos
}

/** Recalcula e grava a matriz de aprovação da RNC (substituição total). */
export async function montarMatrizAprovadores(
  tx: Prisma.TransactionClient,
  rncId: string,
  filialId: string,
  turnoId: string | null,
): Promise<void> {
  const escolhidos = await selecionarAprovadores(tx, filialId, turnoId)
  await tx.rncAprovador.deleteMany({ where: { rncId } })
  if (escolhidos.length > 0) {
    await tx.rncAprovador.createMany({
      data: escolhidos.map((e) => ({ rncId, ...e })),
    })
  }
}
