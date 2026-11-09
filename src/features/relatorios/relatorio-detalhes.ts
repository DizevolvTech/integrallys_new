import {
  COLUNAS_DESEMPENHO_DETALHE,
  DETALHES_DESEMPENHO,
  type CartaoTotal,
  type ColunaRelatorio,
  type ConfigRelatorio,
} from '@/features/relatorios/relatorio-config'
import { formatData } from '@/features/relatorios/format'

type Valores = Record<string, string>

/** Como o cartão clicável de um relatório abre a lista dos registros que formam o número. */
export interface DetalheCartao {
  /** Relatório (rota /api/relatorios/<tipo>) que lista os registros. */
  tipo: string
  titulo: (cartao: CartaoTotal) => string
  explicacao: (indicador: string) => string
  /** Filtros da lista; null quando o cartão e os filtros da tela não podem coexistir (lista vazia). */
  filtros: (valores: Valores, indicador: string) => Valores | null
  colunas: (config: ConfigRelatorio, indicador: string) => ColunaRelatorio[]
  /** Colunas em destaque no celular (padrão: as da config do relatório). */
  mobile?: ConfigRelatorio['mobile']
  /** Frase extra com a conta do indicador (ex.: taxa de conclusão). */
  conta?: (totais: Record<string, unknown>) => string | null
}

const numero = (v: unknown) => Number(v ?? 0).toLocaleString('pt-BR')

const EXPLICACAO_DESEMPENHO: Record<string, string> = {
  agendamentos: 'Todos os agendamentos de pacientes no período e com os filtros escolhidos.',
  realizados: 'Atendimentos concluídos (concluído ou check-out) no período.',
  cancelados: 'Agendamentos cancelados no período.',
  faltas: 'Pacientes que não compareceram no período.',
  pacientes: 'Cada paciente atendido no período aparece uma vez, com o último atendimento e o total de atendimentos.',
  taxa: 'Taxa de conclusão = realizados ÷ agendamentos. A lista mostra todos os agendamentos que entram na conta.',
}

const COLUNA_ATENDIMENTOS: ColunaRelatorio = { key: 'atendimentos', label: 'Atendimentos', tipo: 'numero', direita: true }

const EXPLICACAO_RECEBIMENTOS: Record<string, string> = {
  liquidado: 'Recebimentos já liquidados (pagos) no período e com os filtros escolhidos.',
  a_receber: 'Valores a receber com vencimento de hoje em diante, no período e com os filtros escolhidos.',
  atrasado: 'Valores a receber cuja data já passou, no período e com os filtros escolhidos.',
}

const EXPLICACAO_TAREFAS: Record<string, string> = {
  todas: 'Todas as tarefas do período e com os filtros escolhidos.',
  pendentes: 'Tarefas com situação Pendente no período e com os filtros escolhidos.',
  concluidas: 'Tarefas concluídas no período e com os filtros escolhidos.',
  atrasadas: 'Tarefas pendentes ou em andamento cujo prazo já passou.',
}

/** Relatórios com cartões clicáveis (o cartão traz `detalhe` = indicador). */
export const DETALHES_POR_TIPO: Record<string, DetalheCartao> = {
  desempenho: {
    tipo: 'desempenho-detalhe',
    titulo: (c) => DETALHES_DESEMPENHO[c.detalhe ?? ''] ?? c.label,
    explicacao: (ind) => EXPLICACAO_DESEMPENHO[ind] ?? '',
    filtros: (valores, ind) => ({ ...valores, metrica: ind }),
    colunas: (_config, ind) => (ind === 'pacientes' ? [...COLUNAS_DESEMPENHO_DETALHE, COLUNA_ATENDIMENTOS] : COLUNAS_DESEMPENHO_DETALHE),
    mobile: { titulo: 'paciente', selo: 'status' },
    conta: (t) =>
      `Conta: ${numero(t.realizados)} realizados ÷ ${numero(t.agendamentos)} agendamentos = ${Number(t.taxaConclusaoPct ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`,
  },
  recebimentos: {
    tipo: 'recebimentos',
    titulo: (c) => c.label,
    explicacao: (ind) => EXPLICACAO_RECEBIMENTOS[ind] ?? '',
    // Se a tela já filtra outra situação, o cartão é R$ 0,00: a lista fica vazia em vez de contradizer.
    filtros: (valores, ind) => {
      const atual = valores.situacao
      if (atual && atual !== 'todos' && atual !== ind) return null
      return { ...valores, situacao: ind }
    },
    colunas: (config) => config.colunas,
  },
  tarefas: {
    tipo: 'tarefas',
    titulo: (c) => c.label,
    explicacao: (ind) => EXPLICACAO_TAREFAS[ind] ?? '',
    filtros: (valores, ind) => (ind === 'todas' ? { ...valores } : { ...valores, indicador: ind }),
    colunas: (config) => config.colunas,
  },
}

export function descricaoDoPeriodo(valores: Valores): string {
  return valores.inicio || valores.fim ? `Período: ${formatData(valores.inicio)} a ${formatData(valores.fim)}.` : ''
}
