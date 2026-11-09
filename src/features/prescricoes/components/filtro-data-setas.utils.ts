import { somarDiasIso } from '@/features/relatorios/format'

/** "DD/MM/AAAA" (formato da lista) → "AAAA-MM-DD"; vazio/inválido → null. */
export function dataBrParaIso(valor?: string | null): string | null {
  const partes = (valor ?? '').split('/')
  if (partes.length !== 3 || partes.some((p) => !p)) return null
  const [d, m, a] = partes
  return `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

/** Dia anterior/seguinte ao filtro; sem filtro (todas as datas) parte de hoje. */
export function moverDia(atual: string | null, hoje: string, dias: number): string {
  return somarDiasIso(atual ?? hoje, dias)
}
