import { describe, expect, it } from 'vitest'
import { CONFIG_RELATORIOS } from '@/features/relatorios/relatorio-config'
import { DETALHES_POR_TIPO } from '@/features/relatorios/relatorio-detalhes'

describe('cartões clicáveis dos relatórios', () => {
  it('Recebimentos: todo cartão abre uma lista; situação da tela em conflito deixa a lista vazia', () => {
    const cartoes = CONFIG_RELATORIOS.recebimentos.cartoes?.({ liquidado: {}, aReceber: {}, atrasado: {} }, 0) ?? []
    expect(cartoes.length).toBe(6)
    expect(cartoes.every((c) => ['liquidado', 'a_receber', 'atrasado'].includes(c.detalhe ?? ''))).toBe(true)
    const d = DETALHES_POR_TIPO.recebimentos
    expect(d.filtros({ situacao: 'todos', inicio: '2026-11-01' }, 'atrasado')).toEqual({ situacao: 'atrasado', inicio: '2026-11-01' })
    expect(d.filtros({ situacao: 'liquidado' }, 'liquidado')).toEqual({ situacao: 'liquidado' })
    expect(d.filtros({ situacao: 'liquidado' }, 'atrasado')).toBeNull()
  })

  it('Tarefas: Tarefas, Pendentes, Concluídas e Atrasadas abrem a lista; indicador soma-se ao filtro', () => {
    const cartoes = CONFIG_RELATORIOS.tarefas.cartoes?.({}, 0) ?? []
    expect(cartoes.map((c) => c.detalhe)).toEqual(['todas', 'pendentes', 'concluidas', 'atrasadas'])
    const d = DETALHES_POR_TIPO.tarefas
    expect(d.filtros({ status: 'Pendente' }, 'atrasadas')).toEqual({ status: 'Pendente', indicador: 'atrasadas' })
    expect(d.filtros({ status: 'Pendente' }, 'todas')).toEqual({ status: 'Pendente' })
  })

  it('Desempenho continua com os seis indicadores', () => {
    expect(DETALHES_POR_TIPO.desempenho.filtros({ inicio: 'a' }, 'taxa')).toEqual({ inicio: 'a', metrica: 'taxa' })
    expect(DETALHES_POR_TIPO.desempenho.tipo).toBe('desempenho-detalhe')
  })
})

describe('Estoque (posição): Venda total', () => {
  const cartoes = CONFIG_RELATORIOS['estoque-posicao'].cartoes
  const base = { produtos: 3, quantidade: 10, custo: 5, margem: 1, margemPct: 10 }
  it('aparece quando o servidor envia o total de venda', () => {
    expect(cartoes?.({ ...base, venda: 20 }, 3).map((c) => c.label)).toContain('Venda total')
  })
  it('some quando o servidor omite o total de venda (recepção)', () => {
    expect(cartoes?.(base, 3).map((c) => c.label)).not.toContain('Venda total')
  })
})

describe('#1645 Consultas e Meus repasses', () => {
  it('Consultas: os cinco cartões abrem lista com o indicador e a coluna é Comparecimento + % pago', () => {
    const cartoes = CONFIG_RELATORIOS.consultas.cartoes?.({ recebido: 1, aberto: 1 }, 3) ?? []
    expect(cartoes.map((c) => c.detalhe)).toEqual(['recebido', 'aberto', 'registros', 'presenca', 'retornos'])
    expect(DETALHES_POR_TIPO.consultas.filtros({ inicio: '2026-11-01' }, 'aberto')).toEqual({ inicio: '2026-11-01', indicador: 'aberto' })
    const labels = CONFIG_RELATORIOS.consultas.colunas.map((c) => c.label)
    expect(labels).toContain('Comparecimento do paciente')
    expect(labels).not.toContain('Presença (histórico)')
    expect(labels.slice(-4)).toEqual(['Valor', 'Pago', 'Em aberto', '% pago'])
    const colunas = DETALHES_POR_TIPO.consultas.colunas(CONFIG_RELATORIOS.consultas, 'aberto').map((c) => c.key)
    expect(colunas).toEqual(expect.arrayContaining(['paciente', 'data', 'valor', 'pago', 'aberto', 'recebidoEm']))
  })

  it('Repasse: cartões Já recebido e Falta receber abrem lista; situação da tela oposta deixa a lista vazia', () => {
    const t = { atendimentos: 2, valor: 10, repasse: 3, jaRecebido: 1, faltaReceber: 2, semPercentual: 0 }
    const cartoes = CONFIG_RELATORIOS.repasse.cartoes?.(t, 3) ?? []
    expect(cartoes.map((c) => c.label)).toEqual(expect.arrayContaining(['Já recebido', 'Falta receber']))
    expect(cartoes.every((c) => c.detalhe)).toBe(true)
    expect(cartoes.map((c) => c.label)).not.toContain('Sem percentual cadastrado')
    expect(CONFIG_RELATORIOS.repasse.cartoes?.({ ...t, semPercentual: 2 }, 3).map((c) => c.label)).toContain('Sem percentual cadastrado')
    const d = DETALHES_POR_TIPO.repasse
    expect(d.filtros({ situacao: 'todos' }, 'falta')).toEqual({ situacao: 'atendido', repasse: 'falta' })
    expect(d.filtros({ situacao: 'cancelado' }, 'recebido')).toBeNull()
    expect(d.filtros({}, 'cancelados')).toEqual({ situacao: 'cancelado' })
  })

  it('Repasse: coluna de situação existe e percentual vazio avisa só quando falta o cadastro', () => {
    const cols = CONFIG_RELATORIOS.repasse.colunas
    expect(cols.map((c) => c.label)).toContain('Situação do repasse')
    expect(cols.find((c) => c.key === 'percentual')).toMatchObject({ vazio: 'Percentual não cadastrado', vazioSe: 'semRegra' })
  })
})
