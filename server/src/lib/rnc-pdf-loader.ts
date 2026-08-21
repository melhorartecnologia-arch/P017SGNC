import type { Response } from 'express'
import PDFDocument from 'pdfkit'
import path from 'node:path'
import fs from 'node:fs/promises'
import { prisma } from '../db.js'
import { montarRncPdf, type RncPdfData, type RncPdfFoto } from './rnc-pdf.js'
import { selecionarAprovadores } from './rnc-aprovadores.js'

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'rnc-fotos')
const IMAGENS_PDF = ['image/jpeg', 'image/jpg', 'image/png']

const pdfInclude = {
  filial: { select: { id: true, codigo: true, nome: true } },
  fornecedor: { select: { id: true, codigo: true, razaoSocial: true, cnpj: true } },
  tipoNaoConformidade: { select: { id: true, codigo: true, descricao: true } },
  turno: { select: { id: true, codigo: true, nome: true } },
  disposicaoMaterial: { select: { id: true, codigo: true, descricao: true } },
  origem: { select: { id: true, codigo: true, nome: true } },
  severidade: { select: { id: true, codigo: true, nome: true, nivel: true, cor: true } },
  produto: { select: { id: true, codigo: true, descricao: true, unidadeMedida: true } },
  criadoPor: { select: { id: true, nome: true, email: true } },
  lotes: { select: { numero: true, quantidade: true }, orderBy: { createdAt: 'asc' } },
  notasFiscais: {
    select: { numero: true, dataFabricacao: true, dataValidade: true, dataRecebimento: true },
    orderBy: { createdAt: 'asc' },
  },
  fotos: { select: { filename: true, mimeType: true, legenda: true }, orderBy: { createdAt: 'asc' } },
  aprovadores: {
    select: {
      areaNome: true,
      nome: true,
      cargo: true,
      assinadoEm: true,
      nivel: true,
      email: true,
      aprovadorId: true,
      assinaturaIp: true,
      assinaturaNavegador: true,
      assinaturaSo: true,
      assinaturaDispositivo: true,
      assinaturaLatitude: true,
      assinaturaLongitude: true,
      assinaturaPrecisao: true,
    },
    orderBy: { areaNome: 'asc' },
  },
} as const

/**
 * Gera o PDF da RNC e o envia na resposta. `disposition` controla se o
 * navegador baixa ('attachment') ou exibe embutido ('inline'). Retorna
 * false quando a RNC não existe (o chamador trata o 404).
 */
export async function streamRncPdf(
  rncId: string,
  res: Response,
  disposition: 'attachment' | 'inline' = 'attachment',
): Promise<boolean> {
  const rnc = await prisma.relatorioNaoConformidade.findUnique({
    where: { id: rncId },
    include: pdfInclude,
  })
  if (!rnc) return false

  const fotos: RncPdfFoto[] = []
  for (const f of rnc.fotos) {
    if (!IMAGENS_PDF.includes(f.mimeType)) continue
    try {
      const buffer = await fs.readFile(path.join(UPLOAD_DIR, f.filename))
      fotos.push({ legenda: f.legenda, mimeType: f.mimeType, buffer })
    } catch {
      // arquivo ausente — ignora
    }
  }

  // RNCs antigos sem matriz: calcula na hora (sem persistir).
  let aprovadores = rnc.aprovadores
  if (aprovadores.length === 0) {
    aprovadores = (await selecionarAprovadores(prisma, rnc.filialId, rnc.turnoId)).map(
      (a) => ({
        aprovadorId: a.aprovadorId,
        areaNome: a.areaNome,
        nome: a.nome,
        cargo: a.cargo,
        email: a.email,
        nivel: a.nivel,
        assinadoEm: null,
        assinaturaIp: null,
        assinaturaNavegador: null,
        assinaturaSo: null,
        assinaturaDispositivo: null,
        assinaturaLatitude: null,
        assinaturaLongitude: null,
        assinaturaPrecisao: null,
      }),
    )
  }

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="RNC-${rnc.numero}.pdf"`,
  )

  // Propriedades do arquivo em português (aparecem na aba do navegador e
  // em "Propriedades do documento" no leitor de PDF).
  const doc = new PDFDocument({
    size: 'A4',
    margin: 28,
    lang: 'pt-BR',
    info: {
      Title: `RNC ${rnc.numero} — Relatório de Não Conformidade`,
      Author: 'SGNC — Cervejaria Cidade Imperial',
      Subject: 'Relatório de Não Conformidade (FOR.IND.CQA.012)',
      Creator: 'SGNC — Sistema de Gestão de Não Conformidade',
      Producer: 'SGNC — Cervejaria Cidade Imperial',
      Keywords: 'RNC, não conformidade, qualidade',
    },
  })
  doc.pipe(res)
  montarRncPdf(doc, { ...rnc, aprovadores } as unknown as RncPdfData, fotos)
  doc.end()
  return true
}
