import { describe, expect, it } from 'vitest'
import { resolveAgendamentoProcedimento } from './agendamento-procedimento'
import {
  addDaysIso,
  diffDiasCivis,
  isProcedimentoRetornoNome,
  prazoDiasDoNomeRetorno,
  validateRetornoAgendamento,
} from './procedimento-retorno'

type Row = Record<string, unknown>

function makeSupabase(config: {
  procedimento?: Row | null
  vinculos?: Row[]
  ultimoAgendamento?: Row | null
}) {
  return {
    from(table: string) {
      if (table === 'procedimentos') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: config.procedimento ?? null, error: null }),
            }),
          }),
        }
      }
      if (table === 'profissional_procedimentos') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: config.vinculos ?? [], error: null }),
          }),
        }
      }
      if (table === 'agendamentos') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({
                        data: config.ultimoAgendamento ?? null,
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }
}

describe('diffDiasCivis / addDaysIso', () => {
  it('calcula diferença e soma dias', () => {
    expect(diffDiasCivis('2026-09-01', '2026-10-06')).toBe(35)
    expect(addDaysIso('2026-09-09', 15)).toBe('2026-09-24')
  })
})

describe('procedimento de retorno pelo nome', () => {
  it('reconhece Retorno… e o prazo escrito no nome', () => {
    expect(isProcedimentoRetornoNome('Retorno (até 30 dias)')).toBe(true)
    expect(isProcedimentoRetornoNome('Consulta Clínica Geral')).toBe(false)
    expect(prazoDiasDoNomeRetorno('Retorno (até 30 dias)')).toBe(30)
    expect(prazoDiasDoNomeRetorno('Retorno')).toBeNull()
  })
})

describe('validateRetornoAgendamento', () => {
  it('bloqueia fora do prazo de 35 dias', () => {
    const result = validateRetornoAgendamento({
      temRetorno: true,
      prazoDias: 35,
      valorRetorno: 120,
      valorConsulta: 240,
      dataAgendamento: '2026-10-20',
      ultimaDataAtendimento: '2026-09-01',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('RETORNO_FORA_PRAZO')
  })

  it('aplica valor de retorno dentro do prazo', () => {
    const result = validateRetornoAgendamento({
      temRetorno: true,
      prazoDias: 35,
      valorRetorno: 120,
      valorConsulta: 240,
      dataAgendamento: '2026-09-20',
      ultimaDataAtendimento: '2026-09-01',
    })
    expect(result).toEqual({ ok: true, valor: 120 })
  })
})

describe('resolveAgendamentoProcedimento', () => {
  it('sem procedimento retorna ids nulos', async () => {
    const result = await resolveAgendamentoProcedimento(makeSupabase({}) as never, {
      procedimentoId: '',
      valorProcedimento: null,
      profissionalId: 'prof-1',
    })
    expect(result).toEqual({
      ok: true,
      data: {
        procedimentoId: null,
        valorProcedimento: null,
        intervaloRecorrenciaDias: null,
        quantidadeSugeridaPacote: null,
        temPacote: false,
        ehRetorno: false,
      },
    })
  })

  it('preenche valor a partir do cadastro do procedimento', async () => {
    const result = await resolveAgendamentoProcedimento(
      makeSupabase({
        procedimento: { id: 'proc-1', valor: 250, ativo: true, tem_pacote: false },
        vinculos: [{ procedimento_id: 'proc-1' }],
      }) as never,
      {
        procedimentoId: 'proc-1',
        valorProcedimento: null,
        profissionalId: 'prof-1',
      },
    )
    expect(result).toEqual({
      ok: true,
      data: {
        procedimentoId: 'proc-1',
        valorProcedimento: 250,
        intervaloRecorrenciaDias: null,
        quantidadeSugeridaPacote: null,
        temPacote: false,
        ehRetorno: false,
      },
    })
  })

  it('rejeita procedimento não vinculado ao profissional', async () => {
    const result = await resolveAgendamentoProcedimento(
      makeSupabase({
        procedimento: { id: 'proc-2', valor: 100, ativo: true },
        vinculos: [{ procedimento_id: 'proc-1' }],
      }) as never,
      {
        procedimentoId: 'proc-2',
        valorProcedimento: null,
        profissionalId: 'prof-1',
      },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('PROCEDIMENTO_NAO_VINCULADO')
    }
  })

  it('rejeita quando profissional não tem nenhum vínculo', async () => {
    const result = await resolveAgendamentoProcedimento(
      makeSupabase({
        procedimento: { id: 'proc-1', valor: 100, ativo: true },
        vinculos: [],
      }) as never,
      {
        procedimentoId: 'proc-1',
        valorProcedimento: null,
        profissionalId: 'prof-1',
      },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('PROCEDIMENTO_SEM_VINCULOS')
    }
  })

  it('retorno dentro do prazo usa valor_retorno', async () => {
    const result = await resolveAgendamentoProcedimento(
      makeSupabase({
        procedimento: {
          id: 'proc-1',
          valor: 240,
          ativo: true,
          tem_retorno: true,
          prazo_retorno_dias: 35,
          valor_retorno: 120,
        },
        vinculos: [{ procedimento_id: 'proc-1' }],
        ultimoAgendamento: { data_agendamento: '2026-09-01', status: 'Check-out' },
      }) as never,
      {
        procedimentoId: 'proc-1',
        valorProcedimento: 240,
        profissionalId: 'prof-1',
        tipo: 'retorno',
        pacienteId: 'pac-1',
        dataAgendamento: '2026-09-20',
      },
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.valorProcedimento).toBe(120)
  })

  it('retorno fora do prazo é bloqueado', async () => {
    const result = await resolveAgendamentoProcedimento(
      makeSupabase({
        procedimento: {
          id: 'proc-1',
          valor: 240,
          ativo: true,
          tem_retorno: true,
          prazo_retorno_dias: 35,
          valor_retorno: 120,
        },
        vinculos: [{ procedimento_id: 'proc-1' }],
        ultimoAgendamento: { data_agendamento: '2026-07-01', status: 'Check-out' },
      }) as never,
      {
        procedimentoId: 'proc-1',
        valorProcedimento: null,
        profissionalId: 'prof-1',
        tipo: 'retorno',
        pacienteId: 'pac-1',
        dataAgendamento: '2026-09-20',
      },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('RETORNO_FORA_PRAZO')
  })

  const retornoGenerico = {
    id: 'proc-ret',
    nome: 'Retorno (até 30 dias)',
    valor: 0,
    ativo: true,
    tem_retorno: false,
  }

  it('procedimento "Retorno" mesmo com tipo consulta vira retorno (valor 0) quando há atendimento concluído', async () => {
    const result = await resolveAgendamentoProcedimento(
      makeSupabase({
        procedimento: retornoGenerico,
        vinculos: [{ procedimento_id: 'proc-ret' }],
        ultimoAgendamento: { data_agendamento: '2026-10-26', status: 'Concluído' },
      }) as never,
      {
        procedimentoId: 'proc-ret',
        valorProcedimento: null,
        profissionalId: 'prof-1',
        tipo: 'consulta',
        pacienteId: 'pac-1',
        dataAgendamento: '2026-11-02',
      },
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.ehRetorno).toBe(true)
      expect(result.data.valorProcedimento).toBe(0)
    }
  })

  it('procedimento "Retorno" sem atendimento anterior: mensagem clara', async () => {
    const result = await resolveAgendamentoProcedimento(
      makeSupabase({
        procedimento: retornoGenerico,
        vinculos: [{ procedimento_id: 'proc-ret' }],
        ultimoAgendamento: null,
      }) as never,
      {
        procedimentoId: 'proc-ret',
        valorProcedimento: null,
        profissionalId: 'prof-1',
        tipo: 'retorno',
        pacienteId: 'pac-1',
        dataAgendamento: '2026-11-02',
      },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('RETORNO_SEM_ATENDIMENTO_PREVIO')
      expect(result.message).toContain('atendimento anterior concluído')
    }
  })

  it('procedimento "Retorno (até 30 dias)" respeita os 30 dias do nome', async () => {
    const result = await resolveAgendamentoProcedimento(
      makeSupabase({
        procedimento: retornoGenerico,
        vinculos: [{ procedimento_id: 'proc-ret' }],
        ultimoAgendamento: { data_agendamento: '2026-09-01', status: 'Concluído' },
      }) as never,
      {
        procedimentoId: 'proc-ret',
        valorProcedimento: null,
        profissionalId: 'prof-1',
        tipo: 'retorno',
        pacienteId: 'pac-1',
        dataAgendamento: '2026-11-02',
      },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('RETORNO_FORA_PRAZO')
  })

  it('edição sem mudar a definição do retorno não revalida (validarRetorno=false)', async () => {
    const result = await resolveAgendamentoProcedimento(
      makeSupabase({
        procedimento: retornoGenerico,
        vinculos: [{ procedimento_id: 'proc-ret' }],
        ultimoAgendamento: null,
      }) as never,
      {
        procedimentoId: 'proc-ret',
        valorProcedimento: 0,
        profissionalId: 'prof-1',
        tipo: 'retorno',
        pacienteId: 'pac-1',
        dataAgendamento: '2026-12-14',
        validarRetorno: false,
      },
    )
    expect(result.ok).toBe(true)
  })
})
