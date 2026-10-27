import { describe, expect, it } from 'vitest'
import { CONFIG_RELATORIOS } from '@/features/relatorios/relatorio-config'
import { colunasDestaque } from './relatorio-cartoes-mobile'

describe('cartão do relatório no celular', () => {
  it('usa as colunas indicadas na config', () => {
    const { titulo, valor, selo } = colunasDestaque(CONFIG_RELATORIOS.recebimentos)
    expect([titulo?.key, valor?.key, selo?.key]).toEqual(['cliente', 'bruto', 'situacao'])
  })

  it('sem indicação escolhe a 1ª coluna de texto, a 1ª de dinheiro e a 1ª badge', () => {
    const { titulo, valor, selo } = colunasDestaque(CONFIG_RELATORIOS.tarefas)
    expect(titulo?.key).toBe('titulo')
    expect(valor).toBeUndefined()
    expect(selo?.key).toBe('status')
  })

  it('toda aba de relatório tem título para o cartão', () => {
    for (const [tipo, config] of Object.entries(CONFIG_RELATORIOS)) {
      expect(colunasDestaque(config).titulo, tipo).toBeDefined()
    }
  })
})

describe('recorrência em Consultas', () => {
  const { cartoes, colunas, legenda } = CONFIG_RELATORIOS.consultas
  it('tem colunas, legenda e cartões de presença e retornos', () => {
    expect(colunas.map((c) => c.key)).toEqual(expect.arrayContaining(['presencaPeriodoPct', 'realizadasPeriodo', 'agendadasPeriodo', 'retornos']))
    expect(legenda).toMatch(/Presença no período/)
    const lista = cartoes?.({ recebido: 0, aberto: 0, realizadas: 4, agendadas: 14, presencaPct: 28.6, retornos: 1, pacientes: 9 }, 19) ?? []
    const presenca = lista.find((c) => c.label.startsWith('Presença na clínica'))
    expect(presenca?.label).toContain('4 de 14')
    expect(presenca?.valor).toBe('28,6%')
    expect(lista.find((c) => c.label.startsWith('Retornos'))?.valor).toBe('1')
  })
  it('sem consultas agendadas mostra traço, não 0%', () => {
    const lista = cartoes?.({ realizadas: 0, agendadas: 0, presencaPct: null }, 0) ?? []
    expect(lista.find((c) => c.label.startsWith('Presença na clínica'))?.valor).toBe('—')
  })
})
