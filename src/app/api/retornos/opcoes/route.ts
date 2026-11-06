import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, supabaseErrorResponse } from '@/lib/app-api'
import { can } from '@/lib/authz'
import { authErrorResponse, getRequestAuth } from '@/lib/request-auth'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * GET /api/retornos/opcoes?agendamentoId=&pacienteId=
 * Especialistas e procedimentos ATIVOS para escolher "de que e com quem" é o retorno, mais o padrão
 * (especialista/procedimento do atendimento de origem). Usado pelo modal de prazo e pelos filtros.
 */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const [leitura, criacao] = await Promise.all([
    can(session.userId, 'retornos', 'read'),
    can(session.userId, 'retornos', 'create'),
  ])
  if (!leitura && !criacao) {
    return NextResponse.json({ error: 'Acesso negado', code: 'FORBIDDEN' }, { status: 403 })
  }

  const params = request.nextUrl.searchParams
  const agendamentoId = params.get('agendamentoId') ?? ''
  const pacienteId = params.get('pacienteId') ?? ''
  const supabase = getAppSupabase()

  const origem = async () => {
    if (UUID.test(agendamentoId)) {
      return supabase
        .from('agendamentos')
        .select('profissional_id,procedimento_id')
        .eq('id', agendamentoId)
        .maybeSingle()
    }
    if (UUID.test(pacienteId)) {
      // Sem agendamento informado (fluxo do prontuário): o atendimento mais recente do paciente.
      return supabase
        .from('agendamentos')
        .select('profissional_id,procedimento_id')
        .eq('paciente_id', pacienteId)
        .neq('status', 'Cancelado')
        .order('data_agendamento', { ascending: false })
        .limit(1)
        .maybeSingle()
    }
    return { data: null, error: null }
  }

  const [profissionais, procedimentos, base] = await Promise.all([
    supabase
      .from('usuarios')
      .select('id,nome')
      .eq('perfil', 'especialista')
      .eq('status', 'Ativo')
      .order('nome', { ascending: true }),
    supabase.from('procedimentos').select('id,nome').eq('ativo', true).order('nome', { ascending: true }),
    origem(),
  ])
  const erro = profissionais.error ?? procedimentos.error ?? base.error
  if (erro) return supabaseErrorResponse(erro, 'Falha ao carregar as opções do retorno')

  const ids = {
    profissionais: new Set((profissionais.data ?? []).map((r) => String(r.id))),
    procedimentos: new Set((procedimentos.data ?? []).map((r) => String(r.id))),
  }
  // Padrão só vale se ainda estiver ativo; especialista logado é o padrão quando a origem não diz.
  const origemProf = base.data?.profissional_id ? String(base.data.profissional_id) : null
  const origemProc = base.data?.procedimento_id ? String(base.data.procedimento_id) : null
  const logado = session.role === 'especialista' ? session.userId : null
  const profPadrao = [origemProf, logado].find((id) => id && ids.profissionais.has(id)) ?? null

  return NextResponse.json({
    data: {
      profissionais: (profissionais.data ?? []).map((r) => ({ id: String(r.id), nome: String(r.nome ?? '') })),
      procedimentos: (procedimentos.data ?? []).map((r) => ({ id: String(r.id), nome: String(r.nome ?? '') })),
      padrao: {
        especialistaId: profPadrao,
        procedimentoId: origemProc && ids.procedimentos.has(origemProc) ? origemProc : null,
      },
    },
  })
}
