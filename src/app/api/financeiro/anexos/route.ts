import { type NextRequest, NextResponse } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { ANEXO_BUCKET, ANEXO_TIPOS, caminhoAnexo, validarAnexo } from '@/lib/financeiro-anexos'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'

const UUID = /^[0-9a-f-]{36}$/i

type Supabase = ReturnType<typeof getAppSupabase>

/** Confere que o lançamento existe e pertence à unidade do usuário. */
async function lancamentoPermitido(supabase: Supabase, session: Parameters<typeof getScopedUnitId>[0], id: string) {
  const scoped = await getScopedUnitId(session)
  if (scoped.error) return { erro: supabaseErrorResponse(scoped.error, 'Falha ao validar lançamento') }
  let query = supabase.from('financeiro_lancamentos').select('id').eq('id', id)
  if (scoped.unidadeId) query = query.eq('unidade_id', scoped.unidadeId)
  const { data, error } = await query.maybeSingle()
  if (error) return { erro: supabaseErrorResponse(error, 'Falha ao validar lançamento') }
  if (!data) return { erro: serverErrorResponse('Lançamento não encontrado', 'NOT_FOUND', 404) }
  return { erro: null }
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'financeiro', 'read')
  if (denied) return denied

  const lancamentoId = request.nextUrl.searchParams.get('lancamentoId') ?? ''
  if (!UUID.test(lancamentoId)) return serverErrorResponse('Lançamento inválido', 'INVALID_LANCAMENTO', 400)

  const supabase = getAppSupabase()
  const permitido = await lancamentoPermitido(supabase, session, lancamentoId)
  if (permitido.erro) return permitido.erro

  const { data, error } = await supabase
    .from('financeiro_anexos')
    .select('id,nome,tipo_documento,mime,tamanho,storage_path,created_at')
    .eq('lancamento_id', lancamentoId)
    .order('created_at', { ascending: false })
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar anexos')

  // O arquivo abre pela rota do próprio app (bucket privado; nenhum link do storage sai para o navegador).
  const anexos = (data ?? []).map((row) => ({
    id: String(row.id),
    nome: String(row.nome),
    tipoDocumento: row.tipo_documento ? String(row.tipo_documento) : null,
    mime: String(row.mime),
    tamanho: Number(row.tamanho ?? 0),
    criadoEm: String(row.created_at),
    url: `/api/financeiro/anexos/${row.id}/arquivo`,
  }))
  return NextResponse.json({ data: anexos })
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'financeiro', 'update')
  if (denied) return denied

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  const lancamentoId = String(form?.get('lancamentoId') ?? '')
  const tipoInformado = String(form?.get('tipoDocumento') ?? '')
  if (!(file instanceof File)) return serverErrorResponse('Selecione um arquivo', 'MISSING_FILE', 400)
  if (!UUID.test(lancamentoId)) return serverErrorResponse('Lançamento inválido', 'INVALID_LANCAMENTO', 400)
  const validacao = validarAnexo(file)
  if (!validacao.ok) return serverErrorResponse(validacao.error, validacao.code, 400)

  const supabase = getAppSupabase()
  const permitido = await lancamentoPermitido(supabase, session, lancamentoId)
  if (permitido.erro) return permitido.erro

  const caminho = caminhoAnexo(lancamentoId, file.name)
  const upload = await supabase.storage
    .from(ANEXO_BUCKET)
    .upload(caminho, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: false })
  if (upload.error) return serverErrorResponse('Falha ao enviar o arquivo', 'UPLOAD_FAILED', 500)

  const tipoDocumento = (ANEXO_TIPOS as readonly string[]).includes(tipoInformado) ? tipoInformado : 'Outro'
  const { data, error } = await supabase
    .from('financeiro_anexos')
    .insert({
      lancamento_id: lancamentoId,
      nome: file.name.slice(0, 160),
      tipo_documento: tipoDocumento,
      mime: file.type,
      tamanho: file.size,
      storage_path: caminho,
      enviado_por: session.userId,
    })
    .select('id')
    .single()
  if (error) {
    await supabase.storage.from(ANEXO_BUCKET).remove([caminho])
    return supabaseErrorResponse(error, 'Falha ao registrar anexo')
  }
  return NextResponse.json({ data: { id: String(data.id) } }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'financeiro', 'update')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as { id?: string } | null
  if (!body?.id || !UUID.test(body.id)) return serverErrorResponse('Anexo inválido', 'INVALID_ANEXO', 400)

  const supabase = getAppSupabase()
  const { data: anexo, error } = await supabase
    .from('financeiro_anexos')
    .select('id,lancamento_id,storage_path')
    .eq('id', body.id)
    .maybeSingle()
  if (error) return supabaseErrorResponse(error, 'Falha ao localizar anexo')
  if (!anexo) return serverErrorResponse('Anexo não encontrado', 'NOT_FOUND', 404)

  const permitido = await lancamentoPermitido(supabase, session, String(anexo.lancamento_id))
  if (permitido.erro) return permitido.erro

  const { error: deleteError } = await supabase.from('financeiro_anexos').delete().eq('id', body.id)
  if (deleteError) return supabaseErrorResponse(deleteError, 'Falha ao remover anexo')
  await supabase.storage.from(ANEXO_BUCKET).remove([String(anexo.storage_path)])
  return NextResponse.json({ data: { id: body.id } })
}
