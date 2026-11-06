import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EditarPrescricaoModal } from './editar-prescricao-modal'

const base = { id: 'p1', pacienteId: 'pac', numero: 'PRESC-1', paciente: 'Ana', valorTotal: 90, status: 'Ativa', validade: '2026-12-01' }

describe('EditarPrescricaoModal', () => {
  it('mostra os itens do registro (mesma fonte do carrinho)', () => {
    render(
      <EditarPrescricaoModal
        isOpen
        onClose={() => {}}
        patients={[{ id: 'pac', nome: 'Ana' }]}
        prescricao={{ ...base, items: [{ productName: 'Vitamina D', quantity: 2, posology: '1 por dia', unitPrice: 45, total: 90 }] }}
      />,
    )
    expect(screen.getByText('Vitamina D')).toBeInTheDocument()
    expect(screen.getByText('1 por dia')).toBeInTheDocument()
    expect(screen.queryByText(/Nenhum item detalhado retornado pela API/)).toBeNull()
  })
  it('sem itens avisa sem citar a API', () => {
    render(<EditarPrescricaoModal isOpen onClose={() => {}} patients={[]} prescricao={{ ...base, items: [] }} />)
    expect(screen.getByText('Nenhum item nesta prescrição.')).toBeInTheDocument()
  })
})
