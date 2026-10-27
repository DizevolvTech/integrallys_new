import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { consultaQuitada, numeroRecibo, rotuloFormaPagamento, vendaEmitiveis, type ReciboDados, type ReciboTipo } from '@/lib/recibo'
import { assertPacienteInUnitScope, authErrorResponse, forbiddenResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'
import { notaFiscalFromFinancial } from '@/features/gestao-pacientes/utils/nota-fiscal'

const UUID = /^[0-9a-f-]{36}$/i
const PERFIS_RECIBO = new Set(['master', 'admin', 'gestor', 'recepcao'])

type Supabase = ReturnType<typeof getAppSupabase>

async function carregarClinica(supabase: Supabase, unidadeId: string | null) {
  let query = supabase.from('clinica_config').select('nome,endereco,cidade_uf,telefone').limit(1)
  if (unidadeId) query = query.eq('unidade_id', unidadeId)
  const { data } = await query.maybeSingle()
  return {
    nome: String(data?.nome ?? 'Clínica'),
    endereco: String(data?.endereco ?? ''),
    cidadeUf: String(data?.cidade_uf ?? ''),
    telefone: String(data?.telefone ?? ''),
  }
}

async function carregarPaciente(supabase: Supabase, pacienteId: string | null) {
  if (!pacienteId) return { nome: 'Paciente', cpf: '', precisaNf: false, titular: null as string | null }
  const { data } = await supabase
    .from('pacientes')
    .select('nome,cpf,precisa_nf,financeiro')
    .eq('id', pacienteId)
    .maybeSingle()
  const nf = data?.financeiro ? notaFiscalFromFinancial(data.financeiro as never) : null
  return {
    nome: String(data?.nome ?? 'Paciente'),
    cpf: String(data?.cpf ?? ''),
    precisaNf: data?.precisa_nf === true,
    titular: nf && nf.modo === 'adicionar' ? `${nf.nome} (${nf.documento})` : null,
  }
}

async function statusPedidoNf(supabase: Supabase, tipo: ReciboTipo, id: string) {
  const { data } = await supabase
    .from('pedidos_nf')
    .select('status')
    .eq('origem', tipo)
    .eq('origem_id', id)
    .in('status', ['pendente', 'emitida'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.status as 'pendente' | 'emitida' | undefined) ?? null
}

async function reciboPrescricao(supabase: Supabase, session: NonNullable<Awaited<ReturnType<typeof getRequestAuth>>>, id: string) {
  const { data: p, error } = await supabase
    .from('prescricoes')
    .select('id,paciente_id,numero,status,valor_total,valor_bruto,desconto_valor,forma_pagamento,numero_parcelas,data_prescricao,updated_at')
    .eq('id', id)
    .maybeSingle()
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar a venda')
  if (!p) return serverErrorResponse('Venda não encontrada', 'NOT_FOUND', 404)
  if (!vendaEmitiveis(String(p.status))) {
    return serverErrorResponse('O recibo só é emitido para venda convertida', 'RECIBO_NAO_DISPONIVEL', 409)
  }
  const pacienteId = p.paciente_id ? String(p.paciente_id) : null
  if (pacienteId) {
    const fora = await assertPacienteInUnitScope({ session, pacienteId })
    if (fora) return fora
  }

  const [itens, paciente, pedido] = await Promise.all([
    supabase.from('prescricao_itens').select('descricao,quantidade,valor_unitario').eq('prescricao_id', id),
    carregarPaciente(supabase, pacienteId),
    statusPedidoNf(supabase, 'prescricao', id),
  ])
  const unidade = (await getScopedUnitId(session)).unidadeId
  const clinica = await carregarClinica(supabase, unidade)
  const linhas = (itens.data ?? []).map((i) => {
    const quantidade = Number(i.quantidade ?? 0)
    const valorUnitario = Number(i.valor_unitario ?? 0)
    return { descricao: String(i.descricao ?? ''), quantidade, valorUnitario, total: Math.round(quantidade * valorUnitario * 100) / 100 }
  })
  const total = Number(p.valor_total ?? 0)
  const subtotal = p.valor_bruto != null ? Number(p.valor_bruto) : linhas.reduce((s, l) => s + l.total, 0)
  const parcelas = Number(p.numero_parcelas ?? 0)
  const dados: ReciboDados = {
    numero: numeroRecibo('prescricao', String(p.numero ?? p.id)),
    tipo: 'prescricao',
    origemId: id,
    emitidoEm: new Date().toISOString(),
    clinica,
    paciente: { nome: paciente.nome, cpf: paciente.cpf },
    nf: { precisa: paciente.precisaNf, titular: paciente.titular, pedidoStatus: pedido },
    itens: linhas,
    subtotal,
    desconto: Math.max(0, Math.round((subtotal - total) * 100) / 100),
    total,
    pagamentos: [
      {
        forma: rotuloFormaPagamento(p.forma_pagamento as string | null),
        valor: total,
        data: (p.data_prescricao ?? p.updated_at ?? null) as string | null,
        detalhe: parcelas > 1 ? `${parcelas}x` : '',
      },
    ],
    totalPago: total,
  }
  return NextResponse.json({ data: dados })
}

async function reciboAgendamento(supabase: Supabase, session: NonNullable<Awaited<ReturnType<typeof getRequestAuth>>>, id: string) {
  const { data: a, error } = await supabase
    .from('agendamentos')
    .select('id,paciente_id,unidade_id,data_agendamento,valor_procedimento,tipo,titulo,procedimento_id')
    .eq('id', id)
    .maybeSingle()
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar o agendamento')
  if (!a?.paciente_id) return serverErrorResponse('Agendamento não encontrado', 'NOT_FOUND', 404)
  const pacienteId = String(a.paciente_id)
  const fora = await assertPacienteInUnitScope({ session, pacienteId })
  if (fora) return fora

  const [pagamentos, procedimento, paciente, pedido, clinica] = await Promise.all([
    supabase.from('agendamentos_pagamentos').select('valor,metodo,bandeira,parcelas,pago_em').eq('agendamento_id', id).eq('status', 'Pago').order('pago_em', { ascending: true }),
    a.procedimento_id ? supabase.from('procedimentos').select('nome').eq('id', a.procedimento_id).maybeSingle() : Promise.resolve({ data: null }),
    carregarPaciente(supabase, pacienteId),
    statusPedidoNf(supabase, 'agendamento', id),
    carregarClinica(supabase, a.unidade_id ? String(a.unidade_id) : null),
  ])
  const pagos = pagamentos.data ?? []
  const totalPago = Math.round(pagos.reduce((s, x) => s + Number(x.valor ?? 0), 0) * 100) / 100
  const valor = Number(a.valor_procedimento ?? 0)
  if (!consultaQuitada(valor, totalPago)) {
    return serverErrorResponse('O recibo só é emitido após o recebimento total da consulta', 'RECIBO_NAO_DISPONIVEL', 409)
  }
  const descricao = String(procedimento.data?.nome ?? a.titulo ?? a.tipo ?? 'Consulta')
  const dados: ReciboDados = {
    numero: numeroRecibo('agendamento', id),
    tipo: 'agendamento',
    origemId: id,
    emitidoEm: new Date().toISOString(),
    clinica,
    paciente: { nome: paciente.nome, cpf: paciente.cpf },
    nf: { precisa: paciente.precisaNf, titular: paciente.titular, pedidoStatus: pedido },
    itens: [{ descricao: `${descricao} — ${String(a.data_agendamento).split('-').reverse().join('/')}`, quantidade: 1, valorUnitario: valor, total: valor }],
    subtotal: valor,
    desconto: 0,
    total: valor,
    pagamentos: pagos.map((x) => ({
      forma: rotuloFormaPagamento(x.metodo as string | null),
      valor: Number(x.valor ?? 0),
      data: (x.pago_em as string | null) ?? null,
      detalhe: [x.bandeira, Number(x.parcelas ?? 0) > 1 ? `${x.parcelas}x` : ''].filter(Boolean).join(' '),
    })),
    totalPago,
  }
  return NextResponse.json({ data: dados })
}

/** GET /api/recibos?tipo=prescricao|agendamento&id=… — dados do recibo; só recepção, gestor, admin e master. */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  if (!PERFIS_RECIBO.has(session.role)) return forbiddenResponse()

  const params = new URL(request.url).searchParams
  const tipo = params.get('tipo')
  const id = params.get('id') ?? ''
  if ((tipo !== 'prescricao' && tipo !== 'agendamento') || !UUID.test(id)) {
    return serverErrorResponse('Recibo inválido', 'INVALID_RECIBO', 400)
  }
  const denied = await requirePermission(session.userId, tipo === 'prescricao' ? 'prescricoes' : 'agenda', 'read')
  if (denied) return denied

  const supabase = getAppSupabase()
  return tipo === 'prescricao' ? reciboPrescricao(supabase, session, id) : reciboAgendamento(supabase, session, id)
}
