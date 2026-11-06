import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const estado = vi.hoisted(() => ({ prescricao: { status: 'Ativa', numero: 'EN-1', valor_total: 100 } as Record<string, unknown>, escritas: [] as string[] }))

vi.mock('@/lib/request-auth', () => ({
  getRequestAuth: async () => ({ userId: 'u1', role: 'recepcao', user: { name: 'Recepção' } }),
  authErrorResponse: () => new Response(null, { status: 401 }),
  forbiddenResponse: () => new Response(null, { status: 403 }),
}))
vi.mock('@/lib/authz', () => ({ requirePermission: async () => null }))
vi.mock('@/lib/estoque-movimentacao', () => ({ estoqueAplicarMovimentacao: async () => ({ ok: true }) }))
vi.mock('@/lib/desconto-forma-server', () => ({ lerDescontosPorForma: async () => ({ descontos: { pix: 0, dinheiro: 0, cartao_debito: 0, cartao_credito: 0 }, error: null }) }))
vi.mock('@/lib/app-api', async () => {
  const resposta = (message: string, code: string, status: number) => Response.json({ error: message, code }, { status })
  const consulta = (tabela: string) => {
    const api: Record<string, unknown> = {}
    for (const metodo of ['select', 'eq', 'order', 'limit', 'in']) api[metodo] = () => api
    api.maybeSingle = async () => ({ data: tabela === 'prescricoes' ? estado.prescricao : null, error: null })
    api.insert = () => {
      estado.escritas.push(`insert:${tabela}`)
      return api
    }
    api.update = () => {
      estado.escritas.push(`update:${tabela}`)
      return api
    }
    api.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null })
    return api
  }
  return {
    getAppSupabase: () => ({ from: consulta }),
    getEntityNameMap: async () => ({ map: {}, error: null }),
    supabaseErrorResponse: (e: { message: string }) => resposta(e.message, 'SUPABASE', 500),
    serverErrorResponse: resposta,
  }
})

import { POST, PUT } from './route'

const requisicao = (metodo: 'POST' | 'PUT', corpo: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/prescricoes', { method: metodo, body: JSON.stringify(corpo) })

describe('/api/prescricoes — venda concluída exige forma de pagamento', () => {
  beforeEach(() => {
    estado.escritas.length = 0
    estado.prescricao = { status: 'Ativa', numero: 'EN-1', valor_total: 100 }
  })

  it('POST Convertida sem forma → 400 e nada é gravado', async () => {
    const res = await POST(requisicao('POST', { pacienteId: 'p1', valorTotal: 100, status: 'Convertida' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Escolha a forma de pagamento', code: 'FORMA_PAGAMENTO_OBRIGATORIA' })
    expect(estado.escritas).toEqual([])
  })

  it('POST Convertida no cartão sem bandeira → 400; PIX sem conta → 400', async () => {
    const cartao = await POST(requisicao('POST', { pacienteId: 'p1', valorTotal: 100, status: 'Convertida', formaPagamento: 'cartao_debito' }))
    expect(cartao.status).toBe(400)
    expect((await cartao.json()).code).toBe('BANDEIRA_OBRIGATORIA')
    const pix = await POST(requisicao('POST', { pacienteId: 'p1', valorTotal: 100, status: 'Convertida', formaPagamento: 'pix' }))
    expect((await pix.json()).code).toBe('CONTA_PIX_OBRIGATORIA')
  })

  it('PUT para Convertida sem forma (e sem forma gravada) → 400 e nada é gravado', async () => {
    const res = await PUT(requisicao('PUT', { id: 'x1', pacienteId: 'p1', valorTotal: 100, status: 'Convertida' }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('FORMA_PAGAMENTO_OBRIGATORIA')
    expect(estado.escritas).toEqual([])
  })

  it('POST com validade no passado → 400', async () => {
    const res = await POST(requisicao('POST', { pacienteId: 'p1', valorTotal: 100, status: 'Ativa', validade: '2020-01-01' }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('VALIDADE_INVALIDA')
  })
})
