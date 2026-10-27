import { type NextRequest, NextResponse } from 'next/server'
import { getAppSupabase, serverErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { caminhoDoExame, EXAMES_BUCKET, mimeDoExame } from '@/lib/exames-storage'
import { assertPacienteInUnitScope, authErrorResponse, getRequestAuth } from '@/lib/request-auth'

const UUID = /^[0-9a-f-]{36}$/i

/**
 * GET /api/pacientes/exames/:id/arquivo — abre o exame/documento do paciente.
 * O bucket é privado: o servidor confere quem pede (o próprio paciente, ou equipe com acesso ao
 * paciente na unidade dela) e entrega o arquivo; nenhum link público ou duradouro é criado.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const { id } = await ctx.params
  if (!UUID.test(id)) return serverErrorResponse('Documento inválido', 'INVALID_ID', 400)

  const supabase = getAppSupabase()
  const { data: exame } = await supabase.from('paciente_exames').select('id,paciente_id,nome,url').eq('id', id).maybeSingle()
  if (!exame) return serverErrorResponse('Documento não encontrado', 'NOT_FOUND', 404)
  const pacienteId = String(exame.paciente_id)

  if (session.role === 'paciente') {
    const { data: pac } = await supabase.from('pacientes').select('id').eq('usuario_id', session.userId).maybeSingle()
    if (!pac || String(pac.id) !== pacienteId) return serverErrorResponse('Acesso negado', 'FORBIDDEN', 403)
  } else {
    const denied = await requirePermission(session.userId, 'pacientes', 'read')
    if (denied) return denied
    const fora = await assertPacienteInUnitScope({ session, pacienteId })
    if (fora) return fora
  }

  const caminho = caminhoDoExame(String(exame.url ?? ''))
  if (!caminho) return serverErrorResponse('Documento sem arquivo guardado', 'NO_FILE', 404)
  const { data: blob, error } = await supabase.storage.from(EXAMES_BUCKET).download(caminho)
  if (error || !blob) return serverErrorResponse('Arquivo não encontrado', 'FILE_NOT_FOUND', 404)

  const nome = String(exame.nome ?? 'documento').replace(/[^\w.\- ]/g, '_')
  return new NextResponse(blob.stream(), {
    headers: {
      'Content-Type': mimeDoExame(caminho),
      'Content-Disposition': `inline; filename="${nome}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
