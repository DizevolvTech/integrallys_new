import { describe, expect, it } from 'vitest'
import { gerarSlots, type HorarioRegra } from './gerar-slots'

// "Adelmo": seg–sex, manhã 08:00–12:00/40min, tarde 14:00–17:00/60min.
// manhã → 08:00, 08:40, 09:20, 10:00, 10:40, 11:20  = 6 slots
// tarde → 14:00, 15:00, 16:00                        = 3 slots
// total por dia atendido                              = 9 slots
const gradeAdelmo: HorarioRegra[] = [1, 2, 3, 4, 5].flatMap((dia) => [
  {
    dia_semana: dia,
    turno: 'manha',
    hora_inicio: '08:00',
    hora_fim: '12:00',
    duracao_min: 40,
    ativo: true,
  },
  {
    dia_semana: dia,
    turno: 'tarde',
    hora_inicio: '14:00',
    hora_fim: '17:00',
    duracao_min: 60,
    ativo: true,
  },
])

const d = (iso: string) => {
  const [y, m, day] = iso.split('-').map(Number)
  return new Date(y, m - 1, day)
}

// Janela de controle (2026):
//  09-01 Ter, 09-02 Qua, 09-03 Qui, 09-04 Sex, 09-05 Sáb,
//  09-06 Dom, 09-07 Seg (FERIADO 07/09), 09-08 Ter
describe('gerarSlots — deriva da grade do profissional', () => {
  it('gera só nos dias com horário cadastrado (sáb/dom não geram)', () => {
    const { slots } = gerarSlots({
      horarios: gradeAdelmo,
      dataInicio: d('2026-09-01'),
      dataFim: d('2026-09-08'),
      diasSemanaFiltro: null,
      considerarFeriados: false,
    })
    const datas = new Set(slots.map((s) => s.data))
    expect(datas.has('2026-09-05')).toBe(false) // sábado
    expect(datas.has('2026-09-06')).toBe(false) // domingo
    expect(datas.has('2026-09-01')).toBe(true) // terça
  })

  it('respeita janela e duração por turno (manhã 6 / tarde 3)', () => {
    const { slots } = gerarSlots({
      horarios: gradeAdelmo,
      dataInicio: d('2026-09-01'),
      dataFim: d('2026-09-01'),
      diasSemanaFiltro: null,
      considerarFeriados: false,
    })
    const doDia = slots.filter((s) => s.data === '2026-09-01')
    expect(doDia).toHaveLength(9)
    // manhã: primeiro e último
    expect(doDia[0]).toEqual({ data: '2026-09-01', horario_inicio: '08:00', horario_fim: '08:40' })
    expect(doDia[5]).toEqual({ data: '2026-09-01', horario_inicio: '11:20', horario_fim: '12:00' })
    // tarde: primeiro e último
    expect(doDia[6]).toEqual({ data: '2026-09-01', horario_inicio: '14:00', horario_fim: '15:00' })
    expect(doDia[8]).toEqual({ data: '2026-09-01', horario_inicio: '16:00', horario_fim: '17:00' })
  })

  it('feriado dentro da grade é pulado e contado em puladosFeriado', () => {
    const { slots, puladosFeriado, alertas } = gerarSlots({
      horarios: gradeAdelmo,
      dataInicio: d('2026-09-07'), // segunda-feira, mas feriado 07/09
      dataFim: d('2026-09-07'),
      diasSemanaFiltro: null,
      considerarFeriados: true,
    })
    expect(slots).toHaveLength(0)
    expect(puladosFeriado).toBe(9)
    expect(alertas).toContain('Feriados ignorados: 07/09/2026.')
  })

  it('com feriados desligados, gera no dia mesmo sendo feriado', () => {
    const { slots, puladosFeriado } = gerarSlots({
      horarios: gradeAdelmo,
      dataInicio: d('2026-09-07'),
      dataFim: d('2026-09-07'),
      diasSemanaFiltro: null,
      considerarFeriados: false,
    })
    expect(slots).toHaveLength(9)
    expect(puladosFeriado).toBe(0)
  })

  it('diasSemanaFiltro restringe (interseção) sem adicionar dias fora da grade', () => {
    // filtro pede TODOS os dias; grade só tem seg–sex → sáb/dom não geram
    const { slots, alertas } = gerarSlots({
      horarios: gradeAdelmo,
      dataInicio: d('2026-09-01'),
      dataFim: d('2026-09-08'),
      diasSemanaFiltro: [0, 1, 2, 3, 4, 5, 6],
      considerarFeriados: false,
    })
    const datas = new Set(slots.map((s) => s.data))
    expect(datas.has('2026-09-05')).toBe(false) // sábado
    expect(datas.has('2026-09-06')).toBe(false) // domingo
    expect(alertas).toContain('Dias sem grade cadastrada (ignorados): Domingo, Sábado.')
  })

  it('diasSemanaFiltro com subconjunto gera apenas os dias pedidos', () => {
    // só segunda (1); na janela, a única segunda é 09-07 (feriados off para gerar)
    const { slots } = gerarSlots({
      horarios: gradeAdelmo,
      dataInicio: d('2026-09-01'),
      dataFim: d('2026-09-08'),
      diasSemanaFiltro: [1],
      considerarFeriados: false,
    })
    const datas = new Set(slots.map((s) => s.data))
    expect([...datas]).toEqual(['2026-09-07'])
    expect(slots).toHaveLength(9)
  })

  it('ignora horários inativos', () => {
    const grade: HorarioRegra[] = [
      {
        dia_semana: 2,
        turno: 'manha',
        hora_inicio: '08:00',
        hora_fim: '12:00',
        duracao_min: 40,
        ativo: true,
      },
      {
        dia_semana: 2,
        turno: 'tarde',
        hora_inicio: '14:00',
        hora_fim: '17:00',
        duracao_min: 60,
        ativo: false,
      },
    ]
    const { slots } = gerarSlots({
      horarios: grade,
      dataInicio: d('2026-09-01'), // terça
      dataFim: d('2026-09-01'),
      diasSemanaFiltro: null,
      considerarFeriados: false,
    })
    expect(slots).toHaveLength(6) // só manhã
  })

  it('aceita hora vinda do Postgres com segundos (HH:MM:SS)', () => {
    const grade: HorarioRegra[] = [
      {
        dia_semana: 2,
        turno: 'manha',
        hora_inicio: '08:00:00',
        hora_fim: '12:00:00',
        duracao_min: 40,
        ativo: true,
      },
    ]
    const { slots } = gerarSlots({
      horarios: grade,
      dataInicio: d('2026-09-01'),
      dataFim: d('2026-09-01'),
      diasSemanaFiltro: null,
      considerarFeriados: false,
    })
    expect(slots).toHaveLength(6)
    expect(slots[0].horario_inicio).toBe('08:00')
  })

  it('ignora horário com duração inválida (<= 0) sem travar', () => {
    const grade: HorarioRegra[] = [
      {
        dia_semana: 2,
        turno: 'manha',
        hora_inicio: '08:00',
        hora_fim: '12:00',
        duracao_min: 0, // travaria o laço se não houvesse guarda
        ativo: true,
      },
    ]
    const { slots } = gerarSlots({
      horarios: grade,
      dataInicio: d('2026-09-01'),
      dataFim: d('2026-09-01'),
      diasSemanaFiltro: null,
      considerarFeriados: false,
    })
    expect(slots).toHaveLength(0)
  })

  it('duração inválida não trava na contagem de feriado', () => {
    const grade: HorarioRegra[] = [
      {
        dia_semana: 1,
        turno: 'manha',
        hora_inicio: '08:00',
        hora_fim: '12:00',
        duracao_min: 0,
        ativo: true,
      },
    ]
    const { puladosFeriado } = gerarSlots({
      horarios: grade,
      dataInicio: d('2026-09-07'), // segunda + feriado 07/09
      dataFim: d('2026-09-07'),
      diasSemanaFiltro: null,
      considerarFeriados: true,
    })
    expect(puladosFeriado).toBe(0)
  })

  it('sem horários cadastrados, não gera nada', () => {
    const { slots, alertas, puladosFeriado } = gerarSlots({
      horarios: [],
      dataInicio: d('2026-09-01'),
      dataFim: d('2026-09-08'),
      diasSemanaFiltro: null,
      considerarFeriados: true,
    })
    expect(slots).toHaveLength(0)
    expect(puladosFeriado).toBe(0)
    expect(alertas).toHaveLength(0)
  })
})

describe('gerarSlots — último horário que começa antes do fim da janela', () => {
  it('janela 08:00–11:00 com 40min inclui 10:40 (termina 11:20)', () => {
    const { slots } = gerarSlots({
      horarios: [{ dia_semana: 3, turno: 'manha', hora_inicio: '08:00', hora_fim: '11:00', duracao_min: 40, ativo: true }],
      dataInicio: d('2026-10-21'),
      dataFim: d('2026-10-21'),
      considerarFeriados: false,
    })
    expect(slots.map((x) => x.horario_inicio)).toEqual(['08:00', '08:40', '09:20', '10:00', '10:40'])
    expect(slots[4].horario_fim).toBe('11:20')
  })
})
