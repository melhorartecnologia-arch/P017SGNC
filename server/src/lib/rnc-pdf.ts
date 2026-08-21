import PDFDocument from 'pdfkit'

/** Dados necessários para montar o PDF de uma RNC (ou RAQ). */
export type RncPdfData = {
  numero: string
  dataIdentificacao: Date
  status: string
  createdAt?: Date
  // Campos próprios do RVT.
  pauta?: string | null
  assuntosAbordados?: string | null
  conclusao?: string | null
  participantes?: { ordem: number; nome: string }[]
  // Campos próprios do RAQ.
  titulo?: string | null
  reincidente?: boolean | null
  reincidenteVezes?: number | null
  observacoesComplementares?: string | null
  raqRelacionados?: {
    numero: string
    titulo: string | null
    createdAt: Date
    produto: { codigo: string; descricao: string } | null
    lotes: { numero: string }[]
  }[]
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
    assinaturaIp?: string | null
    assinaturaNavegador?: string | null
    assinaturaSo?: string | null
    assinaturaDispositivo?: string | null
    assinaturaLatitude?: number | null
    assinaturaLongitude?: number | null
    assinaturaPrecisao?: number | null
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

function fmtDataHora(d: Date | null | undefined): string {
  if (!d) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/**
 * Situação da RNC em português. O banco guarda o enum em inglês
 * (DRAFT, OPEN, ...); o PDF deve exibir o rótulo traduzido.
 */
const STATUS_PT: Record<string, string> = {
  DRAFT: 'Rascunho',
  OPEN: 'Aberta',
  IN_PROGRESS: 'Em andamento',
  CLOSED: 'Encerrada',
  CANCELLED: 'Cancelada',
}

export function fmtStatus(s: string | null | undefined): string {
  if (!s) return ''
  return STATUS_PT[s] ?? s
}

/**
 * Tipo de dispositivo em português. O ua-parser devolve os tipos em
 * inglês ("mobile", "tablet", ...); quando há marca/modelo, o valor já
 * é um nome próprio e é mantido como está.
 */
const DISPOSITIVO_PT: Record<string, string> = {
  desktop: 'Computador',
  mobile: 'Celular',
  tablet: 'Tablet',
  smarttv: 'Smart TV',
  console: 'Console',
  wearable: 'Dispositivo vestível',
  embedded: 'Dispositivo embarcado',
  xr: 'Realidade estendida',
  unknown: 'Não identificado',
}

export function fmtDispositivo(s: string | null | undefined): string {
  if (!s) return ''
  return DISPOSITIVO_PT[s.trim().toLowerCase()] ?? s
}

const COR_ASSINADO_BORDA = '#86efac'
const COR_ASSINADO_FUNDO = '#f0fdf4'
const COR_ASSINADO_TEXTO = '#15803d'

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

/**
 * Bloco de texto longo que FLUI por quantas páginas precisar (o pdfkit
 * pagina sozinho). Usado nas seções de texto corrido do RVT, onde cortar
 * com reticências perderia conteúdo do documento oficial.
 */
function blocoTextoFluido(doc: Doc, est: Estado, label: string, valor: string) {
  novaPaginaSeNecessario(doc, est, 48)
  doc
    .fillColor(COR_LABEL)
    .font('Helvetica-Bold')
    .fontSize(6)
    .text(label.toUpperCase(), LEFT + 4, est.y + 3, { width: CONTENT_W - 8 })
  doc
    .fillColor(COR_VALOR)
    .font('Helvetica')
    .fontSize(8.5)
    .text(valor || '—', LEFT + 4, est.y + 13, { width: CONTENT_W - 8 })
  // doc.y termina onde o texto parou — possivelmente em outra página.
  est.y = doc.y + 8
  doc
    .moveTo(LEFT, est.y - 4)
    .lineTo(RIGHT, est.y - 4)
    .strokeColor(COR_BORDA)
    .lineWidth(0.6)
    .stroke()
}

function cabecalho(
  doc: Doc,
  est: Estado,
  rnc: RncPdfData,
  docMeta: { titulo: string; codigo: string; versao?: string; emissao?: string } = {
    titulo: 'RELATÓRIO DE NÃO CONFORMIDADE (RNC)',
    codigo: 'FOR.IND.CQA.012',
  },
) {
  const h = 46
  // Moldura do cabeçalho
  doc.rect(LEFT, est.y, CONTENT_W, h).strokeColor(COR_BORDA).lineWidth(0.8).stroke()
  // Bloco do título (centro)
  doc
    .fillColor(COR_VALOR)
    .font('Helvetica-Bold')
    .fontSize(13)
    .text(docMeta.titulo, LEFT + 8, est.y + 10, {
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
    ['DOCUMENTO', docMeta.codigo],
    ['VERSÃO', docMeta.versao ?? '.003'],
    ['EMISSÃO', docMeta.emissao ?? '23/12/2025'],
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

type AssinaturaEntrada = {
  papel: string
  nome: string
  assinadoEm: Date | null
  ip?: string | null
  navegador?: string | null
  so?: string | null
  dispositivo?: string | null
  lat?: number | null
  lng?: number | null
  precisao?: number | null
}

const ALTURA_ASSINADO = 78
const ALTURA_PENDENTE = 44

/** Altura da caixa conforme assinada ou não. */
function alturaCaixa(e: AssinaturaEntrada): number {
  return e.assinadoEm ? ALTURA_ASSINADO : ALTURA_PENDENTE
}

function caixaAssinatura(
  doc: Doc,
  x: number,
  y: number,
  w: number,
  h: number,
  e: AssinaturaEntrada,
) {
  const assinado = !!e.assinadoEm

  // Assinada: destaque verde com selo; pendente: caixa neutra para firma.
  if (assinado) {
    doc.rect(x, y, w, h).fill(COR_ASSINADO_FUNDO)
    doc.rect(x, y, w, h).strokeColor(COR_ASSINADO_BORDA).lineWidth(1).stroke()
  } else {
    doc.rect(x, y, w, h).strokeColor(COR_BORDA).lineWidth(0.6).stroke()
  }

  doc
    .fillColor(COR_LABEL)
    .font('Helvetica-Bold')
    .fontSize(6.5)
    .text(e.papel.toUpperCase(), x + 4, y + 3, { width: w - 70 })

  if (assinado) {
    // Selo "ASSINADO" no canto superior direito.
    const pw = 44
    doc.roundedRect(x + w - pw - 4, y + 2.5, pw, 11, 3).fill(COR_ASSINADO_TEXTO)
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .text('ASSINADO', x + w - pw - 4, y + 5, { width: pw, align: 'center' })

    doc
      .fillColor(COR_VALOR)
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .text(e.nome, x + 4, y + 16, { width: w - 8, ellipsis: true })

    // Metadados da assinatura.
    let ly = y + 28
    const linha = (txt: string) => {
      doc
        .fillColor(COR_ASSINADO_TEXTO)
        .font('Helvetica')
        .fontSize(6.2)
        .text(txt, x + 4, ly, { width: w - 8, ellipsis: true })
      ly += 8.2
    }
    linha(`Assinado em ${fmtDataHora(e.assinadoEm)}`)
    if (e.ip || e.navegador) {
      linha([e.ip ? `IP ${e.ip}` : '', e.navegador].filter(Boolean).join(' · '))
    }
    if (e.so || e.dispositivo) {
      linha([e.so, fmtDispositivo(e.dispositivo)].filter(Boolean).join(' · '))
    }
    if (e.lat != null && e.lng != null) {
      const prec = e.precisao != null ? ` (±${Math.round(e.precisao)} m)` : ''
      linha(`Local ${e.lat.toFixed(5)}, ${e.lng.toFixed(5)}${prec}`)
    }
  } else {
    doc
      .fillColor(COR_VALOR)
      .font('Helvetica')
      .fontSize(7.5)
      .text('NOME:', x + 4, y + 22)
      .text('DATA:', x + 4, y + 33)
    doc
      .fillColor(COR_VALOR)
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .text(e.nome, x + 32, y + 22, { width: w - 40, ellipsis: true })
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
    { label: 'Situação', valor: fmtStatus(rnc.status), flex: 1 },
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

  let entradas: AssinaturaEntrada[]
  if (rnc.aprovadores.length > 0) {
    entradas = rnc.aprovadores.map((a) => ({
      papel: a.areaNome + (a.cargo ? ` — ${a.cargo}` : ''),
      nome: a.nome,
      assinadoEm: a.assinadoEm,
      ip: a.assinaturaIp,
      navegador: a.assinaturaNavegador,
      so: a.assinaturaSo,
      dispositivo: a.assinaturaDispositivo,
      lat: a.assinaturaLatitude,
      lng: a.assinaturaLongitude,
      precisao: a.assinaturaPrecisao,
    }))
  } else {
    // Sem matriz: papéis padrão do formulário, todos em branco.
    entradas = [
      'Conferente da Logística',
      'Gestão Logística',
      'Gestão PCP',
      'Controle de Qualidade',
      'Gestão Controle de Qualidade',
      'Gerente da Área',
    ].map((papel) => ({ papel, nome: '', assinadoEm: null }))
  }

  for (let i = 0; i < entradas.length; i += 2) {
    const a = entradas[i]
    const b = entradas[i + 1]
    const rowH = Math.max(alturaCaixa(a), b ? alturaCaixa(b) : 0)
    novaPaginaSeNecessario(doc, est, rowH + 4)
    caixaAssinatura(doc, LEFT, est.y, colW, rowH, a)
    if (b) caixaAssinatura(doc, LEFT + colW + 8, est.y, colW, rowH, b)
    est.y += rowH + 4
  }
}

/**
 * Monta o PDF do RAQ (Relatório de Alerta de Qualidade) no layout do
 * formulário FOR.IND.CQA.023. Não chama doc.end() — quem chama controla
 * o stream.
 */
export function montarRaqPdf(doc: Doc, raq: RncPdfData, fotos: RncPdfFoto[]) {
  const est: Estado = { y: MARGIN }

  cabecalho(doc, est, raq, {
    titulo: 'RELATÓRIO DE ALERTA DE QUALIDADE (RAQ)',
    codigo: 'FOR.IND.CQA.023',
  })

  // 1. Identificação
  tituloSecao(doc, est, '1. Identificação do RAQ')
  linhaCampos(doc, est, [
    { label: 'Unidade', valor: raq.filial ? `${raq.filial.codigo} — ${raq.filial.nome}` : '', flex: 2 },
    { label: 'Número sequencial', valor: raq.numero, flex: 1.2 },
    { label: 'Situação', valor: fmtStatus(raq.status), flex: 1 },
  ])
  linhaCampos(doc, est, [
    { label: 'Título da RAQ', valor: raq.titulo ?? '', flex: 3 },
    { label: 'Data de emissão', valor: fmtData(raq.createdAt ?? null), flex: 1 },
  ])

  // 2. RAQ's relacionados (reincidência)
  tituloSecao(doc, est, "2. RAQ's Relacionados")
  linhaCampos(
    doc,
    est,
    [
      { label: 'Reincidente', valor: raq.reincidente == null ? '' : raq.reincidente ? 'SIM' : 'NÃO', flex: 1 },
      { label: 'Se sim, quantas vezes?', valor: raq.reincidenteVezes != null ? String(raq.reincidenteVezes) : '', flex: 1 },
    ],
    22,
  )
  const relacionados = raq.raqRelacionados ?? []
  for (let i = 0; i < 3; i++) {
    const rel = relacionados[i]
    linhaCampos(
      doc,
      est,
      [
        { label: `RAQ relacionado ${i + 1} — número`, valor: rel?.numero ?? '', flex: 1.4 },
        { label: 'Título', valor: rel?.titulo ?? '', flex: 2 },
        { label: 'Data de emissão', valor: fmtData(rel?.createdAt ?? null), flex: 1 },
        { label: 'Item', valor: rel?.produto ? rel.produto.codigo : '', flex: 0.9 },
        { label: 'Lote', valor: rel?.lotes?.[0]?.numero ?? '', flex: 0.9 },
      ],
      22,
    )
  }

  // 3. Dados do fornecedor e material
  tituloSecao(doc, est, '3. Dados do Fornecedor e Material')
  linhaCampos(doc, est, [
    { label: 'Fornecedor', valor: raq.fornecedor ? `${raq.fornecedor.codigo} — ${raq.fornecedor.razaoSocial}` : '', flex: 2 },
    { label: 'CNPJ', valor: raq.fornecedor?.cnpj ?? '', flex: 1 },
  ])
  const lote = raq.lotes[0]
  linhaCampos(doc, est, [
    { label: 'Item (produto)', valor: raq.produto ? `${raq.produto.codigo} — ${raq.produto.descricao}` : '', flex: 2.4 },
    { label: 'Lote', valor: lote?.numero ?? '', flex: 1 },
  ])
  linhaCampos(doc, est, [
    { label: 'Quantidade do lote', valor: lote?.quantidade != null ? num(lote.quantidade) : '', flex: 1 },
    { label: 'Quantidade com defeito', valor: num(raq.quantidadeDefeito), flex: 1 },
    { label: 'Tempo de parada', valor: raq.tempoParadaMinutos != null ? `${num(raq.tempoParadaMinutos)} min` : '', flex: 1 },
    { label: 'Número NF', valor: raq.notasFiscais[0]?.numero ?? '', flex: 1 },
  ])
  const nf = raq.notasFiscais[0]
  linhaCampos(doc, est, [
    { label: 'Data de fabricação', valor: fmtData(nf?.dataFabricacao), flex: 1 },
    { label: 'Data de validade', valor: fmtData(nf?.dataValidade), flex: 1 },
    { label: 'Data de recebimento', valor: fmtData(nf?.dataRecebimento), flex: 1 },
    { label: 'Data da ocorrência', valor: fmtData(raq.dataIdentificacao), flex: 1 },
  ])
  linhaCampos(doc, est, [
    { label: 'Transportadora', valor: raq.transportador ?? '', flex: 2 },
    { label: 'Placa do cavalo', valor: raq.placaCavalo ?? '', flex: 1 },
    { label: 'Placa da carreta', valor: raq.placaCarreta ?? '', flex: 1 },
  ])
  linhaCampos(doc, est, [
    { label: 'Nome do motorista', valor: raq.nomeMotorista ?? '', flex: 2 },
    { label: 'Documento do motorista', valor: raq.cnhMotorista ?? '', flex: 1 },
  ])

  // 4. Disposição do material
  tituloSecao(doc, est, '4. Disposição do Material')
  blocoTexto(
    doc,
    est,
    'Disposição',
    raq.disposicaoMaterial ? `${raq.disposicaoMaterial.codigo} — ${raq.disposicaoMaterial.descricao}` : '',
    30,
  )

  // 5. Dados da não conformidade
  tituloSecao(doc, est, '5. Dados da Não Conformidade')
  linhaCampos(doc, est, [
    { label: 'Origem da NC', valor: raq.origem ? `${raq.origem.codigo} — ${raq.origem.nome}` : '', flex: 1 },
    { label: 'Severidade', valor: raq.severidade ? `Nível ${raq.severidade.nivel} — ${raq.severidade.nome}` : '', flex: 1 },
  ])
  blocoTexto(
    doc,
    est,
    'Defeito / problema identificado (descrição da ocorrência)',
    raq.descricaoDefeito ?? '',
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

  linhaCampos(doc, est, [
    { label: 'Emitente', valor: raq.criadoPor ? `${raq.criadoPor.nome} (${raq.criadoPor.email})` : '' },
  ], 22)
  blocoTexto(
    doc,
    est,
    'Observações complementares',
    raq.observacoesComplementares ?? '',
    40,
  )

  // 6. Assinaturas — aprovadores configurados para o tipo RAQ.
  tituloSecao(doc, est, '6. Assinaturas')
  const colW = (CONTENT_W - 8) / 2

  let entradas: AssinaturaEntrada[]
  if (raq.aprovadores.length > 0) {
    entradas = raq.aprovadores.map((a) => ({
      papel: a.areaNome + (a.cargo ? ` — ${a.cargo}` : ''),
      nome: a.nome,
      assinadoEm: a.assinadoEm,
      ip: a.assinaturaIp,
      navegador: a.assinaturaNavegador,
      so: a.assinaturaSo,
      dispositivo: a.assinaturaDispositivo,
      lat: a.assinaturaLatitude,
      lng: a.assinaturaLongitude,
      precisao: a.assinaturaPrecisao,
    }))
  } else {
    // Sem matriz: papéis padrão do formulário, em branco.
    entradas = [
      'Controle de Qualidade',
      'Gestão Controle de Qualidade',
    ].map((papel) => ({ papel, nome: '', assinadoEm: null }))
  }

  for (let i = 0; i < entradas.length; i += 2) {
    const a = entradas[i]
    const b = entradas[i + 1]
    const rowH = Math.max(alturaCaixa(a), b ? alturaCaixa(b) : 0)
    novaPaginaSeNecessario(doc, est, rowH + 4)
    caixaAssinatura(doc, LEFT, est.y, colW, rowH, a)
    if (b) caixaAssinatura(doc, LEFT + colW + 8, est.y, colW, rowH, b)
    est.y += rowH + 4
  }
}

/**
 * Monta o PDF do RVT (Relatório de Visita Técnica) no layout do
 * formulário do modelo. Não chama doc.end() — quem chama controla o
 * stream.
 */
export function montarRvtPdf(doc: Doc, rvt: RncPdfData, fotos: RncPdfFoto[]) {
  const est: Estado = { y: MARGIN }

  cabecalho(doc, est, rvt, {
    titulo: 'RELATÓRIO DE VISITA TÉCNICA (RVT)',
    codigo: 'FOR.IND.XXX.XXX',
    versao: '.001',
    emissao: '—',
  })

  // 1. Dados do fornecedor e produto
  tituloSecao(doc, est, '1. Dados do Fornecedor e Produto')
  linhaCampos(doc, est, [
    { label: 'Fornecedor', valor: rvt.fornecedor ? `${rvt.fornecedor.codigo} — ${rvt.fornecedor.razaoSocial}` : '', flex: 2 },
    { label: 'CNPJ', valor: rvt.fornecedor?.cnpj ?? '', flex: 1 },
  ])
  linhaCampos(doc, est, [
    { label: 'Produto', valor: rvt.produto ? `${rvt.produto.codigo} — ${rvt.produto.descricao}` : '', flex: 2 },
    { label: 'Data da visita', valor: fmtData(rvt.dataIdentificacao), flex: 0.8 },
    { label: 'Número', valor: rvt.numero, flex: 1 },
  ])
  linhaCampos(doc, est, [
    { label: 'Unidade', valor: rvt.filial ? `${rvt.filial.codigo} — ${rvt.filial.nome}` : '', flex: 2 },
    { label: 'Situação', valor: fmtStatus(rvt.status), flex: 1 },
  ])

  // 2. Informações gerais da visita técnica
  tituloSecao(doc, est, '2. Informações Gerais da Visita Técnica')
  linhaCampos(doc, est, [{ label: 'Pauta', valor: rvt.pauta ?? '' }], 26)
  const participantes = rvt.participantes ?? []
  for (let i = 0; i < 5; i++) {
    linhaCampos(
      doc,
      est,
      [
        {
          label: `Participante ${i + 1}`,
          valor: participantes[i]?.nome ?? '',
        },
      ],
      20,
    )
  }

  // 3. Fotos da visita técnica
  tituloSecao(doc, est, '3. Fotos da Visita Técnica')
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

  // 4. Assuntos abordados — texto corrido, sem corte: flui por quantas
  // páginas precisar.
  tituloSecao(doc, est, '4. Assuntos Abordados')
  blocoTextoFluido(doc, est, 'Assuntos abordados na visita', rvt.assuntosAbordados ?? '')

  // 5. Conclusão
  tituloSecao(doc, est, '5. Conclusão')
  blocoTextoFluido(doc, est, 'Conclusão da visita técnica', rvt.conclusao ?? '')
  linhaCampos(doc, est, [
    { label: 'Emitente', valor: rvt.criadoPor ? `${rvt.criadoPor.nome} (${rvt.criadoPor.email})` : '' },
  ], 22)

  // 6. Assinaturas — aprovadores configurados para o tipo RVT.
  tituloSecao(doc, est, '6. Assinaturas')
  const colW = (CONTENT_W - 8) / 2

  let entradas: AssinaturaEntrada[]
  if (rvt.aprovadores.length > 0) {
    entradas = rvt.aprovadores.map((a) => ({
      papel: a.areaNome + (a.cargo ? ` — ${a.cargo}` : ''),
      nome: a.nome,
      assinadoEm: a.assinadoEm,
      ip: a.assinaturaIp,
      navegador: a.assinaturaNavegador,
      so: a.assinaturaSo,
      dispositivo: a.assinaturaDispositivo,
      lat: a.assinaturaLatitude,
      lng: a.assinaturaLongitude,
      precisao: a.assinaturaPrecisao,
    }))
  } else {
    // Sem matriz: papéis padrão do formulário, em branco.
    entradas = [
      'Controle de Qualidade',
      'Gestão Controle de Qualidade',
      'Gerência Envase/Processo',
      'Representante Técnico',
    ].map((papel) => ({ papel, nome: '', assinadoEm: null }))
  }

  for (let i = 0; i < entradas.length; i += 2) {
    const a = entradas[i]
    const b = entradas[i + 1]
    const rowH = Math.max(alturaCaixa(a), b ? alturaCaixa(b) : 0)
    novaPaginaSeNecessario(doc, est, rowH + 4)
    caixaAssinatura(doc, LEFT, est.y, colW, rowH, a)
    if (b) caixaAssinatura(doc, LEFT + colW + 8, est.y, colW, rowH, b)
    est.y += rowH + 4
  }
}
