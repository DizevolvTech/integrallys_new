import { describe, expect, it } from 'vitest'
import { resumosDeValidade } from '@/features/relatorios/estoque-validade-resumo'

describe('resumo de validade do estoque', () => {
  it('sem dados não mostra nada', () => {
    expect(resumosDeValidade(null)).toEqual([])
  })

  it('quatro faixas com quantidade e itens (produto, lote, validade)', () => {
    const r = resumosDeValidade({
      grupos: {
        vencidos: { total: 1, itens: [{ id: '1', produto: 'Soro', lote: 'L9', validade: '2026-10-01', quantidade: 4 }] },
        sem_validade: { total: 2, itens: [{ id: '2', produto: 'Luvas', lote: '—', validade: null, quantidade: 120 }] },
      },
    })
    expect(r.map((x) => x.titulo)).toEqual([
      'Vencidos — 1 produto',
      'Vencem em até 60 dias — 0 produtos',
      'Validade acima de 60 dias — 0 produtos',
      'Sem validade — 2 produtos',
    ])
    expect(r[0].itens).toEqual([{ nome: 'Soro · lote L9', valor: '01/10/2026 · 4 un.' }])
    expect(r[1].itens).toEqual([])
    expect(r[3].itens).toEqual([
      { nome: 'Luvas', valor: '120 un.' },
      { nome: '… e mais 1 produtos', valor: '' },
    ])
  })
})
