import { describe, expect, it } from 'vitest'
import { classificarRetorno, contarRetornos, diasParaRetorno, parseDiasRetorno } from './retornos'

describe('retornos do início', () => {
  it('lê o prazo gravado', () => {
    expect(parseDiasRetorno('35 dias')).toBe(35)
    expect(parseDiasRetorno('6 meses')).toBe(180)
    expect(parseDiasRetorno('Retorno liberado')).toBeNull()
    expect(parseDiasRetorno('em breve')).toBe(30)
  })

  it('calcula quantos dias faltam', () => {
    expect(diasParaRetorno('2026-10-01', 35, '2026-10-27')).toBe(9)
    expect(diasParaRetorno('2026-09-01', 30, '2026-10-27')).toBe(-26)
  })

  it('limite = faltam até 10 dias; vencido só sem agendamento futuro', () => {
    expect(classificarRetorno(11, false)).toBe('no_prazo')
    expect(classificarRetorno(10, false)).toBe('limite')
    expect(classificarRetorno(0, false)).toBe('limite')
    expect(classificarRetorno(-1, false)).toBe('vencido')
    expect(classificarRetorno(-1, true)).toBeNull()
  })

  it('conta por paciente usando o último atendimento', () => {
    const r = contarRetornos({
      hojeIso: '2026-10-27',
      pacientesComAgendamentoFuturo: new Set(['c']),
      evolucoes: [
        { paciente_id: 'a', data_evolucao: '2026-01-01', retorno_recepcao: '30 dias' }, // antigo: ignorado
        { paciente_id: 'a', data_evolucao: '2026-10-01', retorno_recepcao: '35 dias' }, // limite (9)
        { paciente_id: 'b', data_evolucao: '2026-08-01', retorno_recepcao: '30 dias' }, // vencido
        { paciente_id: 'c', data_evolucao: '2026-08-01', retorno_recepcao: '30 dias' }, // já agendado
        { paciente_id: 'd', data_evolucao: '2026-10-20', retorno_recepcao: '60 dias' }, // no prazo
        { paciente_id: 'e', data_evolucao: '2026-01-01', retorno_recepcao: 'liberado' },
      ],
    })
    expect(r).toEqual({ noPrazo: 1, limitePrazo: 1, vencidos: 1 })
  })

  it('respeita o escopo de unidade', () => {
    const r = contarRetornos({
      hojeIso: '2026-10-27',
      pacientesComAgendamentoFuturo: new Set(),
      pacienteVisivel: (id) => id === 'b',
      evolucoes: [
        { paciente_id: 'a', data_evolucao: '2026-08-01', retorno_recepcao: '30 dias' },
        { paciente_id: 'b', data_evolucao: '2026-08-01', retorno_recepcao: '30 dias' },
      ],
    })
    expect(r.vencidos).toBe(1)
  })
})
