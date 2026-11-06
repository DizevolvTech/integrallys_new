import { describe, expect, it } from 'vitest'
import { registrarRetorno, validarAlvoRetorno } from './retornos-server'

function fakeSupabase(opts: { usuarioOk?: boolean; procOk?: boolean } = {}) {
  const inserts: Array<Record<string, unknown>> = []
  const client = {
    from(table: string) {
      const q: Record<string, unknown> = {}
      const chain = () => q
      Object.assign(q, {
        select: chain,
        eq: chain,
        upsert: async () => ({ error: null }),
        update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
        insert: (row: Record<string, unknown>) => {
          inserts.push(row)
          return { select: () => ({ single: async () => ({ data: { id: 'novo' }, error: null }) }) }
        },
        maybeSingle: async () => {
          if (table === 'usuarios') return { data: opts.usuarioOk === false ? null : { id: 'u' } }
          return { data: opts.procOk === false ? null : { id: 'p' } }
        },
      })
      return q
    },
  }
  return { client: client as never, inserts }
}

describe('retorno com especialista e procedimento próprios', () => {
  it('grava especialista e procedimento do retorno no atendimento', async () => {
    const { client, inserts } = fakeSupabase()
    const r = await registrarRetorno(client, {
      pacienteId: 'pac',
      origem: 'atendimento',
      criadoPorId: 'u',
      dataBase: '2026-11-06',
      prazoTipo: '30',
      especialistaRetornoId: 'esp',
      procedimentoRetornoId: 'proc',
    })
    expect(r.ok).toBe(true)
    expect(inserts[0]).toMatchObject({ especialista_retorno_id: 'esp', procedimento_retorno_id: 'proc' })
  })

  it('venda "Mais tarde" não grava alvo', async () => {
    const { client, inserts } = fakeSupabase()
    const sup = client as unknown as { from: (t: string) => Record<string, unknown> }
    // sem retorno aberto: select().eq().eq().limit() precisa resolver lista vazia
    const original = sup.from.bind(sup)
    ;(sup as { from: unknown }).from = (t: string) => {
      const q = original(t) as Record<string, unknown>
      q.limit = async () => ({ data: [], error: null })
      return q
    }
    await registrarRetorno(sup as never, {
      pacienteId: 'pac',
      origem: 'prescricao',
      criadoPorId: 'u',
      dataBase: '2026-11-06',
      especialistaRetornoId: 'esp',
    })
    expect(inserts[0]).toMatchObject({ especialista_retorno_id: null, procedimento_retorno_id: null })
  })

  it('recusa especialista ou procedimento inativo', async () => {
    expect(await validarAlvoRetorno(fakeSupabase({ usuarioOk: false }).client, { especialistaId: 'x' })).toMatch(/Especialista/)
    expect(await validarAlvoRetorno(fakeSupabase({ procOk: false }).client, { procedimentoId: 'x' })).toMatch(/Procedimento/)
    expect(await validarAlvoRetorno(fakeSupabase().client, { especialistaId: 'x', procedimentoId: 'y' })).toBeNull()
    expect(await validarAlvoRetorno(fakeSupabase().client, {})).toBeNull()
  })
})
