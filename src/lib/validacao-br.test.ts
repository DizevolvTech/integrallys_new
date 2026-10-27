import { describe, expect, it } from 'vitest'
import {
  formatarCEP,
  formatarCNPJ,
  formatarCPF,
  formatarTelefone,
  normalizarCNPJ,
  validarCEP,
  validarCNPJ,
  validarCPF,
  validarTelefone,
} from './validacao-br'

// Vetores de teste conferidos manualmente contra o algoritmo oficial.
// CNPJ alfanumérico: exemplo oficial da Receita Federal / Serpro
// ("Cálculo dos dígitos verificadores de CNPJ alfanumérico", Nota Técnica
// COCAD/SUARA/RFB nº 49/2024): base 12ABC34501DE -> DV 35.

describe('validarCPF', () => {
  it('aceita CPF válido com máscara', () => {
    expect(validarCPF('111.444.777-35')).toBe(true)
  })

  it('aceita CPF válido sem máscara', () => {
    expect(validarCPF('52998224725')).toBe(true)
  })

  it('aceita CPF cujo primeiro dígito verificador é 0 (resto 1 da divisão)', () => {
    // 123.456.789: somatório 210, resto 1 -> DV1 = 0
    expect(validarCPF('123.456.789-09')).toBe(true)
  })

  it('rejeita CPF com dígito verificador errado', () => {
    expect(validarCPF('529.982.247-26')).toBe(false)
  })

  it('rejeita CPF com segundo dígito verificador errado', () => {
    expect(validarCPF('123.456.789-10')).toBe(false)
  })

  it('rejeita CPF com todos os dígitos iguais mesmo passando no cálculo do DV', () => {
    // 111.111.111-11 satisfaz o módulo 11 (DV1=1, DV2=1) mas é inválido de fato.
    expect(validarCPF('111.111.111-11')).toBe(false)
    expect(validarCPF('000.000.000-00')).toBe(false)
    expect(validarCPF('999.999.999-99')).toBe(false)
  })

  it('rejeita CPF com quantidade de dígitos errada', () => {
    expect(validarCPF('1114447773')).toBe(false)
    expect(validarCPF('111444777355')).toBe(false)
  })

  it('rejeita valor vazio ou com letras', () => {
    expect(validarCPF('')).toBe(false)
    expect(validarCPF('   ')).toBe(false)
    expect(validarCPF('111.444.777-3X')).toBe(false)
  })
})

describe('formatarCPF', () => {
  it('aplica a máscara progressivamente conforme o usuário digita', () => {
    expect(formatarCPF('111')).toBe('111')
    expect(formatarCPF('111444')).toBe('111.444')
    expect(formatarCPF('111444777')).toBe('111.444.777')
    expect(formatarCPF('11144477735')).toBe('111.444.777-35')
  })

  it('descarta caracteres não numéricos e o excedente de 11 dígitos', () => {
    expect(formatarCPF('111.444.777-35')).toBe('111.444.777-35')
    expect(formatarCPF('111abc444777359999')).toBe('111.444.777-35')
  })
})

describe('normalizarCNPJ', () => {
  it('remove máscara e converte letras para maiúsculas', () => {
    expect(normalizarCNPJ('12.abc.345/01de-35')).toBe('12ABC34501DE35')
    expect(normalizarCNPJ('00.000.000/0001-91')).toBe('00000000000191')
  })
})

describe('validarCNPJ', () => {
  it('aceita o exemplo alfanumérico oficial da Receita Federal', () => {
    expect(validarCNPJ('12.ABC.345/01DE-35')).toBe(true)
    expect(validarCNPJ('12ABC34501DE35')).toBe(true)
  })

  it('aceita o exemplo oficial digitado em minúsculas', () => {
    expect(validarCNPJ('12.abc.345/01de-35')).toBe(true)
  })

  it('rejeita o exemplo oficial com o último dígito verificador trocado', () => {
    expect(validarCNPJ('12.ABC.345/01DE-34')).toBe(false)
  })

  it('rejeita o exemplo oficial com o primeiro dígito verificador trocado', () => {
    expect(validarCNPJ('12.ABC.345/01DE-45')).toBe(false)
  })

  it('aceita CNPJ numérico real já existente', () => {
    // Banco do Brasil
    expect(validarCNPJ('00.000.000/0001-91')).toBe(true)
  })

  it('aceita CNPJ numérico cujo primeiro DV é 0 (resto 0 da divisão)', () => {
    // Petrobras: somatório 121, múltiplo de 11 -> DV1 = 0
    expect(validarCNPJ('33.000.167/0001-01')).toBe(true)
  })

  it('rejeita CNPJ numérico com dígito verificador errado', () => {
    expect(validarCNPJ('00.000.000/0001-92')).toBe(false)
    expect(validarCNPJ('33.000.167/0001-02')).toBe(false)
  })

  it('rejeita CNPJ com todos os caracteres iguais mesmo passando no cálculo do DV', () => {
    // 00000000000000 satisfaz o módulo 11 (DV1=0, DV2=0) mas é inválido de fato.
    expect(validarCNPJ('00.000.000/0000-00')).toBe(false)
    expect(validarCNPJ('11.111.111/1111-11')).toBe(false)
  })

  it('rejeita letra na posição dos dígitos verificadores', () => {
    // Os 2 últimos caracteres são sempre numéricos, mesmo no CNPJ alfanumérico.
    expect(validarCNPJ('12ABC34501DE3E')).toBe(false)
    expect(validarCNPJ('12ABC34501DEA5')).toBe(false)
  })

  it('rejeita quantidade de caracteres diferente de 14', () => {
    expect(validarCNPJ('12ABC34501DE3')).toBe(false)
    expect(validarCNPJ('12ABC34501DE355')).toBe(false)
    expect(validarCNPJ('')).toBe(false)
  })

  it('rejeita caracteres fora de 0-9 e A-Z', () => {
    expect(validarCNPJ('12ÁBC34501DE35')).toBe(false)
    expect(validarCNPJ('12-BC34501DE35')).toBe(false)
  })
})

describe('formatarCNPJ', () => {
  it('aplica a máscara progressivamente e aceita letras na raiz', () => {
    expect(formatarCNPJ('12')).toBe('12')
    expect(formatarCNPJ('12ABC')).toBe('12.ABC')
    expect(formatarCNPJ('12ABC345')).toBe('12.ABC.345')
    expect(formatarCNPJ('12ABC34501DE')).toBe('12.ABC.345/01DE')
    expect(formatarCNPJ('12ABC34501DE35')).toBe('12.ABC.345/01DE-35')
  })

  it('mantém a máscara dos CNPJ numéricos existentes', () => {
    expect(formatarCNPJ('00000000000191')).toBe('00.000.000/0001-91')
  })

  it('converte letras para maiúsculas e descarta símbolos', () => {
    expect(formatarCNPJ('12.abc.345/01de-35')).toBe('12.ABC.345/01DE-35')
  })

  it('descarta letra digitada na posição dos dígitos verificadores', () => {
    // Posições 13 e 14 só aceitam dígito.
    expect(formatarCNPJ('12ABC34501DEAB')).toBe('12.ABC.345/01DE')
    expect(formatarCNPJ('12ABC34501DE3X5')).toBe('12.ABC.345/01DE-35')
  })

  it('descarta o excedente de 14 caracteres', () => {
    expect(formatarCNPJ('12ABC34501DE35999')).toBe('12.ABC.345/01DE-35')
  })
})

describe('validarCEP', () => {
  it('aceita CEP real com e sem máscara', () => {
    expect(validarCEP('01310-100')).toBe(true)
    expect(validarCEP('01310100')).toBe(true)
  })

  it('rejeita quantidade de dígitos diferente de 8', () => {
    expect(validarCEP('0131010')).toBe(false)
    expect(validarCEP('013101000')).toBe(false)
    expect(validarCEP('')).toBe(false)
  })

  it('valida apenas formato: aceita CEP bem formado ainda que inexistente', () => {
    // CEP não tem dígito verificador e esta função trava submit — quem decide
    // existência é o ViaCEP, de forma não bloqueante.
    expect(validarCEP('99999999')).toBe(true)
    expect(validarCEP('00000000')).toBe(true)
  })
})

describe('formatarCEP', () => {
  it('aplica a máscara progressivamente', () => {
    expect(formatarCEP('01310')).toBe('01310')
    expect(formatarCEP('01310100')).toBe('01310-100')
    expect(formatarCEP('01310-100')).toBe('01310-100')
    expect(formatarCEP('013101009999')).toBe('01310-100')
  })
})

describe('validarTelefone', () => {
  it('aceita celular com 9 dígitos iniciando em 9', () => {
    expect(validarTelefone('(11) 98765-4321')).toBe(true)
    expect(validarTelefone('11987654321')).toBe(true)
  })

  it('aceita telefone fixo com 8 dígitos', () => {
    expect(validarTelefone('(11) 3456-7890')).toBe(true)
    expect(validarTelefone('1134567890')).toBe(true)
  })

  it('rejeita DDD inexistente', () => {
    expect(validarTelefone('(20) 98765-4321')).toBe(false)
    expect(validarTelefone('(00) 98765-4321')).toBe(false)
    expect(validarTelefone('(52) 3456-7890')).toBe(false)
  })

  it('rejeita celular de 9 dígitos que não começa com 9', () => {
    expect(validarTelefone('(11) 88765-4321')).toBe(false)
  })

  it('rejeita formato antigo de celular com 8 dígitos iniciando em 9', () => {
    expect(validarTelefone('(11) 9876-4321')).toBe(false)
  })

  it('rejeita fixo cujo primeiro dígito não é de 2 a 5', () => {
    expect(validarTelefone('(11) 1456-7890')).toBe(false)
    expect(validarTelefone('(11) 6456-7890')).toBe(false)
  })

  it('rejeita quantidade de dígitos fora de 10 e 11', () => {
    expect(validarTelefone('1134567')).toBe(false)
    expect(validarTelefone('119876543210')).toBe(false)
    expect(validarTelefone('')).toBe(false)
  })
})

describe('formatarTelefone', () => {
  it('aplica a máscara de celular e de fixo', () => {
    expect(formatarTelefone('11987654321')).toBe('(11) 98765-4321')
    expect(formatarTelefone('1134567890')).toBe('(11) 3456-7890')
  })

  it('aplica a máscara progressivamente', () => {
    expect(formatarTelefone('11')).toBe('(11)')
    expect(formatarTelefone('119')).toBe('(11) 9')
    expect(formatarTelefone('119876')).toBe('(11) 9876')
    expect(formatarTelefone('1')).toBe('(1')
  })

  it('descarta o excedente de 11 dígitos', () => {
    expect(formatarTelefone('11987654321999')).toBe('(11) 98765-4321')
  })
})

describe('formatarCPF (recibo e fichas)', () => {
  it('formata CPF só com dígitos e mantém o já formatado', () => {
    expect(formatarCPF('99999999933')).toBe('999.999.999-33')
    expect(formatarCPF('999.999.999-33')).toBe('999.999.999-33')
    expect(formatarCPF('')).toBe('')
  })
})
