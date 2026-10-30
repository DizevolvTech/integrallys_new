import { type NextRequest, NextResponse } from 'next/server'
import { getAppSupabase, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth } from '@/lib/request-auth'

/**
 * Lista mínima de contas bancárias ativas (id e nome) para quem recebe pagamento
 * na agenda escolher a conta do PIX. Não expõe agência, número nem saldo:
 * a gestão bancária completa continua restrita à permissão `gestao-bancaria`.
 */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'agenda', 'update')
  if (denied) return denied

  const { data, error } = await getAppSupabase()
    .from('contas_bancarias')
    .select('id,nome,banco')
    .eq('ativo', true)
    .order('nome', { ascending: true })
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar contas bancárias')

  return NextResponse.json({
    data: (data ?? []).map((row) => ({
      id: String(row.id),
      nome: String(row.nome ?? ''),
      banco: row.banco ?? null,
    })),
  })
}
