import { type NextRequest, NextResponse } from 'next/server'
import { getAppSupabase, serverErrorResponse } from '@/lib/app-api'
import { BUCKETS_PUBLICOS, caminhoSeguro } from '@/lib/storage-urls'

/** GET /api/arquivos-publicos/<bucket>/<caminho> — arquivos de buckets públicos (avatares, logos). */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ bucket: string; caminho: string[] }> }) {
  const { bucket, caminho: partes } = await ctx.params
  if (!(BUCKETS_PUBLICOS as readonly string[]).includes(bucket)) {
    return serverErrorResponse('Arquivo não encontrado', 'NOT_FOUND', 404)
  }
  const caminho = caminhoSeguro((partes ?? []).map(decodeURIComponent).join('/'))
  if (!caminho) return serverErrorResponse('Arquivo inválido', 'INVALID_PATH', 400)
  const { data: blob, error } = await getAppSupabase().storage.from(bucket).download(caminho)
  if (error || !blob) return serverErrorResponse('Arquivo não encontrado', 'FILE_NOT_FOUND', 404)
  return new NextResponse(blob.stream(), {
    headers: {
      'Content-Type': blob.type || 'application/octet-stream',
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
