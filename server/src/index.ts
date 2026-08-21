import express from 'express'
import cors from 'cors'
import { env } from './env.js'
import { prisma } from './db.js'
import { processarWorkflows } from './lib/rnc-workflow.js'
import {
  processarCienciaFornecedor,
  processarAlertasContingencia,
  processarVerificacaoEficacia,
} from './lib/rnc-ciencia.js'
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
import { raqRouter } from './routes/raq.js'
import { rvtRouter } from './routes/rvt.js'
import { iaRouter } from './routes/ia.js'
import { configuracoesRouter } from './routes/configuracoes.js'
import { dashboardRouter } from './routes/dashboard.js'
import { assinaturaRouter } from './routes/assinatura.js'
import { cienciaRouter } from './routes/ciencia.js'

const app = express()

// Atrás de proxy/balanceador: confia no X-Forwarded-* para obter o IP real.
app.set('trust proxy', true)

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
// Acesso público por token (link mágico de assinatura por e-mail).
app.use('/api/assinatura', assinaturaRouter)
app.use('/api/ciencia', cienciaRouter)

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
app.use('/api/raq', requireAuth, raqRouter)
app.use('/api/rvt', requireAuth, rvtRouter)
app.use('/api/ia', requireAuth, iaRouter)
app.use('/api/configuracoes', requireAuth, configuracoesRouter)
app.use('/api/dashboard', requireAuth, dashboardRouter)

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

  // Agendador do SLA de assinatura: lembretes (50%) e escalonamento (100%).
  const TICK_MS = 10 * 60 * 1000 // a cada 10 min
  const tick = async () => {
    try {
      const r = await processarWorkflows(prisma)
      if (r.lembretesEnviados || r.escalonamentos) {
        console.log(
          `SGNC workflow: ${r.lembretesEnviados} lembrete(s), ${r.escalonamentos} escalonamento(s).`,
        )
      }
    } catch (err) {
      console.error('SGNC workflow: falha ao processar SLA.', err)
    }
    // Ciência do fornecedor: aceite automático por decurso do prazo. Roda
    // separado do SLA de assinatura, que sai antes se não houver política
    // de resposta configurada.
    try {
      const c = await processarCienciaFornecedor(prisma)
      if (c.aceitesAutomaticos) {
        console.log(
          `SGNC ciência: ${c.aceitesAutomaticos} aceite(s) automático(s) por decurso de prazo.`,
        )
      }
    } catch (err) {
      console.error('SGNC ciência: falha ao processar o prazo.', err)
    }
    // Ações de contingência: cobra o fornecedor depois de vencido o prazo,
    // na cadência de alertas por dia definida nos parâmetros do workflow.
    try {
      const a = await processarAlertasContingencia(prisma)
      if (a.alertasEnviados) {
        console.log(
          `SGNC contingência: ${a.alertasEnviados} alerta(s) de ações em atraso.`,
        )
      }
    } catch (err) {
      console.error('SGNC contingência: falha ao processar os alertas.', err)
    }
    // Eficácia: libera as verificações cujo tempo de espera acabou e
    // avisa os aprovadores marcados.
    try {
      const e = await processarVerificacaoEficacia(prisma)
      if (e.liberadas) {
        console.log(
          `SGNC eficácia: ${e.liberadas} verificação(ões) liberada(s).`,
        )
      }
    } catch (err) {
      console.error('SGNC eficácia: falha ao liberar as verificações.', err)
    }
  }
  setTimeout(tick, 30_000) // primeiro tick logo após subir
  setInterval(tick, TICK_MS)
}

start()
