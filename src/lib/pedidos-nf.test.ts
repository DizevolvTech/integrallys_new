import { describe, expect, it } from 'vitest'
import { descreverPedidosNf, resumirPedidosNf } from './pedidos-nf'

describe('pedidos de NF', () => {
  it('conta pendentes e emitidas, soma valores e ignora cancelados', () => {
    const resumo = resumirPedidosNf([
      { status: 'pendente', valor: '180.10' },
      { status: 'pendente', valor: 100 },
      { status: 'emitida', valor: 80 },
      { status: 'cancelada', valor: 999 },
      { status: 'pendente', valor: null },
    ])
    expect(resumo).toEqual({ pendentes: 3, emitidas: 1, valorPendente: 280.1, valorEmitido: 80 })
  })

  it('descreve com singular e plural', () => {
    expect(descreverPedidosNf({ pendentes: 1, emitidas: 2, valorPendente: 100, valorEmitido: 200 })).toMatch(
      /^1 pendente · 2 emitidas · R\$\s300,00 em pedidos$/,
    )
  })

  it('sem pedidos devolve zeros', () => {
    expect(resumirPedidosNf([])).toEqual({ pendentes: 0, emitidas: 0, valorPendente: 0, valorEmitido: 0 })
  })
})
