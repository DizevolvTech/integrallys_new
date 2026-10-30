export interface OpcaoBusca {
  value: string
  label: string
  /** Texto secundário (perfil, saldo...) — também entra na busca. */
  hint?: string
}

/** Minúsculas e sem acento: "ômega" encontra "OMEGA". */
export function normalizarBusca(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

/** Opções cujo nome (ou dica) contém todos os termos digitados. Sem termo, devolve tudo. */
export function filtrarOpcoes<T extends OpcaoBusca>(opcoes: T[], termo: string): T[] {
  const termos = normalizarBusca(termo).split(/\s+/).filter(Boolean)
  if (termos.length === 0) return opcoes
  return opcoes.filter((opcao) => {
    const alvo = normalizarBusca(`${opcao.label} ${opcao.hint ?? ''}`)
    return termos.every((t) => alvo.includes(t))
  })
}
