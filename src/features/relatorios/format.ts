export function formatMoeda(valor: unknown): string {
  const n = Number(valor)
  return (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** 'YYYY-MM-DD' (ou timestamp) → 'DD/MM/AAAA' sem deslocar fuso. */
export function formatData(valor: unknown): string {
  if (!valor) return '—'
  const texto = String(valor)
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : texto
}

export function formatDataHora(valor: unknown): string {
  if (!valor) return '—'
  const d = new Date(String(valor))
  if (Number.isNaN(d.getTime())) return String(valor)
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
}

export function formatPct(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  const n = Number(valor)
  return Number.isFinite(n) ? `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—'
}

export function hojeIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

export function somarDiasIso(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}

export const ROTULO_FORMA: Record<string, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  debito: 'Cartão de débito',
  credito: 'Cartão de crédito',
  transferencia: 'Transferência',
  consumo: 'Consumo',
  nao_informado: 'Não informado',
  outro: 'Outro',
}
