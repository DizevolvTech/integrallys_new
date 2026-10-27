import { type NextRequest, NextResponse } from 'next/server'
import { getAppSupabase, serverErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { assertPacienteInUnitScope, authErrorResponse, getRequestAuth } from '@/lib/request-auth'
import { caminhoSeguro } from '@/lib/storage-urls'

const UUID = /^[0-9a-f-]{36}$/i

/**
 * GET /api/pacientes/foto/arquivo?caminho=<pacienteId>/foto-x.jpg — foto do paciente.
 * Bucket privado: o paciente vê a própria; a equipe vê pacientes da sua unidade.
 */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const caminho = caminhoSeguro(request.nextUrl.searchParams.get('caminho') ?? '')
  if (!caminho) return serverErrorResponse('Foto inválida', 'INVALID_PATH', 400)

  const supabase = getAppSupabase()
  const [pasta, sub] = caminho.split('/')
  if (pasta === '_pending') {
    if (sub !== session.userId) return serverErrorResponse('Acesso negado', 'FORBIDDEN', 403)
  } else if (!UUID.test(pasta ?? '')) {
    return serverErrorResponse('Foto inválida', 'INVALID_PATH', 400)
  } else if (session.role === 'paciente') {
    const { data: pac } = await supabase.from('pacientes').select('id').eq('usuario_id', session.userId).maybeSingle()
    if (!pac || String(pac.id) !== pasta) return serverErrorResponse('Acesso negado', 'FORBIDDEN', 403)
  } else {
    const denied = await requirePermission(session.userId, 'pacientes', 'read')
    if (denied) return denied
    const fora = await assertPacienteInUnitScope({ session, pacienteId: String(pasta) })
    if (fora) return fora
  }

  const { data: blob, error } = await supabase.storage.from('pacientes-fotos').download(caminho)
  if (error || !blob) return serverErrorResponse('Foto não encontrada', 'FILE_NOT_FOUND', 404)
  return new NextResponse(blob.stream(), {
    headers: {
      'Content-Type': blob.type || 'image/jpeg',
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
