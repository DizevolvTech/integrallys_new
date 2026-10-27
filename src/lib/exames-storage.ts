import type { SupabaseClient } from '@supabase/supabase-js'

export const EXAMES_BUCKET = 'exames-pacientes'
/** Link de abertura curto: gerado a cada listagem, nunca guardado nem público. */
export const EXAMES_URL_TTL_SEGUNDOS = 600
const PREFIXO = `storage://${EXAMES_BUCKET}/`

export function urlDeCaminho(caminho: string): string {
  return `${PREFIXO}${caminho}`
}

/** Extrai o caminho no bucket de `storage://…` ou de uma URL assinada antiga; null se for link externo. */
export function caminhoDoExame(url: string): string | null {
  if (url.startsWith(PREFIXO)) return url.slice(PREFIXO.length)
  const m = url.match(new RegExp(`/object/(?:sign|public|authenticated)/${EXAMES_BUCKET}/([^?]+)`))
  return m ? decodeURIComponent(m[1]) : null
}

/** Troca o valor guardado por URLs assinadas novas (bucket privado). Links externos passam sem mudança. */
export async function assinarUrlsExames<T extends { url: string }>(supabase: SupabaseClient, rows: T[]): Promise<T[]> {
  const caminhos = rows.map((r) => caminhoDoExame(r.url))
  const validos = caminhos.filter((c): c is string => !!c)
  if (validos.length === 0) return rows
  const { data } = await supabase.storage.from(EXAMES_BUCKET).createSignedUrls(validos, EXAMES_URL_TTL_SEGUNDOS)
  const porCaminho = new Map((data ?? []).map((d) => [d.path ?? '', d.signedUrl]))
  return rows.map((r, i) => {
    const c = caminhos[i]
    return c ? { ...r, url: porCaminho.get(c) || '' } : r
  })
}
