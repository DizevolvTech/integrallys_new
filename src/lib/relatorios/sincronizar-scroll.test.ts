import { describe, expect, it } from 'vitest'
import { precisaBarraNoTopo, sincronizarRolagem } from '@/lib/relatorios/sincronizar-scroll'

describe('barra de rolagem no topo da tabela', () => {
  it('copia a posição de uma barra para a outra nos dois sentidos', () => {
    const topo = { scrollLeft: 0 }
    const baixo = { scrollLeft: 0 }
    topo.scrollLeft = 240
    expect(sincronizarRolagem(topo, baixo)).toBe(true)
    expect(baixo.scrollLeft).toBe(240)
    baixo.scrollLeft = 80
    expect(sincronizarRolagem(baixo, topo)).toBe(true)
    expect(topo.scrollLeft).toBe(80)
  })

  it('não reaplica quando já estão na mesma posição (sem laço)', () => {
    expect(sincronizarRolagem({ scrollLeft: 10 }, { scrollLeft: 10 })).toBe(false)
  })

  it('só mostra a barra de cima quando a tabela é mais larga que a tela', () => {
    expect(precisaBarraNoTopo(1800, 900)).toBe(true)
    expect(precisaBarraNoTopo(900, 900)).toBe(false)
    expect(precisaBarraNoTopo(900.5, 900)).toBe(false)
  })
})
