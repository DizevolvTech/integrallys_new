/**
 * Taxa de cartão, data de compensação e valor líquido dos recebimentos, a partir da
 * configuração de pagamento (`pagamento.maquininha` ou `pagamento.card_fees`).
 *
 * Regras (a confirmar com a cliente, ver retorno do item 8):
 *  - Pix, dinheiro e transferência: sem taxa, compensam no mesmo dia.
 *  - Débito: sem taxa cadastrada (a configuração só tem taxa de crédito); compensa em prazo_debito.
 *  - Crédito à vista: taxa de 1x; compensa em prazo_credito_avista.
 *  - Crédito parcelado: taxa da faixa de parcelas; 1ª parcela compensa em 30 dias. Com taxa de
 *    antecipação configurada, ela é somada e o total compensa em prazo_credito_avista.
 */
export interface ConfigTaxas {
  taxasPorParcela: Record<number, number>
  taxaAntecipacao: number
  prazoDebitoDias: number
  prazoCreditoAvistaDias: number
}

export const CONFIG_TAXAS_PADRAO: ConfigTaxas = {
  taxasPorParcela: {},
  taxaAntecipacao: 0,
  prazoDebitoDias: 1,
  prazoCreditoAvistaDias: 30,
}

function diasDoPrazo(valor: unknown, padrao: number): number {
  const m = typeof valor === 'string' ? /^D\+(\d+)$/.exec(valor) : null
  return m ? Number(m[1]) : padrao
}

function pct(valor: unknown): number {
  const n = Number(valor)
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : 0
}

/** `valores` são os textos JSON de configuracoes.valor (null quando a chave não existe). */
export function lerConfigTaxas(valores: { maquininha: string | null; cardFees: string | null }): ConfigTaxas {
  const parse = (texto: string | null): Record<string, unknown> | null => {
    if (!texto) return null
    try {
      const v: unknown = JSON.parse(texto)
      return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
    } catch {
      return null
    }
  }
  const maq = parse(valores.maquininha)
  const fees = parse(valores.cardFees)
  const taxasPorParcela: Record<number, number> = {}
  if (maq && Array.isArray(maq.taxas_parcelas)) {
    for (const item of maq.taxas_parcelas as Array<{ parcelas?: unknown; taxa?: unknown }>) {
      const n = Number(item?.parcelas)
      if (Number.isInteger(n) && n >= 1 && n <= 12) taxasPorParcela[n] = pct(item.taxa)
    }
  } else if (fees) {
    for (const [chave, taxa] of Object.entries(fees)) {
      const n = Number(chave)
      if (Number.isInteger(n) && n >= 1 && n <= 12) taxasPorParcela[n] = pct(taxa)
    }
  }
  return {
    taxasPorParcela,
    taxaAntecipacao: pct(maq?.taxa_antecipacao),
    prazoDebitoDias: diasDoPrazo(maq?.prazo_debito, CONFIG_TAXAS_PADRAO.prazoDebitoDias),
    prazoCreditoAvistaDias: diasDoPrazo(maq?.prazo_credito_avista, CONFIG_TAXAS_PADRAO.prazoCreditoAvistaDias),
  }
}

export interface TaxaCalculada {
  taxaPct: number
  desconto: number
  liquido: number
  /** Dias até a compensação a partir do pagamento. */
  diasCompensacao: number
}

export function calcularTaxa(forma: string, parcelas: number, bruto: number, cfg: ConfigTaxas): TaxaCalculada {
  const n = Math.min(12, Math.max(1, Math.trunc(parcelas) || 1))
  let taxaPct = 0
  let dias = 0
  if (forma === 'debito') {
    dias = cfg.prazoDebitoDias
  } else if (forma === 'credito') {
    taxaPct = cfg.taxasPorParcela[n] ?? 0
    if (n === 1) {
      dias = cfg.prazoCreditoAvistaDias
    } else if (cfg.taxaAntecipacao > 0) {
      taxaPct += cfg.taxaAntecipacao
      dias = cfg.prazoCreditoAvistaDias
    } else {
      dias = 30
    }
  }
  const desconto = Math.round(bruto * taxaPct) / 100
  return { taxaPct, desconto, liquido: Math.round((bruto - desconto) * 100) / 100, diasCompensacao: dias }
}

export function somarDias(dataIso: string, dias: number): string {
  const [a, m, d] = dataIso.split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d + dias))
  return dt.toISOString().slice(0, 10)
}

export interface GrupoRecebimento {
  situacao: string
  forma: string
  parcelas: number
  bruto: number
}

export interface TotaisRecebimentos {
  liquidado: { bruto: number; desconto: number; liquido: number }
  aReceber: { bruto: number; desconto: number; liquido: number }
  atrasado: { bruto: number; desconto: number; liquido: number }
}

export function totalizarRecebimentos(grupos: GrupoRecebimento[], cfg: ConfigTaxas): TotaisRecebimentos {
  const zero = () => ({ bruto: 0, desconto: 0, liquido: 0 })
  const totais: TotaisRecebimentos = { liquidado: zero(), aReceber: zero(), atrasado: zero() }
  for (const g of grupos) {
    const alvo = g.situacao === 'liquidado' ? totais.liquidado : g.situacao === 'atrasado' ? totais.atrasado : totais.aReceber
    // Taxa é por transação; o grupo soma transações da mesma faixa, então a taxa sobre a soma é igual.
    const t = calcularTaxa(g.forma, g.parcelas, Number(g.bruto), cfg)
    alvo.bruto += Number(g.bruto)
    alvo.desconto += t.desconto
    alvo.liquido += t.liquido
  }
  for (const alvo of [totais.liquidado, totais.aReceber, totais.atrasado]) {
    alvo.bruto = Math.round(alvo.bruto * 100) / 100
    alvo.desconto = Math.round(alvo.desconto * 100) / 100
    alvo.liquido = Math.round(alvo.liquido * 100) / 100
  }
  return totais
}
