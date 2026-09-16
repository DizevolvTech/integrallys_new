import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth } from '@/lib/request-auth'

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp'])
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB

function extensionForMime(mime: string): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/webp') return 'webp'
  return 'bin'
}

/**
 * Upload de foto do paciente.
 * - Sem pacienteId: grava em `_pending/{userId}/…` e devolve URL pública (pré-cadastro).
 * - Com pacienteId: grava em `{pacienteId}/…` e atualiza `pacientes.photo_url`.
 */
export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()

  const deniedCreate = await requirePermission(session.userId, 'pacientes', 'create')
  const deniedUpdate = await requirePermission(session.userId, 'pacientes', 'update')
  // Precisa de create (pré-cadastro) ou update (foto em paciente existente).
  if (deniedCreate && deniedUpdate) {
    return deniedCreate
  }

  const form = await request.formData().catch(() => null)
  if (!form) return serverErrorResponse('Upload inválido', 'INVALID_UPLOAD', 400)

  const file = form.get('file')
  if (!(file instanceof File)) return serverErrorResponse('Arquivo ausente', 'MISSING_FILE', 400)
  if (!ALLOWED_MIME.has(file.type)) {
    return serverErrorResponse('Formato inválido (PNG, JPG ou WEBP)', 'INVALID_MIME', 400)
  }
  if (file.size > MAX_BYTES) {
    return serverErrorResponse('Arquivo acima de 2 MB', 'FILE_TOO_LARGE', 400)
  }

  const pacienteIdRaw = form.get('pacienteId')
  const pacienteId =
    typeof pacienteIdRaw === 'string' && pacienteIdRaw.trim() ? pacienteIdRaw.trim() : null

  if (pacienteId && deniedUpdate) return deniedUpdate
  if (!pacienteId && deniedCreate) return deniedCreate

  const supabase = getAppSupabase()
  const bytes = new Uint8Array(await file.arrayBuffer())
  const folder = pacienteId ?? `_pending/${session.userId}`
  const path = `${folder}/foto-${Date.now()}.${extensionForMime(file.type)}`

  const upload = await supabase.storage.from('pacientes-fotos').upload(path, bytes, {
    contentType: file.type,
    upsert: true,
  })
  if (upload.error) {
    console.error('[pacientes/foto] upload', upload.error)
    return serverErrorResponse('Falha ao enviar a foto', 'UPLOAD_FAILED', 500)
  }

  const { data: publicData } = supabase.storage.from('pacientes-fotos').getPublicUrl(path)
  const photoUrl = publicData.publicUrl

  if (pacienteId) {
    const { error: updateError } = await supabase
      .from('pacientes')
      .update({ photo_url: photoUrl, updated_at: new Date().toISOString() })
      .eq('id', pacienteId)
    if (updateError) {
      return supabaseErrorResponse(updateError, 'Foto enviada, mas falha ao atualizar paciente')
    }
  }

  return NextResponse.json({ data: { photoUrl }, meta: session })
}
