export const EXAMES_BUCKET = 'exames-pacientes'
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

/** Link de abertura na própria API (autenticada); links externos antigos passam sem mudança. */
export function urlDeAberturaExame<T extends { id: string; url: string }>(row: T): T {
  return caminhoDoExame(row.url) ? { ...row, url: `/api/pacientes/exames/${row.id}/arquivo` } : row
}

const MIMES: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }

export function mimeDoExame(caminho: string): string {
  return MIMES[caminho.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream'
}
