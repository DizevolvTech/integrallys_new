import { describe, expect, it } from 'vitest'
import { CONFIG_RELATORIOS, DETALHES_DESEMPENHO } from '@/features/relatorios/relatorio-config'

describe('Desempenho geral: cartões clicáveis', () => {
  const cartoes = CONFIG_RELATORIOS.desempenho.cartoes?.({ agendamentos: 38, realizados: 8, taxaConclusaoPct: 21.1 }, 0) ?? []

  it('os seis cartões abrem um detalhe conhecido', () => {
    expect(cartoes.map((c) => c.label)).toEqual([
      'Agendamentos', 'Realizados', 'Cancelados', 'Não compareceram', 'Pacientes atendidos', 'Taxa de conclusão',
    ])
    for (const c of cartoes) expect(DETALHES_DESEMPENHO[c.detalhe ?? '']).toBe(c.label)
  })
})

describe('Consultas: totalizadores financeiros só quando o servidor os envia', () => {
  const cartoes = CONFIG_RELATORIOS.consultas.cartoes!
  const rotulos = (t: Record<string, unknown>) => cartoes(t, 5).map((c) => c.label)

  it('sem recebido/aberto (recepção) a tela não mostra os dois totais', () => {
    const r = rotulos({ realizadas: 1, agendadas: 2, retornos: 0, pacientes: 1 })
    expect(r).not.toContain('Total recebido')
    expect(r).not.toContain('Total em aberto')
    expect(r).toContain('Registros')
  })

  it('com os totais (gestor/admin) os dois aparecem', () => {
    const r = rotulos({ recebido: 10, aberto: 5 })
    expect(r).toEqual(expect.arrayContaining(['Total recebido', 'Total em aberto']))
  })
})

describe('Pacientes: sexo, faixa etária e resumos novos', () => {
  const filtros = CONFIG_RELATORIOS.pacientes.filtros
  it('filtro Sexo e filtro Faixa etária com as opções pedidas', () => {
    expect(filtros.find((f) => f.key === 'sexo')?.opcoes?.map((o) => o.label)).toEqual(['Todos', 'Feminino', 'Masculino', 'Não informado'])
    const faixas = filtros.find((f) => f.key === 'faixa_etaria')?.opcoes?.map((o) => o.value)
    expect(faixas).toEqual(['todos', 'ate_14', '15_24', '25_34', '35_44', '45_54', '55_64', '65_mais', 'nao_informado'])
  })

  it('Por sexo e Por faixa etária (quantidade e %)', () => {
    const r = CONFIG_RELATORIOS.pacientes.resumos!({
      porSexo: [{ nome: 'Feminino', qtd: 4 }, { nome: 'Masculino', qtd: 7 }],
      porFaixaEtaria: [{ nome: '25 a 34 anos', qtd: 5, pct: 31.3 }],
    })
    expect(r.map((x) => x.titulo)).toEqual(['Por mídia', 'Por cidade', 'Por convênio', 'Por sexo', 'Por faixa etária'])
    expect(r[3].itens).toEqual([
      { nome: 'Feminino', valor: '4 · 36,4%' },
      { nome: 'Masculino', valor: '7 · 63,6%' },
    ])
    expect(r[4].itens[0].valor).toBe('5 · 31,3%')
  })
})

describe('Vendas: três rankings separados', () => {
  it('Produtos, Consultas e Procedimentos, em ordem, depois da forma de pagamento', () => {
    const r = CONFIG_RELATORIOS.vendas.resumos!({
      porForma: [{ forma: 'pix', qtd: 2, valor: 100 }],
      rankProdutos: [{ nome: 'Vitamina D', quantidade: 3, valor: 90 }, { nome: 'Kit', quantidade: 1, valor: 20 }],
      rankConsultas: [{ nome: 'Consulta Clínica Geral', quantidade: 2, valor: 360 }],
      rankProcedimentos: [],
    })
    expect(r.map((x) => x.titulo)).toEqual(['Por forma de pagamento', 'Produtos', 'Consultas', 'Procedimentos'])
    expect(r[1].itens.map((i) => i.nome)).toEqual(['1º Vitamina D', '2º Kit'])
    expect(r[3].itens).toEqual([])
    expect(r[3].vazio).toBeTruthy()
  })
})

import { percentuaisQueSomam100 } from './relatorio-config'
import { describe as d2, expect as e2, it as i2 } from 'vitest'
d2('percentuaisQueSomam100', () => {
  i2('fecha em 100 com 4/1/7', () => {
    const p = percentuaisQueSomam100([4, 1, 7])
    e2(Math.round(p.reduce((a, b) => a + b, 0) * 10)).toBe(1000)
    e2(p.every((x) => [33.3, 33.4, 8.3, 8.4, 58.3, 58.4].includes(x))).toBe(true)
  })
  i2('total zero', () => e2(percentuaisQueSomam100([0, 0])).toEqual([0, 0]))
})
