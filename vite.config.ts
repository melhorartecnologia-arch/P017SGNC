import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { execSync } from 'node:child_process'

// Padrão de versionamento: v<ano>.<mês>.<dia>-<hora><min>-<hash do commit>
// (ex.: v2026.06.26-1432-3bb3f45). Gerado no build a partir do último
// commit. A data/hora é sempre convertida para o horário de Brasília
// (America/Sao_Paulo), independentemente do fuso da máquina de build.
function versaoDoGit(): { codigo: string; dataHora: string } {
  try {
    const saida = execSync('git log -1 --format="%h|%cI"', {
      encoding: 'utf8',
    }).trim()
    const [hash, iso] = saida.split('|')
    // %cI traz o instante do commit com o fuso do committer; new Date o
    // interpreta como instante absoluto e o Intl o exibe em Brasília.
    const partes = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(iso))
    const p = (t: string) => partes.find((x) => x.type === t)?.value ?? ''
    const a = p('year')
    const m = p('month')
    const d = p('day')
    const hora = p('hour')
    const min = p('minute')
    return {
      codigo: `v${a}.${m}.${d}-${hora}${min}-${hash}`,
      dataHora: `${d}/${m}/${a} ${hora}:${min}`,
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
