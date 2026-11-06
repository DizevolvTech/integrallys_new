import { describe, expect, it, vi } from 'vitest'
import { fimDoDia, inicioDoDia, pacientesDosMovimentos } from './movimentos-paciente'
import { hojeIsoClinica } from '@/lib/fuso-clinica'

describe('filtro De/Ate e atalho Hoje', () => {
  it('o dia vai de 00:00 a 23:59:59.999 de Brasília', () => {
    expect(inicioDoDia('2026-11-06')).toBe('2026-11-06T00:00:00-03:00')
    expect(fimDoDia('2026-11-06')).toBe('2026-11-06T23:59:59.999-03:00')
    // 02:30 UTC de 07/11 ainda é 06/11 em Brasília -> entra no "só hoje" de 06/11
    const t = new Date('2026-11-07T02:30:00Z').getTime()
    expect(t >= new Date(inicioDoDia('2026-11-06')).getTime() && t <= new Date(fimDoDia('2026-11-06')).getTime()).toBe(true)
    expect(t > new Date(fimDoDia('2026-11-05')).getTime()).toBe(true)
  })

  it('hoje usa o fuso America/Sao_Paulo, não o UTC', () => {
    expect(hojeIsoClinica(new Date('2026-11-07T02:30:00Z'))).toBe('2026-11-06')
    expect(hojeIsoClinica(new Date('2026-11-06T15:00:00Z'))).toBe('2026-11-06')
  })
})

describe('paciente dos movimentos', () => {
  it('busca em lotes de 150 (sem N+1) e mapeia id -> nome', async () => {
    const chamadas: string[][] = []
    const supabase = {
      from: () => ({
        select: () => ({
          in: async (_c: string, ids: string[]) => {
            chamadas.push(ids)
            return { data: ids.slice(0, 1).map((id) => ({ movimentacao_id: id, paciente_nome: `Pac ${id}` })), error: null }
          },
        }),
      }),
    }
    const ids = Array.from({ length: 320 }, (_, i) => `m${i}`)
    const mapa = await pacientesDosMovimentos(supabase as never, [...ids, 'm0'])
    expect(chamadas.map((c) => c.length)).toEqual([150, 150, 20])
    expect(mapa.get('m0')).toBe('Pac m0')
    expect(mapa.get('m1')).toBeUndefined()
  })

  it('erro do banco não vira lista sem paciente', async () => {
    const supabase = { from: () => ({ select: () => ({ in: async () => ({ data: null, error: { message: 'x' } }) }) }) }
    await expect(pacientesDosMovimentos(supabase as never, ['a'])).rejects.toThrow()
    vi.restoreAllMocks()
  })
})
