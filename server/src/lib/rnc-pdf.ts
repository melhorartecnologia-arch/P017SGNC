import PDFDocument from 'pdfkit'

/** Dados necessários para montar o PDF de uma RNC. */
export type RncPdfData = {
  numero: string
  dataIdentificacao: Date
  status: string
  descricaoDefeito: string | null
  quantidadeDefeito: number | null
  tempoParadaMinutos: number | null
  transportador: string | null
  placaCavalo: string | null
  placaCarreta: string | null
  nomeMotorista: string | null
  cnhMotorista: string | null
  filial: { codigo: string; nome: string } | null
  fornecedor: { codigo: string; razaoSocial: string; cnpj: string } | null
  tipoNaoConformidade: { codigo: string; descricao: string } | null
  produto: { codigo: string; descricao: string; unidadeMedida: string } | null
  disposicaoMaterial: { codigo: string; descricao: string } | null
  origem: { codigo: string; nome: string } | null
  severidade: { nivel: number; nome: string } | null
  criadoPor: { nome: string; email: string } | null
  aprovadores: {
    areaNome: string
    nome: string
    cargo: string | null
    assinadoEm: Date | null
  }[]
  lotes: { numero: string; quantidade: number | null }[]
  notasFiscais: {
    numero: string | null
    dataFabricacao: Date | null
    dataValidade: Date | null
    dataRecebimento: Date | null
  }[]
}

export type RncPdfFoto = {
  legenda: string | null
  mimeType: string
  buffer: Buffer
}

// ── Layout ──────────────────────────────────────────────────────────
const MARGIN = 28
const PAGE_W = 595.32
const PAGE_H = 841.92
const LEFT = MARGIN
const RIGHT = PAGE_W - MARGIN
const CONTENT_W = RIGHT - LEFT
const BOTTOM = PAGE_H - MARGIN

const COR_BARRA = '#1f2937'
const COR_LABEL = '#6b7280'
const COR_VALOR = '#111827'
const COR_BORDA = '#cbd5e1'

type Doc = PDFKit.PDFDocument

function fmtData(d: Date | null | undefined): string {
  if (!d) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

function num(n: number | null | undefined): string {
  if (n == null) return ''
  return n.toLocaleString('pt-BR')
}

type Estado = { y: number }

function novaPaginaSeNecessario(doc: Doc, est: Estado, altura: number) {
  if (est.y + altura > BOTTOM) {
    doc.addPage()
    est.y = MARGIN
  }
}

function tituloSecao(doc: Doc, est: Estado, texto: string) {
  const h = 16
  novaPaginaSeNecessario(doc, est, h + 24)
  doc.rect(LEFT, est.y, CONTENT_W, h).fill(COR_BARRA)
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .text(texto.toUpperCase(), LEFT + 6, est.y + 4.5, { width: CONTENT_W - 12 })
  est.y += h
}

type Campo = { label: string; valor?: string; flex?: number }

/** Desenha uma linha de campos (label em cima, valor embaixo) em colunas. */
function linhaCampos(doc: Doc, est: Estado, campos: Campo[], altura = 30) {
  novaPaginaSeNecessario(doc, est, altura)
  const totalFlex = campos.reduce((s, c) => s + (c.flex ?? 1), 0)
  let x = LEFT
  for (const c of campos) {
    const w = (CONTENT_W * (c.flex ?? 1)) / totalFlex
    doc.rect(x, est.y, w, altura).strokeColor(COR_BORDA).lineWidth(0.6).stroke()
    doc
      .fillColor(COR_LABEL)
      .font('Helvetica-Bold')
      .fontSize(6)
      .text(c.label.toUpperCase(), x + 4, est.y + 3, {
        width: w - 8,
        lineGap: -1,
      })
    doc
      .fillColor(COR_VALOR)
      .font('Helvetica')
      .fontSize(8.5)
      .text(c.valor ?? '', x + 4, est.y + 13, {
        width: w - 8,
        height: altura - 15,
        ellipsis: true,
      })
    x += w
  }
  est.y += altura
}

/** Bloco de texto livre (label + valor multilinha) ocupando a largura toda. */
function blocoTexto(
  doc: Doc,
  est: Estado,
  label: string,
  valor: string,
  altura: number,
) {
  novaPaginaSeNecessario(doc, est, altura)
  doc.rect(LEFT, est.y, CONTENT_W, altura).strokeColor(COR_BORDA).lineWidth(0.6).stroke()
  doc
    .fillColor(COR_LABEL)
    .font('Helvetica-Bold')
    .fontSize(6)
    .text(label.toUpperCase(), LEFT + 4, est.y + 3, { width: CONTENT_W - 8 })
  doc
    .fillColor(COR_VALOR)
    .font('Helvetica')
    .fontSize(8.5)
    .text(valor || '', LEFT + 4, est.y + 13, {
      width: CONTENT_W - 8,
      height: altura - 16,
      ellipsis: true,
    })
  est.y += altura
}

function cabecalho(doc: Doc, est: Estado, rnc: RncPdfData) {
  const h = 46
  // Moldura do cabeçalho
  doc.rect(LEFT, est.y, CONTENT_W, h).strokeColor(COR_BORDA).lineWidth(0.8).stroke()
  // Bloco do título (centro)
  doc
    .fillColor(COR_VALOR)
    .font('Helvetica-Bold')
    .fontSize(13)
    .text('RELATÓRIO DE NÃO CONFORMIDADE (RNC)', LEFT + 8, est.y + 10, {
      width: CONTENT_W - 170,
      align: 'center',
    })
  doc
    .fillColor(COR_LABEL)
    .font('Helvetica')
    .fontSize(8)
    .text('SGNC — Cervejaria Cidade Imperial', LEFT + 8, est.y + 30, {
      width: CONTENT_W - 170,
      align: 'center',
    })
  // Bloco de metadados (direita)
  const mx = RIGHT - 150
  doc.moveTo(mx, est.y).lineTo(mx, est.y + h).strokeColor(COR_BORDA).stroke()
  const meta = [
    ['DOCUMENTO', 'FOR.IND.CQA.012'],
    ['VERSÃO', '.003'],
    ['EMISSÃO', '23/12/2025'],
  ]
  let my = est.y + 5
  for (const [k, v] of meta) {
    doc.fillColor(COR_LABEL).font('Helvetica-Bold').fontSize(6).text(k, mx + 6, my)
    doc
      .fillColor(COR_VALOR)
      .font('Helvetica')
      .fontSize(8)
      .text(v, mx + 60, my - 0.5, { width: 84 })
    my += 13
  }
  est.y += h + 6
}

function caixaAssinatura(
  doc: Doc,
  x: number,
  y: number,
  w: number,
  papel: string,
  nome?: string,
  data?: string,
) {
  const h = 44
  doc.rect(x, y, w, h).strokeColor(COR_BORDA).lineWidth(0.6).stroke()
  doc
    .fillColor(COR_LABEL)
    .font('Helvetica-Bold')
    .fontSize(6.5)
    .text(papel.toUpperCase(), x + 4, y + 3, { width: w - 8 })
  doc
    .fillColor(COR_VALOR)
    .font('Helvetica')
    .fontSize(7.5)
    .text('NOME:', x + 4, y + 22)
    .text('DATA:', x + 4, y + 33)
  if (nome) {
    doc
      .fillColor(COR_VALOR)
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .text(nome, x + 32, y + 22, { width: w - 40, ellipsis: true })
  }
  if (data) {
    doc
      .fillColor(COR_VALOR)
      .font('Helvetica')
      .fontSize(7.5)
      .text(data, x + 32, y + 33, { width: w - 40 })
  }
  doc
    .moveTo(x + 32, y + 29)
    .lineTo(x + w - 6, y + 29)
    .strokeColor(COR_BORDA)
    .stroke()
  doc
    .moveTo(x + 32, y + 40)
    .lineTo(x + w - 6, y + 40)
    .strokeColor(COR_BORDA)
    .stroke()
}

/**
 * Monta o PDF da RNC no documento informado, no layout do formulário
 * FOR.IND.CQA.012. Não chama doc.end() — quem chama controla o stream.
 */
export function montarRncPdf(
  doc: Doc,
  rnc: RncPdfData,
  fotos: RncPdfFoto[],
) {
  const est: Estado = { y: MARGIN }

  cabecalho(doc, est, rnc)

  // 1. Identificação
  tituloSecao(doc, est, '1. Identificação do RNC')
  linhaCampos(doc, est, [
    { label: 'Unidade', valor: rnc.filial ? `${rnc.filial.codigo} — ${rnc.filial.nome}` : '', flex: 2 },
    { label: 'Número sequencial', valor: rnc.numero, flex: 1.2 },
    { label: 'Status', valor: rnc.status, flex: 1 },
  ])
  linhaCampos(doc, est, [
    { label: 'Título do RNC', valor: rnc.tipoNaoConformidade ? `${rnc.tipoNaoConformidade.codigo} — ${rnc.tipoNaoConformidade.descricao}` : '', flex: 3 },
    { label: 'Reincidente', valor: '', flex: 1 },
    { label: 'Se sim, quantas vezes?', valor: '', flex: 1 },
  ])

  // 2. RNC's relacionados (sem vínculo no sistema — campos em branco)
  tituloSecao(doc, est, "2. RNC's Relacionados")
  for (let i = 1; i <= 3; i++) {
    linhaCampos(
      doc,
      est,
      [
        { label: `RNC relacionado ${i} — número`, valor: '', flex: 1.4 },
        { label: 'Título do RNC', valor: '', flex: 2 },
        { label: 'Data de emissão', valor: '', flex: 1 },
      ],
      22,
    )
  }

  // 3. Dados do fornecedor e material
  tituloSecao(doc, est, '3. Dados do Fornecedor e Material')
  linhaCampos(doc, est, [
    { label: 'Fornecedor', valor: rnc.fornecedor ? `${rnc.fornecedor.codigo} — ${rnc.fornecedor.razaoSocial}` : '', flex: 2 },
    { label: 'CNPJ', valor: rnc.fornecedor?.cnpj ?? '', flex: 1 },
  ])
  linhaCampos(doc, est, [
    { label: 'Item (produto)', valor: rnc.produto ? `${rnc.produto.codigo} — ${rnc.produto.descricao}` : '', flex: 3 },
    { label: 'Un.', valor: rnc.produto?.unidadeMedida ?? '', flex: 0.5 },
  ])
  // Lotes (até 4 colunas)
  const loteCampos: Campo[] = []
  for (let i = 0; i < 4; i++) {
    const l = rnc.lotes[i]
    loteCampos.push({
      label: `Lote ${i + 1}`,
      valor: l ? `${l.numero}${l.quantidade != null ? ` (${num(l.quantidade)})` : ''}` : '',
      flex: 1,
    })
  }
  linhaCampos(doc, est, loteCampos, 26)
  const totalLote = rnc.lotes.reduce((s, l) => s + (l.quantidade ?? 0), 0)
  linhaCampos(doc, est, [
    { label: 'Data da ocorrência', valor: fmtData(rnc.dataIdentificacao), flex: 1 },
    { label: 'Quantidade do lote', valor: totalLote ? num(totalLote) : '', flex: 1 },
    { label: 'Quantidade com defeito', valor: num(rnc.quantidadeDefeito), flex: 1 },
    { label: 'Tempo de parada', valor: rnc.tempoParadaMinutos != null ? `${num(rnc.tempoParadaMinutos)} min` : '', flex: 1 },
  ])
  // Notas fiscais (uma linha por nota; rótulos só na 1ª)
  const notas = rnc.notasFiscais.length > 0 ? rnc.notasFiscais : [null]
  notas.forEach((nf, i) => {
    linhaCampos(
      doc,
      est,
      [
        { label: i === 0 ? 'Número NF' : '', valor: nf?.numero ?? '', flex: 1 },
        { label: i === 0 ? 'Data de fabricação' : '', valor: fmtData(nf?.dataFabricacao), flex: 1 },
        { label: i === 0 ? 'Data de validade' : '', valor: fmtData(nf?.dataValidade), flex: 1 },
        { label: i === 0 ? 'Data de recebimento' : '', valor: fmtData(nf?.dataRecebimento), flex: 1 },
      ],
      22,
    )
  })
  linhaCampos(doc, est, [
    { label: 'Transportadora', valor: rnc.transportador ?? '', flex: 2 },
    { label: 'Placa do cavalo', valor: rnc.placaCavalo ?? '', flex: 1 },
    { label: 'Placa da carreta', valor: rnc.placaCarreta ?? '', flex: 1 },
  ])
  linhaCampos(doc, est, [
    { label: 'Nome do motorista', valor: rnc.nomeMotorista ?? '', flex: 2 },
    { label: 'Documento do motorista', valor: rnc.cnhMotorista ?? '', flex: 1 },
  ])

  // 4. Disposição do material
  tituloSecao(doc, est, '4. Disposição do Material')
  const dispTexto = rnc.disposicaoMaterial
    ? `${rnc.disposicaoMaterial.descricao}`.toLowerCase()
    : ''
  const opcoes: [string, string[]][] = [
    ['Liberar com restrição', ['restri']],
    ['Bloqueado para retrabalho', ['retrabalho']],
    ['Liberar sob concessão', ['concess']],
    ['Bloqueado para devolução / ressarcimento', ['devolu', 'ressarc']],
  ]
  novaPaginaSeNecessario(doc, est, 20)
  let ox = LEFT
  const ow = CONTENT_W / opcoes.length
  for (const [rotulo, chaves] of opcoes) {
    const marcado = chaves.some((k) => dispTexto.includes(k))
    doc.rect(ox, est.y, ow, 20).strokeColor(COR_BORDA).lineWidth(0.6).stroke()
    doc.rect(ox + 5, est.y + 6, 8, 8).strokeColor(COR_VALOR).lineWidth(0.8).stroke()
    if (marcado) {
      doc
        .fillColor(COR_VALOR)
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('X', ox + 6.3, est.y + 6.2)
    }
    doc
      .fillColor(COR_VALOR)
      .font('Helvetica')
      .fontSize(6.8)
      .text(rotulo.toUpperCase(), ox + 17, est.y + 5, { width: ow - 20 })
    ox += ow
  }
  est.y += 20
  if (rnc.disposicaoMaterial) {
    linhaCampos(doc, est, [
      { label: 'Disposição selecionada', valor: `${rnc.disposicaoMaterial.codigo} — ${rnc.disposicaoMaterial.descricao}` },
    ], 20)
  }

  // 5. Dados da não conformidade
  tituloSecao(doc, est, '5. Dados da Não Conformidade')
  linhaCampos(doc, est, [
    { label: 'Origem da NC', valor: rnc.origem ? `${rnc.origem.codigo} — ${rnc.origem.nome}` : '', flex: 1 },
    { label: 'Severidade', valor: rnc.severidade ? `Nível ${rnc.severidade.nivel} — ${rnc.severidade.nome}` : '', flex: 1 },
  ])
  blocoTexto(
    doc,
    est,
    'Defeito / problema identificado (descrição da ocorrência)',
    rnc.descricaoDefeito ?? '',
    72,
  )

  // Fotos da ocorrência (até 4)
  tituloSecao(doc, est, 'Fotos da Ocorrência')
  const fotosUsaveis = fotos.filter((f) =>
    ['image/jpeg', 'image/jpg', 'image/png'].includes(f.mimeType),
  )
  const celW = CONTENT_W / 2
  const celH = 120
  for (let i = 0; i < 4; i += 2) {
    novaPaginaSeNecessario(doc, est, celH)
    for (let j = 0; j < 2; j++) {
      const idx = i + j
      const x = LEFT + j * celW
      doc.rect(x, est.y, celW, celH).strokeColor(COR_BORDA).lineWidth(0.6).stroke()
      doc
        .fillColor(COR_LABEL)
        .font('Helvetica-Bold')
        .fontSize(6)
        .text(`FOTO 0${idx + 1}`, x + 4, est.y + 3)
      const foto = fotosUsaveis[idx]
      if (foto) {
        try {
          doc.image(foto.buffer, x + 6, est.y + 14, {
            fit: [celW - 12, celH - 32],
            align: 'center',
            valign: 'center',
          })
        } catch {
          // imagem inválida — ignora
        }
        doc
          .fillColor(COR_VALOR)
          .font('Helvetica')
          .fontSize(7)
          .text(foto.legenda ?? '', x + 4, est.y + celH - 14, {
            width: celW - 8,
            ellipsis: true,
          })
      }
    }
    est.y += celH
  }

  blocoTexto(doc, est, 'Observações complementares', '', 40)
  linhaCampos(doc, est, [
    { label: 'Emitente', valor: rnc.criadoPor ? `${rnc.criadoPor.nome} (${rnc.criadoPor.email})` : '' },
  ], 22)

  // 6. Assinaturas — matriz de aprovação da RNC (uma pessoa por área do
  // cadastro de Aprovadores da filial, respeitando restrição de turno).
  // Sem matriz, cai nos papéis padrão do formulário (em branco).
  tituloSecao(doc, est, '6. Assinaturas')
  const colW = (CONTENT_W - 8) / 2
  if (rnc.aprovadores.length > 0) {
    const entradas = rnc.aprovadores.map((a) => ({
      papel: a.areaNome + (a.cargo ? ` — ${a.cargo}` : ''),
      nome: a.nome,
      data: a.assinadoEm ? fmtData(a.assinadoEm) : undefined,
    }))
    for (let i = 0; i < entradas.length; i += 2) {
      novaPaginaSeNecessario(doc, est, 48)
      caixaAssinatura(doc, LEFT, est.y, colW, entradas[i].papel, entradas[i].nome, entradas[i].data)
      if (entradas[i + 1]) {
        caixaAssinatura(
          doc,
          LEFT + colW + 8,
          est.y,
          colW,
          entradas[i + 1].papel,
          entradas[i + 1].nome,
          entradas[i + 1].data,
        )
      }
      est.y += 48
    }
  } else {
    const papeis = [
      'Conferente da Logística',
      'Gestão Logística',
      'Gestão PCP',
      'Controle de Qualidade',
      'Gestão Controle de Qualidade',
      'Gerente da Área',
    ]
    for (let i = 0; i < papeis.length; i += 2) {
      novaPaginaSeNecessario(doc, est, 48)
      caixaAssinatura(doc, LEFT, est.y, colW, papeis[i])
      if (papeis[i + 1]) caixaAssinatura(doc, LEFT + colW + 8, est.y, colW, papeis[i + 1])
      est.y += 48
    }
  }
}
