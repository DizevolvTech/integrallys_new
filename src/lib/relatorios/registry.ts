/**
 * Quais abas de Relatórios cada perfil enxerga e quais relatórios (RPC) cada perfil pode consultar.
 * A decisão é do servidor: a tela só renderiza as abas que a API devolve (AGENTS.md).
 */
export type RelatorioTipo =
  | 'consultas'
  | 'agendamentos'
  | 'justificativas'
  | 'pacientes'
  | 'vendas'
  | 'recebimentos'
  | 'estoque-posicao'
  | 'estoque-movimentacao'
  | 'repasse'
  | 'financeiro'
  | 'comissoes'
  | 'tarefas'
  | 'aniversariantes'
  | 'desempenho'

export interface RelatorioTab {
  id: string
  label: string
  /** O servidor já restringe esta aba aos dados do próprio usuário (especialista). */
  proprio?: boolean
}

type Perfil = 'admin' | 'master' | 'gestor' | 'recepcao' | 'especialista' | 'paciente' | string

const GESTAO: Perfil[] = ['admin', 'master', 'gestor']
const GESTAO_E_RECEPCAO: Perfil[] = [...GESTAO, 'recepcao']

/** Perfis que podem consultar cada relatório (RPC). Especialista sempre enxerga só os próprios dados. */
export const PERFIS_POR_TIPO: Record<RelatorioTipo, Perfil[]> = {
  consultas: [...GESTAO_E_RECEPCAO, 'especialista'],
  agendamentos: [...GESTAO_E_RECEPCAO, 'especialista'],
  justificativas: [...GESTAO_E_RECEPCAO, 'especialista'],
  pacientes: GESTAO_E_RECEPCAO,
  vendas: GESTAO_E_RECEPCAO,
  recebimentos: GESTAO_E_RECEPCAO,
  'estoque-posicao': GESTAO_E_RECEPCAO,
  'estoque-movimentacao': GESTAO_E_RECEPCAO,
  repasse: [...GESTAO, 'especialista'],
  comissoes: [...GESTAO, 'especialista'],
  // Recepção não vê Financeiro nem despesas: tudo o que ela precisa está no Caixa.
  financeiro: GESTAO,
  tarefas: GESTAO_E_RECEPCAO,
  aniversariantes: [...GESTAO_E_RECEPCAO, 'especialista'],
  desempenho: [...GESTAO_E_RECEPCAO, 'especialista'],
}

/** Tipos em que o especialista é forçado ao próprio profissional_id. */
export const TIPOS_DO_PROPRIO_ESPECIALISTA: RelatorioTipo[] = [
  'consultas',
  'agendamentos',
  'justificativas',
  'repasse',
  'comissoes',
  'desempenho',
]

const ABAS_GESTAO: RelatorioTab[] = [
  { id: 'desempenho', label: 'Desempenho geral' },
  { id: 'consultas', label: 'Consultas' },
  { id: 'agendamentos', label: 'Agendamentos' },
  { id: 'justificativas', label: 'Justificativas de cancelamento' },
  { id: 'retornos', label: 'Retornos' },
  { id: 'pacientes', label: 'Pacientes' },
  { id: 'aniversariantes', label: 'Aniversariantes' },
  { id: 'prescricoes', label: 'Orçamentos / Prescrição' },
  { id: 'vendas', label: 'Vendas' },
  { id: 'recebimentos', label: 'Recebimentos' },
  { id: 'estoque', label: 'Estoque' },
  { id: 'repasse', label: 'Repasse' },
  { id: 'comissoes', label: 'Comissões' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'tarefas', label: 'Tarefas' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'caixa-gestor', label: 'Caixa Gestor' },
  { id: 'comparativo', label: 'Comparativo' },
]

const ABAS_RECEPCAO: RelatorioTab[] = [
  { id: 'desempenho', label: 'Desempenho geral' },
  { id: 'consultas', label: 'Consultas' },
  { id: 'agendamentos', label: 'Agendamentos' },
  { id: 'justificativas', label: 'Justificativas de cancelamento' },
  { id: 'retornos', label: 'Retornos' },
  { id: 'pacientes', label: 'Pacientes' },
  { id: 'prescricoes', label: 'Orçamentos / Prescrição' },
  { id: 'vendas', label: 'Vendas' },
  { id: 'recebimentos', label: 'Recebimentos' },
  { id: 'estoque', label: 'Estoque' },
  { id: 'tarefas', label: 'Tarefas' },
]

// Meus repasses entra entre Desempenho geral e Minhas comissões (pedido da cliente).
const ABAS_ESPECIALISTA: RelatorioTab[] = [
  { id: 'desempenho', label: 'Desempenho geral', proprio: true },
  { id: 'repasse', label: 'Meus repasses', proprio: true },
  { id: 'comissoes', label: 'Minhas comissões', proprio: true },
  { id: 'consultas', label: 'Consultas', proprio: true },
  { id: 'prescricoes', label: 'Orçamentos / Prescrição' },
]

export function abasDoPerfil(perfil: Perfil): RelatorioTab[] {
  if (GESTAO.includes(perfil)) return ABAS_GESTAO
  if (perfil === 'recepcao') return ABAS_RECEPCAO
  if (perfil === 'especialista') return ABAS_ESPECIALISTA
  return []
}

export function perfilPodeVerRelatorio(perfil: Perfil, tipo: RelatorioTipo): boolean {
  return PERFIS_POR_TIPO[tipo].includes(perfil)
}

export function isRelatorioTipo(value: string): value is RelatorioTipo {
  return value in PERFIS_POR_TIPO
}
