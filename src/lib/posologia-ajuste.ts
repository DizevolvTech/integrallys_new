/** Regras puras do Ajuste de posologia: janela de 30 dias e um item por produto (o mais recente). */
export const DIAS_AJUSTE_POSOLOGIA = 30
export const MAX_POSOLOGIA = 500

export interface ItemPrescritoBruto {
  id: string
  prescricaoId: string
  produtoId: string | null
  descricao: string
  posologia: string | null
  dataPrescricao: string
  criadoEm: string
}

export interface ItemAjustavel {
  itemId: string
  prescricaoId: string
  produto: string
  posologia: string
  dataPrescricao: string
}

/** Primeiro dia da janela (YYYY-MM-DD), contando `dias` para trás a partir de `hojeIso`. */
export function inicioJanelaPosologia(hojeIso: string, dias = DIAS_AJUSTE_POSOLOGIA): string {
  const data = new Date(`${hojeIso}T00:00:00Z`)
  data.setUTCDate(data.getUTCDate() - dias)
  return data.toISOString().slice(0, 10)
}

function chaveProduto(item: ItemPrescritoBruto): string {
  return item.produtoId ?? `desc:${item.descricao.trim().toLowerCase()}`
}

/** Um item por produto, o da prescrição mais recente; ordem por produto (nome). */
export function itensMaisRecentesPorProduto(itens: ItemPrescritoBruto[]): ItemAjustavel[] {
  const maisRecente = new Map<string, ItemPrescritoBruto>()
  for (const item of itens) {
    const chave = chaveProduto(item)
    const atual = maisRecente.get(chave)
    const mais =
      !atual ||
      item.dataPrescricao > atual.dataPrescricao ||
      (item.dataPrescricao === atual.dataPrescricao && item.criadoEm > atual.criadoEm)
    if (mais) maisRecente.set(chave, item)
  }
  return [...maisRecente.values()]
    .map((item) => ({
      itemId: item.id,
      prescricaoId: item.prescricaoId,
      produto: item.descricao,
      posologia: (item.posologia ?? '').trim(),
      dataPrescricao: item.dataPrescricao,
    }))
    .sort((a, b) => a.produto.localeCompare(b.produto, 'pt-BR'))
}
