import {
  Circle,
  LayoutDashboard,
  ListChecks,
  BarChart3,
  Users,
  Files,
  Package,
  Clock,
  Timer,
  Plus,
  MoreVertical,
  LogOut,
  Factory,
  Truck,
  PackageCheck,
  GitBranch,
  AlertTriangle,
  FileWarning,
  ShieldAlert,
  BadgeCheck,
  MapPin,
  LayoutGrid,
  UserCheck,
  Mail,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth/AuthContext'

type Item = {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const mainNav: Item[] = [
  { key: 'dashboard', label: 'Painel Principal', icon: LayoutDashboard },
  { key: 'rnc-list', label: 'RNCs', icon: FileWarning },
  { key: 'lifecycle', label: 'Acompanhamento', icon: ListChecks },
  { key: 'analytics', label: 'Pendências de Assinaturas', icon: BarChart3 },
]

type RegistroOption = {
  key: string
  sigla: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const registroOptions: RegistroOption[] = [
  { key: 'rnc', sigla: 'RNC', label: 'Relatório de Não Conformidade', icon: FileWarning },
  { key: 'raq', sigla: 'RAQ', label: 'Relatório de Alerta da Qualidade', icon: ShieldAlert },
  { key: 'rhe', sigla: 'RHE', label: 'Relatório de Homologação de Fornecedor', icon: BadgeCheck },
  { key: 'rvt', sigla: 'RVT', label: 'Relatório de Visita Técnica', icon: MapPin },
]

const cadastrosNav: Item[] = [
  { key: 'cad-filial', label: 'Filial', icon: Factory },
  { key: 'cad-area', label: 'Área', icon: LayoutGrid },
  { key: 'cad-aprovador', label: 'Aprovador', icon: UserCheck },
  { key: 'cad-turno', label: 'Turno de Trabalho', icon: Clock },
  { key: 'cad-fornecedor', label: 'Fornecedor', icon: Truck },
  { key: 'cad-produto', label: 'Produto', icon: Package },
  { key: 'cad-disposicao', label: 'Disposição de Material', icon: PackageCheck },
  { key: 'cad-tipo-nc', label: 'Tipo de Não Conformidade', icon: FileWarning },
  { key: 'cad-origem', label: 'Origem da Não Conformidade', icon: GitBranch },
  { key: 'cad-severidade', label: 'Severidade', icon: AlertTriangle },
  { key: 'cad-tipo-relatorio', label: 'Tipos de Relatórios', icon: Files },
  { key: 'cad-politica-resposta', label: 'Política de Resposta', icon: Timer },
]

// Itens de cadastro visíveis somente para administradores.
const cadastrosAdminNav: Item[] = [
  { key: 'cad-usuario', label: 'Usuários', icon: Users },
]

// Configurações técnicas — somente administradores.
const configuracoesNav: Item[] = [
  { key: 'cfg-smtp', label: 'Servidor de E-mail (SMTP)', icon: Mail },
]

type NavItemProps = {
  item: Item
  active: boolean
  onClick: (item: Item) => void
}

function NavItem({ item, active, onClick }: NavItemProps) {
  const Icon = item.icon
  return (
    <button
      onClick={() => onClick(item)}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm font-medium transition-colors',
        active
          ? 'bg-neutral-200 text-neutral-900 hover:bg-neutral-200'
          : 'text-neutral-700 hover:bg-neutral-200/60',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </button>
  )
}

export type AppSidebarProps = {
  activeKey: string
  onSelect: (key: string, label: string) => void
  /** Disparado ao escolher um item do menu "Criar Relatório".
   *  Quando provido, sobrescreve o comportamento padrão (`onSelect`). */
  onCreateRelatorio?: (key: string, sigla: string, label: string) => void
}

export function AppSidebar({ activeKey, onSelect, onCreateRelatorio }: AppSidebarProps) {
  const auth = useAuth()
  const usuario = auth.status === 'authenticated' ? auth.user : null
  const iniciais = usuario
    ? usuario.nome
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join('') || usuario.email[0]?.toUpperCase()
    : '?'

  const handleClick = (item: Item) => onSelect(item.key, item.label)

  const handleRegistro = (opt: RegistroOption) => {
    if (onCreateRelatorio) {
      onCreateRelatorio(opt.key, opt.sigla, opt.label)
    } else {
      onSelect(`registro-${opt.key}`, `${opt.sigla} — ${opt.label}`)
    }
  }

  return (
    <aside className="flex w-[15.5rem] shrink-0 flex-col border-r border-neutral-200 bg-neutral-50">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-900 text-white">
          <Circle className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="text-[15px] font-semibold tracking-tight text-neutral-900">
            SGNC
          </span>
          <span className="truncate text-[11px] text-neutral-500">
            Gestão de Não Conformidade
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 px-2 pt-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-200/60">
              <Plus className="h-4 w-4 shrink-0" />
              <span className="truncate">Criar Relatório</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={6} className="w-64">
            <DropdownMenuLabel>Novo relatório</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {registroOptions.map((opt) => {
              const Icon = opt.icon
              return (
                <DropdownMenuItem
                  key={opt.key}
                  onSelect={() => handleRegistro(opt)}
                >
                  <Icon className="h-4 w-4 text-neutral-500" />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-neutral-900">
                      {opt.sigla}
                    </span>
                    <span className="truncate text-xs text-neutral-500">
                      {opt.label}
                    </span>
                  </div>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <nav className="mt-1 flex flex-col gap-0.5 px-2">
        {mainNav.map((item) => (
          <NavItem
            key={item.key}
            item={item}
            active={activeKey === item.key}
            onClick={handleClick}
          />
        ))}
      </nav>

      <div className="mt-6 px-2">
        <div className="px-2.5 pb-1.5 text-xs font-medium text-neutral-500">
          Cadastros
        </div>
        <nav className="flex flex-col gap-0.5">
          {cadastrosNav.map((item) => (
            <NavItem
              key={item.key}
              item={item}
              active={activeKey === item.key}
              onClick={handleClick}
            />
          ))}
          {usuario?.role === 'ADMIN' &&
            cadastrosAdminNav.map((item) => (
              <NavItem
                key={item.key}
                item={item}
                active={activeKey === item.key}
                onClick={handleClick}
              />
            ))}
        </nav>
      </div>

      {usuario?.role === 'ADMIN' && (
        <div className="mt-6 px-2">
          <div className="px-2.5 pb-1.5 text-xs font-medium text-neutral-500">
            Configurações Técnicas
          </div>
          <nav className="flex flex-col gap-0.5">
            {configuracoesNav.map((item) => (
              <NavItem
                key={item.key}
                item={item}
                active={activeKey === item.key}
                onClick={handleClick}
              />
            ))}
          </nav>
        </div>
      )}

      <div className="mt-auto flex flex-col">
        <div className="flex items-center gap-2 border-t border-neutral-200 px-3 py-2.5">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-neutral-300 text-neutral-700">
              {iniciais}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-neutral-900">
              {usuario?.nome ?? '—'}
            </span>
            <span className="truncate text-xs text-neutral-500">
              {usuario?.email ?? ''}
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="rounded-md p-1 text-neutral-500 hover:bg-neutral-200/60"
                aria-label="Menu da conta"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6} className="w-48">
              <DropdownMenuLabel>Conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => auth.logout()}>
                <LogOut className="h-4 w-4 text-neutral-500" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </aside>
  )
}

export const CADASTRO_KEYS = new Set([
  ...cadastrosNav.map((i) => i.key),
  ...cadastrosAdminNav.map((i) => i.key),
])

export const CONFIG_KEYS = new Set(configuracoesNav.map((i) => i.key))
