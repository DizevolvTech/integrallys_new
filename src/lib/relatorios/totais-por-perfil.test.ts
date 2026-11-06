import { describe, expect, it } from 'vitest'
import { metricaDesempenhoValida, ocultarTotaisFinanceirosDaRecepcao } from '@/lib/relatorios/totais-por-perfil'

const totais = { recebido: 100, aberto: 50, realizadas: 3, agendadas: 4, retornos: 1 }

describe('totais financeiros de Consultas por perfil', () => {
  it('recepção não recebe recebido nem em aberto, mas mantém os demais totais', () => {
    const r = ocultarTotaisFinanceirosDaRecepcao('consultas', 'recepcao', totais)
    expect(r).not.toHaveProperty('recebido')
    expect(r).not.toHaveProperty('aberto')
    expect(r).toMatchObject({ realizadas: 3, agendadas: 4, retornos: 1 })
    expect(totais.recebido).toBe(100)
  })

  it.each(['gestor', 'admin', 'master', 'especialista'])('%s continua recebendo tudo', (perfil) => {
    expect(ocultarTotaisFinanceirosDaRecepcao('consultas', perfil, totais)).toEqual(totais)
  })

  it('não mexe em outros relatórios da recepção', () => {
    expect(ocultarTotaisFinanceirosDaRecepcao('recebimentos', 'recepcao', totais)).toEqual(totais)
    expect(ocultarTotaisFinanceirosDaRecepcao('agendamentos', 'recepcao', totais)).toEqual(totais)
  })
})

describe('indicador do detalhe do Desempenho geral', () => {
  it('aceita só os seis cartões', () => {
    for (const m of ['agendamentos', 'realizados', 'cancelados', 'faltas', 'pacientes', 'taxa']) {
      expect(metricaDesempenhoValida(m)).toBe(true)
    }
    for (const m of ['', 'todos', "x'; drop", undefined, 3]) expect(metricaDesempenhoValida(m)).toBe(false)
  })
})
