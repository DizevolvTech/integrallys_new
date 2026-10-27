import { describe, expect, it } from 'vitest'
import {
  filtrarSaldos,
  lerFiltrosContas,
  mapLancamentoConta,
  saldoAgendamentoConta,
  type FiltrosContas,
} from './financeiro-contas'

const hoje = '2026-10-27'
const ctx = { hoje, formas: new Map([['f1', 'PIX']]), anexos: new Map([['l1', 2]]) }

describe('mapLancamentoConta', () => {
  it('mostra parcela 2/10, forma do cadastro e A vencer no lugar de pendente', () => {
    const item = mapLancamentoConta(
      {
        id: 'l1', descricao: 'Aluguel', categoria: 'Despesas fixas', valor: '1500', status: 'Pendente',
        parcelas: 10, parcela_atual: 2, forma_pagamento_id: 'f1', data_referencia: '2026-11-10',
        vencimento: '2026-11-10', data_lancamento: '2026-10-20T10:00:00Z', numero_documento: 'NF 55',
      },
      ctx,
    )
    expect(item).toMatchObject({ parcela: '2/10', forma: 'PIX', situacao: 'a_vencer', situacaoLabel: 'A vencer', anexos: 2, numeroDocumento: 'NF 55' })
  })

  it('vencido sem pagar é atrasado; pago é liquidado', () => {
    const base = { id: 'x', descricao: 'd', categoria: 'c', valor: 10, parcelas: 1, data_lancamento: '2026-09-01T00:00:00Z' }
    expect(mapLancamentoConta({ ...base, status: 'Pendente', data_referencia: '2026-10-01' }, ctx).situacao).toBe('atrasado')
    expect(mapLancamentoConta({ ...base, status: 'Pago', data_referencia: '2026-10-01' }, ctx).situacao).toBe('liquidado')
  })
})

describe('saldoAgendamentoConta', () => {
  const base = {
    agendamentoId: 'a1', paciente: 'Maria', procedimento: 'Consulta', procedimentoId: 'p1',
    profissionalId: 'u1', dataAgendamento: '2026-11-05', valorDevido: 200, hoje,
  }
  it('só existe quando falta receber e vence na data do atendimento', () => {
    expect(saldoAgendamentoConta({ ...base, totalPago: 100 })).toMatchObject({ valor: 100, situacao: 'a_vencer', somenteLeitura: true })
    expect(saldoAgendamentoConta({ ...base, totalPago: 200 })).toBeNull()
    expect(saldoAgendamentoConta({ ...base, totalPago: 50, dataAgendamento: '2026-10-01' })?.situacao).toBe('atrasado')
  })
})

describe('filtros', () => {
  const filtros = (extra: Partial<FiltrosContas>): FiltrosContas => ({
    tipo: 'receita', de: null, ate: null, pessoa: '', produto: '', formaId: '', situacao: '',
    categoriaId: '', profissionalId: '', procedimentoId: '', ...extra,
  })
  const saldo = saldoAgendamentoConta({
    agendamentoId: 'a1', paciente: 'Maria Souza', procedimento: null, procedimentoId: 'p1',
    profissionalId: 'u1', dataAgendamento: '2026-11-05', valorDevido: 200, totalPago: 100, hoje,
  })!

  it('filtra o saldo por cliente, profissional e período', () => {
    expect(filtrarSaldos([saldo], filtros({ pessoa: 'souza' }))).toHaveLength(1)
    expect(filtrarSaldos([saldo], filtros({ pessoa: 'joao' }))).toHaveLength(0)
    expect(filtrarSaldos([saldo], filtros({ profissionalId: 'u2' }))).toHaveLength(0)
    expect(filtrarSaldos([saldo], filtros({ de: '2026-11-06' }))).toHaveLength(0)
  })
  it('filtro de forma/categoria/produto não se aplica ao saldo', () => {
    expect(filtrarSaldos([saldo], filtros({ formaId: '00000000-0000-0000-0000-000000000000' }))).toHaveLength(0)
  })
  it('lê filtros validando tipo, datas e ids', () => {
    expect(lerFiltrosContas(new URLSearchParams('tipo=x'))).toBeNull()
    const lidos = lerFiltrosContas(new URLSearchParams('tipo=despesa&de=2026-02-30&ate=2026-10-27&situacao=atrasado&formaId=abc'))
    expect(lidos).toMatchObject({ tipo: 'despesa', de: null, ate: '2026-10-27', situacao: 'atrasado', formaId: '' })
  })
})
