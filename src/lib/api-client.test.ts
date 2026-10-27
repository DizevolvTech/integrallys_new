import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './api-client'

function respostaJson(corpo: unknown) {
  return { ok: true, status: 200, statusText: 'OK', json: async () => corpo }
}

describe('apiClient — GETs simultâneos', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reaproveita a requisição em andamento e entrega cópias independentes', async () => {
    const spy = vi.fn(async () => respostaJson({ data: [1] }))
    vi.stubGlobal('fetch', spy)
    const [a, b] = await Promise.all([apiClient<{ data: number[] }>('/api/x'), apiClient<{ data: number[] }>('/api/x')])
    expect(spy).toHaveBeenCalledTimes(1)
    a.data.push(2)
    expect(b.data).toEqual([1])
  })

  it('não junta POSTs nem GETs depois que terminaram', async () => {
    const spy = vi.fn(async () => respostaJson({}))
    vi.stubGlobal('fetch', spy)
    await Promise.all([apiClient('/api/y', { method: 'POST', body: '{}' }), apiClient('/api/y', { method: 'POST', body: '{}' })])
    expect(spy).toHaveBeenCalledTimes(2)
    await apiClient('/api/z')
    await apiClient('/api/z')
    expect(spy).toHaveBeenCalledTimes(4)
  })
})
