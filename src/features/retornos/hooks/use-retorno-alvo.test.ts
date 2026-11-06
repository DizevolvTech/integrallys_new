import { describe, expect, it } from 'vitest'
import { alvoParaCorpo, montarQueryOpcoes } from './use-retorno-alvo'
import { hrefAgendarRetorno } from '../retornos-relatorio'

describe('alvo do retorno', () => {
  it('só envia o que foi escolhido', () => {
    expect(alvoParaCorpo({ especialistaId: '', procedimentoId: '' })).toEqual({})
    expect(alvoParaCorpo({ especialistaId: 'e1', procedimentoId: 'p1' })).toEqual({
      especialistaRetornoId: 'e1',
      procedimentoRetornoId: 'p1',
    })
  })

  it('monta a consulta de opções pela origem', () => {
    expect(montarQueryOpcoes({})).toBe('/api/retornos/opcoes')
    expect(montarQueryOpcoes({ agendamentoId: 'a', pacienteId: 'b' })).toBe('/api/retornos/opcoes?agendamentoId=a&pacienteId=b')
  })

  it('agendar retorno abre com especialista e procedimento do retorno', () => {
    const href = hrefAgendarRetorno({ pacienteId: 'p', especialistaId: 'e', procedimentoId: 'pr' })
    expect(href).toContain('profissionalId=e')
    expect(href).toContain('procedimentoId=pr')
    expect(href).toContain('tipo=retorno')
    expect(hrefAgendarRetorno({ pacienteId: 'p', especialistaId: null, procedimentoId: null })).not.toContain('procedimentoId')
  })
})
