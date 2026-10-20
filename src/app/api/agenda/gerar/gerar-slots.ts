// Geração de slots de agenda derivada da GRADE do profissional
// (public.profissional_horarios, migration 079). O formulário não dita mais o
// horário/intervalo — a grade é a fonte; o formulário só pode RESTRINGIR dias.
// Lógica pura (sem Supabase) para ser testável — consumida por route.ts.

export interface HorarioRegra {
  dia_semana: number // 0=Dom .. 6=Sáb (eixo do getDay())
  turno: 'manha' | 'tarde'
  hora_inicio: string // "HH:MM" ou "HH:MM:SS" (Postgres time)
  hora_fim: string
  duracao_min: number
  ativo: boolean
}

export interface SlotCandidato {
  data: string // YYYY-MM-DD (local)
  horario_inicio: string // HH:MM
  horario_fim: string // HH:MM
}

export interface GerarSlotsParams {
  horarios: HorarioRegra[]
  dataInicio: Date
  dataFim: Date
  /** Filtro opcional de dias (interseção com a grade); null/[] = sem restrição. */
  diasSemanaFiltro: number[] | null
  considerarFeriados: boolean
}

export interface GerarSlotsResult {
  slots: SlotCandidato[]
  /** Slots que existiriam em dias de feriado e foram pulados. */
  puladosFeriado: number
  alertas: string[]
}

const FERIADOS_NACIONAIS_FIXOS = new Set([
  '01-01',
  '04-21',
  '05-01',
  '09-07',
  '10-12',
  '11-02',
  '11-15',
  '12-25',
])

const NOMES_DIA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export function isFeriadoFixo(date: Date): boolean {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return FERIADOS_NACIONAIS_FIXOS.has(`${month}-${day}`)
}

function isoDateLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatBR(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${d}/${m}/${y}`
}

function parseTimeToMinutes(time: string): number | null {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(time)
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 60 + m
}

function minutesToTime(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Quantos slots o dia geraria, somando os turnos (usado p/ contar feriados). */
function contarSlotsDoDia(horarios: HorarioRegra[]): number {
  let total = 0
  for (const h of horarios) {
    const inicio = parseTimeToMinutes(h.hora_inicio)
    const fim = parseTimeToMinutes(h.hora_fim)
    if (inicio == null || fim == null) continue
    if (!(h.duracao_min > 0)) continue // termina o laço (0/negativo/NaN não avançaria)
    for (let s = inicio; s < fim; s += h.duracao_min) total += 1
  }
  return total
}

export function gerarSlots(params: GerarSlotsParams): GerarSlotsResult {
  const { horarios, dataInicio, dataFim, diasSemanaFiltro, considerarFeriados } = params

  // Agrupa a grade ativa por dia da semana (mantém a ordem manhã→tarde).
  const porDia = new Map<number, HorarioRegra[]>()
  for (const h of horarios) {
    if (!h.ativo) continue
    const list = porDia.get(h.dia_semana) ?? []
    list.push(h)
    porDia.set(h.dia_semana, list)
  }

  const filtro = diasSemanaFiltro && diasSemanaFiltro.length > 0 ? new Set(diasSemanaFiltro) : null

  const alertas: string[] = []

  // Dias que o operador pediu (via filtro) mas que não existem na grade.
  if (filtro) {
    const naoAtende = [...filtro].filter((dow) => !porDia.has(dow)).sort((a, b) => a - b)
    if (naoAtende.length > 0) {
      alertas.push(
        `Dias sem grade cadastrada (ignorados): ${naoAtende.map((dow) => NOMES_DIA[dow]).join(', ')}.`,
      )
    }
  }

  const slots: SlotCandidato[] = []
  let puladosFeriado = 0
  const feriadosIgnorados: string[] = []

  const cursor = new Date(dataInicio.getTime())
  while (cursor.getTime() <= dataFim.getTime()) {
    const dow = cursor.getDay()
    const doDia = porDia.get(dow)

    // Sem grade nesse dia, OU restringido pelo filtro → não gera (resolve
    // "Adelmo não abre sábado/domingo mesmo marcado").
    if (!doDia || (filtro && !filtro.has(dow))) {
      cursor.setDate(cursor.getDate() + 1)
      continue
    }

    if (considerarFeriados && isFeriadoFixo(cursor)) {
      puladosFeriado += contarSlotsDoDia(doDia)
      feriadosIgnorados.push(formatBR(cursor))
      cursor.setDate(cursor.getDate() + 1)
      continue
    }

    const isoData = isoDateLocal(cursor)
    for (const h of doDia) {
      const inicio = parseTimeToMinutes(h.hora_inicio)
      const fim = parseTimeToMinutes(h.hora_fim)
      if (inicio == null || fim == null) continue
      if (!(h.duracao_min > 0)) continue // termina o laço (0/negativo/NaN não avançaria)
      for (let s = inicio; s < fim; s += h.duracao_min) {
        slots.push({
          data: isoData,
          horario_inicio: minutesToTime(s),
          horario_fim: minutesToTime(s + h.duracao_min),
        })
      }
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  if (feriadosIgnorados.length > 0) {
    alertas.push(`Feriados ignorados: ${feriadosIgnorados.join(', ')}.`)
  }

  return { slots, puladosFeriado, alertas }
}
