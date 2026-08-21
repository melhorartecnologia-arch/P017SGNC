import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Toaster } from 'sonner'
import { AppSidebar, CADASTRO_KEYS } from '@/components/dashboard/AppSidebar'
import { TopBar } from '@/components/dashboard/TopBar'
import { UnderConstruction } from '@/components/dashboard/UnderConstruction'
import { FilialPage } from '@/components/cadastros/FilialPage'
import { FornecedorPage } from '@/components/cadastros/FornecedorPage'
import { AreaPage } from '@/components/cadastros/AreaPage'
import { AprovadorPage } from '@/components/cadastros/AprovadorPage'
import { SeveridadePage } from '@/components/cadastros/SeveridadePage'
import { OrigemPage } from '@/components/cadastros/OrigemPage'
import { DisposicaoPage } from '@/components/cadastros/DisposicaoPage'
import { ProdutoPage } from '@/components/cadastros/ProdutoPage'
import { TipoNaoConformidadePage } from '@/components/cadastros/TipoNaoConformidadePage'
import { TipoRelatorioPage } from '@/components/cadastros/TipoRelatorioPage'
import { TurnoTrabalhoPage } from '@/components/cadastros/TurnoTrabalhoPage'
import { PoliticaRespostaPage } from '@/components/cadastros/PoliticaRespostaPage'
import { UsuarioPage } from '@/components/cadastros/UsuarioPage'
import { SmtpConfigPage } from '@/components/configuracoes/SmtpConfigPage'
import { WorkflowConfigPage } from '@/components/configuracoes/WorkflowConfigPage'
import { LoginPage } from '@/components/auth/LoginPage'
import { RncWizard } from '@/components/registros/RncWizard'
import { RncListPage } from '@/components/registros/RncListPage'
import { RaqListPage } from '@/components/registros/RaqListPage'
import { RaqWizard } from '@/components/registros/RaqWizard'
import { RvtListPage } from '@/components/registros/RvtListPage'
import { RvtWizard } from '@/components/registros/RvtWizard'
import { RheListPage } from '@/components/registros/RheListPage'
import { RheWizard } from '@/components/registros/RheWizard'
import { WorkflowAssinaturasPage } from '@/components/registros/WorkflowAssinaturasPage'
import { DashboardPage } from '@/components/dashboard/DashboardPage'
import { useAuth } from '@/lib/auth/AuthContext'

function App() {
  const auth = useAuth()
  const [activeKey, setActiveKey] = useState('dashboard')
  const [activeLabel, setActiveLabel] = useState('Painel Principal')
  const [rncWizardOpen, setRncWizardOpen] = useState(false)
  const [raqWizardOpen, setRaqWizardOpen] = useState(false)
  const [rvtWizardOpen, setRvtWizardOpen] = useState(false)
  const [rheWizardOpen, setRheWizardOpen] = useState(false)

  if (auth.status === 'loading') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    )
  }

  if (auth.status === 'unauthenticated') {
    return (
      <>
        <LoginPage />
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{ duration: 3500 }}
        />
      </>
    )
  }

  const handleSelect = (key: string, label: string) => {
    setActiveKey(key)
    setActiveLabel(label)
  }

  const handleCreateRelatorio = (
    key: string,
    sigla: string,
    label: string,
  ) => {
    if (key === 'rnc') {
      setRncWizardOpen(true)
      return
    }
    if (key === 'raq') {
      setRaqWizardOpen(true)
      return
    }
    if (key === 'rvt') {
      setRvtWizardOpen(true)
      return
    }
    if (key === 'rhe') {
      setRheWizardOpen(true)
      return
    }
    // Demais tipos ainda não têm wizard — caem na tela "Em construção".
    setActiveKey(`registro-${key}`)
    setActiveLabel(`${sigla} — ${label}`)
  }

  const isCadastro = CADASTRO_KEYS.has(activeKey)
  const isRegistro = activeKey.startsWith('registro-')
  const isFilial = activeKey === 'cad-filial'
  const isFornecedor = activeKey === 'cad-fornecedor'
  const isArea = activeKey === 'cad-area'
  const isAprovador = activeKey === 'cad-aprovador'
  const isSeveridade = activeKey === 'cad-severidade'
  const isOrigem = activeKey === 'cad-origem'
  const isDisposicao = activeKey === 'cad-disposicao'
  const isProduto = activeKey === 'cad-produto'
  const isTipoNc = activeKey === 'cad-tipo-nc'
  const isTipoRelatorio = activeKey === 'cad-tipo-relatorio'
  const isTurno = activeKey === 'cad-turno'
  const isPoliticaResposta = activeKey === 'cad-politica-resposta'
  const isUsuario = activeKey === 'cad-usuario' && auth.user.role === 'ADMIN'
  const isSmtpConfig = activeKey === 'cfg-smtp' && auth.user.role === 'ADMIN'
  const isWorkflowConfig =
    activeKey === 'cfg-workflow' && auth.user.role === 'ADMIN'
  const isRncList = activeKey === 'rnc-list'
  const isRaqList = activeKey === 'raq-list'
  const isRvtList = activeKey === 'rvt-list'
  const isRheList = activeKey === 'rhe-list'
  const isWorkflows = activeKey === 'workflows-assinatura'
  const isDashboard = activeKey === 'dashboard'

  let pageTitle = activeLabel
  if (isFilial) pageTitle = 'Cadastro de Filial'
  else if (isFornecedor) pageTitle = 'Cadastro de Fornecedor'
  else if (isArea) pageTitle = 'Cadastro de Área'
  else if (isAprovador) pageTitle = 'Cadastro de Aprovador'
  else if (isSeveridade) pageTitle = 'Cadastro de Severidade'
  else if (isOrigem) pageTitle = 'Cadastro de Origem da Não Conformidade'
  else if (isDisposicao) pageTitle = 'Cadastro de Disposição do Material'
  else if (isProduto) pageTitle = 'Cadastro de Produtos'
  else if (isTipoNc) pageTitle = 'Cadastro de Tipos de Não Conformidade'
  else if (isTipoRelatorio) pageTitle = 'Cadastro de Tipos de Relatórios'
  else if (isTurno) pageTitle = 'Cadastro de Turnos de Trabalho'
  else if (isPoliticaResposta) pageTitle = 'Cadastro de Políticas de Resposta'
  else if (isUsuario) pageTitle = 'Cadastro de Usuários'
  else if (isSmtpConfig) pageTitle = 'Configurações — Servidor de E-mail (SMTP)'
  else if (isWorkflowConfig) pageTitle = 'Configurações — Prazos do Fornecedor'
  else if (isRncList) pageTitle = 'Relatórios de Não Conformidade'
  else if (isRaqList) pageTitle = 'Relatórios de Alerta de Qualidade'
  else if (isRvtList) pageTitle = 'Relatórios de Visita Técnica'
  else if (isWorkflows) pageTitle = 'Workflows de Assinatura'
  else if (isCadastro) pageTitle = `Cadastro de ${activeLabel}`
  else if (isRegistro) pageTitle = activeLabel

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white text-neutral-900">
      <AppSidebar
        activeKey={activeKey}
        onSelect={handleSelect}
        onCreateRelatorio={handleCreateRelatorio}
      />
      <RncWizard open={rncWizardOpen} onOpenChange={setRncWizardOpen} />
      <RaqWizard open={raqWizardOpen} onOpenChange={setRaqWizardOpen} />
      <RvtWizard open={rvtWizardOpen} onOpenChange={setRvtWizardOpen} />
      <RheWizard open={rheWizardOpen} onOpenChange={setRheWizardOpen} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={pageTitle} />
        <main className="flex flex-1 flex-col overflow-y-auto bg-white">
          {isFilial ? (
            <FilialPage />
          ) : isFornecedor ? (
            <FornecedorPage />
          ) : isArea ? (
            <AreaPage />
          ) : isAprovador ? (
            <AprovadorPage />
          ) : isSeveridade ? (
            <SeveridadePage />
          ) : isOrigem ? (
            <OrigemPage />
          ) : isDisposicao ? (
            <DisposicaoPage />
          ) : isProduto ? (
            <ProdutoPage />
          ) : isTipoNc ? (
            <TipoNaoConformidadePage />
          ) : isTipoRelatorio ? (
            <TipoRelatorioPage />
          ) : isTurno ? (
            <TurnoTrabalhoPage />
          ) : isPoliticaResposta ? (
            <PoliticaRespostaPage />
          ) : isUsuario ? (
            <UsuarioPage />
          ) : isSmtpConfig ? (
            <SmtpConfigPage />
          ) : isWorkflowConfig ? (
            <WorkflowConfigPage />
          ) : isRncList ? (
            <RncListPage />
          ) : isRaqList ? (
            <RaqListPage />
          ) : isRvtList ? (
            <RvtListPage />
          ) : isRheList ? (
            <RheListPage />
          ) : isWorkflows ? (
            <WorkflowAssinaturasPage />
          ) : isDashboard ? (
            <DashboardPage />
          ) : (
            <UnderConstruction title={pageTitle} />
          )}
        </main>
      </div>
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          duration: 3500,
        }}
      />
    </div>
  )
}

export default App
