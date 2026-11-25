import { afterEach, describe, expect, it, vi } from 'vitest'
import { lerConfigEtiqueta } from './etiqueta-config'
import { calcularLayout, quebrarLinhas } from './etiqueta-layout'
import { imprimirEtiquetas } from './gerar-etiqueta'

const medir = (t: string, pt: number) => t.length * pt * 0.3528 * 0.5
const storage = (v: Record<string, string>) => ({ getItem: (k: string) => v[k] ?? null })

describe('lerConfigEtiqueta', () => {
  it('padrão é 60x40 sem margens', () => {
    expect(lerConfigEtiqueta(storage({}))).toEqual({ larguraMm: 60, alturaMm: 40, margemSuperiorMm: 0, margemEsquerdaMm: 0 })
  })
  it('usa perfil e margens de Configurações > Hardware', () => {
    expect(lerConfigEtiqueta(storage({ pref_printer_profile: 'a4_inkjet', pref_print_margin_top: '1,5', pref_print_margin_left: '2' }))).toEqual({
      larguraMm: 210, alturaMm: 297, margemSuperiorMm: 1.5, margemEsquerdaMm: 2,
    })
  })
})

describe('layout da etiqueta', () => {
  const cfg = { larguraMm: 60, alturaMm: 40, margemSuperiorMm: 0, margemEsquerdaMm: 0 }
  it('quebra por palavras dentro da largura e respeita parágrafos', () => {
    const linhas = quebrarLinhas('um dois três\nquatro', 20, 10, false, medir)
    expect(linhas.length).toBeGreaterThanOrEqual(2)
    expect(linhas.at(-1)).toBe('quatro')
  })
  it('texto longo reduz a fonte para caber na altura', () => {
    const curto = calcularLayout({ paciente: 'A', produto: 'P', modoDeUso: '1 por dia' }, cfg, medir)
    const longo = calcularLayout({ paciente: 'A', produto: 'P', modoDeUso: 'tomar '.repeat(60) }, cfg, medir)
    expect(longo.corpoPt).toBeLessThan(curto.corpoPt)
    expect(longo.linhasUso.length * longo.passoUsoMm).toBeLessThanOrEqual(40 - 6 - 12)
  })
})

describe('imprimirEtiquetas', () => {
  afterEach(() => { document.body.innerHTML = ''; vi.useRealTimers() })
  it('monta uma página por item com @page do tamanho da etiqueta', () => {
    vi.useFakeTimers()
    const ok = imprimirEtiquetas(
      [{ paciente: 'Ana', produto: 'Vit D', modoDeUso: '1 cap' }, { paciente: 'Ana', produto: 'Mg', modoDeUso: '2 caps' }],
      'Natur e Vida',
      { larguraMm: 60, alturaMm: 40, margemSuperiorMm: 1, margemEsquerdaMm: 2 },
    )
    expect(ok).toBe(true)
    const html = document.querySelector('iframe')?.contentDocument?.documentElement.innerHTML ?? ''
    expect(html).toContain('size:60mm 40mm')
    expect(html.match(/<section>/g)).toHaveLength(2)
    expect(html).toContain('Natur e Vida')
    expect(html).toContain('Mg')
  })
})
