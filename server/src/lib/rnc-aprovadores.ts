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
 * Candidatos elegíveis a aprovar a RNC, agrupados por área e ordenados
 * dentro da área (match de turno primeiro, depois menor nível).
 *
 * Regra de turno: aprovador com restrição de turno só é elegível quando
 * a RNC é do turno correspondente; sem restrição (turno nulo) vale para
 * todos.
 */
export async function candidatosPorArea(
  db: Db,
  filialId: string,
  turnoId: string | null,
): Promise<Map<string, AprovadorSelecionado[]>> {
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
    if (c.turnoId && c.turnoId !== turnoId) continue
    const lista = porArea.get(c.areaId) ?? []
    lista.push(c)
    porArea.set(c.areaId, lista)
  }

  const resultado = new Map<string, AprovadorSelecionado[]>()
  for (const [areaId, lista] of porArea) {
    lista.sort((a, b) => {
      const aMatch = a.turnoId ? 0 : 1
      const bMatch = b.turnoId ? 0 : 1
      return aMatch - bMatch || a.nivel - b.nivel
    })
    resultado.set(
      areaId,
      lista.map((e) => ({
        aprovadorId: e.id,
        areaId: e.areaId,
        areaNome: e.area.nome,
        nome: e.nome,
        cargo: e.cargo,
        email: e.email,
        nivel: e.nivel,
      })),
    )
  }
  return resultado
}

/**
 * Seleciona quem deve assinar uma RNC inicialmente: UMA pessoa por área
 * (a de maior prioridade — geralmente o nível 1). Áreas sem elegível
 * ficam de fora. Os demais níveis entram depois, via escalonamento.
 */
export async function selecionarAprovadores(
  db: Db,
  filialId: string,
  turnoId: string | null,
): Promise<AprovadorSelecionado[]> {
  const porArea = await candidatosPorArea(db, filialId, turnoId)
  const escolhidos: AprovadorSelecionado[] = []
  for (const lista of porArea.values()) {
    if (lista[0]) escolhidos.push(lista[0])
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
