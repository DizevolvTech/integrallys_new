export const DEFAULT_TIPOS_BLOQUEIO = ['Férias', 'Folga', 'Reunião', 'Outro']
export const TIPO_BLOQUEIO_REGEX = /^[\p{L}\p{N}\s\-_+/]{1,80}$/u

/** Lê o valor salvo (JSON ou lista separada por vírgula); sem valor válido, usa os tipos padrão. */
export function parseTiposBloqueio(valor: string | null | undefined): string[] {
  if (!valor) return DEFAULT_TIPOS_BLOQUEIO
  try {
    const parsed: unknown = JSON.parse(valor)
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      const filtrados = parsed.map((item) => item.trim()).filter(Boolean)
      return filtrados.length > 0 ? filtrados : DEFAULT_TIPOS_BLOQUEIO
    }
  } catch {
    const lista = valor.split(',').map((item) => item.trim()).filter(Boolean)
    if (lista.length > 0) return lista
  }
  return DEFAULT_TIPOS_BLOQUEIO
}

/** Acrescenta o tipo sem duplicar (sem diferenciar maiúsculas). */
export function adicionarTipoBloqueio(tipos: string[], nome: string): { criado: boolean; tipos: string[] } {
  const existe = tipos.some((item) => item.toLowerCase() === nome.toLowerCase())
  return existe ? { criado: false, tipos } : { criado: true, tipos: [...tipos, nome] }
}
