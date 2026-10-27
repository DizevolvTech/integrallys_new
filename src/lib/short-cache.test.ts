import { beforeEach, describe, expect, it, vi } from 'vitest'
import { limparCacheCurto, memoizeShort } from './short-cache'

describe('memoizeShort', () => {
  beforeEach(() => limparCacheCurto())

  it('deduplica chamadas simultâneas e reaproveita dentro do prazo', async () => {
    const loader = vi.fn(async () => 'ok')
    await Promise.all([memoizeShort('k', 1000, loader), memoizeShort('k', 1000, loader)])
    await memoizeShort('k', 1000, loader)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('não guarda falhas nem resultados rejeitados por deveGuardar', async () => {
    const falha = vi.fn(async () => { throw new Error('x') })
    await expect(memoizeShort('f', 1000, falha)).rejects.toThrow()
    await expect(memoizeShort('f', 1000, falha)).rejects.toThrow()
    expect(falha).toHaveBeenCalledTimes(2)

    const negado = vi.fn(async () => false)
    await memoizeShort('n', 1000, negado, (v) => v)
    await memoizeShort('n', 1000, negado, (v) => v)
    expect(negado).toHaveBeenCalledTimes(2)
  })

  it('limparCacheCurto invalida entradas', async () => {
    const loader = vi.fn(async () => 1)
    await memoizeShort('a', 1000, loader)
    limparCacheCurto()
    await memoizeShort('a', 1000, loader)
    expect(loader).toHaveBeenCalledTimes(2)
  })
})
