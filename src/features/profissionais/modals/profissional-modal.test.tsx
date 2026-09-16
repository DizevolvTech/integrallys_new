import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProfissionalModal } from './profissional-modal'

// Evidência de comportamento real: CPF com dígito verificador de verdade e
// auto-preenchimento de endereço pelo CEP (backlog do item 12) mantendo os
// campos editáveis.

const toasts = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock('sonner', () => ({ toast: toasts }))
vi.mock('@/features/procedimentos/hooks/use-procedimentos', () => ({
  useProcedimentos: () => ({ data: [] }),
}))
vi.mock('@/hooks/use-unidades', () => ({
  useUnidades: () => ({ data: [{ id: 'u1', nome: 'Natur & Vida', cidade: 'Água Boa' }] }),
}))

const RESPOSTA_VIACEP = {
  ok: true,
  status: 200,
  json: async () => ({
    cep: '01310-100',
    logradouro: 'Avenida Paulista',
    complemento: 'de 612 a 1510 - lado par',
    bairro: 'Bela Vista',
    localidade: 'São Paulo',
    uf: 'SP',
  }),
}

function stubFetch(impl: (url: string) => unknown | Promise<unknown>) {
  const spy = vi.fn(async (input: string | URL) => impl(String(input)))
  vi.stubGlobal('fetch', spy)
  return spy
}

function renderModal(onSave = vi.fn().mockResolvedValue(undefined)) {
  render(<ProfissionalModal isOpen mode="create" onClose={vi.fn()} onSave={onSave} />)
  return { onSave }
}

afterEach(() => {
  vi.unstubAllGlobals()
  toasts.error.mockClear()
})

describe('ProfissionalModal — CPF', () => {
  it(
    'aplica a máscara do CPF conforme o usuário digita',
    async () => {
    stubFetch(() => RESPOSTA_VIACEP)
    const user = userEvent.setup({ delay: null })
    renderModal()

    const campo = screen.getByPlaceholderText('000.000.000-00')
    await user.type(campo, '11144477735')

    expect(campo).toHaveValue('111.444.777-35')
  },
  15000,
  )

  it('acusa CPF com dígito verificador inválido logo abaixo do campo', async () => {
    stubFetch(() => RESPOSTA_VIACEP)
    const user = userEvent.setup({ delay: null })
    renderModal()

    await user.type(screen.getByPlaceholderText('000.000.000-00'), '11144477734')

    expect(screen.getByText('CPF inválido — confira os dígitos verificadores.')).toBeInTheDocument()
  })

  it('não acusa erro enquanto o CPF ainda está incompleto', async () => {
    stubFetch(() => RESPOSTA_VIACEP)
    const user = userEvent.setup({ delay: null })
    renderModal()

    await user.type(screen.getByPlaceholderText('000.000.000-00'), '111444')

    expect(
      screen.queryByText('CPF inválido — confira os dígitos verificadores.'),
    ).not.toBeInTheDocument()
  })

  it('aceita CPF válido sem acusar erro', async () => {
    stubFetch(() => RESPOSTA_VIACEP)
    const user = userEvent.setup({ delay: null })
    renderModal()

    await user.type(screen.getByPlaceholderText('000.000.000-00'), '52998224725')

    expect(
      screen.queryByText('CPF inválido — confira os dígitos verificadores.'),
    ).not.toBeInTheDocument()
  })
})

describe('ProfissionalModal — CEP', () => {
  it('preenche logradouro, bairro, cidade e UF ao completar o CEP', async () => {
    const spy = stubFetch(() => RESPOSTA_VIACEP)
    const user = userEvent.setup({ delay: null })
    renderModal()

    const campoCep = screen.getByPlaceholderText('00000-000')
    await user.type(campoCep, '01310100')

    expect(campoCep).toHaveValue('01310-100')
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Bairro')).toHaveValue('Bela Vista')
    })
    expect(screen.getByPlaceholderText('Ex.: Av. Paulista, 1000')).toHaveValue('Avenida Paulista')
    expect(screen.getByPlaceholderText('Cidade')).toHaveValue('São Paulo')
    expect(screen.getByPlaceholderText('Ex.: SP')).toHaveValue('SP')
    expect(spy).toHaveBeenCalledWith('https://viacep.com.br/ws/01310100/json/', expect.anything())
  })

  it(
    'mantém os campos editáveis depois do auto-preenchimento',
    async () => {
    stubFetch(() => RESPOSTA_VIACEP)
    const user = userEvent.setup({ delay: null })
    renderModal()

    await user.type(screen.getByPlaceholderText('00000-000'), '01310100')
    await waitFor(() => expect(screen.getByPlaceholderText('Bairro')).toHaveValue('Bela Vista'), {
      timeout: 10000,
    })

    const campoBairro = screen.getByPlaceholderText('Bairro')
    expect(campoBairro).not.toBeDisabled()
    expect(campoBairro).not.toHaveAttribute('readonly')

    await user.clear(campoBairro)
    await user.type(campoBairro, 'Consolação')
    expect(campoBairro).toHaveValue('Consolação')
  },
  15000,
  )

  it(
    'não sobrescreve endereço que o usuário já digitou',
    async () => {
    // Resposta atrasada: usuário termina de digitar bairro antes do CEP aplicar.
    stubFetch(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(RESPOSTA_VIACEP), 50)
        }),
    )
    const user = userEvent.setup({ delay: null })
    renderModal()

    await user.type(screen.getByPlaceholderText('Bairro'), 'Bairro escolhido a mão')
    await user.type(screen.getByPlaceholderText('00000-000'), '01310100')

    await waitFor(() => expect(screen.getByPlaceholderText('Cidade')).toHaveValue('São Paulo'), {
      timeout: 10000,
    })
    expect(screen.getByPlaceholderText('Bairro')).toHaveValue('Bairro escolhido a mão')
  },
  15000,
  )

  it('não consulta a rede com CEP incompleto', async () => {
    const spy = stubFetch(() => RESPOSTA_VIACEP)
    const user = userEvent.setup({ delay: null })
    renderModal()

    await user.type(screen.getByPlaceholderText('00000-000'), '0131')

    expect(spy).not.toHaveBeenCalled()
  })

  it('avisa sem travar quando o CEP não existe', async () => {
    stubFetch(() => ({ ok: true, status: 200, json: async () => ({ erro: true }) }))
    const user = userEvent.setup({ delay: null })
    renderModal()

    await user.type(screen.getByPlaceholderText('00000-000'), '99999998')

    await waitFor(() => {
      expect(screen.getByText(/CEP não encontrado/i)).toBeInTheDocument()
    })
    // endereço segue vazio e editável, sem bloqueio
    expect(screen.getByPlaceholderText('Bairro')).toHaveValue('')
    expect(screen.getByPlaceholderText('Bairro')).not.toBeDisabled()
  })

  it('avisa sem travar quando a rede falha', async () => {
    stubFetch(() => {
      throw new Error('network down')
    })
    const user = userEvent.setup({ delay: null })
    renderModal()

    await user.type(screen.getByPlaceholderText('00000-000'), '01310100')

    await waitFor(() => {
      expect(screen.getByText(/Não foi possível consultar agora/i)).toBeInTheDocument()
    })
    expect(screen.getByPlaceholderText('Bairro')).not.toBeDisabled()
  })
})
