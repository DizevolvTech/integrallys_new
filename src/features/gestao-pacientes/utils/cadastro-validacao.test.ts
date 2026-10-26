import { describe, expect, it } from 'vitest'
import { camposFaltandoCadastro, mensagemCamposFaltando } from './cadastro-validacao'
import { ENDERECO_NF_VAZIO, NOTA_FISCAL_VAZIA } from './nota-fiscal'

const OK = {
  nome: 'Ana',
  cpf: '529.982.247-25',
  dataNascimento: '2023-01-01',
  cep: '01310-100',
  telefone: '(11) 91234-5678',
  precisaNf: false,
  notaFiscal: NOTA_FISCAL_VAZIA,
  menorDeIdade: false,
  responsavelNome: '',
  responsavelParentesco: '',
}

describe('campos obrigatórios do cadastro', () => {
  it('completo não pede nada', () => {
    expect(camposFaltandoCadastro(OK)).toEqual([])
    expect(mensagemCamposFaltando([])).toBeNull()
  })
  it('lista tudo o que falta de uma vez, incluindo responsável e endereço da nota', () => {
    const faltam = camposFaltandoCadastro({
      ...OK,
      cep: '',
      menorDeIdade: true,
      precisaNf: true,
      notaFiscal: { modo: 'adicionar', documento: '11.222.333/0001-81', nome: 'Fazenda', endereco: { ...ENDERECO_NF_VAZIO } },
    })
    expect(faltam).toEqual([
      'CEP do endereço',
      'nome do responsável (paciente menor de 18 anos)',
      'parentesco do responsável',
      'CEP da nota',
      'logradouro da nota',
      'número da nota',
      'bairro da nota',
      'cidade da nota',
      'UF da nota',
    ])
    expect(mensagemCamposFaltando(faltam)).toMatch(/^Para salvar, preencha: CEP do endereço, /)
  })
})
