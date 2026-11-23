/** Cronômetro e média de espera do paciente (check-in → início do atendimento). Funções puras. */

/** Milissegundos desde o check-in; null quando não há check-in válido. `agoraMs` já vem corrigido pelo relógio do servidor. */
export function esperaDesdeCheckin(
  checkinEm: string | null | undefined,
  agoraMs: number,
): number | null {
  if (!checkinEm) return null
  const inicio = Date.parse(checkinEm)
  if (Number.isNaN(inicio)) return null
  return Math.max(0, agoraMs - inicio)
}

/** Espera já encerrada (check-in → início do atendimento) em milissegundos; null se faltar um dos registros. */
export function esperaEntre(
  checkinEm: string | null | undefined,
  inicioEm: string | null | undefined,
): number | null {
  if (!checkinEm || !inicioEm) return null
  const a = Date.parse(checkinEm)
  const b = Date.parse(inicioEm)
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null
  return b - a
}

const dois = (n: number) => String(n).padStart(2, '0')

/** Cronômetro: "05:09" até 1 h; "1:05:09" depois. */
export function formatarCronometro(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${dois(m)}:${dois(s)}` : `${dois(m)}:${dois(s)}`
}

/** Minutos legíveis: "menos de 1 min", "12 min", "1 h 05 min". */
export function formatarMinutos(minutos: number | string | null | undefined): string {
  const n = Number(minutos)
  if (minutos === null || minutos === undefined || minutos === '' || !Number.isFinite(n)) return '—'
  if (n < 1) return 'menos de 1 min'
  const total = Math.round(n)
  if (total < 60) return `${total} min`
  return `${Math.floor(total / 60)} h ${dois(total % 60)} min`
}

/** Média simples em minutos (1 casa); null sem valores. */
export function mediaMinutos(valores: number[]): number | null {
  const validos = valores.filter((v) => Number.isFinite(v))
  if (validos.length === 0) return null
  return Math.round((validos.reduce((a, b) => a + b, 0) / validos.length) * 10) / 10
}
