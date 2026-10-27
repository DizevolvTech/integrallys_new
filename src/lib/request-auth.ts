import type { PostgrestError } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { getAuthUser } from '@/lib/auth'
import { buildAuthPayloadFromUserId } from '@/lib/auth-payload'
import { memoizeShort } from '@/lib/short-cache'
import type { AuthUser } from '@/types/auth'

export interface RequestAuth {
  userId: string
  role: AuthUser['role']
  user: AuthUser
}

const AUTH_CACHE_MS = 10_000

/**
 * Sempre valida o JWT — nunca confia em headers que o cliente pode forjar.
 * O middleware injeta x-user-id/x-user-role por conveniência, mas esses
 * headers não são fonte de verdade para autenticação nas API routes.
 */
export async function getRequestAuth(request: NextRequest): Promise<RequestAuth | null> {
  const jwtUser = await getAuthUser(request)
  if (!jwtUser) {
    return null
  }

  // Cache curto (10 s) com dedupe: a abertura de uma tela dispara ~12 chamadas paralelas do mesmo usuário.
  const payload = await memoizeShort(
    `auth:${jwtUser.id}`,
    AUTH_CACHE_MS,
    () => buildAuthPayloadFromUserId(jwtUser.id),
    (valor) => valor !== null,
  )
  const user = payload?.user
  if (!user) {
    return null
  }

  return {
    userId: user.id,
    role: user.role,
    user,
  }
}

export function authErrorResponse() {
  return NextResponse.json({ error: 'Não autenticado', code: 'AUTH_REQUIRED' }, { status: 401 })
}

export function forbiddenResponse() {
  return NextResponse.json({ error: 'Acesso negado', code: 'FORBIDDEN' }, { status: 403 })
}

/**
 * Garante que a sessão é de um paciente — retorna 403 caso contrário.
 * Usado para endpoints `/api/portal/*` que só fazem sentido para o portal
 * do paciente. Evita que perfis administrativos consigam ler/manipular
 * dados via essas rotas, mesmo que `getPacienteIdByUserId` retorne null.
 */
export function requirePatientRole(session: RequestAuth) {
  if (session.role !== 'paciente') {
    return forbiddenResponse()
  }
  return null
}

/**
 * Inverso de `requirePatientRole`: barra paciente em rota administrativa.
 *
 * Necessário porque o recurso `configuracoes` é usado por dois domínios
 * diferentes: as preferências do próprio paciente no portal
 * (`/api/portal/alert`, que exige `configuracoes:update`) e a configuração
 * global da clínica. Por isso o perfil `paciente` tem `configuracoes:update`
 * em 004_permission_defaults — grant legítimo para o portal, mas que sozinho
 * não pode liberar a identidade da clínica.
 */
export function forbidPatientRole(session: RequestAuth) {
  if (session.role === 'paciente') {
    return forbiddenResponse()
  }
  return null
}

/**
 * Garante que o paciente pertence à unidade da sessão (perfis escopados).
 * master/admin passam sem filtro. Retorna Response de erro ou null se ok.
 */
export async function assertPacienteInUnitScope(params: {
  session: RequestAuth
  pacienteId: string
  notFoundMessage?: string
}): Promise<Response | null> {
  const scoped = await getScopedUnitId(params.session)
  if (scoped.error) {
    return supabaseErrorResponse(scoped.error, 'Falha ao validar unidade')
  }
  if (!scoped.unidadeId) return null

  const supabase = getAppSupabase()
  const { data, error } = await supabase
    .from('pacientes')
    .select('unidade_id')
    .eq('id', params.pacienteId)
    .maybeSingle()

  if (error) return supabaseErrorResponse(error, 'Falha ao validar paciente')
  if (!data) {
    return serverErrorResponse(
      params.notFoundMessage ?? 'Paciente não encontrado',
      'PACIENTE_NOT_FOUND',
      404,
    )
  }
  if (data.unidade_id && String(data.unidade_id) !== scoped.unidadeId) {
    return serverErrorResponse(
      'Paciente fora do escopo da unidade',
      'PACIENTE_UNIT_FORBIDDEN',
      403,
    )
  }
  return null
}

export type ScopedUnitResult =
  | { unidadeId: string | null; error: null }
  | { unidadeId: null; error: PostgrestError }

const SCOPED_ROLES = ['gestor', 'recepcao', 'especialista'] as const

/**
 * Papel escopado por unidade. Distingue "sem escopo" (master/admin — unidadeId
 * null de propósito) de "escopado, mas sem unidade no cadastro" (gestor com
 * unidade_id nulo). `getScopedUnitId` devolve null nos dois casos, e quem
 * precisa decidir permissão a partir disso não pode confundir os dois.
 */
export function isScopedRole(role: AuthUser['role']): boolean {
  return SCOPED_ROLES.includes(role as (typeof SCOPED_ROLES)[number])
}

/**
 * Helper centralizado para escopar queries por unidade do usuário.
 *
 * - master/admin/paciente: sempre `{ unidadeId: null }` — sem escopo.
 * - gestor/recepcao/especialista: caminho rápido lê `session.user.unidadeId`
 *   embarcado no JWT (CR-AUTH-01). Para tokens antigos (`unidadeId === undefined`)
 *   ou sessões sem unidadeId persistido, faz fallback à query em `usuarios`.
 *
 * Substitui os antigos helpers `getScopedUnitId` locais por convenção do
 * projeto — ver comentário em `src/app/api/estoque/route.ts` para o
 * histórico da decisão (Agente 20, 2026-05-21).
 */
export async function getScopedUnitId(
  session: Awaited<ReturnType<typeof getRequestAuth>>,
): Promise<ScopedUnitResult> {
  if (!session || !SCOPED_ROLES.includes(session.role as (typeof SCOPED_ROLES)[number])) {
    return { unidadeId: null, error: null }
  }

  // Caminho rápido: JWT carrega unidadeId (CR-AUTH-01)
  if (session.user?.unidadeId) {
    return { unidadeId: String(session.user.unidadeId), error: null }
  }

  // Fallback para tokens antigos ou casos onde unidadeId é undefined/null no JWT
  const supabase = getAppSupabase()
  const { data, error } = await supabase
    .from('usuarios')
    .select('unidade_id')
    .eq('id', session.userId)
    .maybeSingle()

  if (error) return { unidadeId: null, error }
  return {
    unidadeId: data?.unidade_id ? String(data.unidade_id) : null,
    error: null,
  }
}
