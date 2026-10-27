import type { ApiErrorResponse } from '@/types/api'

export class ApiClientError extends Error implements ApiErrorResponse {
  error: string
  code: string
  status: number

  constructor(payload: ApiErrorResponse, status: number) {
    super(payload.error)
    this.name = 'ApiClientError'
    this.error = payload.error
    this.code = payload.code
    this.status = status
  }
}

/**
 * Detecta uma negação de permissão vinda da API (`requirePermission` em
 * src/lib/authz.ts responde 403 com code 'FORBIDDEN'). Usado pelas views para
 * mostrar um estado de "acesso negado" em vez de "nenhum item cadastrado".
 */
export function isForbiddenError(err: unknown): boolean {
  return (
    err instanceof ApiClientError &&
    (err.status === 403 || err.code === 'FORBIDDEN' || err.code === 'ACCESS_DENIED')
  )
}

async function executarRequisicao<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
  })

  if (!response.ok) {
    let payload: ApiErrorResponse = {
      error: `Erro ${response.status}`,
      code: `HTTP_${response.status}`,
    }

    try {
      const body = (await response.json()) as ApiErrorResponse
      if (body.error && body.code) {
        payload = body
      }
    } catch {
      payload = {
        error: response.statusText || payload.error,
        code: payload.code,
      }
    }

    if (response.status === 401 && typeof window !== 'undefined') {
      // CR-AUTH-01 · QC-06: preserva a rota atual em `redirectTo` (login/page.tsx
      // já honra esse param, linhas 70-78) e marca o motivo do redirect via
      // `reason=session_expired` — login/page pode exibir banner quando lê esse
      // param. Evita também loops quando o 401 vier de DENTRO da própria /login.
      const currentPath = window.location.pathname + window.location.search
      if (!currentPath.startsWith('/login')) {
        const loginUrl = `/login?redirectTo=${encodeURIComponent(currentPath)}&reason=session_expired`
        window.location.href = loginUrl
      }
    }

    throw new ApiClientError(payload, response.status)
  }

  return response.json() as Promise<T>
}

// Várias partes da tela pedem o mesmo GET ao mesmo tempo (hooks independentes, efeitos duplicados em
// desenvolvimento). Enquanto a primeira requisição está em andamento, as demais reaproveitam a resposta.
const getsEmAndamento = new Map<string, Promise<unknown>>()

function copiar<T>(valor: T): T {
  return typeof structuredClone === 'function' ? structuredClone(valor) : valor
}

export function apiClient<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const ehGetSimples = typeof input === 'string' && (!init || (!init.method && !init.body && !init.headers && !init.signal))
  if (!ehGetSimples) return executarRequisicao<T>(input, init)

  let emAndamento = getsEmAndamento.get(input) as Promise<T> | undefined
  if (!emAndamento) {
    emAndamento = executarRequisicao<T>(input, init).finally(() => getsEmAndamento.delete(input))
    getsEmAndamento.set(input, emAndamento)
  }
  return emAndamento.then(copiar)
}
