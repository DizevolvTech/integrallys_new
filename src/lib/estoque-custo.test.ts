import { describe, expect, it } from 'vitest'
import { perfilVeCustoEstoque, removerCustoProduto, removerCustoRelatorio } from './estoque-custo'

describe('custo de estoque por perfil', () => {
  it('gestão vê custo; recepção e especialista não', () => {
    expect(['gestor', 'admin', 'master'].every(perfilVeCustoEstoque)).toBe(true)
    expect(perfilVeCustoEstoque('recepcao')).toBe(false)
    expect(perfilVeCustoEstoque('especialista')).toBe(false)
    expect(perfilVeCustoEstoque(undefined)).toBe(false)
  })

  it('produto: recepção mantém venda e perde custo', () => {
    const item = { precoCusto: 10, precoVenda: 30 }
    expect(removerCustoProduto(item, 'recepcao')).toEqual({ precoVenda: 30 })
    expect(removerCustoProduto(item, 'gestor')).toEqual(item)
  })

  it('relatório: remove custo, margem e margemPct em linhas e totais aninhados', () => {
    const rows = [{ id: '1', venda: 5, custo: 2, margem: 3, margemPct: 150 }]
    const totais = { venda: 5, custo: 2, margem: 3, entradas: { quantidade: 1, custo: 2, venda: 5, margemPct: 150 } }
    const r = removerCustoRelatorio(rows, totais, 'recepcao')
    expect(r.rows).toEqual([{ id: '1', venda: 5 }])
    expect(r.totais).toEqual({ venda: 5, entradas: { quantidade: 1, venda: 5 } })
    expect(r.custoOculto).toBe(true)
    expect(removerCustoRelatorio(rows, totais, 'gestor').custoOculto).toBe(false)
  })
})
