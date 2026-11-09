import { describe, expect, it } from 'vitest'
import { lerEstornoCaixa, mensagemEstornoCaixaConcluido, respostaErroEstornoCaixa } from './estorno-caixa'

const ID = '0f6b7d3e-1c2a-4b5d-8e9f-a1b2c3d4e5f6'

describe('estorno de movimentação do caixa', () => {
  it('exige id válido e motivo com no mínimo 10 caracteres', () => {
    expect(lerEstornoCaixa({ id: 'x', motivo: 'motivo bem longo' }).ok).toBe(false)
    expect(lerEstornoCaixa({ id: ID, motivo: 'curto' }).ok).toBe(false)
    expect(lerEstornoCaixa(null).ok).toBe(false)
  })

  it('usa os padrões da janela: devolver ao estoque e cancelar a prescrição', () => {
    const lido = lerEstornoCaixa({ id: ID, motivo: '  cliente desistiu da compra ' })
    expect(lido).toEqual({ ok: true, value: { movimentoId: ID, motivo: 'cliente desistiu da compra', devolverEstoque: true, prescricaoAcao: 'cancelar' } })
  })

  it('respeita Não devolver e Reabrir; recusa ação desconhecida', () => {
    const lido = lerEstornoCaixa({ id: ID, motivo: 'cliente desistiu da compra', devolverEstoque: false, prescricaoAcao: 'reabrir' })
    expect(lido.ok && lido.value).toMatchObject({ devolverEstoque: false, prescricaoAcao: 'reabrir' })
    expect(lerEstornoCaixa({ id: ID, motivo: 'cliente desistiu da compra', prescricaoAcao: 'apagar' }).ok).toBe(false)
  })

  it('traduz códigos da função SQL', () => {
    expect(respostaErroEstornoCaixa('MOVIMENTO_ALREADY_REVERSED')).toMatchObject({ status: 409, message: 'Esta movimentação já foi estornada.' })
    expect(respostaErroEstornoCaixa('CAIXA_FECHADO').message).toMatch(/Abra o caixa/)
    expect(respostaErroEstornoCaixa('CAIXA_SALDO_INSUFICIENTE').status).toBe(409)
    expect(respostaErroEstornoCaixa('ALGO').status).toBe(500)
  })

  it('mensagem de sucesso diz o que aconteceu', () => {
    expect(mensagemEstornoCaixaConcluido({ produtosDevolvidos: 0, prescricaoStatus: null })).toBe('Movimentação estornada.')
    expect(mensagemEstornoCaixaConcluido({ produtosDevolvidos: 2, prescricaoStatus: 'Cancelado' })).toMatch(/devolvidos ao estoque.*cancelada/)
    expect(mensagemEstornoCaixaConcluido({ produtosDevolvidos: 0, prescricaoStatus: 'Pendente' })).toMatch(/reaberta/)
  })
})
