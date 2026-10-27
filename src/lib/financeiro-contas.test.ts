import { describe, expect, it } from 'vitest'
import {
  filtrarRecebimentosCaixa,
  filtrarSaldos,
  lerFiltrosContas,
  mapLancamentoConta,
  recebimentoCaixaConta,
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
  })
  if (!saldo) throw new Error('saldo esperado')

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

describe('recebimento lançado no caixa', () => {
  const credito = recebimentoCaixaConta({ id: 'm1', descricao: 'Teste cartão', valor: 300, forma: 'cartao_credito', bandeira: 'Visa', parcelas: 3, dia: '2026-10-27' })
  const dinheiro = recebimentoCaixaConta({ id: 'm2', descricao: 'Venda suplemento', valor: 89.9, forma: 'dinheiro', bandeira: null, parcelas: null, dia: '2026-10-14' })

  it('entra como liquidado, só leitura, com bandeira e parcelas na forma', () => {
    expect(credito).toMatchObject({ id: 'cx:m1', origem: 'caixa', situacao: 'liquidado', somenteLeitura: true, valor: 300 })
    expect(credito.forma).toBe('Cartão de crédito · Visa 3x')
    expect(dinheiro.forma).toBe('Dinheiro')
  })

  it('filtra por período, texto e situação; filtros que o caixa não responde o escondem', () => {
    const base: FiltrosContas = { tipo: 'receita', de: null, ate: null, pessoa: '', produto: '', formaId: '', situacao: '', categoriaId: '', profissionalId: '', procedimentoId: '' }
    const todos = [credito, dinheiro]
    expect(filtrarRecebimentosCaixa(todos, { ...base, de: '2026-10-20' })).toEqual([credito])
    expect(filtrarRecebimentosCaixa(todos, { ...base, pessoa: 'suplemento' })).toEqual([dinheiro])
    expect(filtrarRecebimentosCaixa(todos, { ...base, situacao: 'a_vencer' })).toEqual([])
    expect(filtrarRecebimentosCaixa(todos, { ...base, profissionalId: '11111111-1111-1111-1111-111111111111' })).toEqual([])
  })
})
