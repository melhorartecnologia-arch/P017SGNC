import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { execSync } from 'node:child_process'

// Padrão de versionamento: v<ano>.<mês>.<dia>-<hora><min>-<hash do commit>
// (ex.: v2026.06.26-1432-3bb3f45). Gerado no build a partir do último
// commit; a data/hora vem do fuso do committer (extraída direto do ISO,
// sem depender do fuso da máquina de build).
function versaoDoGit(): { codigo: string; dataHora: string } {
  try {
    const saida = execSync('git log -1 --format="%h|%cI"', {
      encoding: 'utf8',
    }).trim()
    const [hash, iso] = saida.split('|')
    const dia = iso.slice(0, 10) // AAAA-MM-DD
    const hora = iso.slice(11, 16) // HH:MM
    const [a, m, d] = dia.split('-')
    return {
      codigo: `v${a}.${m}.${d}-${hora.replace(':', '')}-${hash}`,
      dataHora: `${d}/${m}/${a} ${hora}`,
    }
  } catch {
    return { codigo: 'dev', dataHora: '' }
  }
}

const versao = versaoDoGit()

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSAO__: JSON.stringify(versao.codigo),
    __APP_VERSAO_DATA__: JSON.stringify(versao.dataHora),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3333',
        changeOrigin: true,
      },
    },
  },
})
