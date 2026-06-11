#!/usr/bin/env node
// Pré-checagens antes do bootstrap/start da API.
// - Copia .env.example -> .env se faltar.
// - Imprime mensagens claras sobre o que o usuário precisa fazer.

import { existsSync, copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const serverDir = resolve(here, '..')
const envPath = resolve(serverDir, '.env')
const examplePath = resolve(serverDir, '.env.example')

if (!existsSync(envPath)) {
  if (!existsSync(examplePath)) {
    console.error('[setup] server/.env.example não encontrado.')
    process.exit(1)
  }
  copyFileSync(examplePath, envPath)
  console.log('[setup] server/.env criado a partir do .env.example.')
  console.log('[setup] Ajuste DATABASE_URL se o seu Postgres não estiver em')
  console.log('[setup]   postgresql://postgres:postgres@localhost:5432/sgnc')
}
