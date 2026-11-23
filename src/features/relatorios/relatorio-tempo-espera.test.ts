import { describe, expect, it } from 'vitest'
import { textoDaCelula } from '@/features/relatorios/exportar-relatorio'
import { CONFIG_RELATORIOS } from '@/features/relatorios/relatorio-config'
import { abasDoPerfil, perfilPodeVerRelatorio } from '@/lib/relatorios/registry'

describe('Relatório Tempo de espera', () => {
  const config = CONFIG_RELATORIOS['tempo-espera']
  const totais = {
    qtd: 3,
    mediaMin: 12.4,
    maiorMin: 30,
    porEspecialista: [
      { nome: 'Dra. Ana', qtd: 2, mediaMin: 15 },
      { nome: 'Dr. João', qtd: 1, mediaMin: 6 },
    ],
  }

  it('cartões: média geral com a quantidade medida e maior espera', () => {
    const cartoes = config.cartoes?.(totais, 2) ?? []
    expect(cartoes[0]).toMatchObject({
      label: 'Espera média geral (3 atendimentos)',
      valor: '12 min',
    })
    expect(cartoes[1]).toMatchObject({ label: 'Maior espera', valor: '30 min' })
    expect(config.cartoes?.({ qtd: 0, mediaMin: null, maiorMin: null }, 0)[0].valor).toBe('—')
  })

  it('resumo por especialista e coluna em minutos legíveis', () => {
    expect(config.resumos?.(totais)[0].itens).toEqual([
      { nome: 'Dra. Ana', valor: '15 min · 2 atendimentos' },
      { nome: 'Dr. João', valor: '6 min · 1 atendimento' },
    ])
    const coluna = config.colunas.find((c) => c.key === 'mediaMin')!
    expect(textoDaCelula(coluna, 65)).toBe('1 h 05 min')
  })

  it('só gestão e recepção veem; especialista e paciente não', () => {
    for (const perfil of ['admin', 'master', 'gestor', 'recepcao']) {
      expect(perfilPodeVerRelatorio(perfil, 'tempo-espera')).toBe(true)
      expect(abasDoPerfil(perfil).map((a) => a.id)).toContain('tempo-espera')
    }
    for (const perfil of ['especialista', 'paciente']) {
      expect(perfilPodeVerRelatorio(perfil, 'tempo-espera')).toBe(false)
      expect(abasDoPerfil(perfil).map((a) => a.id)).not.toContain('tempo-espera')
    }
  })
})
