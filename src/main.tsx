import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from '@/lib/auth/AuthContext'
import { AssinaturaPage } from '@/components/assinatura/AssinaturaPage'
import { CienciaFornecedorPage } from '@/components/ciencia/CienciaFornecedorPage'

// Links públicos por token, sem login:
//   ?assinar=<token>  → assinatura do aprovador
//   ?ciencia=<token>  → ciência do fornecedor (aceitar ou recusar)
const params = new URLSearchParams(window.location.search)
const tokenAssinatura = params.get('assinar')
const tokenCiencia = params.get('ciencia')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {tokenCiencia ? (
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
