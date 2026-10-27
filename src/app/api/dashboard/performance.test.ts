import { describe, expect, it } from 'vitest'
import { calcularPerformance, classificarFaturamento } from './performance'

const ag = (status: string, extra: Record<string, unknown> = {}) => ({
  paciente_id: 'p', status, tipo: 'Consulta', valor_procedimento: null, ...extra,
})

describe('performance do início', () => {
  it('conta realizados, faltas, cancelamentos, ocupação e receita', () => {
    const r = calcularPerformance(
      [
        ag('Concluído', { valor_procedimento: 200 }),
        ag('Check-out', { valor_procedimento: '150.5', tipo: 'Retorno' }),
        ag('Faltou'),
        ag('Cancelado'),
        ag('Agendado'),
        { paciente_id: null, status: 'Disponível', tipo: null, valor_procedimento: null },
        { paciente_id: null, status: 'Disponível', tipo: null, valor_procedimento: null },
        { paciente_id: null, status: 'Bloqueado', tipo: null, valor_procedimento: null },
      ],
      [
        { status: 'Convertida', tipo: 'Venda', valor_total: 100 },
        { status: 'Ativo', tipo: 'Prescrição', valor_total: 0 },
        { status: 'Cancelado', tipo: 'Prescrição', valor_total: 50 },
        { status: 'Pendente', tipo: 'Atestado', valor_total: 0 },
      ],
    )
    expect(r.realizados).toBe(2)
    expect(r.faltas).toBe(1)
    expect(r.cancelamentos).toBe(1)
    expect(r.retornosAgendados).toBe(1)
    expect(r.ocupacao).toEqual({ ocupados: 3, disponiveis: 2, percentual: 60 })
    expect(r.receita).toEqual({ atendimentos: 350.5, prescricoes: 100, total: 450.5 })
    expect(r.prescricoes).toEqual({ total: 2, convertidas: 1, taxaConversao: 50 })
  })

  it('sem dados devolve zeros', () => {
    const r = calcularPerformance([], [])
    expect(r.ocupacao.percentual).toBe(0)
    expect(r.prescricoes.taxaConversao).toBe(0)
  })

  it('classifica o faturamento', () => {
    expect(classificarFaturamento('Procedimentos')).toBe('procedimentos')
    expect(classificarFaturamento('Consultas')).toBe('consultas')
    expect(classificarFaturamento('Produtos')).toBe('produtos')
    expect(classificarFaturamento('Outros')).toBe('outros')
    expect(classificarFaturamento(null)).toBe('outros')
  })
})
