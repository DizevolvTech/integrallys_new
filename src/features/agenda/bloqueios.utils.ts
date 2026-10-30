import type { AgendaBloqueio } from './hooks/use-agenda-bloqueios'

export function isoDateLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Bloqueios que cobrem o dia (YYYY-MM-DD), respeitando o profissional filtrado ('todos' = sem filtro). */
export function bloqueiosDoDia(
  bloqueios: AgendaBloqueio[],
  dayIso: string,
  selectedProfessional: string,
  profIdToNome: Map<string, string>,
): AgendaBloqueio[] {
  return bloqueios.filter((b) => {
    if (!dayIso || b.dataInicio > dayIso || b.dataFim < dayIso) return false
    if (selectedProfessional !== 'todos' && b.profissionalId) {
      if (profIdToNome.get(b.profissionalId) !== selectedProfessional) return false
    }
    return true
  })
}

export interface CorBloqueio {
  /** Cartão (dia/semana). */
  card: string
  /** Etiqueta do tipo e chips. */
  chip: string
  /** Texto de apoio. */
  text: string
}

// Paleta fixa (classes literais para o Tailwind enxergar). Cor estável por tipo, sem cadastro extra.
const PALETA: CorBloqueio[] = [
  { card: 'border-red-200 bg-red-50/70 dark:border-red-900/40 dark:bg-red-950/20', chip: 'bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-100', text: 'text-red-800 dark:text-red-200' },
  { card: 'border-violet-200 bg-violet-50/70 dark:border-violet-900/40 dark:bg-violet-950/20', chip: 'bg-violet-200 text-violet-900 dark:bg-violet-900/50 dark:text-violet-100', text: 'text-violet-800 dark:text-violet-200' },
  { card: 'border-teal-200 bg-teal-50/70 dark:border-teal-900/40 dark:bg-teal-950/20', chip: 'bg-teal-200 text-teal-900 dark:bg-teal-900/50 dark:text-teal-100', text: 'text-teal-800 dark:text-teal-200' },
  { card: 'border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/20', chip: 'bg-amber-200 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100', text: 'text-amber-800 dark:text-amber-200' },
  { card: 'border-sky-200 bg-sky-50/70 dark:border-sky-900/40 dark:bg-sky-950/20', chip: 'bg-sky-200 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100', text: 'text-sky-800 dark:text-sky-200' },
  { card: 'border-pink-200 bg-pink-50/70 dark:border-pink-900/40 dark:bg-pink-950/20', chip: 'bg-pink-200 text-pink-900 dark:bg-pink-900/50 dark:text-pink-100', text: 'text-pink-800 dark:text-pink-200' },
  { card: 'border-lime-200 bg-lime-50/70 dark:border-lime-900/40 dark:bg-lime-950/20', chip: 'bg-lime-200 text-lime-900 dark:bg-lime-900/50 dark:text-lime-100', text: 'text-lime-800 dark:text-lime-200' },
  { card: 'border-slate-300 bg-slate-100/70 dark:border-slate-700 dark:bg-slate-900/30', chip: 'bg-slate-300 text-slate-900 dark:bg-slate-700 dark:text-slate-100', text: 'text-slate-700 dark:text-slate-300' },
]

/** Cor do bloqueio pelo tipo (mesmo tipo = mesma cor, sem diferenciar maiúsculas). */
export function corDoTipoBloqueio(tipo: string): CorBloqueio {
  const chave = tipo.trim().toLowerCase()
  let hash = 0
  for (let i = 0; i < chave.length; i += 1) hash = (hash * 31 + chave.charCodeAt(i)) >>> 0
  return PALETA[hash % PALETA.length]
}

export function rotuloHorarioBloqueio(b: Pick<AgendaBloqueio, 'diaInteiro' | 'horarioInicio' | 'horarioFim'>) {
  if (b.diaInteiro) return 'Dia inteiro'
  return `${b.horarioInicio?.slice(0, 5) ?? ''}–${b.horarioFim?.slice(0, 5) ?? ''}`
}

/** Texto do bloqueio para a cliente: só o título (bloqueios antigos traziam "Compromisso:<id>|<título>"). */
export function textoDoBloqueio(justificativa: string | null | undefined): string {
  const texto = (justificativa ?? '').trim()
  const legado = /^Compromisso:[0-9a-f-]{36}\|(.*)$/i.exec(texto)
  return legado ? legado[1].trim() : texto
}
