interface ApiListResponse<T> {
  data: T[]
}

interface ApiErrorResponse {
  error?: string
}

interface PacienteApiItem {
  id: string
  nome: string
}

interface PrescricaoComplementarItem {
  nome: string
  quantidade: number
  valorUnitario: number
  posologia: string
}

function formatApiError(status: number, fallback: string) {
  return async (response: Response) => {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorResponse
    throw new Error(payload.error ?? `${fallback} (${status}).`)
  }
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: 'include',
    ...init,
  })

  if (!response.ok) {
    await formatApiError(response.status, 'Falha ao processar requisição')(response)
  }

  return response.json() as Promise<T>
}

async function getPacienteIdByName(nomePaciente: string) {
  const payload = await fetchJson<ApiListResponse<PacienteApiItem>>('/api/pacientes', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })

  const normalized = nomePaciente.trim().toLowerCase()
  const paciente = payload.data.find((item) => item.nome.trim().toLowerCase() === normalized)

  if (!paciente?.id) {
    throw new Error('Não foi possível localizar o paciente para criar a prescrição complementar.')
  }

  return paciente.id
}

/**
 * Cria uma prescrição complementar para um paciente.
 * Chama POST /api/prescricoes com os itens e forma de pagamento.
 */
export async function salvarPrescricaoComplementar(
  paciente: string,
  itens: PrescricaoComplementarItem[],
  formaPagamento: string,
): Promise<{ ok: boolean }> {
  const pacienteId = await getPacienteIdByName(paciente)
  const valorTotal = itens.reduce((total, item) => total + (item.quantidade * item.valorUnitario), 0)

  const response = await fetch('/api/prescricoes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      pacienteId,
      valorTotal,
      status: formaPagamento === 'consumo' ? 'Quitado' : 'Pendente',
      tipo: 'complementar',
      observacoes: `Forma de pagamento: ${formaPagamento}`,
      itens,
      formaPagamento,
    }),
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorResponse
    throw new Error(payload.error ?? `Falha ao salvar prescrição complementar (${response.status}).`)
  }

  return { ok: true }
}
