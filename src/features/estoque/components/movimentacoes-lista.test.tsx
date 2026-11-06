import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MovimentacoesLista } from './movimentacoes-lista'
import type { MovimentacaoItem } from '../hooks/use-estoque'

const base: MovimentacaoItem = {
  id: '1', produtoId: 'p', produtoNome: 'Vitamina D', operadorNome: 'Rita', tipo: 'saida', tipoMovimentacao: 'saida',
  quantidade: 2, observacoes: 'Saída por venda de prescrição PRESC-1', vinculoTipo: null, vinculoNome: null,
  pacienteNome: 'Carlos Almeida', criadoEm: '2026-11-06T15:00:00Z', estornada: false,
}

describe('Movimentos: coluna Paciente', () => {
  it('mostra o paciente da venda e "—" quando não há', () => {
    render(<MovimentacoesLista movimentacoes={[base, { ...base, id: '2', pacienteNome: null }]} onEstornar={() => {}} />)
    expect(screen.getAllByText('Paciente').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Vínculo').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Carlos Almeida').length).toBeGreaterThan(0)
  })
})
