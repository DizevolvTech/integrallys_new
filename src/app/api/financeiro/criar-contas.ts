import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { validarNovoLancamento } from '@/lib/financeiro-lancamento-input'
import { hojeClinica } from '@/lib/recebimento-agendamento'
import { getScopedUnitId, isScopedRole, type getRequestAuth } from '@/lib/request-auth'

type Session = NonNullable<Awaited<ReturnType<typeof getRequestAuth>>>

const uuidOuNulo = (valor: unknown) =>
  typeof valor === 'string' && /^[0-9a-f-]{36}$/i.test(valor) ? valor : null

/**
 * "Novo recebimento" / "Nova despesa": cria 1 lançamento ou, com parcelamento, uma conta por
 * parcela (mesmo grupo), cada uma com seu vencimento. A categoria vem do cadastro de DRE.
 */
export async function criarContas(session: Session, body: Record<string, unknown>) {
  const tipo = body.tipo === 'despesa' ? 'despesa' : 'receita'
  const descricao = typeof body.descricao === 'string' ? body.descricao.trim() : ''
  if (!descricao) return serverErrorResponse('Informe a descrição', 'INVALID_FINANCEIRO_INPUT', 400)

  const validado = validarNovoLancamento(body, hojeClinica())
  if (!validado.ok) return serverErrorResponse(validado.error, validado.code, 400)
  const { data: dados } = validado

  const supabase = getAppSupabase()
  if (!dados.categoriaDreId) {
    return serverErrorResponse('Escolha a categoria de DRE', 'DRE_CATEGORIA_REQUIRED', 400)
  }
  const { data: categoria, error: categoriaError } = await supabase
    .from('dre_categorias')
    .select('nome,tipo,linha_dre,ativo')
    .eq('id', dados.categoriaDreId)
    .maybeSingle()
  if (categoriaError) return supabaseErrorResponse(categoriaError, 'Falha ao validar categoria')
  if (!categoria?.ativo || categoria.tipo !== tipo) {
    return serverErrorResponse('Categoria de DRE inválida para este lançamento', 'DRE_CATEGORIA_INVALID', 400)
  }

  const scoped = await getScopedUnitId(session)
  if (scoped.error) return supabaseErrorResponse(scoped.error, 'Falha ao salvar lançamento financeiro')
  if (isScopedRole(session.role) && !scoped.unidadeId) {
    return serverErrorResponse('Usuário sem unidade vinculada', 'UNIT_REQUIRED', 403)
  }
  const unidadeId = isScopedRole(session.role)
    ? scoped.unidadeId
    : (scoped.unidadeId ?? uuidOuNulo(body.unidadeId))

  const formaId = uuidOuNulo(body.formaPagamentoId)
  let metodo: string | null = null
  if (formaId) {
    const { data: forma } = await supabase.from('formas_pagamento').select('nome').eq('id', formaId).maybeSingle()
    metodo = forma?.nome ? String(forma.nome) : null
  }

  const beneficiario =
    typeof body.beneficiario === 'string' && body.beneficiario.trim() ? body.beneficiario.trim() : null
  const grupo = dados.parcelas.length > 1 ? randomUUID() : null
  const linhas = dados.parcelas.map((parcela) => ({
    unidade_id: unidadeId,
    usuario_id: session.userId,
    descricao,
    categoria: categoria.nome,
    categoria_dre: categoria.linha_dre,
    dre_categoria_id: dados.categoriaDreId,
    valor: parcela.valor,
    tipo,
    data_lancamento: `${dados.emissao}T12:00:00-03:00`,
    data_emissao: dados.emissao,
    competencia: dados.emissao,
    vencimento: parcela.vencimento,
    numero_documento: dados.numeroDocumento,
    metodo,
    status: 'Pendente',
    observacoes: typeof body.observacoes === 'string' && body.observacoes.trim() ? body.observacoes.trim() : null,
    forma_pagamento_id: formaId,
    conta_bancaria_id: uuidOuNulo(body.contaBancariaId),
    beneficiario,
    parcelas: parcela.total,
    parcela_atual: parcela.numero,
    grupo_parcelas: grupo,
    paciente_id: dados.vinculos.pacienteId,
    profissional_id: dados.vinculos.profissionalId,
    procedimento_id: dados.vinculos.procedimentoId,
  }))

  const { data, error } = await supabase.from('financeiro_lancamentos').insert(linhas).select('id')
  if (error) return supabaseErrorResponse(error, 'Falha ao salvar lançamento financeiro')
  return NextResponse.json({ data: { ids: (data ?? []).map((row) => String(row.id)), parcelas: linhas.length } }, { status: 201 })
}
