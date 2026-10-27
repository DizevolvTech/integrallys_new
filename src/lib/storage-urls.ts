// URLs de arquivos do storage que o navegador consegue abrir.
// O storage do Supabase fica atrás do servidor (endereço interno), então o app nunca entrega
// o link do storage: fotos de paciente saem por /api/pacientes/foto/arquivo (com login e escopo)
// e arquivos de buckets públicos (avatares, logos) por /api/arquivos-publicos/<bucket>/<caminho>.

export const BUCKETS_PUBLICOS = ['avatares', 'clinica-logos'] as const
const FOTO_BUCKET = 'pacientes-fotos'

const STORAGE_OBJECT = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/

export function urlDaFotoPaciente(caminho: string): string {
  return `/api/pacientes/foto/arquivo?caminho=${encodeURIComponent(caminho)}`
}

export function urlArquivoPublico(bucket: string, caminho: string): string {
  return `/api/arquivos-publicos/${bucket}/${caminho.split('/').map(encodeURIComponent).join('/')}`
}

/** Converte link do storage (inclusive os antigos já gravados no banco) em rota do app. */
export function urlParaNavegador(url: string | null | undefined): string {
  const valor = String(url ?? '').trim()
  if (!valor) return ''
  const m = STORAGE_OBJECT.exec(valor)
  if (!m) return valor
  const bucket = decodeURIComponent(m[1] ?? '')
  const caminho = decodeURIComponent(m[2] ?? '')
  if (bucket === FOTO_BUCKET) return urlDaFotoPaciente(caminho)
  if ((BUCKETS_PUBLICOS as readonly string[]).includes(bucket)) return urlArquivoPublico(bucket, caminho)
  return valor
}

/** Caminho seguro dentro do bucket (sem subir diretório). */
export function caminhoSeguro(caminho: string): string | null {
  const limpo = caminho.replace(/^\/+/, '')
  if (!limpo || limpo.split('/').some((parte) => parte === '..' || parte === '')) return null
  return limpo
}
