import type { Permission, SidebarItem, UserRole } from '@/types/auth'

const SIDEBAR_BY_ROLE: Record<UserRole, SidebarItem[]> = {
  admin: [
    { id: 'cat-operacional', label: 'Operacional', icon: 'Home', type: 'category' },
    { id: 'inicio', label: 'Início', icon: 'Home', href: '/' },
    { id: 'agenda', label: 'Agenda', icon: 'Calendar', href: '/agenda' },
    { id: 'retornos', label: 'Retornos', icon: 'RotateCcw', href: '/retornos' },
    { id: 'cat-gestao', label: 'Gestão', icon: 'Users', type: 'category' },
    { id: 'usuarios', label: 'Usuários', icon: 'Users', href: '/usuarios' },
    { id: 'profissionais', label: 'Profissionais', icon: 'Stethoscope', href: '/profissionais' },
    { id: 'fornecedores', label: 'Fornecedores', icon: 'Boxes', href: '/fornecedores' },
    { id: 'permissoes', label: 'Permissões', icon: 'Shield', href: '/permissoes' },
    { id: 'unidades', label: 'Unidades', icon: 'Building', href: '/unidades' },
    { id: 'procedimentos-cadastro', label: 'Procedimentos', icon: 'ClipboardList', href: '/procedimentos' },
    { id: 'financeiro', label: 'Financeiro', icon: 'CreditCard', href: '/financeiro' },
    { id: 'formas-pagamento', label: 'Formas de Pagamento', icon: 'Wallet', href: '/formas-pagamento' },
    { id: 'cartoes', label: 'Cartões', icon: 'CreditCard', href: '/cartoes' },
    { id: 'gestao-bancaria', label: 'Gestão Bancária', icon: 'Building2', href: '/gestao-bancaria' },
    { id: 'dre', label: 'DRE', icon: 'BarChart2', href: '/dre' },
    { id: 'repasse', label: 'Repasse', icon: 'History', href: '/repasse' },
    { id: 'relatorios', label: 'Relatórios', icon: 'FileText', href: '/relatorios' },
    { id: 'tarefas', label: 'Tarefas', icon: 'CheckSquare', href: '/tarefas' },
    { id: 'auditoria', label: 'Log de Auditoria', icon: 'History', href: '/auditoria' },
    { id: 'cat-sistema', label: 'Sistema', icon: 'Settings', type: 'category' },
    { id: 'comunicacao', label: 'Comunicação', icon: 'MessageSquare', href: '/comunicacao' },
    { id: 'config-clinica', label: 'Config. da Clínica', icon: 'Building', href: '/configuracoes/clinica' },
    { id: 'config-documentos', label: 'Templates de Documentos', icon: 'FileText', href: '/configuracoes/documentos' },
    { id: 'configuracoes', label: 'Configurações', icon: 'Settings', href: '/configuracoes' },
  ],
  gestor: [
    { id: 'cat-operacional', label: 'Operacional', icon: 'LayoutDashboard', type: 'category' },
    { id: 'inicio', label: 'Início', icon: 'LayoutDashboard', href: '/' },
    { id: 'agenda', label: 'Agenda', icon: 'Calendar', href: '/agenda' },
    { id: 'retornos', label: 'Retornos', icon: 'RotateCcw', href: '/retornos' },
    { id: 'pacientes', label: 'Pacientes', icon: 'Search', href: '/pacientes' },
    { id: 'espera', label: 'Lista de Espera', icon: 'Clock', href: '/lista-espera' },
    { id: 'vendas', label: 'Prescrição/Vendas', icon: 'ShoppingCart', href: '/prescricoes' },
    { id: 'estoque', label: 'Estoque por Unidade', icon: 'Package', href: '/estoque' },
    { id: 'cat-clinico', label: 'Clínico', icon: 'Stethoscope', type: 'category' },
    { id: 'documentacao', label: 'Documentação Clínica', icon: 'FileText', href: '/documentacao' },
    { id: 'cat-financeiro', label: 'Financeiro', icon: 'Wallet', type: 'category' },
    { id: 'financeiro', label: 'Financeiro', icon: 'DollarSign', href: '/financeiro' },
    { id: 'formas-pagamento', label: 'Formas de Pagamento', icon: 'Wallet', href: '/formas-pagamento' },
    { id: 'cartoes', label: 'Cartões', icon: 'CreditCard', href: '/cartoes' },
    { id: 'gestao-bancaria', label: 'Gestão Bancária', icon: 'Building2', href: '/gestao-bancaria' },
    { id: 'dre', label: 'DRE', icon: 'BarChart2', href: '/dre' },
    { id: 'repasse', label: 'Repasse', icon: 'ArrowLeftRight', href: '/repasse' },
    { id: 'cat-gestao', label: 'Gestão', icon: 'Shield', type: 'category' },
    { id: 'usuarios', label: 'Usuários', icon: 'Users', href: '/usuarios' },
    { id: 'profissionais', label: 'Profissionais', icon: 'Stethoscope', href: '/profissionais' },
    { id: 'fornecedores', label: 'Fornecedores', icon: 'Boxes', href: '/fornecedores' },
    { id: 'unidades', label: 'Unidades', icon: 'Building', href: '/unidades' },
    { id: 'permissoes', label: 'Permissões', icon: 'Shield', href: '/permissoes' },
    { id: 'procedimentos-cadastro', label: 'Procedimentos', icon: 'ClipboardList', href: '/procedimentos' },
    { id: 'relatorios', label: 'Relatórios Corporativos', icon: 'BarChart2', href: '/relatorios' },
    { id: 'tarefas', label: 'Tarefas', icon: 'CheckSquare', href: '/tarefas' },
    { id: 'cat-sistema', label: 'Sistema', icon: 'Settings', type: 'category' },
    { id: 'comunicacao', label: 'Comunicação', icon: 'MessageSquare', href: '/comunicacao' },
    { id: 'config-clinica', label: 'Config. da Clínica', icon: 'Building', href: '/configuracoes/clinica' },
    { id: 'config-documentos', label: 'Templates de Documentos', icon: 'FileText', href: '/configuracoes/documentos' },
    { id: 'configuracoes', label: 'Configurações', icon: 'Settings', href: '/configuracoes' },
  ],
  recepcao: [
    { id: 'cat-operacional', label: 'Operacional', icon: 'LayoutDashboard', type: 'category' },
    { id: 'inicio', label: 'Início', icon: 'LayoutDashboard', href: '/' },
    { id: 'agenda', label: 'Agenda', icon: 'Calendar', href: '/agenda' },
    { id: 'retornos', label: 'Retornos', icon: 'RotateCcw', href: '/retornos' },
    { id: 'pacientes', label: 'Pacientes', icon: 'Users', href: '/pacientes' },
    { id: 'prescricoes', label: 'Prescrição/Vendas', icon: 'FileText', href: '/prescricoes' },
    { id: 'estoque', label: 'Estoque e Suprimentos', icon: 'Package', href: '/estoque' },
    { id: 'espera', label: 'Lista de espera', icon: 'Clock', href: '/lista-espera' },
    { id: 'cat-financeiro', label: 'Financeiro', icon: 'Wallet', type: 'category' },
    { id: 'caixa', label: 'Caixa', icon: 'Wallet', href: '/caixa' },
    { id: 'cat-sistema', label: 'Sistema', icon: 'Settings', type: 'category' },
    { id: 'relatorios', label: 'Relatórios', icon: 'BarChart3', href: '/relatorios' },
    { id: 'tarefas', label: 'Tarefas', icon: 'CheckSquare', href: '/tarefas' },
    { id: 'comunicacao', label: 'Comunicação', icon: 'MessageSquare', href: '/comunicacao' },
    { id: 'settings', label: 'Configurações', icon: 'Settings', href: '/configuracoes' },
  ],
  especialista: [
    { id: 'cat-operacional', label: 'Operacional', icon: 'Home', type: 'category' },
    { id: 'inicio', label: 'Início', icon: 'Home', href: '/' },
    { id: 'agenda', label: 'Agenda', icon: 'Calendar', href: '/agenda' },
    { id: 'retornos', label: 'Retornos', icon: 'RotateCcw', href: '/retornos' },
    { id: 'pacientes', label: 'Pacientes', icon: 'Users', href: '/pacientes' },
    { id: 'cat-clinico', label: 'Clínico', icon: 'Stethoscope', type: 'category' },
    { id: 'anamnese', label: 'Anamnese', icon: 'Stethoscope', href: '/anamnese' },
    { id: 'prontuario', label: 'Prontuário', icon: 'FileText', href: '/prontuarios' },
    { id: 'prescricoes', label: 'Prescrição/Vendas', icon: 'Pill', href: '/prescricoes' },
    { id: 'evolucoes', label: 'Evoluções Clínicas', icon: 'ClipboardList', href: '/evolucoes' },
    { id: 'estoque', label: 'Estoque', icon: 'Box', href: '/estoque' },
    { id: 'relatorios', label: 'Relatórios', icon: 'BarChart2', href: '/relatorios' },
    { id: 'cat-sistema', label: 'Sistema', icon: 'Settings', type: 'category' },
    { id: 'comunicacao', label: 'Comunicação', icon: 'MessageSquare', href: '/comunicacao' },
    { id: 'configuracoes', label: 'Configurações', icon: 'Settings', href: '/configuracoes' },
  ],
  paciente: [
    { id: 'cat-operacional', label: 'Operacional', icon: 'Home', type: 'category' },
    { id: 'inicio', label: 'Início', icon: 'Home', href: '/portal' },
    { id: 'agenda', label: 'Minha Agenda', icon: 'Calendar', href: '/portal/agenda' },
    { id: 'historico', label: 'Histórico', icon: 'History', href: '/portal/historico' },
    { id: 'documentos', label: 'Documentos', icon: 'FileText', href: '/portal/documentos' },
    { id: 'prescricoes', label: 'Prescrição/Vendas', icon: 'FileText', href: '/portal/prescricoes' },
    { id: 'cat-financeiro', label: 'Financeiro', icon: 'Wallet', type: 'category' },
    { id: 'cartoes', label: 'Cartões', icon: 'CreditCard', href: '/portal/cartoes' },
    { id: 'pagamentos', label: 'Pagamentos', icon: 'CreditCard', href: '/portal/pagamentos' },
    { id: 'cat-sistema', label: 'Sistema', icon: 'Settings', type: 'category' },
    { id: 'configuracoes', label: 'Configurações', icon: 'Settings', href: '/portal/configuracoes' },
  ],
  master: [
    { id: 'cat-operacional', label: 'Operacional', icon: 'Home', type: 'category' },
    { id: 'inicio', label: 'Início', icon: 'Home', href: '/' },
    { id: 'agenda', label: 'Agenda', icon: 'Calendar', href: '/agenda' },
    { id: 'retornos', label: 'Retornos', icon: 'RotateCcw', href: '/retornos' },
    { id: 'pacientes', label: 'Pacientes', icon: 'Users', href: '/pacientes' },
    { id: 'caixa', label: 'Caixa', icon: 'Wallet', href: '/caixa' },
    { id: 'prescricoes', label: 'Prescrição/Vendas', icon: 'FileText', href: '/prescricoes' },
    { id: 'estoque', label: 'Estoque', icon: 'Package', href: '/estoque' },
    { id: 'espera', label: 'Lista de Espera', icon: 'Clock', href: '/lista-espera' },
    { id: 'cat-clinico', label: 'Clínico', icon: 'Stethoscope', type: 'category' },
    { id: 'anamnese', label: 'Anamnese', icon: 'ClipboardList', href: '/anamnese' },
    { id: 'prontuario', label: 'Prontuário', icon: 'FileText', href: '/prontuarios' },
    { id: 'evolucoes', label: 'Evoluções Clínicas', icon: 'Activity', href: '/evolucoes' },
    { id: 'cat-admin', label: 'Administrativo', icon: 'Shield', type: 'category' },
    { id: 'usuarios', label: 'Usuários', icon: 'Users', href: '/usuarios' },
    { id: 'profissionais', label: 'Profissionais', icon: 'Stethoscope', href: '/profissionais' },
    { id: 'fornecedores', label: 'Fornecedores', icon: 'Boxes', href: '/fornecedores' },
    { id: 'permissoes', label: 'Permissões', icon: 'Shield', href: '/permissoes' },
    { id: 'unidades', label: 'Unidades', icon: 'Building2', href: '/unidades' },
    { id: 'procedimentos-cadastro', label: 'Procedimentos', icon: 'ClipboardList', href: '/procedimentos' },
    { id: 'financeiro', label: 'Financeiro', icon: 'Wallet', href: '/financeiro' },
    { id: 'formas-pagamento', label: 'Formas de Pagamento', icon: 'Wallet', href: '/formas-pagamento' },
    { id: 'cartoes', label: 'Cartões', icon: 'CreditCard', href: '/cartoes' },
    { id: 'gestao-bancaria', label: 'Gestão Bancária', icon: 'Building2', href: '/gestao-bancaria' },
    { id: 'dre', label: 'DRE', icon: 'BarChart2', href: '/dre' },
    { id: 'repasse', label: 'Repasse', icon: 'ArrowLeftRight', href: '/repasse' },
    { id: 'relatorios', label: 'Relatórios', icon: 'BarChart2', href: '/relatorios' },
    { id: 'tarefas', label: 'Tarefas', icon: 'CheckSquare', href: '/tarefas' },
    { id: 'auditoria', label: 'Auditoria', icon: 'FileCheck', href: '/auditoria' },
    { id: 'comunicacao', label: 'Comunicação', icon: 'MessageSquare', href: '/comunicacao' },
    { id: 'config-clinica', label: 'Config. da Clínica', icon: 'Building', href: '/configuracoes/clinica' },
    { id: 'config-documentos', label: 'Templates de Documentos', icon: 'FileText', href: '/configuracoes/documentos' },
    { id: 'configuracoes', label: 'Configurações', icon: 'Settings', href: '/configuracoes' },
  ],
}

function itemToResource(role: UserRole, item: SidebarItem): string | null {
  if (item.type === 'category' || item.type === 'group') {
    return null
  }

  if (role === 'paciente') {
    if (item.id === 'inicio') return 'portal.dashboard'
    if (item.id === 'agenda') return 'portal.agendamentos'
    if (item.id === 'historico') return 'portal.historico'
    if (item.id === 'documentos') return 'portal.documentos'
    if (item.id === 'cartoes') return 'portal.cartoes'
    if (item.id === 'pagamentos') return 'portal.pagamentos'
    if (item.id === 'configuracoes') return 'configuracoes'
    if (item.id === 'prescricoes') return 'portal.prescricoes'
  }

  if (item.id === 'inicio') return 'dashboard'
  if (item.id === 'tarefas' || item.id === 'tarefas-relatorio') return 'tarefas'
  if (item.id === 'dre') return 'financeiro'
  // gestao-bancaria NÃO reusa 'financeiro' (recepção tem financeiro p/ Caixa e
  // veria contas bancárias completas) — cai no fallback href → recurso próprio
  // 'gestao-bancaria' (migration 082), alinhado ao gate da API.
  if (item.id === 'cartoes') return 'financeiro'
  if (item.id === 'formas-pagamento') return 'financeiro'
  if (item.id === 'procedimentos-cadastro') return 'procedimentos'
  if (item.id === 'comunicacao') return 'comunicacao'
  if (item.id === 'config-clinica') return 'configuracoes'
  if (item.id === 'config-documentos') return 'documentacao'
  if (item.id === 'settings') return 'configuracoes'
  if (item.id === 'prontuario') return 'prontuarios'
  const href = item.href?.replace(/^\//, '')
  if (href) {
    return href
  }

  return item.id
}

function hasReadPermission(resource: string, permissions: Permission[]) {
  return permissions.some((permission) => permission.resource === resource && permission.actions.includes('read'))
}

export function buildSidebarForRole(role: UserRole, permissions: Permission[] = []): SidebarItem[] {
  const items = SIDEBAR_BY_ROLE[role] ?? []
  if (permissions.length === 0) {
    return items
  }

  const filtered: SidebarItem[] = []
  let pendingCategory: SidebarItem | null = null
  let categoryHasItems = false

  for (const item of items) {
    if (item.type === 'category') {
      pendingCategory = item
      categoryHasItems = false
      continue
    }

    if (item.type === 'group') {
      const children = (item.children ?? []).filter((child) => {
        const resource = itemToResource(role, child)
        return resource ? hasReadPermission(resource, permissions) : true
      })

      if (children.length === 0) {
        continue
      }

      if (pendingCategory && !categoryHasItems) {
        filtered.push(pendingCategory)
        categoryHasItems = true
      }

      filtered.push({ ...item, children })
      continue
    }

    const resource = itemToResource(role, item)
    const allowed = resource ? hasReadPermission(resource, permissions) : true
    if (!allowed) {
      continue
    }

    if (pendingCategory && !categoryHasItems) {
      filtered.push(pendingCategory)
      categoryHasItems = true
    }

    filtered.push(item)
  }

  return filtered
}
