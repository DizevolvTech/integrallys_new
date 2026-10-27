/** Convênios usados nos cadastros, sem repetição (ignora caixa), do mais frequente ao menos; "Particular" sempre fica de fora (é o padrão). */
export function listarConveniosEmUso(valores: string[]): string[] {
  const contagem = new Map<string, { nome: string; qtd: number }>()
  for (const bruto of valores) {
    const nome = bruto.trim()
    if (!nome || nome.toLowerCase() === 'particular') continue
    const chave = nome.toLowerCase()
    const atual = contagem.get(chave)
    if (atual) atual.qtd += 1
    else contagem.set(chave, { nome, qtd: 1 })
  }
  return [...contagem.values()].sort((a, b) => b.qtd - a.qtd || a.nome.localeCompare(b.nome, 'pt-BR')).map((c) => c.nome)
}
