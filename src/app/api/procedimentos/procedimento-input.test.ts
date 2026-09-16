import { describe, expect, it } from 'vitest'
import { buildProcedimentoPayload, parseInteger, parseNumeric } from './procedimento-input'

describe('parseNumeric / parseInteger', () => {
  it('vazio e null viram null', () => {
    expect(parseNumeric('')).toBeNull()
    expect(parseNumeric(null)).toBeNull()
    expect(parseNumeric(undefined)).toBeNull()
    expect(parseInteger('')).toBeNull()
  })

  it('numérico é convertido; inteiro trunca', () => {
    expect(parseNumeric('12.50')).toBe(12.5)
    expect(parseInteger('30.9')).toBe(30)
  })

  it('não-numérico vira null', () => {
    expect(parseNumeric('abc')).toBeNull()
  })
})

describe('buildProcedimentoPayload', () => {
  it('gera código automático quando vazio e autoCodigo=true', () => {
    const p = buildProcedimentoPayload({ nome: 'Consulta' }, { autoCodigo: true })
    expect(p.codigo).toMatch(/^PROC-\d{1,8}$/)
  })

  it('preserva o código informado (aparado) e não gera outro', () => {
    const p = buildProcedimentoPayload(
      { nome: 'Consulta', codigo: '  CONS-01  ' },
      { autoCodigo: true },
    )
    expect(p.codigo).toBe('CONS-01')
  })

  it('autoCodigo=false com código vazio mantém null', () => {
    const p = buildProcedimentoPayload({ nome: 'Consulta' }, { autoCodigo: false })
    expect(p.codigo).toBeNull()
  })

  it('tem_retorno=false zera prazo/valor de retorno mesmo se enviados', () => {
    const p = buildProcedimentoPayload(
      { nome: 'X', temRetorno: false, prazoRetornoDias: '30', valorRetorno: '80' },
      { autoCodigo: false },
    )
    expect(p.tem_retorno).toBe(false)
    expect(p.prazo_retorno_dias).toBeNull()
    expect(p.valor_retorno).toBeNull()
  })

  it('tem_retorno=true converte prazo (int) e valor (numeric)', () => {
    const p = buildProcedimentoPayload(
      { nome: 'X', temRetorno: true, prazoRetornoDias: '15', valorRetorno: '49.90' },
      { autoCodigo: false },
    )
    expect(p.tem_retorno).toBe(true)
    expect(p.prazo_retorno_dias).toBe(15)
    expect(p.valor_retorno).toBe(49.9)
  })

  it('tem_retorno=true sem prazo usa padrão 35 dias', () => {
    const p = buildProcedimentoPayload(
      { nome: 'X', temRetorno: true, valorRetorno: '120' },
      { autoCodigo: false },
    )
    expect(p.prazo_retorno_dias).toBe(35)
  })

  it('tem_pacote=true persiste intervalo e quantidade', () => {
    const p = buildProcedimentoPayload(
      {
        nome: 'Psicanálise',
        temPacote: true,
        intervaloRecorrenciaDias: '15',
        quantidadeSugeridaPacote: '10',
      },
      { autoCodigo: false },
    )
    expect(p.tem_pacote).toBe(true)
    expect(p.intervalo_recorrencia_dias).toBe(15)
    expect(p.quantidade_sugerida_pacote).toBe(10)
  })

  it('tem_pacote=false zera intervalo/quantidade', () => {
    const p = buildProcedimentoPayload(
      {
        nome: 'X',
        temPacote: false,
        intervaloRecorrenciaDias: '15',
        quantidadeSugeridaPacote: '10',
      },
      { autoCodigo: false },
    )
    expect(p.tem_pacote).toBe(false)
    expect(p.intervalo_recorrencia_dias).toBeNull()
    expect(p.quantidade_sugerida_pacote).toBeNull()
  })

  it('valor e duração são parseados; ativo default true, false quando explícito', () => {
    const p = buildProcedimentoPayload(
      { nome: 'X', valor: '180', duracaoMin: '45' },
      { autoCodigo: false },
    )
    expect(p.valor).toBe(180)
    expect(p.duracao_min).toBe(45)
    expect(p.ativo).toBe(true)

    const inativo = buildProcedimentoPayload({ nome: 'X', ativo: false }, { autoCodigo: false })
    expect(inativo.ativo).toBe(false)
  })
})
