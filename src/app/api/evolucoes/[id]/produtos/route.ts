import { type NextRequest, NextResponse } from 'next/server'
import { serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { acessoEvolucao } from '@/lib/evolucao-acesso'

const UUID = /^[0-9a-f-]{36}$/i

function texto(valor: unknown, max = 200) {
  const t = typeof valor === 'string' ? valor.trim().slice(0, max) : ''
  return t || null
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const acesso = await acessoEvolucao(request, id, 'read')
  if (acesso.erro) return acesso.erro
  const { data, error } = await acesso.supabase
    .from('evolucao_produtos')
    .select('id,nome,tipo,modo_uso,frequencia,horario_ideal,created_at')
    .eq('evolucao_id', id)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar produtos')
  return NextResponse.json({
    data: (data ?? []).map((p) => ({
      id: String(p.id),
      nome: String(p.nome),
      tipo: p.tipo ? String(p.tipo) : null,
      modoUso: p.modo_uso ? String(p.modo_uso) : null,
      frequencia: p.frequencia ? String(p.frequencia) : null,
      horarioIdeal: p.horario_ideal ? String(p.horario_ideal) : null,
    })),
  })
}

/** Corpo: produtoId (do Estoque), modoUso, frequencia, horarioIdeal. Nome e tipo vêm do cadastro. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const acesso = await acessoEvolucao(request, id, 'update')
  if (acesso.erro) return acesso.erro
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const produtoId = String(body?.produtoId ?? '')
  if (!UUID.test(produtoId))
    return serverErrorResponse('Escolha um produto do estoque.', 'PRODUCT_REQUIRED', 400)

  const { data: produto } = await acesso.supabase
    .from('produtos_estoque')
    .select('id,nome,categoria')
    .eq('id', produtoId)
    .maybeSingle()
  if (!produto)
    return serverErrorResponse('Produto não encontrado no estoque.', 'PRODUCT_NOT_FOUND', 404)

  const { error } = await acesso.supabase.from('evolucao_produtos').insert({
    evolucao_id: id,
    produto_id: produtoId,
    nome: produto.nome,
    tipo: produto.categoria,
    modo_uso: texto(body?.modoUso),
    frequencia: texto(body?.frequencia),
    horario_ideal: texto(body?.horarioIdeal),
    created_by: acesso.session.userId,
  })
  if (error) return supabaseErrorResponse(error, 'Falha ao salvar produto')
  return NextResponse.json({ ok: true }, { status: 201 })
}
