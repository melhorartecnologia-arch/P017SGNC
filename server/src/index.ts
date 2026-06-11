import express from 'express'
import cors from 'cors'
import { env } from './env.js'
import { prisma } from './db.js'
import { errorHandler } from './middleware/error.js'
import { requireAuth } from './middleware/auth.js'
import { authRouter } from './routes/auth.js'
import { usuariosRouter } from './routes/usuarios.js'
import { filiaisRouter } from './routes/filiais.js'
import { fornecedoresRouter } from './routes/fornecedores.js'
import { areasRouter } from './routes/areas.js'
import { aprovadoresRouter } from './routes/aprovadores.js'
import { severidadesRouter } from './routes/severidades.js'
import { origensRouter } from './routes/origens-nao-conformidade.js'
import { disposicoesRouter } from './routes/disposicoes-material.js'
import { tiposRelatorioRouter } from './routes/tipos-relatorio.js'
import { produtosRouter } from './routes/produtos.js'
import { tiposNaoConformidadeRouter } from './routes/tipos-nao-conformidade.js'
import { turnosTrabalhoRouter } from './routes/turnos-trabalho.js'
import { politicasRespostaRouter } from './routes/politicas-resposta.js'
import { rncRouter } from './routes/rnc.js'
import { iaRouter } from './routes/ia.js'
import { configuracoesRouter } from './routes/configuracoes.js'

const app = express()

app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))
app.use(express.json({ limit: '1mb' }))

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', db: 'up', timestamp: new Date().toISOString() })
  } catch {
    res.status(503).json({ status: 'degraded', db: 'down' })
  }
})

app.use('/api/auth', authRouter)

app.use('/api/usuarios', requireAuth, usuariosRouter)
app.use('/api/filiais', requireAuth, filiaisRouter)
app.use('/api/fornecedores', requireAuth, fornecedoresRouter)
app.use('/api/areas', requireAuth, areasRouter)
app.use('/api/aprovadores', requireAuth, aprovadoresRouter)
app.use('/api/severidades', requireAuth, severidadesRouter)
app.use('/api/origens-nao-conformidade', requireAuth, origensRouter)
app.use('/api/disposicoes-material', requireAuth, disposicoesRouter)
app.use('/api/tipos-relatorio', requireAuth, tiposRelatorioRouter)
app.use('/api/produtos', requireAuth, produtosRouter)
app.use('/api/tipos-nao-conformidade', requireAuth, tiposNaoConformidadeRouter)
app.use('/api/turnos-trabalho', requireAuth, turnosTrabalhoRouter)
app.use('/api/politicas-resposta', requireAuth, politicasRespostaRouter)
app.use('/api/rnc', requireAuth, rncRouter)
app.use('/api/ia', requireAuth, iaRouter)
app.use('/api/configuracoes', requireAuth, configuracoesRouter)

app.use((_req, res) => {
  res.status(404).json({ error: 'NotFoundError', message: 'Rota não encontrada' })
})

app.use(errorHandler)

async function start() {
  try {
    await prisma.$connect()
    console.log('SGNC API: conexão com Postgres OK.')
  } catch (err) {
    console.error('SGNC API: não consegui conectar no Postgres.')
    console.error('Verifique se o Postgres está rodando e se DATABASE_URL em')
    console.error('server/.env aponta para um banco existente (ex.: createdb sgnc).')
    console.error(err)
    process.exit(1)
  }

  app.listen(env.PORT, () => {
    console.log(`SGNC API rodando em http://localhost:${env.PORT}`)
  })
}

start()
