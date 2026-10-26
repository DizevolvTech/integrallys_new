import { NextResponse } from 'next/server'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { getServiceSupabase } from '@/lib/auth-payload'

export function serverErrorResponse(message = 'Erro interno do servidor', code = 'INTERNAL_ERROR', status = 500) {
  return NextResponse.json({ error: message, code }, { status })
}

export function supabaseErrorResponse(error: PostgrestError, fallbackMessage = 'Falha ao consultar dados') {
  console.error('[supabase]', error)
  return serverErrorResponse(fallbackMessage, 'SUPABASE_QUERY_FAILED', 500)
}

export function getAppSupabase(): SupabaseClient {
  return getServiceSupabase()
}

export async function getPacienteIdByUserId(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('pacientes')
    .select('id')
    .eq('usuario_id', userId)
    .maybeSingle()

  if (error) {
    return { pacienteId: null, error }
  }

  return { pacienteId: data?.id ?? null, error: null }
}

export async function getEntityNameMap(
  supabase: SupabaseClient,
  table: 'pacientes' | 'usuarios' | 'unidades' | 'procedimentos',
  ids: string[],
) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  if (uniqueIds.length === 0) {
    return { map: {} as Record<string, string>, error: null as PostgrestError | null }
  }

  // Em lotes: listas longas de ids na URL estouram o limite do servidor e a chamada falha.
  const LOTE = 150
  const lotes: string[][] = []
  for (let i = 0; i < uniqueIds.length; i += LOTE) lotes.push(uniqueIds.slice(i, i + LOTE))
  const resultados = await Promise.all(lotes.map((lote) => supabase.from(table).select('id,nome').in('id', lote)))
  const error = resultados.find((r) => r.error)?.error ?? null
  if (error) {
    return { map: {} as Record<string, string>, error }
  }
  const data = resultados.flatMap((r) => r.data ?? [])

  const map = data.reduce<Record<string, string>>((acc, row) => {
    acc[String(row.id)] = String(row.nome ?? '')
    return acc
  }, {})

  return { map, error: null }
}
