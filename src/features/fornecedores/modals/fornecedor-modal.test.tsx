import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FornecedorModal } from './fornecedor-modal'

// Evidência de comportamento real do formulário (React montado de verdade):
// máscara alfanumérica, bloqueio por dígito verificador, busca automática na
// Receita e o requisito de nunca travar o cadastro quando a busca falha.

const toasts = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock('sonner', () => ({ toast: toasts }))

function stubFetch(
  impl: (url: string) => { ok: boolean; status: number; json: () => Promise<unknown> },
) {
  const spy = vi.fn(async (input: string | URL) => impl(String(input)))
  vi.stubGlobal('fetch', spy)
  return spy
}

const RESPOSTA_INVEBRA = {
  ok: true,
  status: 200,
  json: async () => ({
    razao_social: 'INVEBRA INDUSTRIA DE ALIMENTOS LTDA',
    nome_fantasia: 'INVEBRA',
    email: 'contato@invebra.com.br',
    ddd_telefone_1: '54 32812200',
  }),
}

function renderModal(onSave = vi.fn().mockResolvedValue(undefined)) {
  render(<FornecedorModal isOpen mode="create" onClose={vi.fn()} onSave={onSave} />)
  return { onSave }
}

afterEach(() => {
  vi.unstubAllGlobals()
  toasts.error.mockClear()
  toasts.success.mockClear()
})

describe('FornecedorModal — CNPJ', () => {
  it('aplica a máscara aceitando letra na raiz (CNPJ alfanumérico)', async () => {
    stubFetch(() => ({ ok: false, status: 404, json: async () => ({}) }))
    const user = userEvent.setup({ delay: null })
    renderModal()

    const campoCnpj = screen.getByLabelText('CNPJ')
    await user.type(campoCnpj, '12abc34501de35')

    expect(campoCnpj).toHaveValue('12.ABC.345/01DE-35')
  })

  it('recusa letra digitada na posição dos dígitos verificadores', async () => {
    stubFetch(() => ({ ok: false, status: 404, json: async () => ({}) }))
    const user = userEvent.setup({ delay: null })
    renderModal()

    const campoCnpj = screen.getByLabelText('CNPJ')
    await user.type(campoCnpj, '12ABC34501DEAB')

    expect(campoCnpj).toHaveValue('12.ABC.345/01DE')
  })

  it('bloqueia o salvamento quando o dígito verificador não confere', async () => {
    stubFetch(() => ({ ok: false, status: 404, json: async () => ({}) }))
    const user = userEvent.setup({ delay: null })
    const { onSave } = renderModal()

    await user.type(screen.getByLabelText('Nome'), 'Fornecedor Teste')
    await user.type(screen.getByLabelText('CNPJ'), '12ABC34501DE34')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(onSave).not.toHaveBeenCalled()
    expect(toasts.error).toHaveBeenCalledWith('CNPJ inválido — confira os dígitos verificadores.')
  })

  it('preenche razão social e contato automaticamente ao completar um CNPJ válido', async () => {
    const spy = stubFetch(() => RESPOSTA_INVEBRA)
    const user = userEvent.setup({ delay: null })
    renderModal()

    await user.type(screen.getByLabelText('CNPJ'), '31511812000125')

    await waitFor(() => {
      expect(screen.getByLabelText('Razão social')).toHaveValue(
        'INVEBRA INDUSTRIA DE ALIMENTOS LTDA',
      )
    })
    expect(screen.getByLabelText('Telefone')).toHaveValue('(54) 3281-2200')
    expect(spy).toHaveBeenCalledWith(
      'https://brasilapi.com.br/api/cnpj/v1/31511812000125',
      expect.anything(),
    )
    // confirmação visual da empresa encontrada
    expect(
      screen.getByText('INVEBRA INDUSTRIA DE ALIMENTOS LTDA', { selector: 'p' }),
    ).toBeInTheDocument()
  })

  it('não consulta a rede enquanto o CNPJ está incompleto', async () => {
    const spy = stubFetch(() => RESPOSTA_INVEBRA)
    const user = userEvent.setup({ delay: null })
    renderModal()

    await user.type(screen.getByLabelText('CNPJ'), '3151181200')

    expect(spy).not.toHaveBeenCalled()
  })

  it(
    'avisa mas NÃO trava o cadastro quando o CNPJ não é encontrado',
    async () => {
    stubFetch(() => ({ ok: false, status: 404, json: async () => ({ type: 'not_found' }) }))
    const user = userEvent.setup({ delay: null })
    const { onSave } = renderModal()

    await user.type(screen.getByLabelText('Nome'), 'Empresa Nova')
    await user.type(screen.getByLabelText('CNPJ'), '12ABC34501DE35')

    await waitFor(
      () => {
        expect(screen.getByText(/não encontrado na Receita/i)).toBeInTheDocument()
      },
      { timeout: 10000 },
    )

    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    // persiste normalizado (sem máscara), preservando a letra em maiúscula
    expect(onSave.mock.calls[0][0]).toMatchObject({ cnpj: '12ABC34501DE35' })
  },
  15000,
  )

  it('avisa mas NÃO trava o cadastro quando a rede falha', async () => {
    stubFetch(() => {
      throw new Error('network down')
    })
    const user = userEvent.setup({ delay: null })
    const { onSave } = renderModal()

    await user.type(screen.getByLabelText('Nome'), 'Empresa Offline')
    await user.type(screen.getByLabelText('CNPJ'), '31511812000125')

    await waitFor(() => {
      expect(screen.getByText(/Não foi possível consultar agora/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
  })

  it('não sobrescreve a razão social que o usuário já digitou', async () => {
    stubFetch(() => RESPOSTA_INVEBRA)
    const user = userEvent.setup({ delay: null })
    renderModal()

    await user.type(screen.getByLabelText('Razão social'), 'Nome escolhido pelo usuário')
    await user.type(screen.getByLabelText('CNPJ'), '31511812000125')

    await waitFor(() => expect(screen.getByLabelText('Telefone')).toHaveValue('(54) 3281-2200'))
    expect(screen.getByLabelText('Razão social')).toHaveValue('Nome escolhido pelo usuário')
  })
})

describe('FornecedorModal — telefone', () => {
  it('aplica máscara de celular e de fixo', async () => {
    stubFetch(() => ({ ok: false, status: 404, json: async () => ({}) }))
    const user = userEvent.setup({ delay: null })
    renderModal()

    const campo = screen.getByLabelText('Telefone')
    await user.type(campo, '11987654321')
    expect(campo).toHaveValue('(11) 98765-4321')
  })

  it('bloqueia o salvamento com DDD inexistente', async () => {
    stubFetch(() => ({ ok: false, status: 404, json: async () => ({}) }))
    const user = userEvent.setup({ delay: null })
    const { onSave } = renderModal()

    await user.type(screen.getByLabelText('Nome'), 'Fornecedor Teste')
    await user.type(screen.getByLabelText('Telefone'), '20987654321')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(onSave).not.toHaveBeenCalled()
    expect(toasts.error).toHaveBeenCalledWith(
      'Telefone inválido — confira o DDD e a quantidade de dígitos.',
    )
  })
})
