import { describe, expect, it } from 'vitest'
import { limiteGeracaoRecorrencia, nextVencimentoForRecorrencia, proximasOcorrencias } from './tarefa-recorrencia'

describe('recorrência de tarefas', () => {
  // 26/10/2026 é segunda-feira. Horários gravados como relógio de parede em UTC.
  const segunda9h = '2026-10-26T09:00:00.000Z'

  it('dias úteis: de segunda gera terça a sexta e pula o fim de semana', () => {
    const limite = new Date('2026-11-02T23:59:59.999Z')
    const datas = proximasOcorrencias('dias_uteis', segunda9h, limite).map((d) => d.toISOString())
    expect(datas).toEqual([
      '2026-10-27T09:00:00.000Z',
      '2026-10-28T09:00:00.000Z',
      '2026-10-29T09:00:00.000Z',
      '2026-10-30T09:00:00.000Z',
      '2026-11-02T09:00:00.000Z',
    ])
  })

  it('sexta à noite (relógio de parede) vai para segunda, sem cair no sábado', () => {
    const next = nextVencimentoForRecorrencia('dias_uteis', '2026-10-30T22:30:00.000Z')
    expect(next?.toISOString()).toBe('2026-11-02T22:30:00.000Z')
  })

  it('diária, semanal e dias específicos respeitam o limite', () => {
    const limite = new Date('2026-10-29T23:59:59.999Z')
    expect(proximasOcorrencias('diaria', segunda9h, limite)).toHaveLength(3)
    expect(proximasOcorrencias('semanal', segunda9h, limite)).toHaveLength(0)
    const quartaESexta = proximasOcorrencias('dias_especificos', segunda9h, new Date('2026-11-06T23:59:59.999Z'), [3, 5])
    expect(quartaESexta.map((d) => d.toISOString().slice(0, 10))).toEqual(['2026-10-28', '2026-10-30', '2026-11-04', '2026-11-06'])
  })

  it('sem recorrência ou dias específicos vazios não gera nada', () => {
    const limite = new Date('2026-12-31T00:00:00.000Z')
    expect(proximasOcorrencias('nenhuma', segunda9h, limite)).toEqual([])
    expect(proximasOcorrencias('dias_especificos', segunda9h, limite, [])).toEqual([])
  })

  it('limite usa o dia da clínica (São Paulo), não o dia UTC', () => {
    // 01:30Z do dia 27 ainda é 22:30 do dia 26 em São Paulo.
    const limite = limiteGeracaoRecorrencia(new Date('2026-10-27T01:30:00.000Z'), 1)
    expect(limite.toISOString()).toBe('2026-10-27T23:59:59.999Z')
  })
})
