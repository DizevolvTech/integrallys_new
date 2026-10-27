import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse } from '@/lib/app-api'
import { authErrorResponse, getRequestAuth } from '@/lib/request-auth'
import { urlArquivoPublico } from '@/lib/storage-urls'

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp'])
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB

function extensionForMime(mime: string): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/webp') return 'webp'
  return 'bin'
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  // avatar é do próprio usuário — sem checagem de permissão de recurso

  const form = await request.formData().catch(() => null)
  if (!form) return serverErrorResponse('Upload inválido', 'INVALID_UPLOAD', 400)

  const file = form.get('file')
  if (!(file instanceof File)) return serverErrorResponse('Arquivo ausente', 'MISSING_FILE', 400)
  if (!ALLOWED_MIME.has(file.type)) return serverErrorResponse('Formato inválido (PNG, JPG ou WEBP)', 'INVALID_MIME', 400)
  if (file.size > MAX_BYTES) return serverErrorResponse('Arquivo acima de 2 MB', 'FILE_TOO_LARGE', 400)

  const supabase = getAppSupabase()
  const bytes = new Uint8Array(await file.arrayBuffer())
  const path = `${session.userId}/avatar-${Date.now()}.${extensionForMime(file.type)}`

  const upload = await supabase.storage.from('avatares').upload(path, bytes, {
    contentType: file.type,
    upsert: true,
  })
  if (upload.error) {
    console.error('[usuarios/avatar] upload', upload.error)
    return serverErrorResponse('Falha ao enviar a foto', 'UPLOAD_FAILED', 500)
  }

  const { data: publicData } = { data: { publicUrl: urlArquivoPublico('avatares', path) } }
  const avatarUrl = publicData.publicUrl

  const { error: updateError } = await supabase
    .from('usuarios')
    .update({ avatar_url: avatarUrl })
    .eq('id', session.userId)
  if (updateError) {
    console.error('[usuarios/avatar] update', updateError)
    return serverErrorResponse('Foto enviada, mas falha ao atualizar perfil', 'UPDATE_FAILED', 500)
  }

  return NextResponse.json({ data: { avatar_url: avatarUrl }, meta: session })
}
