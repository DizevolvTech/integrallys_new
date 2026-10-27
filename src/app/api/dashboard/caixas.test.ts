import { describe, expect, it } from 'vitest'
import { montarCaixaUnidade } from './caixas'

const base = { id: 's1', unidade_id: 'u1', saldo_inicial: 300, saldo_final: null, saldo_restante: null, aberto_em: '2026-10-27T10:00:00Z' }

describe('caixinha de troco', () => {
  it('caixa aberto: dinheiro na gaveta (PIX/cartão não contam), saldo do caixa conta tudo', () => {
    const c = montarCaixaUnidade(
      { ...base, status: 'aberto' },
      [
        { unidade_id: 'u1', tipo: 'entrada', valor: 100, forma: 'dinheiro', data_movimento: '2026-10-27T11:00:00Z' },
        { unidade_id: 'u1', tipo: 'entrada', valor: 200, forma: 'pix', data_movimento: '2026-10-27T11:30:00Z' },
        { unidade_id: 'u1', tipo: 'saida', valor: 20, forma: 'dinheiro', data_movimento: '2026-10-27T12:00:00Z' },
        { unidade_id: 'u1', tipo: 'entrada', valor: 999, forma: 'dinheiro', data_movimento: '2026-10-27T08:00:00Z' }, // antes da reabertura
      ],
      50,
    )
    expect(c.troco).toBe(380)
    expect(c.saldoCaixa).toBe(580)
    expect(c.cofre).toBe(50)
  })

  it('caixa fechado: troco = saldo restante do fechamento', () => {
    const c = montarCaixaUnidade({ ...base, status: 'fechado', saldo_final: 980, saldo_restante: 300 }, [], 680)
    expect(c).toMatchObject({ aberto: false, troco: 300, saldoCaixa: 980, cofre: 680 })
  })
})
