import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import {
  buildInsertPayload,
  buildOccupyUpdate,
  decidirFluxoAgendamento,
  ocuparSlotDisponivel,
  validateModalidadeOnlineUrl,
} from './agenda-slot'

describe('decidirFluxoAgendamento', () => {
  it('consulta (com paciente) sem encaixe → ocupar', () => {
    expect(decidirFluxoAgendamento({ pacienteId: 'pac-1', foraJanela: false })).toBe('ocupar')
  })

  it('consulta com encaixe → inserir (fora da grade)', () => {
    expect(decidirFluxoAgendamento({ pacienteId: 'pac-1', foraJanela: true })).toBe('inserir')
  })

  it('compromisso pessoal/reunião (sem paciente) → inserir', () => {
    expect(decidirFluxoAgendamento({ pacienteId: null, foraJanela: false })).toBe('inserir')
    expect(decidirFluxoAgendamento({ pacienteId: null, foraJanela: true })).toBe('inserir')
  })
})

describe('validateModalidadeOnlineUrl', () => {
  it('Presencial não exige URL', () => {
    expect(validateModalidadeOnlineUrl({ modalidade: 'Presencial', urlOnline: '' })).toEqual({
      ok: true,
    })
  })

  it('Online sem URL → erro', () => {
    expect(validateModalidadeOnlineUrl({ modalidade: 'Online', urlOnline: '  ' })).toMatchObject({
      ok: false,
      code: 'URL_ONLINE_REQUIRED',
    })
  })

  it('Hibrido com https válido → ok', () => {
    expect(
      validateModalidadeOnlineUrl({
        modalidade: 'Hibrido',
        urlOnline: 'https://meet.google.com/abc-defg-hij',
      }),
    ).toEqual({ ok: true })
  })

  it('Online com protocolo inválido → erro', () => {
    expect(
      validateModalidadeOnlineUrl({ modalidade: 'Online', urlOnline: 'ftp://example.com' }),
    ).toMatchObject({ ok: false, code: 'URL_ONLINE_INVALID' })
  })
})

describe('buildOccupyUpdate', () => {
  it('converte para Agendado sem mover o slot nem marcar encaixe', () => {
    const u = buildOccupyUpdate({ tipo: 'consulta', observacoes: 'x' }, 'pac-1')
    expect(u.status).toBe('Agendado')
    expect(u.paciente_id).toBe('pac-1')
    expect(u.tipo).toBe('consulta')
    expect(u.fora_janela).toBe(false)
    expect(u.tipo_encaixe).toBe('normal')
    expect(u.motivo_encaixe).toBeNull()
    // não move o slot: horário/unidade ficam como o gerar criou
    expect(u).not.toHaveProperty('horario_inicio')
    expect(u).not.toHaveProperty('horario_fim')
    expect(u).not.toHaveProperty('unidade_id')
  })

  it('Online: grava a modalidade e a plataforma escolhidas (não Presencial/null)', () => {
    const u = buildOccupyUpdate({ modalidade: 'Online', plataformaOnline: 'google_meet' }, 'pac-1')
    expect(u.modalidade_atendimento).toBe('Online')
    expect(u.plataforma_online).toBe('google_meet')
  })

  it('Hibrido: mantém a plataforma escolhida', () => {
    const u = buildOccupyUpdate({ modalidade: 'Hibrido', plataformaOnline: 'zoom' }, 'pac-1')
    expect(u.modalidade_atendimento).toBe('Hibrido')
    expect(u.plataforma_online).toBe('zoom')
  })

  it('Presencial: zera a plataforma mesmo que venha lixo no body', () => {
    const u = buildOccupyUpdate(
      { modalidade: 'Presencial', plataformaOnline: 'google_meet' },
      'pac-1',
    )
    expect(u.modalidade_atendimento).toBe('Presencial')
    expect(u.plataforma_online).toBeNull()
  })

  it('sem modalidade no body: default Presencial e plataforma null', () => {
    const u = buildOccupyUpdate({}, 'pac-1')
    expect(u.modalidade_atendimento).toBe('Presencial')
    expect(u.plataforma_online).toBeNull()
  })

  it('vincula procedimento_id e valor_procedimento na ocupação', () => {
    const u = buildOccupyUpdate(
      { procedimentoId: 'proc-1', valorProcedimento: 180 },
      'pac-1',
    )
    expect(u.procedimento_id).toBe('proc-1')
    expect(u.valor_procedimento).toBe(180)
  })
})

describe('buildInsertPayload', () => {
  it('encaixe insere fora da grade (fora_janela=true, tipo_encaixe=manual, motivo)', () => {
    const row = buildInsertPayload({
      unidadeId: 'u1',
      pacienteId: 'pac-1',
      profissionalId: 'prof-1',
      criadoPorId: 'user-1',
      body: { data: '2026-09-08', horario: '10:00', tipo: 'consulta' },
      foraJanela: true,
      motivoEncaixe: 'urgência',
    })
    expect(row.fora_janela).toBe(true)
    expect(row.tipo_encaixe).toBe('manual')
    expect(row.motivo_encaixe).toBe('urgência')
    expect(row.paciente_id).toBe('pac-1')
    expect(row.status).toBe('Agendado')
    expect(row.modalidade_atendimento).toBe('Presencial')
  })

  it('compromisso pessoal (sem paciente) insere com paciente_id e modalidade nulos', () => {
    const row = buildInsertPayload({
      unidadeId: null,
      pacienteId: null,
      profissionalId: 'prof-1',
      criadoPorId: 'user-1',
      body: { data: '2026-09-08', horario: '10:00', titulo: 'Reunião' },
      foraJanela: false,
      motivoEncaixe: null,
    })
    expect(row.paciente_id).toBeNull()
    // coluna NOT NULL: compromisso pessoal grava o padrão 'Presencial' (antes null → erro 500)
    expect(row.modalidade_atendimento).toBe('Presencial')
    expect(row.titulo).toBe('Reunião')
    expect(row.fora_janela).toBe(false)
    expect(row.tipo_encaixe).toBe('normal')
  })
})

interface FakeCapture {
  table: string
  update: Record<string, unknown> | null
  eqs: Array<[string, unknown]>
}

function fakeSupabase(result: { data: unknown; error: unknown }) {
  const capture: FakeCapture = { table: '', update: null, eqs: [] }
  const builder = {
    update(values: Record<string, unknown>) {
      capture.update = values
      return builder
    },
    eq(column: string, value: unknown) {
      capture.eqs.push([column, value])
      return builder
    },
    select() {
      return Promise.resolve(result)
    },
  }
  const client = {
    from(table: string) {
      capture.table = table
      return builder
    },
  }
  return { client: client as unknown as SupabaseClient, capture }
}

describe('ocuparSlotDisponivel', () => {
  it('ocupa slot Disponível existente via update condicional e retorna o id (não insere)', async () => {
    const { client, capture } = fakeSupabase({ data: [{ id: 'slot-1' }], error: null })
    const res = await ocuparSlotDisponivel(client, {
      profissionalId: 'prof-1',
      data: '2026-09-08',
      horario: '08:00',
      update: buildOccupyUpdate({}, 'pac-1'),
    })
    expect(res).toEqual({ kind: 'occupied', id: 'slot-1' })
    expect(capture.table).toBe('agendamentos')
    // concorrência: só ocupa se o slot ainda estiver 'Disponível'
    expect(capture.eqs).toContainEqual(['status', 'Disponível'])
    expect(capture.eqs).toContainEqual(['profissional_id', 'prof-1'])
    expect(capture.eqs).toContainEqual(['data_agendamento', '2026-09-08'])
    expect(capture.eqs).toContainEqual(['horario_inicio', '08:00'])
  })

  it('0 linhas afetadas (slot já Agendado ou inexistente) → indisponivel', async () => {
    const { client } = fakeSupabase({ data: [], error: null })
    const res = await ocuparSlotDisponivel(client, {
      profissionalId: 'prof-1',
      data: '2026-09-08',
      horario: '08:00',
      update: {},
    })
    expect(res).toEqual({ kind: 'indisponivel' })
  })

  it('erro do supabase é propagado', async () => {
    const error = { message: 'boom' }
    const { client } = fakeSupabase({ data: null, error })
    const res = await ocuparSlotDisponivel(client, {
      profissionalId: 'prof-1',
      data: '2026-09-08',
      horario: '08:00',
      update: {},
    })
    expect(res).toEqual({ kind: 'error', error })
  })
})
