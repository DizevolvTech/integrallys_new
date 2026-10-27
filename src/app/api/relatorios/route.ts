import { NextResponse, type NextRequest } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { abasDoPerfil } from '@/lib/relatorios/registry'
import { authErrorResponse, getRequestAuth } from '@/lib/request-auth'

/** Abas de Relatórios do perfil logado; os dados de cada aba vêm de /api/relatorios/<tipo>. */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'relatorios', 'read')
  if (denied) return denied

  return NextResponse.json({
    data: [],
    meta: { ...session, tabs: abasDoPerfil(session.role) },
  })
}
