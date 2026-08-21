import type { Prisma, PrismaClient } from '@prisma/client'

type Db = Prisma.TransactionClient | PrismaClient

export type AprovadorSelecionado = {
  aprovadorId: string
  areaId: string
  areaNome: string
  nome: string
  cargo: string | null
  email: string | null
  whatsapp: string | null
  nivel: number
}

/**
 * Candidatos elegíveis a aprovar o documento, agrupados por área e
 * ordenados dentro da área (match de turno primeiro, depois menor nível).
 *
 * Regra de turno: aprovador com restrição de turno só é elegível quando
 * o documento é do turno correspondente; sem restrição (turno nulo) vale
 * para todos. Regra de tipo: aprovador vinculado a tipos de relatório só
 * assina os tipos vinculados; sem vínculo, assina todos.
 */
export async function candidatosPorArea(
  db: Db,
  filialId: string,
  turnoId: string | null,
  tipoCodigo: string = 'RNC',
): Promise<Map<string, AprovadorSelecionado[]>> {
  const candidatos = await db.aprovador.findMany({
    where: {
      filialId,
      ativo: true,
      OR: [
        { tiposRelatorio: { none: {} } },
        {
          tiposRelatorio: {
            some: { codigo: { equals: tipoCodigo, mode: 'insensitive' } },
          },
        },
      ],
    },
    select: {
      id: true,
      areaId: true,
      turnoId: true,
      nivel: true,
      nome: true,
      cargo: true,
      email: true,
      whatsapp: true,
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
        whatsapp: e.whatsapp,
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
  tipoCodigo: string = 'RNC',
): Promise<AprovadorSelecionado[]> {
  const porArea = await candidatosPorArea(db, filialId, turnoId, tipoCodigo)
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
  tipoCodigo: string = 'RNC',
): Promise<void> {
  const escolhidos = await selecionarAprovadores(tx, filialId, turnoId, tipoCodigo)
  await tx.rncAprovador.deleteMany({ where: { rncId } })
  if (escolhidos.length > 0) {
    await tx.rncAprovador.createMany({
      data: escolhidos.map((e) => ({ rncId, ...e })),
    })
  }
}

/**
 * Anexa à matriz os representantes técnicos do fornecedor cadastrados no
 * RHE — signatários avulsos, sem vínculo com o cadastro interno de
 * aprovadores. Chamar SEMPRE depois de montarMatrizAprovadores (que
 * substitui a matriz inteira). O fornecedor não tem devolução no RHE:
 * apenas assina, pelo mesmo link/senha dos demais.
 */
export async function anexarRepresentantesRhe(
  tx: Prisma.TransactionClient,
  rncId: string,
): Promise<void> {
  const reps = await tx.rheRepresentante.findMany({
    where: { rncId },
    orderBy: { ordem: 'asc' },
    select: { nome: true, email: true },
  })
  if (reps.length === 0) return
  await tx.rncAprovador.createMany({
    data: reps.map((r) => ({
      rncId,
      areaNome: 'Representante Técnico (Fornecedor)',
      nome: r.nome,
      email: r.email,
    })),
  })
}
