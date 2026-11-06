/** Rolagem horizontal de um elemento (subconjunto de HTMLElement usado aqui). */
export interface AlvoDeRolagem {
  scrollLeft: number
}

/** Copia a posição horizontal de `origem` para `destino`; só mexe quando difere (evita laço de eventos entre as duas barras). */
export function sincronizarRolagem(origem: AlvoDeRolagem, destino: AlvoDeRolagem): boolean {
  if (destino.scrollLeft === origem.scrollLeft) return false
  destino.scrollLeft = origem.scrollLeft
  return true
}

/** A barra de cima só aparece quando o conteúdo é mais largo que a área visível. */
export function precisaBarraNoTopo(larguraConteudo: number, larguraVisivel: number): boolean {
  return larguraConteudo - larguraVisivel > 1
}
