import { type NextRequest, NextResponse } from 'next/server'
import { serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'
import { VINCULO_TIPOS } from '../movimento-input'
import { listarOpcoesVinculo } from '../vinculo-lookup'

/**
 * GET /api/caixa/vinculos?tipo=paciente|fornecedor|prestador|colaborador — lista mínima (id e nome) para o campo
 * "Vinculado a" do Recebimento/Pagamento. Quem opera o caixa nem sempre abre os cadastros; aqui só sai o necessário.
 */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'caixa', 'create')
  if (denied) return denied

  const tipo = request.nextUrl.searchParams.get('tipo') ?? ''
  if (!(VINCULO_TIPOS as readonly string[]).includes(tipo) || tipo === 'outro') {
    return serverErrorResponse('Tipo de vínculo inválido', 'CAIXA_VINCULO_INVALIDO', 400)
  }

  const scoped = await getScopedUnitId(session)
  if (scoped.error) return supabaseErrorResponse(scoped.error, 'Falha ao validar unidade')

  const { data, error } = await listarOpcoesVinculo(tipo as Exclude<(typeof VINCULO_TIPOS)[number], 'outro'>, scoped.unidadeId ?? null)
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar opções')
  return NextResponse.json({ data })
}
