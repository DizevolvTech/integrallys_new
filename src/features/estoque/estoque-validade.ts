export type ValidadeStatus = 'ok' | 'proxima' | 'vencida' | null

export function getValidadeStatus(validade?: string): ValidadeStatus {
  if (!validade) return null
  // Aceita YYYY-MM-DD ou ISO; normaliza pegando os 10 primeiros chars quando possível
  const raw = validade.length >= 10 ? validade.slice(0, 10) : validade
  const parsed = new Date(`${raw}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const limite = new Date(hoje)
  limite.setDate(limite.getDate() + 30)
  if (parsed.getTime() < hoje.getTime()) return 'vencida'
  if (parsed.getTime() <= limite.getTime()) return 'proxima'
  return 'ok'
}

export function formatValidade(validade?: string) {
  if (!validade) return ''
  const raw = validade.length >= 10 ? validade.slice(0, 10) : validade
  const parts = raw.split('-')
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return validade
}
