import { type NextRequest, NextResponse } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { ANEXO_BUCKET } from '@/lib/financeiro-anexos'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'

const UUID = /^[0-9a-f-]{36}$/i

/**
 * GET /api/financeiro/anexos/:id/arquivo — abre o anexo (nota, cupom, recibo) de um lançamento.
 * Bucket privado: o servidor confere permissão e unidade e entrega o arquivo, sem link público.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'financeiro', 'read')
  if (denied) return denied
  const { id } = await ctx.params
  if (!UUID.test(id)) return serverErrorResponse('Anexo inválido', 'INVALID_ID', 400)

  const supabase = getAppSupabase()
  const { data: anexo, error } = await supabase
    .from('financeiro_anexos')
    .select('id,nome,mime,storage_path,lancamento_id')
    .eq('id', id)
    .maybeSingle()
  if (error) return supabaseErrorResponse(error, 'Falha ao abrir anexo')
  if (!anexo) return serverErrorResponse('Anexo não encontrado', 'NOT_FOUND', 404)

  const scoped = await getScopedUnitId(session)
  if (scoped.error) return supabaseErrorResponse(scoped.error, 'Falha ao validar anexo')
  if (scoped.unidadeId) {
    const { data: lanc } = await supabase
      .from('financeiro_lancamentos')
      .select('id')
      .eq('id', String(anexo.lancamento_id))
      .eq('unidade_id', scoped.unidadeId)
      .maybeSingle()
    if (!lanc) return serverErrorResponse('Anexo não encontrado', 'NOT_FOUND', 404)
  }

  const { data: blob, error: dlError } = await supabase.storage.from(ANEXO_BUCKET).download(String(anexo.storage_path))
  if (dlError || !blob) return serverErrorResponse('Arquivo não encontrado', 'FILE_NOT_FOUND', 404)

  const nome = String(anexo.nome ?? 'anexo').replace(/[^\w.\- ]/g, '_')
  return new NextResponse(blob.stream(), {
    headers: {
      'Content-Type': String(anexo.mime || 'application/octet-stream'),
      'Content-Disposition': `inline; filename="${nome}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
