import { agendamentoConta } from './retornos'

// Indicadores de performance do início (itens 47 e 52). Tudo vem de agendamentos e
// prescrições reais do período; nada é estimado.

export interface AgendamentoPerf {
  paciente_id: string | null
  status: string | null
  tipo: string | null
  valor_procedimento: number | string | null
}

export interface PrescricaoPerf {
  status: string | null
  tipo: string | null
  valor_total: number | string | null
}

export interface PerformanceDashboard {
  realizados: number
  faltas: number
  cancelamentos: number
  retornosAgendados: number
  ocupacao: { ocupados: number; disponiveis: number; percentual: number }
  receita: { atendimentos: number; prescricoes: number; total: number }
  prescricoes: { total: number; convertidas: number; taxaConversao: number }
  porStatus: Array<{ chave: 'realizados' | 'faltas' | 'cancelamentos'; nome: string; total: number }>
}

const round2 = (n: number) => Math.round(n * 100) / 100
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0)
const has = (value: string | null | undefined, ...parts: string[]) => {
  const s = String(value ?? '').toLowerCase()
  return parts.some((p) => s.includes(p))
}

export function calcularPerformance(agendamentos: AgendamentoPerf[], prescricoes: PrescricaoPerf[]): PerformanceDashboard {
  let realizados = 0
  let faltas = 0
  let cancelamentos = 0
  let retornosAgendados = 0
  let ocupados = 0
  let disponiveis = 0
  let receitaAtendimentos = 0

  for (const row of agendamentos) {
    const status = row.status
    if (has(status, 'dispon')) {
      disponiveis += 1
      continue
    }
    if (!row.paciente_id) continue // bloqueios e compromissos pessoais não são atendimento
    if (has(status, 'faltou')) faltas += 1
    else if (has(status, 'cancel')) cancelamentos += 1
    else if (agendamentoConta(status)) {
      ocupados += 1
      if (has(row.tipo, 'retorno')) retornosAgendados += 1
      if (has(status, 'concl', 'check-out')) {
        realizados += 1
        receitaAtendimentos += Number(row.valor_procedimento ?? 0)
      }
    }
  }

  const vendas = prescricoes.filter((p) => !has(p.status, 'cancel') && has(p.tipo, 'prescri', 'venda'))
  const convertidas = vendas.filter((p) => has(p.status, 'convertida'))
  const receitaPrescricoes = convertidas.reduce((acc, p) => acc + Number(p.valor_total ?? 0), 0)

  return {
    realizados,
    faltas,
    cancelamentos,
    retornosAgendados,
    ocupacao: { ocupados, disponiveis, percentual: pct(ocupados, ocupados + disponiveis) },
    receita: {
      atendimentos: round2(receitaAtendimentos),
      prescricoes: round2(receitaPrescricoes),
      total: round2(receitaAtendimentos + receitaPrescricoes),
    },
    prescricoes: { total: vendas.length, convertidas: convertidas.length, taxaConversao: pct(convertidas.length, vendas.length) },
    porStatus: [
      { chave: 'realizados', nome: 'Realizados', total: realizados },
      { chave: 'faltas', nome: 'Faltas', total: faltas },
      { chave: 'cancelamentos', nome: 'Cancelamentos', total: cancelamentos },
    ],
  }
}

/** Faturamento por tipo (item 52): procedimentos, consultas, produtos; o resto vai em "outros". */
export type TipoFaturamento = 'procedimentos' | 'consultas' | 'produtos' | 'outros'

export function classificarFaturamento(categoria: string | null | undefined): TipoFaturamento {
  const s = String(categoria ?? '').toLowerCase()
  if (s.includes('procedimento')) return 'procedimentos'
  if (s.includes('consulta')) return 'consultas'
  if (s.includes('produto') || s.includes('venda')) return 'produtos'
  return 'outros'
}
