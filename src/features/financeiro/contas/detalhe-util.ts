import type { GrupoDetalhe, LinhaDetalhe } from './detalhe-grupos-modal'

export type LinhaAgrupavel = LinhaDetalhe & { grupo: string }

/** Agrupa linhas (ex.: lançamentos) por forma/categoria, maior total primeiro. */
export function montarGrupos(linhas: LinhaAgrupavel[]): GrupoDetalhe[] {
  const mapa = new Map<string, GrupoDetalhe>()
  for (const { grupo, ...linha } of linhas) {
    const atual = mapa.get(grupo) ?? { chave: grupo, rotulo: grupo, total: 0, linhas: [] }
    atual.total = Math.round((atual.total + linha.valor) * 100) / 100
    atual.linhas.push(linha)
    mapa.set(grupo, atual)
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total)
}

export function totalDosGrupos(grupos: GrupoDetalhe[]): number {
  return Math.round(grupos.reduce((soma, grupo) => soma + grupo.total, 0) * 100) / 100
}
