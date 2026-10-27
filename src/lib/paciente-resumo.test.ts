import { describe, expect, it } from 'vitest'
import { calcularIdade, montarPacienteResumo } from './paciente-resumo'

describe('calcularIdade', () => {
  it('conta o aniversário só depois de passar', () => {
    expect(calcularIdade('1990-10-28', '2026-10-27')).toBe(35)
    expect(calcularIdade('1990-10-27', '2026-10-27')).toBe(36)
  })
  it('data inválida ou futura devolve null', () => {
    expect(calcularIdade('', '2026-10-27')).toBeNull()
    expect(calcularIdade('2030-01-01', '2026-10-27')).toBeNull()
  })
})

describe('montarPacienteResumo', () => {
  it('formata nascimento, CPF, endereço e foto', () => {
    const r = montarPacienteResumo(
      {
        id: 'p1',
        nome: ' Maria ',
        data_nascimento: '1985-03-09',
        cpf: '12345678909',
        telefone: '11987654321',
        email: 'm@x.com',
        logradouro: 'Rua A',
        numero: '10',
        bairro: 'Centro',
        cidade: 'Campinas',
        estado: 'SP',
        cep: '13000-000',
        photo_url: 'http://x/foto.jpg',
      },
      '2026-10-27',
    )
    expect(r).toMatchObject({
      nome: 'Maria',
      dataNascimento: '09/03/1985',
      idade: 41,
      cpf: '123.456.789-09',
      endereco: 'Rua A, 10 - Centro - Campinas/SP - 13000-000',
      fotoUrl: 'http://x/foto.jpg',
    })
  })
  it('campos vazios ficam vazios (sem inventar)', () => {
    const r = montarPacienteResumo({ id: 'p2', nome: 'Ana' }, '2026-10-27')
    expect(r).toMatchObject({ dataNascimento: '', idade: null, cpf: '', endereco: '', fotoUrl: null })
  })
})
