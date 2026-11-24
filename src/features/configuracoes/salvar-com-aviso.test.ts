import { describe, expect, it, vi } from 'vitest'

const erro = vi.fn()
vi.mock('sonner', () => ({ toast: { error: (m: string) => erro(m) } }))

import { ApiClientError } from '@/lib/api-client'
import { mensagemErroSalvar, salvarComAviso } from './salvar-com-aviso'

describe('salvarComAviso', () => {
  it('403 vira mensagem clara de permissão', async () => {
    await salvarComAviso(() =>
      Promise.reject(new ApiClientError({ error: 'Acesso negado', code: 'FORBIDDEN' }, 403)),
    )
    expect(erro).toHaveBeenCalledWith(
      'Seu perfil não pode alterar estas configurações. Peça ao administrador.',
    )
  })

  it('outro erro mostra a mensagem do servidor', () => {
    expect(mensagemErroSalvar(new Error('Falha X'))).toBe('Falha X')
  })

  it('sucesso não mostra erro', async () => {
    erro.mockClear()
    await salvarComAviso(() => Promise.resolve())
    expect(erro).not.toHaveBeenCalled()
  })
})
