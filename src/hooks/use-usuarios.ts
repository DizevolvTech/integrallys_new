'use client'

import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import type { ApiListResponse } from '@/types/api'

export interface UsuarioItem {
  id: string
  nome: string
  email: string
  perfil?: string
  status: string
  /** null para master/admin/paciente — perfis que não são escopados por unidade. */
  unidadeId?: string | null
  tipoVinculo?: 'interno' | 'parceiro'
  especialistasPermitidos?: string[] | null
  agendaPessoalPermitidos?: string[]
  isVendedor?: boolean
  comissao?: number
}

export interface UsuarioInput {
  id?: string
  nome: string
  email: string
  perfil: string
  status?: string
  senha?: string
  /** Obrigatório para gestor/recepcao/especialista — a API recusa sem. */
  unidadeId?: string | null
  tipoVinculo?: 'interno' | 'parceiro'
  especialistasPermitidos?: string[] | null
  agendaPessoalPermitidos?: string[]
  isVendedor?: boolean
  comissao?: number
}

export function useUsuarios() {
  const api = useApi()
  const [data, setData] = useState<UsuarioItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.get<ApiListResponse<UsuarioItem>>('/api/usuarios')
      setData(response.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar usuarios')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    const loadUsers = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await api.get<ApiListResponse<UsuarioItem>>('/api/usuarios')
        if (!mounted) return
        setData(response.data)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar usuarios')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    void loadUsers()
    return () => {
      mounted = false
    }
  }, [api])

  const createUsuario = async (payload: UsuarioInput) => {
    const response = await api.post<ApiListResponse<UsuarioItem>>('/api/usuarios', payload)
    setData(response.data)
    return response.data
  }

  const updateUsuario = async (payload: UsuarioInput) => {
    const response = await api.put<ApiListResponse<UsuarioItem>>('/api/usuarios', payload)
    setData(response.data)
    return response.data
  }

  const deleteUsuario = async (id: string) => {
    const response = await api.delete<ApiListResponse<UsuarioItem>>('/api/usuarios', { id })
    setData(response.data)
    return response.data
  }

  return { data, isLoading, error, load, createUsuario, updateUsuario, deleteUsuario }
}
