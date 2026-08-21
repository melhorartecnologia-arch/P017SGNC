import type { Response } from 'express'
import PDFDocument from 'pdfkit'
import path from 'node:path'
import fs from 'node:fs/promises'
import { prisma } from '../db.js'
import {
  montarRncPdf,
  montarRaqPdf,
  montarRvtPdf,
  type RncPdfData,
  type RncPdfFoto,
} from './rnc-pdf.js'
import { selecionarAprovadores } from './rnc-aprovadores.js'

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'rnc-fotos')
const IMAGENS_PDF = ['image/jpeg', 'image/jpg', 'image/png']

const pdfInclude = {
  participantes: {
    select: { ordem: true, nome: true },
    orderBy: { ordem: 'asc' },
  },
  raqRelacionados: {
    select: {
      numero: true,
      titulo: true,
      createdAt: true,
      produto: { select: { codigo: true, descricao: true } },
      lotes: { select: { numero: true }, orderBy: { createdAt: 'asc' } },
    },
  },
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
 * Carrega o documento com tudo que o PDF precisa (fotos em buffer e a
 * matriz calculada quando ausente). Retorna null se não existir.
 */
async function carregarParaPdf(rncId: string): Promise<{
  rnc: RncPdfData & { id: string; numero: string; tipoDocumento: string }
  fotos: RncPdfFoto[]
} | null> {
  const rnc = await prisma.relatorioNaoConformidade.findUnique({
    where: { id: rncId },
    include: pdfInclude,
  })
  if (!rnc) return null

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

  // Documentos antigos sem matriz: calcula na hora (sem persistir).
  let aprovadores = rnc.aprovadores
  if (aprovadores.length === 0) {
    aprovadores = (
      await selecionarAprovadores(
        prisma,
        rnc.filialId,
        rnc.turnoId,
        rnc.tipoDocumento,
      )
    ).map((a) => ({
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
    }))
  }

  return {
    rnc: { ...rnc, aprovadores } as unknown as RncPdfData & {
      id: string
      numero: string
      tipoDocumento: string
    },
    fotos,
  }
}

/** Cria o PDFDocument com as propriedades do tipo (RNC, RAQ ou RVT). */
function criarDocumento(numero: string, tipoDocumento: string) {
  const props: Record<string, { title: string; subject: string; keywords: string }> = {
    RNC: {
      title: `RNC ${numero} — Relatório de Não Conformidade`,
      subject: 'Relatório de Não Conformidade (FOR.IND.CQA.012)',
      keywords: 'RNC, não conformidade, qualidade',
    },
    RAQ: {
      title: `RAQ ${numero} — Relatório de Alerta de Qualidade`,
      subject: 'Relatório de Alerta de Qualidade (FOR.IND.CQA.023)',
      keywords: 'RAQ, alerta de qualidade, qualidade',
    },
    RVT: {
      title: `RVT ${numero} — Relatório de Visita Técnica`,
      subject: 'Relatório de Visita Técnica',
      keywords: 'RVT, visita técnica, fornecedor, qualidade',
    },
  }
  const p = props[tipoDocumento] ?? props.RNC
  return new PDFDocument({
    size: 'A4',
    margin: 28,
    lang: 'pt-BR',
    info: {
      Title: p.title,
      Author: 'SGNC — Cervejaria Cidade Imperial',
      Subject: p.subject,
      Creator: 'SGNC — Sistema de Gestão de Não Conformidade',
      Producer: 'SGNC — Cervejaria Cidade Imperial',
      Keywords: p.keywords,
    },
  })
}

/**
 * Gera o PDF do documento (RNC ou RAQ) e o envia na resposta.
 * `disposition` controla se o navegador baixa ('attachment') ou exibe
 * embutido ('inline'). Retorna false quando o documento não existe.
 */
export async function streamRncPdf(
  rncId: string,
  res: Response,
  disposition: 'attachment' | 'inline' = 'attachment',
): Promise<boolean> {
  const carga = await carregarParaPdf(rncId)
  if (!carga) return false
  const { rnc, fotos } = carga

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="${rnc.tipoDocumento}-${rnc.numero}.pdf"`,
  )

  const doc = criarDocumento(rnc.numero, rnc.tipoDocumento)
  doc.pipe(res)
  if (rnc.tipoDocumento === 'RAQ') montarRaqPdf(doc, rnc, fotos)
  else if (rnc.tipoDocumento === 'RVT') montarRvtPdf(doc, rnc, fotos)
  else montarRncPdf(doc, rnc, fotos)
  doc.end()
  return true
}

/**
 * Gera o PDF do documento em memória (para anexos de e-mail). Retorna
 * null quando o documento não existe.
 */
export async function gerarPdfBuffer(rncId: string): Promise<Buffer | null> {
  const carga = await carregarParaPdf(rncId)
  if (!carga) return null
  const { rnc, fotos } = carga

  const doc = criarDocumento(rnc.numero, rnc.tipoDocumento)
  const chunks: Buffer[] = []
  const pronto = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
  if (rnc.tipoDocumento === 'RAQ') montarRaqPdf(doc, rnc, fotos)
  else if (rnc.tipoDocumento === 'RVT') montarRvtPdf(doc, rnc, fotos)
  else montarRncPdf(doc, rnc, fotos)
  doc.end()
  return pronto
}
