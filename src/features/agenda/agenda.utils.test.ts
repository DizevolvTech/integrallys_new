import { describe, expect, it } from 'vitest'
import {
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
    const agora = new Date(2026, 8, 9, 14, 30, 0)
    expect(isHorarioPassado('2026-09-09', '08:00', agora)).toBe(true)
    expect(isHorarioPassado('2026-09-09', '15:00', agora)).toBe(false)
    expect(isHorarioPassado('2026-09-10', '08:00', agora)).toBe(false)
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
