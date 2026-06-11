import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL ?? 'admin@sgnc.local').toLowerCase()
  const adminSenha = process.env.ADMIN_PASSWORD ?? 'admin123'
  const adminNome = process.env.ADMIN_NOME ?? 'Administrador'
  const existeAdmin = await prisma.usuario.findUnique({ where: { email: adminEmail } })
  if (!existeAdmin) {
    await prisma.usuario.create({
      data: {
        email: adminEmail,
        senhaHash: await bcrypt.hash(adminSenha, 10),
        nome: adminNome,
        role: 'ADMIN',
        ativo: true,
      },
    })
    console.log(`[seed] usuário admin criado: ${adminEmail}`)
  }

  // Filial tem unique tanto em `codigo` quanto em `cnpj`. Casar por um dos
  // dois evita P2002 quando já existe uma linha com o mesmo cnpj mas codigo
  // diferente (ou vice-versa).
  const filialCodigo = 'MATRIZ'
  const filialCnpj = '00.000.000/0001-00'
  const filialData = {
    codigo: filialCodigo,
    nome: 'Matriz Petrópolis',
    razaoSocial: 'Cervejaria Cidade Imperial Ltda.',
    cnpj: filialCnpj,
    endereco: 'Rua da Cervejaria',
    numero: '1000',
    bairro: 'Centro',
    cidade: 'Petrópolis',
    uf: 'RJ',
    cep: '25600-000',
    ativo: true,
  }
  const filialExistente = await prisma.filial.findFirst({
    where: { OR: [{ codigo: filialCodigo }, { cnpj: filialCnpj }] },
  })
  if (filialExistente) {
    await prisma.filial.update({
      where: { id: filialExistente.id },
      data: filialData,
    })
  } else {
    await prisma.filial.create({ data: filialData })
  }

  const areas = [
    { codigo: 'PROD', nome: 'Produção' },
    { codigo: 'QUAL', nome: 'Qualidade' },
    { codigo: 'MANUT', nome: 'Manutenção' },
    { codigo: 'LOG', nome: 'Logística' },
    { codigo: 'COMERCIAL', nome: 'Comercial' },
  ]
  for (const a of areas) {
    await prisma.area.upsert({
      where: { codigo: a.codigo },
      update: {},
      create: { ...a, ativo: true },
    })
  }

  const severidades = [
    { codigo: 'BAIXA', nome: 'Baixa', nivel: 1, cor: '#22c55e' },
    { codigo: 'MEDIA', nome: 'Média', nivel: 2, cor: '#eab308' },
    { codigo: 'ALTA', nome: 'Alta', nivel: 3, cor: '#f97316' },
    { codigo: 'CRITICA', nome: 'Crítica', nivel: 4, cor: '#dc2626' },
  ]
  for (const s of severidades) {
    // Severidade has unique constraints on both `codigo` and `nivel`, so an
    // upsert keyed only by codigo would fail if a row already exists with the
    // same nivel but a different codigo. Match by either key, then update or
    // create accordingly.
    const existente = await prisma.severidade.findFirst({
      where: { OR: [{ codigo: s.codigo }, { nivel: s.nivel }] },
    })
    if (existente) {
      await prisma.severidade.update({
        where: { id: existente.id },
        data: { ...s, ativo: true },
      })
    } else {
      await prisma.severidade.create({
        data: { ...s, ativo: true },
      })
    }
  }

  const origens = [
    { codigo: 'AUDITORIA', nome: 'Auditoria' },
    { codigo: 'CLIENTE', nome: 'Reclamação de cliente' },
    { codigo: 'FORNECEDOR', nome: 'Falha de fornecedor' },
    { codigo: 'INSPECAO', nome: 'Inspeção de qualidade' },
    { codigo: 'PROCESSO', nome: 'Processo produtivo' },
    { codigo: 'LABORATORIO', nome: 'Análise laboratorial' },
  ]
  for (const o of origens) {
    await prisma.origemNaoConformidade.upsert({
      where: { codigo: o.codigo },
      update: {},
      create: { ...o, ativo: true },
    })
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
