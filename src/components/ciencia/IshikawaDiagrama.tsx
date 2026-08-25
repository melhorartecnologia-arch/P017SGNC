/**
 * Diagrama de Ishikawa (espinha de peixe) em SVG, somente leitura.
 *
 * A espinha corre na horizontal até o efeito (a não conformidade), com
 * três categorias acima e três abaixo. As causas de cada categoria são
 * listadas ao longo da sua espinha secundária. A altura acompanha a
 * categoria mais cheia, então o desenho não se sobrepõe quando o
 * fornecedor cadastra muitas causas.
 */

import {
  ISHIKAWA_CATEGORIAS,
  ISHIKAWA_LABEL,
  type CausaIshikawa,
  type IshikawaCategoria,
} from './ishikawa'

const ACIMA: IshikawaCategoria[] = ['METODO', 'MAQUINA', 'MEDICAO']
const ABAIXO: IshikawaCategoria[] = ['MAO_DE_OBRA', 'MATERIAL', 'MEIO_AMBIENTE']

/** Corta o texto para caber na faixa da categoria (o título traz o inteiro). */
function encurtar(texto: string, max = 30): string {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto
}

function agrupar(causas: CausaIshikawa[]): Map<string, string[]> {
  const mapa = new Map<string, string[]>()
  for (const c of ISHIKAWA_CATEGORIAS) mapa.set(c, [])
  for (const causa of causas) {
    const lista = mapa.get(causa.categoria)
    if (lista) lista.push(causa.descricao)
  }
  return mapa
}

export function IshikawaDiagrama({
  causas,
  efeito,
}: {
  causas: CausaIshikawa[]
  /** O problema na cabeça do peixe — normalmente o defeito da RNC. */
  efeito: string
}) {
  const porCategoria = agrupar(causas)
  const maiorLista = Math.max(
    1,
    ...ISHIKAWA_CATEGORIAS.map((c) => porCategoria.get(c)?.length ?? 0),
  )

  // Geometria: a metade cresce com a categoria mais cheia. As âncoras são
  // espaçadas o suficiente para o texto de uma categoria não invadir a
  // faixa da anterior (ver `encurtar`).
  const alturaMetade = 44 + maiorLista * 14
  const altura = alturaMetade * 2 + 30
  const espinhaY = alturaMetade + 15
  const largura = 900
  const inicioX = 20
  const fimX = 660

  const ancoras = [210, 400, 590]

  const bones = [
    ...ACIMA.map((cat, i) => ({ cat, x: ancoras[i], cima: true })),
    ...ABAIXO.map((cat, i) => ({ cat, x: ancoras[i], cima: false })),
  ]

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white p-2">
      <svg
        viewBox={`0 0 ${largura} ${altura}`}
        style={{ minWidth: 760 }}
        className="h-auto w-full"
        role="img"
        aria-label="Diagrama de Ishikawa das causas levantadas"
      >
        {/* Espinha principal */}
        <line
          x1={inicioX}
          y1={espinhaY}
          x2={fimX}
          y2={espinhaY}
          stroke="#404040"
          strokeWidth={2}
        />
        <polygon
          points={`${fimX},${espinhaY - 6} ${fimX + 12},${espinhaY} ${fimX},${espinhaY + 6}`}
          fill="#404040"
        />

        {/* Efeito (cabeça do peixe) */}
        <rect
          x={fimX + 16}
          y={espinhaY - 26}
          width={168}
          height={52}
          rx={8}
          fill="#fef2f2"
          stroke="#fecaca"
        />
        <text
          x={fimX + 100}
          y={espinhaY - 8}
          textAnchor="middle"
          fontSize={10}
          fill="#991b1b"
          fontWeight="600"
        >
          EFEITO
        </text>
        <text
          x={fimX + 100}
          y={espinhaY + 8}
          textAnchor="middle"
          fontSize={11}
          fill="#7f1d1d"
        >
          {encurtar(efeito || 'Não conformidade', 26)}
          <title>{efeito}</title>
        </text>

        {bones.map(({ cat, x, cima }) => {
          const itens = porCategoria.get(cat) ?? []
          const sinal = cima ? -1 : 1
          const pontaY = espinhaY + sinal * (alturaMetade - 14)
          const pontaX = x - 96
          return (
            <g key={cat}>
              {/* Espinha secundária */}
              <line
                x1={x}
                y1={espinhaY}
                x2={pontaX}
                y2={pontaY}
                stroke="#a3a3a3"
                strokeWidth={1.5}
              />
              {/* Rótulo da categoria */}
              <rect
                x={pontaX - 46}
                y={pontaY + (cima ? -20 : 2)}
                width={94}
                height={18}
                rx={4}
                fill="#f5f5f5"
                stroke="#e5e5e5"
              />
              <text
                x={pontaX}
                y={pontaY + (cima ? -7 : 15)}
                textAnchor="middle"
                fontSize={10}
                fontWeight="600"
                fill="#404040"
              >
                {ISHIKAWA_LABEL[cat] ?? cat}
              </text>

              {/* Causas: uma linha por causa, saindo da espinha secundária
                  e crescendo para longe da espinha principal. */}
              {itens.map((texto, i) => {
                const y = espinhaY + sinal * (26 + i * 14)
                const xTick = x - 16 - i * 7
                return (
                  <g key={i}>
                    <line
                      x1={xTick}
                      y1={y}
                      x2={xTick + 9}
                      y2={y}
                      stroke="#d4d4d4"
                      strokeWidth={1}
                    />
                    <text
                      x={xTick - 3}
                      y={y + 3}
                      textAnchor="end"
                      fontSize={9}
                      fill="#525252"
                    >
                      {encurtar(texto)}
                      <title>{texto}</title>
                    </text>
                  </g>
                )
              })}
              {itens.length === 0 && (
                <text
                  x={x - 19}
                  y={espinhaY + sinal * 26 + 3}
                  textAnchor="end"
                  fontSize={9}
                  fill="#d4d4d4"
                  fontStyle="italic"
                >
                  sem causas
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
