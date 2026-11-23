import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { can } from '@/lib/authz'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'
import { carregarContexto, conteudoDoEmitido, resolverConteudo, valoresDoEmitido } from '@/lib/documentos'

/**
 * GET /api/documentos/emitidos/[id]
 * Um documento emitido pronto para baixar em PDF ou imprimir: conteúdo, valores preenchidos, dados de
 * cabeçalho/rodapé (clínica, profissional, paciente) e assinatura. Lê quem tem Documentação ou quem
 * tem acesso a Pacientes (recepção): é só o documento emitido, nunca anamnese ou prontuário.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const [podeDocs, podePacientes] = await Promise.all([
    can(session.userId, 'documentacao', 'read'),
    can(session.userId, 'pacientes', 'read'),
  ])
  if (!podeDocs && !podePacientes) return serverErrorResponse('Acesso negado', 'FORBIDDEN', 403)

  const scopedUnit = await getScopedUnitId(session)
  const unidadeId = scopedUnit.error ? null : scopedUnit.unidadeId
  if (!unidadeId) return serverErrorResponse('Usuário sem unidade vinculada', 'NO_UNIT', 400)

  const { id } = await params
  const supabase = getAppSupabase()
  const { data: doc, error } = await supabase
    .from('documentos_gerados')
    .select('id,template_id,paciente_id,profissional_id,agendamento_id,conteudo_preenchido,gerado_em,assinatura_base64')
    .eq('id', id)
    .maybeSingle()
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar o documento')
  if (!doc) return serverErrorResponse('Documento não encontrado', 'NOT_FOUND', 404)

  const [templateRes, contexto, identidadeRes] = await Promise.all([
    supabase.from('documento_templates').select('unidade_id,nome').eq('id', doc.template_id).maybeSingle(),
    carregarContexto({
      supabase,
      unidadeId,
      pacienteId: doc.paciente_id,
      agendamentoId: doc.agendamento_id,
      profissionalId: doc.profissional_id,
    }),
    supabase.from('clinica_config').select('logo_url,cor_primaria').eq('unidade_id', unidadeId).maybeSingle(),
  ])
  if (!templateRes.data || String(templateRes.data.unidade_id) !== unidadeId) {
    return serverErrorResponse('Documento não encontrado', 'NOT_FOUND', 404)
  }

  const conteudoBruto = conteudoDoEmitido(doc.conteudo_preenchido)
  if (!conteudoBruto) return serverErrorResponse('Documento sem conteúdo', 'EMPTY_DOCUMENT', 422)
  // Variáveis (#DATA_ATUAL# etc.) resolvidas na data da emissão, não na de hoje.
  const conteudo = resolverConteudo(conteudoBruto, { ...contexto, agora: new Date(doc.gerado_em) })
  const assinatura = typeof doc.assinatura_base64 === 'string' && doc.assinatura_base64 ? doc.assinatura_base64 : null

  return NextResponse.json({
    data: {
      id: doc.id,
      titulo: conteudo.cabecalho.titulo || String(templateRes.data.nome ?? 'Documento'),
      pacienteNome: contexto.cliente?.nome ?? '',
      geradoEm: doc.gerado_em,
      conteudo,
      valores: valoresDoEmitido(doc.conteudo_preenchido),
      contexto: {
        cliente: contexto.cliente,
        agendamento: contexto.agendamento,
        profissional: contexto.profissional,
        clinica: {
          ...contexto.clinica,
          logo_url: identidadeRes.data?.logo_url ?? null,
          cor_primaria: identidadeRes.data?.cor_primaria ?? undefined,
        },
      },
      assinaturaUrl: assinatura ? (assinatura.startsWith('data:') ? assinatura : `data:image/png;base64,${assinatura}`) : null,
    },
  })
}
