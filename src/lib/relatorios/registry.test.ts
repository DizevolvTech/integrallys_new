import { describe, expect, it } from 'vitest'
import { abasDoPerfil, perfilPodeVerRelatorio } from '@/lib/relatorios/registry'

const ids = (perfil: string) => abasDoPerfil(perfil).map((a) => a.id)

describe('abas de Relatórios por perfil', () => {
  it('recepção não vê Financeiro, Repasse, Comissões nem relatórios corporativos', () => {
    const abas = ids('recepcao')
    for (const proibida of ['financeiro', 'repasse', 'comissoes', 'ranking', 'caixa-gestor', 'comparativo']) {
      expect(abas).not.toContain(proibida)
    }
    expect(abas).toEqual(expect.arrayContaining(['consultas', 'recebimentos', 'estoque', 'vendas', 'pacientes']))
  })

  it('especialista: Meus repasses fica entre Desempenho geral e Minhas comissões', () => {
    const abas = abasDoPerfil('especialista')
    expect(abas.slice(0, 3).map((a) => a.label)).toEqual(['Desempenho geral', 'Meus repasses', 'Minhas comissões'])
    expect(abas.find((a) => a.id === 'repasse')?.proprio).toBe(true)
    expect(abas.find((a) => a.id === 'comissoes')?.proprio).toBe(true)
  })

  it('gestor e administrador veem os mesmos relatórios, incluindo aniversariantes', () => {
    expect(ids('gestor')).toEqual(ids('admin'))
    expect(ids('gestor')).toEqual(expect.arrayContaining(['aniversariantes', 'financeiro', 'comissoes', 'repasse']))
  })

  it('paciente não tem aba de relatórios', () => {
    expect(abasDoPerfil('paciente')).toEqual([])
  })

  it('o servidor nega relatório financeiro à recepção e dados de gestão ao especialista', () => {
    expect(perfilPodeVerRelatorio('recepcao', 'financeiro')).toBe(false)
    expect(perfilPodeVerRelatorio('recepcao', 'recebimentos')).toBe(true)
    expect(perfilPodeVerRelatorio('especialista', 'financeiro')).toBe(false)
    expect(perfilPodeVerRelatorio('especialista', 'vendas')).toBe(false)
    expect(perfilPodeVerRelatorio('especialista', 'comissoes')).toBe(true)
    expect(perfilPodeVerRelatorio('paciente', 'consultas')).toBe(false)
  })
})
