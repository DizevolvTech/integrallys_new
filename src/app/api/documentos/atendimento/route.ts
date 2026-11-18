import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'
import {
  carregarContexto,
  normalizarConteudo,
  SLUG_MODELO_POR_DOCUMENTO,
  type ContextoVariaveis,
  type TemplateConteudo,
} from '@/lib/documentos'

export interface ModeloAtendimento {
  templateId: string | null
  clinica: TemplateConteudo | null
  pessoal: TemplateConteudo | null
}

export interface DocumentosAtendimentoPayload {
  modelos: Record<string, ModeloAtendimento>
  contexto: ContextoVariaveis & { clinica?: { logo_url?: string | null; cor_primaria?: string } }
}

/**
 * GET /api/documentos/atendimento?pacienteId=&agendamentoId=
 * Tudo que a etapa Documentos do atendimento precisa em 1 chamada: o modelo da clínica de cada
 * documento da lista (o MESMO que o gestor vê em Configurações), o modelo pessoal do especialista
 * (se houver) e os dados para preencher as variáveis (paciente, profissional, clínica).
 */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'documentacao', 'read')
  if (denied) return denied

  const scopedUnit = await getScopedUnitId(session)
  const unidadeId = scopedUnit.error ? null : scopedUnit.unidadeId
  if (!unidadeId) return serverErrorResponse('Usuário sem unidade vinculada', 'NO_UNIT', 400)

  const url = new URL(request.url)
  const pacienteId = url.searchParams.get('pacienteId')
  const agendamentoId = url.searchParams.get('agendamentoId')

  const supabase = getAppSupabase()
  const [templatesRes, pessoaisRes, contexto, identidadeRes] = await Promise.all([
    supabase
      .from('documento_templates')
      .select('id,slug,conteudo')
      .eq('unidade_id', unidadeId)
      .eq('ativo', true),
    supabase
      .from('documento_modelos_pessoais')
      .select('slug,conteudo')
      .eq('usuario_id', session.userId),
    carregarContexto({
      supabase,
      unidadeId,
      pacienteId,
      agendamentoId,
      profissionalId: session.role === 'especialista' ? session.userId : null,
    }),
    supabase.from('clinica_config').select('logo_url,cor_primaria').eq('unidade_id', unidadeId).maybeSingle(),
  ])
  if (templatesRes.error) return supabaseErrorResponse(templatesRes.error, 'Falha ao carregar modelos de documento')
  if (pessoaisRes.error) return supabaseErrorResponse(pessoaisRes.error, 'Falha ao carregar modelos pessoais')

  const porSlug = new Map((templatesRes.data ?? []).map((t) => [t.slug as string, t]))
  const pessoais = new Map((pessoaisRes.data ?? []).map((p) => [p.slug as string, p.conteudo]))

  const modelos: Record<string, ModeloAtendimento> = {}
  for (const [docId, slugs] of Object.entries(SLUG_MODELO_POR_DOCUMENTO)) {
    const row = slugs.map((s) => porSlug.get(s)).find((t) => t && normalizarConteudo(t.conteudo))
    modelos[docId] = {
      templateId: (row?.id as string | undefined) ?? null,
      clinica: row ? normalizarConteudo(row.conteudo) : null,
      pessoal: normalizarConteudo(pessoais.get(docId)),
    }
  }

  const payload: DocumentosAtendimentoPayload = {
    modelos,
    contexto: {
      ...contexto,
      clinica: {
        ...contexto.clinica,
        logo_url: identidadeRes.data?.logo_url ?? null,
        cor_primaria: identidadeRes.data?.cor_primaria ?? undefined,
      },
    },
  }
  return NextResponse.json({ data: payload })
}
