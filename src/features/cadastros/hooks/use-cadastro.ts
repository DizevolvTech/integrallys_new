'use client'

import { useCallback, useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import type { RecursoCadastro } from '@/lib/cadastros'

export interface BancoCadastro {
  id: string
  codigo: string | null
  nome: string
  ativo: boolean
}

export interface CategoriaDreCadastro {
  id: string
  nome: string
  tipo: 'receita' | 'despesa'
  linhaDre: string
  ordem: number
  ativo: boolean
  sistema: boolean
}

export interface TipoDocumentoCadastro {
  id: string
  nome: string
  base: string
  ordem: number
  ativo: boolean
  sistema: boolean
}

interface CadastroMap {
  bancos: BancoCadastro
  'categorias-dre': CategoriaDreCadastro
  'tipos-documento': TipoDocumentoCadastro
}

/** Lista e grava um cadastro editável (bancos, categorias de DRE, tipos de documento). */
export function useCadastro<R extends RecursoCadastro>(recurso: R) {
  const api = useApi()
  const [data, setData] = useState<CadastroMap[R][]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.get<{ data: CadastroMap[R][] }>(`/api/cadastros/${recurso}`)
      setData(response.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar cadastro')
    } finally {
      setIsLoading(false)
    }
  }, [api, recurso])

  useEffect(() => {
    void load()
  }, [load])

  const criar = async (payload: Record<string, unknown>) => {
    const response = await api.post<{ data: CadastroMap[R][] }>(`/api/cadastros/${recurso}`, payload)
    setData(response.data)
  }

  const atualizar = async (id: string, payload: Record<string, unknown>) => {
    const response = await api.put<{ data: CadastroMap[R][] }>(`/api/cadastros/${recurso}`, { id, ...payload })
    setData(response.data)
  }

  return { data, isLoading, error, reload: load, criar, atualizar }
}
