/** Perfil e margens de ajuste fino de Configurações > Hardware (guardados no navegador). */
export interface EtiquetaConfig {
  larguraMm: number
  alturaMm: number
  margemSuperiorMm: number
  margemEsquerdaMm: number
}

export interface EtiquetaDados {
  paciente: string
  produto: string
  modoDeUso: string
}

const PERFIS: Record<string, { larguraMm: number; alturaMm: number }> = {
  thermal_60x40: { larguraMm: 60, alturaMm: 40 },
  a4_inkjet: { larguraMm: 210, alturaMm: 297 },
}

function numero(valor: string | null): number {
  const n = Number((valor ?? '').replace(',', '.'))
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), 20) : 0
}

export function lerConfigEtiqueta(storage: Pick<Storage, 'getItem'> | null = typeof window === 'undefined' ? null : window.localStorage): EtiquetaConfig {
  const perfil = PERFIS[storage?.getItem('pref_printer_profile') ?? ''] ?? PERFIS.thermal_60x40
  return {
    ...perfil,
    margemSuperiorMm: numero(storage?.getItem('pref_print_margin_top') ?? null),
    margemEsquerdaMm: numero(storage?.getItem('pref_print_margin_left') ?? null),
  }
}
