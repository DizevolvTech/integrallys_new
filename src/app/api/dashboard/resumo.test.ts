import { describe, expect, it } from 'vitest'
import {
  RESUMO_CARDS,
  ehResumoCard,
  extrairJustificativa,
  formatarTempoAtendimento,
  montarLinhaAgendamento,
  periodoDoMes,
} from './resumo'

describe('resumo dos cards do início', () => {
  it('formata o tempo em atendimento e mostra — sem registro', () => {
    expect(formatarTempoAtendimento('2026-11-18T14:00:00Z', '2026-11-18T14:42:00Z')).toBe('42 min')
    expect(formatarTempoAtendimento('2026-11-18T14:00:00Z', '2026-11-18T15:05:00Z')).toBe('1 h 05 min')
    expect(formatarTempoAtendimento('2026-11-18T14:00:00Z', '2026-11-18T14:00:10Z')).toBe('< 1 min')
    expect(formatarTempoAtendimento(null, '2026-11-18T14:00:00Z')).toBe('—')
    expect(formatarTempoAtendimento('2026-11-18T14:00:00Z', null)).toBe('—')
    expect(formatarTempoAtendimento('2026-11-18T15:00:00Z', '2026-11-18T14:00:00Z')).toBe('—')
  })

  it('extrai a justificativa de falta e cancelamento', () => {
    expect(extrairJustificativa('Cancelado: paciente viajou')).toBe('paciente viajou')
    expect(extrairJustificativa('Cancelado')).toBe('—')
    expect(extrairJustificativa('Paciente não compareceu')).toBe('Paciente não compareceu')
    expect(extrairJustificativa(null)).toBe('—')
  })

  it('periodo do mês vai do dia 1 ao último dia', () => {
    expect(periodoDoMes('2026-02-10')).toEqual({ de: '2026-02-01', ate: '2026-02-28' })
    expect(periodoDoMes('2026-11-18')).toEqual({ de: '2026-11-01', ate: '2026-11-30' })
  })

  it('monta a linha com nomes, procedimento e valor', () => {
    const linha = montarLinhaAgendamento(
      {
        id: 'a1', data_agendamento: '2026-11-18', horario_inicio: '14:00:00', tipo: 'retorno', observacoes: null,
        valor_procedimento: 120, atendimento_inicio_em: null, atendimento_fim_em: null, paciente_id: 'p1', procedimento_id: 'x',
      },
      { pacientes: { p1: 'Ana' }, procedimentos: {}, especialista: 'Dra. Maria' },
    )
    expect(linha).toMatchObject({ cliente: 'Ana', data: '18/11/2026', horario: '14:00', procedimento: 'Retorno', especialista: 'Dra. Maria', tempo: '—' })
    expect(linha.valor).toContain('120,00')
  })

  it('só aceita cards conhecidos e nenhum deles mostra valor em consultas/pendentes', () => {
    expect(ehResumoCard('receita')).toBe(true)
    expect(ehResumoCard('toString')).toBe(false)
    expect(ehResumoCard(null)).toBe(false)
    for (const id of ['consultas', 'pendentes', 'faltas', 'cancelamentos'] as const) {
      expect(RESUMO_CARDS[id].colunas.some((c) => c.key === 'valor')).toBe(false)
    }
  })
})
