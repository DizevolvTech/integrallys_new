import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'

/**
 * GET /api/retornos/pendentes — ids dos pacientes com retorno em aberto (tag "Retorno pendente").
 * Com `?detalhe=1`: um item por retorno em aberto (mais recente primeiro) com especialista e procedimento do retorno,
 * para o selo da lista abrir o Novo agendamento já preenchido.
 */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'retornos', 'read')
  if (denied) return denied

  const scoped = await getScopedUnitId(session)
  if (scoped.error) return supabaseErrorResponse(scoped.error, 'Falha ao carregar retornos pendentes')

  const detalhe = request.nextUrl.searchParams.get('detalhe') === '1'
  const colunas = detalhe
    ? ('paciente_id,prescricao_id,retorno_profissional_id,retorno_procedimento_id,created_at' as const)
    : ('paciente_id' as const)
  let query = getAppSupabase().from('retornos_em_aberto').select(colunas).order('created_at', { ascending: false }).limit(2000)
  if (scoped.unidadeId) query = query.eq('unidade_id', scoped.unidadeId)
  const { data, error } = await query
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar retornos pendentes')
  if (detalhe) {
    const linhas = (data ?? []) as unknown as Array<Record<string, string | null>>
    return NextResponse.json({
      data: linhas.map((r) => ({
        pacienteId: String(r.paciente_id),
        prescricaoId: r.prescricao_id ?? null,
        profissionalId: r.retorno_profissional_id ?? null,
        procedimentoId: r.retorno_procedimento_id ?? null,
      })),
    })
  }
  return NextResponse.json({ data: Array.from(new Set(((data ?? []) as unknown as Array<{ paciente_id: string }>).map((r) => String(r.paciente_id)))) })
}
