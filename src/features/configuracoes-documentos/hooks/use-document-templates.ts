'use client'

import { useCallback, useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import type { DocumentoTemplate, DocumentoTipo, TemplateConteudo } from '@/lib/documentos'

interface ListResponse {
  data: DocumentoTemplate[]
}

interface ItemResponse {
  data: DocumentoTemplate
}

export interface TemplateUpdates {
  nome?: string
  tipo?: DocumentoTipo
  conteudo?: TemplateConteudo
  ativo?: boolean
  editavel_pelo_especialista?: boolean
  disponivel_portal_paciente?: boolean
}

export function useDocumentTemplates() {
  const api = useApi()
  const [data, setData] = useState<DocumentoTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Estado por-operação de save/reset (PATCH/POST/DELETE) — distinto do load
  // inicial pra que a UI possa mostrar spinners locais sem regredir a lista.
  const [isMutating, setIsMutating] = useState(false)
  const [mutationError, setMutationError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await api.get<ListResponse>('/api/documentos/templates?incluir_inativos=true')
      setData(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar templates')
    } finally {
      setIsLoading(false)
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  // Wrapper único pra padronizar isMutating/mutationError em qualquer operação
  // de escrita. Re-lança o erro pra que callers existentes não percam o try/catch.
  const runMutation = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
    setIsMutating(true)
    setMutationError(null)
    try {
      return await fn()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha na operação'
      setMutationError(message)
      throw err
    } finally {
      setIsMutating(false)
    }
  }, [])

  // O endpoint responde em PATCH /api/documentos/templates. useApi não expõe
  // patch, então chamamos fetch direto mantendo o método HTTP correto.
  const patch = useCallback(
    (id: string, updates: TemplateUpdates) =>
      runMutation(async () => {
        const response = await fetch('/api/documentos/templates', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id, ...updates }),
        })
        if (!response.ok) {
          const body = await response.json().catch(() => null)
          throw new Error(body?.error ?? 'Falha ao atualizar template')
        }
        const payload = (await response.json()) as ItemResponse
        setData((current) =>
          current.map((item) =>
            item.id === payload.data.id ? { ...item, ...payload.data } : item,
          ),
        )
        return payload.data
      }),
    [runMutation],
  )

  const create = useCallback(
    (input: {
      slug: string
      nome: string
      tipo: DocumentoTipo
      tipoDocumentoId?: string
      conteudo: TemplateConteudo
      /** Obrigatório pra master/admin (sem unidade no JWT); escopado ignora no backend. */
      unidadeId?: string
      ativo?: boolean
      editavel_pelo_especialista?: boolean
      disponivel_portal_paciente?: boolean
    }) =>
      runMutation(async () => {
        const res = await api.post<ItemResponse>('/api/documentos/templates', input)
        setData((current) => [...current, res.data].sort((a, b) => a.nome.localeCompare(b.nome)))
        return res.data
      }),
    [api, runMutation],
  )

  const remove = useCallback(
    (id: string) =>
      runMutation(async () => {
        const response = await fetch('/api/documentos/templates', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id }),
        })
        if (!response.ok) {
          const body = await response.json().catch(() => null)
          throw new Error(body?.error ?? 'Falha ao excluir template')
        }
        const payload = (await response.json()) as { data: { id: string; desativado?: boolean } }
        if (payload.data.desativado) {
          // Backend desativou em vez de excluir (há docs emitidos dependentes)
          setData((current) =>
            current.map((item) => (item.id === id ? { ...item, ativo: false } : item)),
          )
          return { removido: false, desativado: true }
        }
        setData((current) => current.filter((item) => item.id !== id))
        return { removido: true, desativado: false }
      }),
    [runMutation],
  )

  return { data, isLoading, error, isMutating, mutationError, reload: load, patch, create, remove }
}
