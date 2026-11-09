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

import { describe as d4, expect as e4, it as i4 } from 'vitest'
import { resumirValidade } from '@/lib/relatorios/prescricoes-validade'

d4('Consultas e Justificativas: resumos por profissional', () => {
  i4('Consultas: um quadro por indicador, sem profissional zerado', () => {
    const r = CONFIG_RELATORIOS.consultas.resumos!({
      porProfissional: [
        { nome: 'Dra. Maria Santos', atendimentos: 22, efetivados: 8, retornos: 3, novas: 5 },
        { nome: 'Dr. João Silva', atendimentos: 7, efetivados: 0, retornos: 0, novas: 0 },
      ],
    })
    e4(r.map((x) => x.titulo)).toEqual([
      'Atendimentos por profissional', 'Efetivados por profissional', 'Retornos por profissional', 'Consultas novas por profissional',
    ])
    e4(r[0].itens).toEqual([{ nome: 'Dra. Maria Santos', valor: '22' }, { nome: 'Dr. João Silva', valor: '7' }])
    e4(r[2].itens).toEqual([{ nome: 'Dra. Maria Santos', valor: '3' }])
  })

  i4('Justificativas: profissional · mês com cancelamentos e faltas', () => {
    const r = CONFIG_RELATORIOS.justificativas.resumos!({
      porProfissionalMes: [
        { nome: 'Dra. Maria Santos', mes: '2026-11', cancelamentos: 3, faltas: 1 },
        { nome: 'Dr. João Silva', mes: '2026-10', cancelamentos: 0, faltas: 2 },
        { nome: 'Dr. João Silva', mes: '2026-09', cancelamentos: 1, faltas: 0 },
      ],
    })
    e4(r[0].itens).toEqual([
      { nome: 'Dra. Maria Santos · Novembro/2026', valor: '3 cancelamentos, 1 falta' },
      { nome: 'Dr. João Silva · Outubro/2026', valor: '2 faltas' },
      { nome: 'Dr. João Silva · Setembro/2026', valor: '1 cancelamento' },
    ])
  })
})

d4('Orçamentos/Prescrição: resumo de validade', () => {
  i4('só em aberto; vencidos, em breve, no prazo, sem validade com quantidade e valor', () => {
    const r = resumirValidade([
      { classe: 'vencida', situacao: 'vencido', valorTotal: 100 },
      { classe: 'ativa', situacao: 'limite_prazo', valorTotal: 50 },
      { classe: 'ativa', situacao: 'no_prazo', valorTotal: 10 },
      { classe: 'ativa', situacao: 'no_prazo', valorTotal: 15 },
      { classe: 'ativa', situacao: 'sem_validade', valorTotal: 7 },
      { classe: 'concluida', situacao: 'vencido', valorTotal: 999 },
      { classe: 'outra', situacao: 'no_prazo', valorTotal: 999 },
    ])
    e4(r).toEqual([
      { faixa: 'vencidos', qtd: 1, valor: 100 },
      { faixa: 'vencem_em_breve', qtd: 1, valor: 50 },
      { faixa: 'no_prazo', qtd: 2, valor: 25 },
      { faixa: 'sem_validade', qtd: 1, valor: 7 },
    ])
  })
})
