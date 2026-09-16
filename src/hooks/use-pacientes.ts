'use client'

import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import type { ApiListResponse } from '@/types/api'

export interface PacienteItem {
  id: string
  usuarioId?: string
  unidadeId?: string
  unidadeName?: string
  nome: string
  telefone: string
  email: string
  status: string
  cpf?: string
  birthDate?: string
  rg?: string
  inscricaoEstadual?: string
  gender?: string
  source?: string
  origemDetalhe?: string
  vinculoTipos?: string[]
  precisaNf?: boolean
  photoUrl?: string
  addressDetails?: {
    zipCode?: string
    street?: string
    number?: string
    complement?: string
    neighborhood?: string
    city?: string
    state?: string
  }
  specialNeeds?: Record<string, unknown>
  responsible?: Record<string, unknown>
  financial?: Record<string, unknown>
  supplierData?: Record<string, unknown>
}

export interface PacienteInput {
  id?: string
  nome: string
  telefone?: string
  email?: string
  cpf?: string
  rg?: string
  inscricaoEstadual?: string
  dataNascimento?: string
  sexo?: string
  status?: string
  indicacao?: string
  origemDetalhe?: string
  vinculoTipos?: string[]
  precisaNf?: boolean
  unidadeId?: string
  photoUrl?: string
  addressDetails?: {
    zipCode?: string
    street?: string
    number?: string
    complement?: string
    neighborhood?: string
    city?: string
    state?: string
  }
  specialNeeds?: Record<string, unknown>
  responsible?: Record<string, unknown>
  supplierData?: Record<string, unknown>
  criarAcessoPortal?: boolean
}

export interface PacientePortalAccess {
  email: string
  temporaryPassword: string
  firstAccessRequired: boolean
}

export interface PacientesMutationResponse extends ApiListResponse<PacienteItem> {
  meta: {
    units?: Array<{ id: string; nome: string }>
  } & Record<string, unknown>
  portalAccess?: PacientePortalAccess | null
  /** Id do paciente recém-criado (POST). */
  createdId?: string
}

interface PacientesListResponse extends ApiListResponse<PacienteItem> {
  meta: {
    units?: Array<{ id: string; nome: string }>
  } & Record<string, unknown>
}

export function usePacientes() {
  const api = useApi()
  const [data, setData] = useState<PacienteItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [units, setUnits] = useState<Array<{ id: string; nome: string }>>([])

  const createPaciente = async (payload: PacienteInput) => {
    const response = await api.post<PacientesMutationResponse>('/api/pacientes', payload)
    setData(response.data)
    if (Array.isArray(response.meta?.units)) {
      setUnits(response.meta.units)
    }
    return response
  }

  const updatePaciente = async (payload: PacienteInput) => {
    const response = await api.put<PacientesListResponse>('/api/pacientes', payload)
    setData(response.data)
    setUnits(response.meta.units ?? [])
    return response.data
  }

  const deletePaciente = async (id: string) => {
    const response = await api.delete<PacientesListResponse>('/api/pacientes', { id })
    setData(response.data)
    setUnits(response.meta.units ?? [])
    return response.data
  }

  const load = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.get<PacientesListResponse>('/api/pacientes')
      setData(response.data)
      setUnits(response.meta.units ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar pacientes')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    const loadData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await api.get<PacientesListResponse>('/api/pacientes')
        if (!mounted) return
        setData(response.data)
        setUnits(response.meta.units ?? [])
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar pacientes')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    void loadData()
    return () => {
      mounted = false
    }
  }, [api])

  return { data, units, isLoading, error, load, createPaciente, updatePaciente, deletePaciente }
}
