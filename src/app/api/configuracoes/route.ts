import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { isMaskedValue, isSensitiveConfigKey, maskConfigValue } from '@/lib/config-secrets'
import { mapConfiguracaoItem } from '@/lib/domain-mappers'
import { authErrorResponse, forbidPatientRole, getRequestAuth } from '@/lib/request-auth'

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = await requirePermission(session.userId, 'configuracoes', 'read')
  if (denied) return denied
  const patientDenied = forbidPatientRole(session)
  if (patientDenied) return patientDenied

  const supabase = getAppSupabase()
  const { data, error } = await supabase
    .from('configuracoes')
    .select('id,chave,valor,categoria')
    .order('categoria', { ascending: true })
    .order('chave', { ascending: true })

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao carregar configurações')
  }

  return NextResponse.json({
    data: (data ?? []).map((row) => {
      const item = mapConfiguracaoItem(row)
      return { ...item, valor: maskConfigValue(item.chave, item.valor) }
    }),
    meta: session,
  })
}

export async function PUT(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()

  const denied = await requirePermission(session.userId, 'configuracoes', 'update')
  if (denied) return denied
  const patientDenied = forbidPatientRole(session)
  if (patientDenied) return patientDenied

  const body = (await request.json().catch(() => null)) as
    | { chave: string; valor: string; categoria: string }[]
    | null

  if (!Array.isArray(body)) {
    return NextResponse.json(
      { error: 'Payload inválido', code: 'INVALID_PAYLOAD' },
      { status: 400 },
    )
  }

  const supabase = getAppSupabase()

  // Não sobrescrever segredos quando o valor recebido é a máscara (•••).
  const upsertItems = body
    .filter((item) => !(isSensitiveConfigKey(item.chave) && isMaskedValue(item.valor)))
    .map((item) => ({
      chave: item.chave,
      valor: item.valor,
      categoria: item.categoria,
    }))

  if (upsertItems.length === 0) {
    const { data, error } = await supabase
      .from('configuracoes')
      .select('id,chave,valor,categoria')
      .order('categoria', { ascending: true })
      .order('chave', { ascending: true })
    if (error) return supabaseErrorResponse(error, 'Falha ao carregar configurações')
    return NextResponse.json({
      data: (data ?? []).map((row) => {
        const item = mapConfiguracaoItem(row)
        return { ...item, valor: maskConfigValue(item.chave, item.valor) }
      }),
      meta: session,
    })
  }

  const { data, error } = await supabase
    .from('configuracoes')
    .upsert(upsertItems, { onConflict: 'categoria,chave' })
    .select('id,chave,valor,categoria')

  if (error) return supabaseErrorResponse(error, 'Falha ao salvar configurações')

  return NextResponse.json({
    data: (data ?? []).map((row) => {
      const item = mapConfiguracaoItem(row)
      return { ...item, valor: maskConfigValue(item.chave, item.valor) }
    }),
    meta: session,
  })
}

export async function DELETE(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()

  const denied = await requirePermission(session.userId, 'configuracoes', 'update')
  if (denied) return denied
  const patientDenied = forbidPatientRole(session)
  if (patientDenied) return patientDenied

  const body = (await request.json().catch(() => null)) as { chave?: string } | null
  if (!body?.chave) {
    return NextResponse.json(
      { error: 'Payload inválido', code: 'INVALID_PAYLOAD' },
      { status: 400 },
    )
  }

  const supabase = getAppSupabase()
  const { error } = await supabase.from('configuracoes').delete().eq('chave', body.chave)
  if (error) return supabaseErrorResponse(error, 'Falha ao excluir configuração')

  const { data, error: listError } = await supabase
    .from('configuracoes')
    .select('id,chave,valor,categoria')
    .order('categoria', { ascending: true })
    .order('chave', { ascending: true })

  if (listError) return supabaseErrorResponse(listError, 'Falha ao carregar configurações')

  return NextResponse.json({
    data: (data ?? []).map((row) => {
      const item = mapConfiguracaoItem(row)
      return { ...item, valor: maskConfigValue(item.chave, item.valor) }
    }),
    meta: session,
  })
}
