/**
 * Envia foto do paciente para `/api/pacientes/foto`.
 * Sem pacienteId: URL fica pronta para o POST de criação.
 * Com pacienteId: API também atualiza `photo_url` no banco.
 */
export async function uploadPacienteFoto(file: File, pacienteId?: string): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  if (pacienteId) form.append('pacienteId', pacienteId)

  const response = await fetch('/api/pacientes/foto', {
    method: 'POST',
    body: form,
    credentials: 'include',
  })

  const payload = (await response.json().catch(() => null)) as {
    data?: { photoUrl?: string }
    error?: string
  } | null

  if (!response.ok) {
    throw new Error(payload?.error ?? 'Falha ao enviar a foto do paciente.')
  }

  const photoUrl = payload?.data?.photoUrl
  if (!photoUrl) {
    throw new Error('Upload concluído sem URL da foto.')
  }
  return photoUrl
}

export function isTransientPhotoUrl(url?: string | null): boolean {
  if (!url) return false
  return url.startsWith('blob:') || url.startsWith('data:')
}
