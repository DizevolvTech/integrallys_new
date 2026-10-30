import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { can, requirePermission } from '@/lib/authz'
import { validarDescontos } from '@/lib/desconto-forma'
import { gravarDescontosPorForma, lerDescontosPorForma } from '@/lib/desconto-forma-server'
import { authErrorResponse, getRequestAuth } from '@/lib/request-auth'

// Cadastro do gestor (Cadastros > Descontos por forma). Quem vende só lê; só quem edita cadastros grava.
async function responder(session: unknown) {
  const { descontos, error } = await lerDescontosPorForma(getAppSupabase())
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar descontos por forma')
  return NextResponse.json({ data: descontos, meta: session })
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const leituras = await Promise.all(['cadastros', 'prescricoes'].map((recurso) => can(session.userId, recurso, 'read')))
  if (!leituras.some(Boolean)) return serverErrorResponse('Acesso negado', 'FORBIDDEN', 403)
  return responder(session)
}

export async function PUT(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'cadastros', 'update')
  if (denied) return denied

  const body = await request.json().catch(() => null)
  const descontos = validarDescontos(body)
  if (!descontos) {
    return serverErrorResponse('Informe um percentual de 0 a 100 para cada forma.', 'INVALID_DESCONTOS', 400)
  }
  const { error } = await gravarDescontosPorForma(getAppSupabase(), descontos)
  if (error) return supabaseErrorResponse(error, 'Falha ao salvar descontos por forma')
  return responder(session)
}
