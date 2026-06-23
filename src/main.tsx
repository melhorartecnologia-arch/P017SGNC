import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from '@/lib/auth/AuthContext'
import { AssinaturaPage } from '@/components/assinatura/AssinaturaPage'

// Link mágico de assinatura (?assinar=<token>): página pública, sem login.
const tokenAssinatura = new URLSearchParams(window.location.search).get(
  'assinar',
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {tokenAssinatura ? (
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
