import { type NextRequest, NextResponse } from 'next/server'
import { getAppSupabase, serverErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, forbidPatientRole, getRequestAuth } from '@/lib/request-auth'
import { resolverUnidade, respostaResolucaoInvalida } from '../resolver-unidade'
import { urlArquivoPublico } from '@/lib/storage-urls'

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'])
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB

function extensionForMime(mime: string): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/svg+xml') return 'svg'
  if (mime === 'image/webp') return 'webp'
  return 'bin'
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'configuracoes', 'update')
  if (denied) return denied
  // Ver forbidPatientRole: `configuracoes` é compartilhado com o portal.
  const naoAdmin = forbidPatientRole(session)
  if (naoAdmin) return naoAdmin

  const form = await request.formData().catch(() => null)
  if (!form) return serverErrorResponse('Upload inválido', 'INVALID_UPLOAD', 400)

  const file = form.get('file')
  if (!(file instanceof File)) {
    return serverErrorResponse('Arquivo ausente', 'MISSING_FILE', 400)
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return serverErrorResponse('Formato inválido (use PNG, JPG, SVG ou WEBP)', 'INVALID_MIME', 400)
  }
  if (file.size > MAX_BYTES) {
    return serverErrorResponse('Arquivo acima de 2 MB', 'FILE_TOO_LARGE', 400)
  }

  const informada = form.get('unidadeId')
  const resolucao = await resolverUnidade(session, typeof informada === 'string' ? informada : null)
  if (!resolucao.ok) return respostaResolucaoInvalida(resolucao)
  const unidadeId = resolucao.unidadeId

  const supabase = getAppSupabase()
  const bytes = new Uint8Array(await file.arrayBuffer())
  const path = `${unidadeId}/logo-${Date.now()}.${extensionForMime(file.type)}`

  const upload = await supabase.storage.from('clinica-logos').upload(path, bytes, {
    contentType: file.type,
    upsert: true,
  })
  if (upload.error) {
    console.error('[clinica-config/logo] upload', upload.error)
    return serverErrorResponse('Falha ao enviar logo', 'UPLOAD_FAILED', 500)
  }

  const { data: publicData } = { data: { publicUrl: urlArquivoPublico('clinica-logos', path) } }
  const logoUrl = publicData.publicUrl

  const { data: existing } = await supabase
    .from('clinica_config')
    .select('id')
    .eq('unidade_id', unidadeId)
    .maybeSingle()

  if (existing) {
    const { error: updateError } = await supabase
      .from('clinica_config')
      .update({ logo_url: logoUrl })
      .eq('unidade_id', unidadeId)
    if (updateError) {
      console.error('[clinica-config/logo] update', updateError)
      return serverErrorResponse(
        'Logo enviado, mas falha ao atualizar registro',
        'UPDATE_FAILED',
        500,
      )
    }
  } else {
    // Primeira gravação — usa 'Clínica' como nome placeholder; o usuário
    // edita na aba de Identidade da Clínica logo em seguida.
    const { error: insertError } = await supabase
      .from('clinica_config')
      .insert({ unidade_id: unidadeId, nome: 'Clínica', logo_url: logoUrl })
    if (insertError) {
      console.error('[clinica-config/logo] insert', insertError)
      return serverErrorResponse('Logo enviado, mas falha ao criar registro', 'INSERT_FAILED', 500)
    }
  }

  return NextResponse.json({ data: { logo_url: logoUrl }, meta: session })
}
