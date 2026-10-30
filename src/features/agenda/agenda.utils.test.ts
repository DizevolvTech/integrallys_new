import { describe, expect, it } from 'vitest'
import {
  deslocarPeriodo,
  duracaoEmMinutos,
  observacoesSemDuracao,
  getPagamentoIconTone,
  isHorarioPassado,
  canIniciarAtendimento,
  normalizeAgendaStatus,
  resolvePagamentoSituacao,
} from './agenda.utils'

describe('resolvePagamentoSituacao', () => {
  it('novo agendamento com valor e sem pagamento → Pendente (não Pago)', () => {
    expect(
      resolvePagamentoSituacao({
        pagamento: 'Pago',
        valorProcedimento: 250,
        totalPago: 0,
      }),
    ).toBe('Pendente')
  })

  it('quitado quando total_pago >= valor', () => {
    expect(
      resolvePagamentoSituacao({
        pagamento: 'Pendente',
        valorProcedimento: 250,
        totalPago: 250,
      }),
    ).toBe('Pago')
  })

  it('parcial quando pagou parte', () => {
    expect(
      resolvePagamentoSituacao({
        valorProcedimento: 200,
        totalPago: 80,
      }),
    ).toBe('Parcial')
  })

  it('sem valor de procedimento', () => {
    expect(resolvePagamentoSituacao({ pagamento: 'Sem valor' })).toBe('Sem valor')
  })
})

describe('normalizeAgendaStatus', () => {
  it('Agendado permanece distinto de Confirmado', () => {
    expect(normalizeAgendaStatus('Agendado')).toBe('Agendado')
    expect(normalizeAgendaStatus('Confirmado')).toBe('Confirmado')
  })
})

describe('isHorarioPassado / canIniciarAtendimento', () => {
  it('detecta horário passado no mesmo dia', () => {
    // 14:30 em Brasília (UTC-3) = 17:30Z
    const agora = new Date('2026-09-09T17:30:00Z')
    expect(isHorarioPassado('2026-09-09', '08:00', agora)).toBe(true)
    expect(isHorarioPassado('2026-09-09', '15:00', agora)).toBe(false)
    expect(isHorarioPassado('2026-09-10', '08:00', agora)).toBe(false)
  })

  it('usa o relógio de Brasília mesmo com servidor em UTC (16:40 BRT = 19:40Z)', () => {
    const agora = new Date('2026-10-20T19:40:00Z')
    expect(isHorarioPassado('2026-10-20', '16:40', agora)).toBe(false)
    expect(isHorarioPassado('2026-10-20', '16:30', agora)).toBe(true)
    expect(isHorarioPassado('2026-10-20', '17:00', agora)).toBe(false)
    // virada de dia: 23:30 BRT = 02:30Z do dia seguinte
    const noite = new Date('2026-10-21T02:30:00Z')
    expect(isHorarioPassado('2026-10-20', '23:00', noite)).toBe(true)
    expect(isHorarioPassado('2026-10-21', '08:00', noite)).toBe(false)
  })

  it('iniciar atendimento só especialista/master', () => {
    expect(canIniciarAtendimento('especialista')).toBe(true)
    expect(canIniciarAtendimento('master')).toBe(true)
    expect(canIniciarAtendimento('recepcao')).toBe(false)
    expect(canIniciarAtendimento('gestor')).toBe(false)
  })
})

describe('getPagamentoIconTone', () => {
  it('pendente não usa verde', () => {
    expect(getPagamentoIconTone('Pendente')).not.toContain('success')
    expect(getPagamentoIconTone('Pago')).toContain('success')
  })
})

describe('deslocarPeriodo', () => {
  const base = new Date(2026, 9, 31, 10, 0)
  it('dia anda 1 dia, semana 7 dias', () => {
    expect(deslocarPeriodo(base, 'dia', 1).getDate()).toBe(1)
    const sem = deslocarPeriodo(base, 'semana', -1)
    expect([sem.getMonth(), sem.getDate()]).toEqual([9, 24])
    const prox = deslocarPeriodo(base, 'semana', 1)
    expect([prox.getMonth(), prox.getDate()]).toEqual([10, 7])
  })
  it('mês anda 1 mês sem estourar o fim do mês', () => {
    const m = deslocarPeriodo(base, 'mes', 1)
    expect([m.getMonth(), m.getDate()]).toEqual([10, 30])
    const a = deslocarPeriodo(base, 'mes', -1)
    expect([a.getMonth(), a.getDate()]).toEqual([8, 30])
  })
})

describe('duração do compromisso', () => {
  it('calcula minutos entre início e fim e ignora fim inválido', () => {
    expect(duracaoEmMinutos('17:00', '17:45')).toBe('45')
    expect(duracaoEmMinutos('17:00', undefined)).toBeUndefined()
    expect(duracaoEmMinutos('17:00', '16:00')).toBeUndefined()
  })
  it('tira o prefixo Duração das observações antigas', () => {
    expect(observacoesSemDuracao('Duração: 45 • levar relatório')).toBe('levar relatório')
    expect(observacoesSemDuracao('Duração: 30')).toBeUndefined()
    expect(observacoesSemDuracao('Sem prefixo')).toBe('Sem prefixo')
  })
})
