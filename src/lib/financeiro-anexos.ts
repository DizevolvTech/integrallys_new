export const ANEXO_BUCKET = 'financeiro-anexos'
export const ANEXO_MAX_BYTES = 10 * 1024 * 1024
export const ANEXO_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const
export const ANEXO_TIPOS = ['Nota fiscal', 'Cupom', 'Recibo', 'Outro'] as const

export function validarAnexo(file: { type: string; size: number }): { ok: true } | { ok: false; error: string; code: string } {
  if (!(ANEXO_MIMES as readonly string[]).includes(file.type)) {
    return { ok: false, error: 'Envie um PDF, JPG, PNG ou WEBP', code: 'INVALID_MIME' }
  }
  if (file.size <= 0) return { ok: false, error: 'Arquivo vazio', code: 'EMPTY_FILE' }
  if (file.size > ANEXO_MAX_BYTES) return { ok: false, error: 'Arquivo acima de 10 MB', code: 'FILE_TOO_LARGE' }
  return { ok: true }
}

/** Caminho no Storage: pasta do lançamento + nome limpo (sem acento nem caracteres perigosos). */
export function caminhoAnexo(lancamentoId: string, nome: string, agora = Date.now()): string {
  const limpo = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(-80)
  return `${lancamentoId}/${agora}-${limpo || 'arquivo'}`
}
