import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { montarPacienteResumo } from '@/lib/paciente-resumo'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'
import { hojeIsoSaoPaulo } from '@/lib/retornos-server'

/**
 * GET /api/pacientes/resumo?id=<paciente_id>
 * Dados de cadastro (nascimento, idade, CPF, endereço, telefone, e-mail, foto) para o topo do
 * atendimento e do prontuário — um único paciente, sem carregar a lista inteira.
 */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'prontuarios', 'read')
  if (denied) return denied

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return serverErrorResponse('Paciente não informado', 'INVALID_PATIENT', 400)

  const scoped = await getScopedUnitId(session)
  if (scoped.error) return supabaseErrorResponse(scoped.error, 'Falha ao carregar paciente')

  const { data, error } = await getAppSupabase()
    .from('pacientes')
    .select(
      'id,nome,email,telefone,data_nascimento,cpf,photo_url,cep,logradouro,numero,complemento,bairro,cidade,estado,unidade_id',
    )
    .eq('id', id)
    .maybeSingle()
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar paciente')
  if (!data) return serverErrorResponse('Paciente não encontrado', 'PACIENTE_NOT_FOUND', 404)
  if (scoped.unidadeId && data.unidade_id && String(data.unidade_id) !== scoped.unidadeId) {
    return serverErrorResponse('Paciente fora do escopo da unidade', 'PACIENTE_UNIT_FORBIDDEN', 403)
  }

  return NextResponse.json({ data: montarPacienteResumo(data, hojeIsoSaoPaulo()) })
}
