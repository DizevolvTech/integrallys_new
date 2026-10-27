/** Aceita "dd/mm/aaaa" (como a tela exibe) ou "aaaa-mm-dd" e devolve "aaaa-mm-dd"; null se inválida. */
export function dataBrParaIso(valor: unknown): string | null {
  const texto = String(valor ?? '').trim()
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto)
  const iso = br ? `${br[3]}-${br[2]}-${br[1]}` : /^\d{4}-\d{2}-\d{2}$/.test(texto) ? texto : null
  if (!iso) return null
  const d = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso
}
