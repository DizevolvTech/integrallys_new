/** Idade em anos completos a partir de uma data ISO (AAAA-MM-DD); null se ausente/invalida. */
export function calcularIdade(dataIso?: string | null, hoje: Date = new Date()): number | null {
  const texto = (dataIso ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null
  const nasc = new Date(`${texto}T12:00:00`)
  if (Number.isNaN(nasc.getTime())) return null
  let idade = hoje.getFullYear() - nasc.getFullYear()
  const m = hoje.getMonth() - nasc.getMonth()
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--
  return idade >= 0 ? idade : null
}
