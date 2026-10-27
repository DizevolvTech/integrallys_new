import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { can, requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth } from '@/lib/request-auth'
import { TIPO_BLOQUEIO_REGEX, adicionarTipoBloqueio, parseTiposBloqueio } from './tipos-bloqueio'

const CHAVE = 'agenda.tipos_bloqueio'
const CATEGORIA = 'agenda'

async function lerTipos() {
  const { data, error } = await getAppSupabase()
    .from('configuracoes')
    .select('valor')
    .eq('categoria', CATEGORIA)
    .eq('chave', CHAVE)
    .maybeSingle()
  return { error, tipos: parseTiposBloqueio(data?.valor as string | null | undefined) }
}

/** GET /api/agenda/bloqueios/tipos — tipos de bloqueio disponíveis (quem lê a agenda). */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'agenda', 'read')
  if (denied) return denied

  const { error, tipos } = await lerTipos()
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar tipos de bloqueio')
  return NextResponse.json({ data: tipos })
}

/** POST /api/agenda/bloqueios/tipos { nome } — inclui um tipo (recepção e especialista; sem acesso geral a configurações). */
export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  // Recepção (agenda: criar) e especialista (agenda: editar) incluem tipos; configurações gerais seguem fechadas.
  const permitido =
    (await can(session.userId, 'agenda', 'create')) || (await can(session.userId, 'agenda', 'update'))
  if (!permitido) return serverErrorResponse('Acesso negado', 'FORBIDDEN', 403)

  const body = (await request.json().catch(() => null)) as { nome?: unknown } | null
  const nome = typeof body?.nome === 'string' ? body.nome.trim() : ''
  if (!nome || !TIPO_BLOQUEIO_REGEX.test(nome)) {
    return serverErrorResponse('Nome de tipo de bloqueio inválido', 'INVALID_TIPO', 400)
  }

  const { error, tipos } = await lerTipos()
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar tipos de bloqueio')
  const resultado = adicionarTipoBloqueio(tipos, nome)
  if (!resultado.criado) return serverErrorResponse('Este tipo já existe.', 'TIPO_DUPLICADO', 409)

  const { error: saveError } = await getAppSupabase()
    .from('configuracoes')
    .upsert([{ chave: CHAVE, categoria: CATEGORIA, valor: JSON.stringify(resultado.tipos) }], {
      onConflict: 'categoria,chave',
    })
  if (saveError) return supabaseErrorResponse(saveError, 'Falha ao salvar tipo de bloqueio')
  return NextResponse.json({ data: resultado.tipos, criado: nome }, { status: 201 })
}
