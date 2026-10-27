import { getAppSupabase, serverErrorResponse } from '@/lib/app-api'
import { memoizeShort } from '@/lib/short-cache'

const PERMISSAO_CACHE_MS = 10_000

export function can(userId: string, resource: string, action: string): Promise<boolean> {
  // Cache curto + dedupe: chamadas paralelas da mesma tela reutilizam a mesma consulta; só "permitido" fica guardado.
  return memoizeShort(
    `can:${userId}:${resource}:${action}`,
    PERMISSAO_CACHE_MS,
    () => consultarPermissao(userId, resource, action),
    (permitido) => permitido,
  )
}

async function consultarPermissao(
  userId: string,
  resource: string,
  action: string,
): Promise<boolean> {
  const supabase = getAppSupabase()
  const { data, error } = await supabase.rpc('can_user', {
    p_usuario_id: userId,
    p_resource: resource,
    p_action: action,
  })

  if (error) {
    console.error('[authz] can_user error', { userId, resource, action, error })
    return false
  }

  return data === true
}

export async function requirePermission(
  userId: string,
  resource: string,
  action: string,
): Promise<Response | null> {
  const allowed = await can(userId, resource, action)
  if (!allowed) {
    return serverErrorResponse('Acesso negado', 'FORBIDDEN', 403)
  }
  return null
}
