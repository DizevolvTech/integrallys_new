import { describe, expect, it } from 'vitest'
import { tarefaStatusLabel, validarCancelamento } from './tarefa-status'

describe('tarefa-status', () => {
  it('Em andamento aparece como Fazendo', () => {
    expect(tarefaStatusLabel('Em andamento')).toBe('Fazendo')
    expect(tarefaStatusLabel('Pendente')).toBe('Pendente')
  })
  it('cancelar exige motivo', () => {
    expect(validarCancelamento('Cancelada', '')).not.toBeNull()
    expect(validarCancelamento('Cancelada', '   ')).not.toBeNull()
    expect(validarCancelamento('Cancelada', 'Duplicada')).toBeNull()
    expect(validarCancelamento('Pendente', '')).toBeNull()
  })
})
