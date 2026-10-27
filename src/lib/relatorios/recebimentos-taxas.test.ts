import { describe, expect, it } from 'vitest'
import {
  CONFIG_TAXAS_PADRAO,
  calcularTaxa,
  lerConfigTaxas,
  somarDias,
  totalizarRecebimentos,
  type ConfigTaxas,
} from '@/lib/relatorios/recebimentos-taxas'

const cfg: ConfigTaxas = {
  taxasPorParcela: { 1: 2, 2: 3.5, 3: 4.5 },
  taxaAntecipacao: 0,
  prazoDebitoDias: 1,
  prazoCreditoAvistaDias: 30,
}

describe('calcularTaxa', () => {
  it('pix e dinheiro não têm taxa e compensam no dia', () => {
    expect(calcularTaxa('pix', 1, 100, cfg)).toMatchObject({ taxaPct: 0, desconto: 0, liquido: 100, diasCompensacao: 0 })
    expect(calcularTaxa('dinheiro', 1, 100, cfg).liquido).toBe(100)
  })

  it('débito compensa no prazo de débito e não tem taxa cadastrada', () => {
    expect(calcularTaxa('debito', 1, 120, cfg)).toMatchObject({ taxaPct: 0, liquido: 120, diasCompensacao: 1 })
  })

  it('crédito à vista usa a taxa de 1x e o prazo à vista', () => {
    expect(calcularTaxa('credito', 1, 200, cfg)).toMatchObject({ taxaPct: 2, desconto: 4, liquido: 196, diasCompensacao: 30 })
  })

  it('crédito parcelado usa a taxa da faixa e compensa a 1ª parcela em 30 dias', () => {
    expect(calcularTaxa('credito', 2, 240, cfg)).toMatchObject({ taxaPct: 3.5, desconto: 8.4, liquido: 231.6, diasCompensacao: 30 })
  })

  it('com taxa de antecipação soma ao parcelado e compensa no prazo à vista', () => {
    const comAntecipacao = { ...cfg, taxaAntecipacao: 1.5, prazoCreditoAvistaDias: 14 }
    expect(calcularTaxa('credito', 3, 300, comAntecipacao)).toMatchObject({ taxaPct: 6, desconto: 18, liquido: 282, diasCompensacao: 14 })
    expect(calcularTaxa('credito', 1, 300, comAntecipacao).taxaPct).toBe(2)
  })

  it('parcelas fora da faixa sem taxa cadastrada ficam sem desconto', () => {
    expect(calcularTaxa('credito', 9, 100, cfg).taxaPct).toBe(0)
  })
})

describe('lerConfigTaxas', () => {
  it('sem configuração não aplica taxa nenhuma', () => {
    expect(lerConfigTaxas({ maquininha: null, cardFees: null })).toMatchObject({ taxasPorParcela: {}, taxaAntecipacao: 0 })
  })

  it('maquininha tem prioridade sobre card_fees e lê os prazos', () => {
    const maq = JSON.stringify({
      taxas_parcelas: [{ parcelas: 1, taxa: 2.9 }, { parcelas: 2, taxa: 4 }],
      taxa_antecipacao: 1.2,
      prazo_debito: 'D+2',
      prazo_credito_avista: 'D+14',
    })
    const lida = lerConfigTaxas({ maquininha: maq, cardFees: JSON.stringify({ 1: 9 }) })
    expect(lida.taxasPorParcela).toEqual({ 1: 2.9, 2: 4 })
    expect(lida).toMatchObject({ taxaAntecipacao: 1.2, prazoDebitoDias: 2, prazoCreditoAvistaDias: 14 })
  })

  it('usa card_fees quando não há maquininha e ignora JSON quebrado ou taxa inválida', () => {
    expect(lerConfigTaxas({ maquininha: null, cardFees: JSON.stringify({ 1: 3, 2: 250, x: 1 }) }).taxasPorParcela).toEqual({ 1: 3, 2: 0 })
    expect(lerConfigTaxas({ maquininha: '{quebrado', cardFees: null })).toEqual(CONFIG_TAXAS_PADRAO)
  })
})

describe('totalizarRecebimentos', () => {
  it('soma bruto, desconto e líquido separando liquidado de a receber', () => {
    const totais = totalizarRecebimentos(
      [
        { situacao: 'liquidado', forma: 'pix', parcelas: 1, bruto: 100 },
        { situacao: 'liquidado', forma: 'credito', parcelas: 2, bruto: 240 },
        { situacao: 'a_receber', forma: 'nao_informado', parcelas: 1, bruto: 90 },
        { situacao: 'atrasado', forma: 'nao_informado', parcelas: 1, bruto: 250 },
      ],
      cfg,
    )
    expect(totais.liquidado).toEqual({ bruto: 340, desconto: 8.4, liquido: 331.6 })
    expect(totais.aReceber).toEqual({ bruto: 90, desconto: 0, liquido: 90 })
    expect(totais.atrasado).toEqual({ bruto: 250, desconto: 0, liquido: 250 })
  })
})

describe('somarDias', () => {
  it('atravessa mês e ano', () => {
    expect(somarDias('2026-10-25', 10)).toBe('2026-11-04')
    expect(somarDias('2026-12-20', 30)).toBe('2027-01-19')
  })
})
