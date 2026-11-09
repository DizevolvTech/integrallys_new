import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RetornosRelatorio } from './retornos-relatorio'

vi.mock('@/hooks/use-auth', () => ({
  useAuth: (sel: (s: unknown) => unknown) =>
    sel({ user: { role: 'recepcao' }, permissions: [{ resource: 'agenda', actions: ['create'] }, { resource: 'retornos', actions: ['update'] }] }),
}))
vi.mock('@/hooks/use-api', () => ({ useApi: () => ({ put: vi.fn() }) }))
vi.mock('./hooks/use-retorno-alvo', () => ({ useRetornoAlvo: () => ({ opcoes: { profissionais: [], procedimentos: [] } }) }))
vi.mock('./hooks/use-retornos', () => ({
  useRetornos: () => ({
    data: [
      {
        id: 'r1', pacienteId: 'p1', paciente: 'Maria Silva', especialistaId: 'e1', especialista: 'Dra. Ana', procedimento: 'Consulta de retorno',
        procedimentoId: 'pr1', data: '05/11/2026', dataPrevista: '20/11/2026', prazo: '15 dias', situacao: 'no_prazo', ultimosProcedimentos: [],
      },
    ],
    meta: { total: 1, page: 1, pageSize: 20, contagem: { no_prazo: 1, limite: 0, vencido: 0, sem_prazo: 0 } },
    isLoading: false,
    error: null,
    reload: vi.fn(),
  }),
  useRetornosResumo: () => ({ resumo: { pendentes: 4, agendados: 2, concluidos: 7 }, error: null }),
  buildRetornosQuery: () => 'page=1',
}))

describe('Retornos — tabela', () => {
  it('junta Especialista e Procedimento do retorno numa célula e mantém a Ação visível sem rolagem horizontal', () => {
    render(<RetornosRelatorio />)
    const tabela = screen.getByTestId('retornos-tabela')
    expect(tabela.className).not.toContain('overflow-x-auto')
    const cab = within(tabela).getAllByRole('columnheader').map((c) => c.textContent)
    expect(cab).toEqual(['Data', 'Cliente', 'Últimos procedimentos', 'Especialista / Procedimento do retorno', 'Retorno previsto', 'Situação', 'Ação'])
    const linha = within(tabela).getAllByRole('row')[1]
    expect(within(linha).getByText('Dra. Ana')).toBeInTheDocument()
    expect(within(linha).getByText('Consulta de retorno')).toBeInTheDocument()
    expect(within(linha).getByRole('link', { name: /Agendar retorno/ })).toBeInTheDocument()
  })

  it('na aba de Relatórios é só demonstrativo: sem Editar prazo, Agendar nem cartões clicáveis; com resumo e exportação', () => {
    render(<RetornosRelatorio somenteLeitura titulo="Retornos" />)
    expect(screen.queryByRole('link', { name: /Agendar/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Editar prazo|Definir prazo/ })).toBeNull()
    const tabela = screen.getByTestId('retornos-tabela')
    expect(within(tabela).getAllByRole('columnheader').map((c) => c.textContent)).not.toContain('Ação')
    // os cartões do topo viram só números (não são botões)
    expect(screen.queryByRole('button', { name: /No prazo/ })).toBeNull()
    const resumo = screen.getByRole('region', { name: 'Resumo dos retornos' })
    expect(within(resumo).getByText('Pendentes').nextSibling?.textContent).toBe('4')
    expect(within(resumo).getByText('Agendados').nextSibling?.textContent).toBe('2')
    expect(within(resumo).getByText('Concluídos').nextSibling?.textContent).toBe('7')
    expect(screen.getByRole('button', { name: 'Exportar em Excel' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Exportar em PDF' })).toBeEnabled()
  })
})
