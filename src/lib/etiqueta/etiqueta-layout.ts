import type { EtiquetaConfig, EtiquetaDados } from './etiqueta-config'

/** Mede o texto em mm com a fonte e o corpo (pt) dados. */
export type Medidor = (texto: string, corPt: number, negrito: boolean) => number

export interface EtiquetaLayout {
  marcaPt: number
  corpoPt: number
  linhasUso: string[]
  linhasPaciente: string[]
  linhasProduto: string[]
  passoUsoMm: number
}

const PT_MM = 0.3528

export function quebrarLinhas(texto: string, larguraMm: number, corpoPt: number, negrito: boolean, medir: Medidor): string[] {
  const saida: string[] = []
  for (const paragrafo of texto.split(/\r?\n/)) {
    let atual = ''
    for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      const teste = atual ? `${atual} ${palavra}` : palavra
      if (medir(teste, corpoPt, negrito) <= larguraMm || !atual) atual = teste
      else {
        saida.push(atual)
        atual = palavra
      }
    }
    saida.push(atual)
  }
  return saida
}

/** Área útil (mm) e, escolhida a maior fonte que cabe, as linhas de cada bloco. */
export function calcularLayout(dados: EtiquetaDados, cfg: EtiquetaConfig, medir: Medidor): EtiquetaLayout & { areaLarguraMm: number } {
  const margem = 3
  const areaLarguraMm = cfg.larguraMm - margem * 2 - cfg.margemEsquerdaMm
  const alturaUtil = cfg.alturaMm - margem * 2 - cfg.margemSuperiorMm
  const marcaPt = 9
  const linhasPaciente = quebrarLinhas(dados.paciente, areaLarguraMm, 7, false, medir).slice(0, 1)
  const linhasProduto = quebrarLinhas(dados.produto, areaLarguraMm, 7.5, true, medir).slice(0, 2)
  const fixo = 6 + 3 + linhasPaciente.length * 3 + linhasProduto.length * 3.2 + 3.5
  const restante = alturaUtil - fixo
  let corpoPt = 10
  let linhasUso: string[] = []
  for (; corpoPt >= 4.5; corpoPt -= 0.5) {
    linhasUso = quebrarLinhas(dados.modoDeUso, areaLarguraMm, corpoPt, false, medir)
    if (linhasUso.length * corpoPt * PT_MM * 1.25 <= restante) break
  }
  const passoUsoMm = corpoPt * PT_MM * 1.25
  const maxLinhas = Math.max(1, Math.floor(restante / passoUsoMm))
  return { marcaPt, corpoPt, linhasUso: linhasUso.slice(0, maxLinhas), linhasPaciente, linhasProduto, passoUsoMm, areaLarguraMm }
}
