import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from '@/lib/auth/AuthContext'
import { AssinaturaPage } from '@/components/assinatura/AssinaturaPage'
import { CienciaFornecedorPage } from '@/components/ciencia/CienciaFornecedorPage'
import { AnaliseRecusaPage } from '@/components/ciencia/AnaliseRecusaPage'

// Links públicos por token, sem login:
//   ?assinar=<token>  → assinatura do aprovador
//   ?ciencia=<token>  → ciência do fornecedor (aceitar ou recusar)
//   ?analise=<token>  → análise da recusa pelo aprovador marcado
const params = new URLSearchParams(window.location.search)
const tokenAssinatura = params.get('assinar')
const tokenCiencia = params.get('ciencia')
const tokenAnalise = params.get('analise')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {tokenAnalise ? (
      <>
        <AnaliseRecusaPage token={tokenAnalise} />
        <Toaster position="top-right" richColors closeButton />
      </>
    ) : tokenCiencia ? (
      <>
        <CienciaFornecedorPage token={tokenCiencia} />
        <Toaster position="top-right" richColors closeButton />
      </>
    ) : tokenAssinatura ? (
      <>
        <AssinaturaPage token={tokenAssinatura} />
        <Toaster position="top-right" richColors closeButton />
      </>
    ) : (
      <AuthProvider>
        <App />
      </AuthProvider>
    )}
  </StrictMode>,
)
