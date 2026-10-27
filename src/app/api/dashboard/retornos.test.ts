import { describe, expect, it } from 'vitest'
import { agendamentoConta, contarSituacoes } from './retornos'

describe('retornos do início', () => {
  it('conta por situação vinda da view retornos_em_aberto', () => {
    expect(
      contarSituacoes([{ situacao: 'limite' }, { situacao: 'vencido' }, { situacao: 'vencido' }, { situacao: 'no_prazo' }, { situacao: null }]),
    ).toEqual({ noPrazo: 1, limitePrazo: 1, vencidos: 2 })
  })

  it('horário livre, bloqueio, cancelado e falta não contam como atendimento', () => {
    expect(agendamentoConta('Confirmado')).toBe(true)
    for (const s of ['Cancelado', 'Faltou', 'Disponível', 'Bloqueado', 'Adiado']) expect(agendamentoConta(s)).toBe(false)
  })
})
