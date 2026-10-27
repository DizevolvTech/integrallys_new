import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth } from '@/lib/request-auth'

/** Listas dos filtros e do formulário de Recebimentos/Pagamentos (uma chamada, em paralelo). */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'financeiro', 'read')
  if (denied) return denied

  const supabase = getAppSupabase()
  const [formas, categorias, profissionais, procedimentos, fornecedores] = await Promise.all([
    supabase.from('formas_pagamento').select('id,nome,tipo').eq('ativo', true).order('nome'),
    supabase.from('dre_categorias').select('id,nome,tipo').eq('ativo', true).order('tipo').order('ordem').order('nome'),
    supabase.from('usuarios').select('id,nome').eq('perfil', 'especialista').eq('status', 'Ativo').order('nome'),
    supabase.from('procedimentos').select('id,nome').eq('ativo', true).order('nome'),
    supabase.from('pacientes').select('id,nome').contains('vinculo_tipos', ['fornecedor']).order('nome').limit(500),
  ])
  const erro = [formas, categorias, profissionais, procedimentos, fornecedores].find((r) => r.error)?.error
  if (erro) return supabaseErrorResponse(erro, 'Falha ao carregar opções')

  return NextResponse.json({
    data: {
      formas: formas.data ?? [],
      categorias: categorias.data ?? [],
      profissionais: profissionais.data ?? [],
      procedimentos: procedimentos.data ?? [],
      fornecedores: fornecedores.data ?? [],
    },
  })
}
