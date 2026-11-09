import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { idDeMovimentoValido, lerEstornoCaixa, mensagemEstornoCaixaConcluido, respostaErroEstornoCaixa } from '@/lib/estorno-caixa'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'

type Auth = NonNullable<Awaited<ReturnType<typeof getRequestAuth>>>

/** Movimentação existe e é da unidade do usuário (perfil com unidade só mexe na própria). */
async function carregarMovimento(session: Auth, id: string) {
  const scoped = await getScopedUnitId(session)
  if (scoped.error) return { response: supabaseErrorResponse(scoped.error, 'Falha ao validar unidade') }
  const { data, error } = await getAppSupabase()
    .from('caixa_movimentos')
    .select('id,descricao,tipo,valor,origem,forma,unidade_id,prescricao_id,estornado_em,estorno_de_id')
    .eq('id', id)
    .maybeSingle()
  if (error) return { response: supabaseErrorResponse(error, 'Falha ao carregar movimentação de caixa') }
  if (!data) return { response: serverErrorResponse('Movimentação não encontrada.', 'MOVIMENTO_NOT_FOUND', 404) }
  if (scoped.unidadeId && data.unidade_id && String(data.unidade_id) !== scoped.unidadeId) {
    return { response: serverErrorResponse('Movimentação fora do escopo da unidade', 'CAIXA_UNIT_FORBIDDEN', 403) }
  }
  return { movimento: data }
}

/** Dados para a janela "Estornar movimentação": se é venda de prescrição e quais produtos de estoque voltam. */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'caixa', 'update')
  if (denied) return denied

  const id = new URL(request.url).searchParams.get('id')
  if (!idDeMovimentoValido(id)) return serverErrorResponse('Movimentação inválida.', 'INVALID_CAIXA_MOVIMENTO', 400)
  const carregado = await carregarMovimento(session, id)
  if ('response' in carregado) return carregado.response
  const { movimento } = carregado

  const supabase = getAppSupabase()
  let prescricao: { id: string; numero: string; status: string; tipo: string | null } | null = null
  let produtos: { nome: string; quantidade: number }[] = []
  if (movimento.origem === 'prescricao' && movimento.prescricao_id) {
    const { data: presc, error } = await supabase
      .from('prescricoes')
      .select('id,numero,status,tipo')
      .eq('id', String(movimento.prescricao_id))
      .maybeSingle()
    if (error) return supabaseErrorResponse(error, 'Falha ao carregar a prescrição da venda')
    if (presc) {
      prescricao = { id: String(presc.id), numero: String(presc.numero), status: String(presc.status), tipo: presc.tipo ? String(presc.tipo) : null }
      const { data: baixas, error: baixaError } = await supabase
        .from('movimentacoes_estoque')
        .select('quantidade,produtos_estoque(nome)')
        .eq('tipo', 'saida')
        .eq('estornada', false)
        .in('observacoes', [`Saída por conversão de prescrição ${prescricao.numero}`, `Saída por venda de prescrição ${prescricao.numero}`])
      if (baixaError) return supabaseErrorResponse(baixaError, 'Falha ao carregar os produtos da venda')
      produtos = (baixas ?? []).map((b) => {
        const produto = Array.isArray(b.produtos_estoque) ? b.produtos_estoque[0] : b.produtos_estoque
        return { nome: String((produto as { nome?: unknown } | null)?.nome ?? 'Produto'), quantidade: Number(b.quantidade ?? 0) }
      })
    }
  }

  const jaEstornada = Boolean(movimento.estornado_em)
  const eEstorno = movimento.origem === 'estorno' || Boolean(movimento.estorno_de_id)
  return NextResponse.json({
    data: {
      id: String(movimento.id),
      descricao: String(movimento.descricao ?? ''),
      tipo: movimento.tipo === 'saida' ? 'saida' : 'entrada',
      valor: Number(movimento.valor ?? 0),
      origem: movimento.origem ? String(movimento.origem) : 'manual',
      estornavel: !jaEstornada && !eEstorno,
      motivoRecusa: jaEstornada ? 'Esta movimentação já foi estornada.' : eEstorno ? 'Esta movimentação já é um estorno e não pode ser estornada.' : null,
      prescricao,
      produtosEstoque: produtos,
      temProdutoEstoque: produtos.length > 0,
    },
  })
}

/** Estorna a movimentação numa função SQL só: contrapartida no caixa, estoque e prescrição juntos ou nada. */
export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'caixa', 'update')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const lido = lerEstornoCaixa(body)
  if (!lido.ok) return serverErrorResponse(lido.message, lido.code, 400)

  const carregado = await carregarMovimento(session, lido.value.movimentoId)
  if ('response' in carregado) return carregado.response

  const { data, error } = await getAppSupabase().rpc('caixa_estornar_movimento', {
    p_movimento_id: lido.value.movimentoId,
    p_usuario_id: session.userId,
    p_motivo: lido.value.motivo,
    p_devolver_estoque: lido.value.devolverEstoque,
    p_prescricao_acao: lido.value.prescricaoAcao,
    p_operador_nome: session.user?.name || null,
  })
  if (error) return supabaseErrorResponse(error, 'Falha ao estornar movimentação')

  const resultado = (data ?? {}) as Record<string, unknown>
  if (resultado.ok !== true) {
    const falha = respostaErroEstornoCaixa(resultado.code, resultado.message)
    return serverErrorResponse(falha.message, falha.code, falha.status)
  }
  const produtosDevolvidos = Number(resultado.produtos_devolvidos ?? 0)
  const prescricaoStatus = typeof resultado.prescricao_status === 'string' ? resultado.prescricao_status : null
  return NextResponse.json({
    ok: true,
    data: {
      caixaMovimentoId: typeof resultado.caixa_movimento_id === 'string' ? resultado.caixa_movimento_id : null,
      produtosDevolvidos,
      prescricaoStatus,
      mensagem: mensagemEstornoCaixaConcluido({ produtosDevolvidos, prescricaoStatus }),
    },
  })
}
