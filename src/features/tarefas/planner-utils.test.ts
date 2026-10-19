import { describe, expect, it } from 'vitest'
import type { TarefaItem } from '@/hooks/use-tarefas'
import { applyFilters, buildMonthGrid, buildWeekDays, groupEntrada, toDateKey } from './planner-utils'

function tarefa(partial: Partial<TarefaItem>): TarefaItem {
  return {
    id: partial.id ?? 'x',
    titulo: 'Tarefa',
    descricao: '',
    responsavel: '',
    responsavelId: '',
    status: 'Pendente',
    recorrencia: 'nenhuma',
    diasSemana: [],
    alerta: false,
    prioridade: 'Média',
    categoria: '',
    vencimentoEm: '',
    data: '',
    horario: '',
    subtarefas: [],
    ...partial,
  }
}

describe('planner-utils', () => {
  it('semana começa na segunda e tem 7 dias', () => {
    const days = buildWeekDays(new Date(2026, 9, 14)) // quarta 14/10/2026
    expect(days).toHaveLength(7)
    expect(toDateKey(days[0])).toBe('2026-10-12')
    expect(toDateKey(days[6])).toBe('2026-10-18')
  })

  it('grade do mês tem 42 células e inclui o dia 1', () => {
    const grid = buildMonthGrid(new Date(2026, 9, 14))
    expect(grid).toHaveLength(42)
    expect(grid.map(toDateKey)).toContain('2026-10-01')
  })

  it('agrupa a Entrada em atrasadas, hoje, próximas, sem data e concluídas', () => {
    const groups = groupEntrada(
      [
        tarefa({ id: 'a', data: '2026-10-10' }),
        tarefa({ id: 'b', data: '2026-10-14' }),
        tarefa({ id: 'c', data: '2026-10-20' }),
        tarefa({ id: 'd' }),
        tarefa({ id: 'e', data: '2026-10-01', status: 'Concluída' }),
      ],
      '2026-10-14',
    )
    expect(groups.atrasadas.map((t) => t.id)).toEqual(['a'])
    expect(groups.hoje.map((t) => t.id)).toEqual(['b'])
    expect(groups.proximas.map((t) => t.id)).toEqual(['c'])
    expect(groups.semData.map((t) => t.id)).toEqual(['d'])
    expect(groups.concluidas.map((t) => t.id)).toEqual(['e'])
  })

  it('filtros combinam: concluídas, projeto, prioridade e busca', () => {
    const base = { mostrarConcluidas: false, mostrarSubtarefas: true, projeto: 'todos', prioridade: 'todas', busca: '' }
    const lista = [
      tarefa({ id: '1', categoria: 'Clínica', prioridade: 'Alta', titulo: 'Ligar para fornecedor' }),
      tarefa({ id: '2', categoria: 'Clínica', status: 'Concluída' }),
      tarefa({ id: '3', categoria: 'Marketing', prioridade: 'Baixa' }),
      tarefa({ id: '4', status: 'Cancelada' }),
    ]
    expect(applyFilters(lista, base).map((t) => t.id)).toEqual(['1', '3'])
    expect(applyFilters(lista, { ...base, mostrarConcluidas: true }).map((t) => t.id)).toEqual(['1', '2', '3'])
    expect(applyFilters(lista, { ...base, projeto: 'Clínica', prioridade: 'Alta' }).map((t) => t.id)).toEqual(['1'])
    expect(applyFilters(lista, { ...base, busca: 'fornecedor' }).map((t) => t.id)).toEqual(['1'])
  })
})
