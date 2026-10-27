'use client'

import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import { NECESSIDADE_ESPECIAL_VAZIA, type NecessidadeEspecialForm } from '@/features/gestao-pacientes/components/necessidade-especial-fields'
import { RESPONSAVEL_VAZIO, type ResponsavelForm } from '@/features/gestao-pacientes/components/responsavel-fields'
import { NOTA_FISCAL_VAZIA, notaFiscalFromFinancial, notaFiscalToFinancial, type NotaFiscalForm } from '@/features/gestao-pacientes/utils/nota-fiscal'

export interface PatientPerfilData {
  nome: string
  cpf: string
  rg: string
  inscricaoEstadual: string
  dataNascimento: string
  sexo: string
  status: string
  telefone: string
  email: string
  zipCode: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  notificacoesEmail: boolean
  notificacoesSms: boolean
  lembretesConsultas: boolean
  avisosPagamento: boolean
  promocoesNovidades: boolean
  // Mesmos campos do cadastro da recepção (item 13)
  indicacao: string
  origemDetalhe: string
  precisaNf: boolean
  notaFiscal: NotaFiscalForm
  specialNeeds: NecessidadeEspecialForm
  responsible: ResponsavelForm
}

type PerfilApi = Omit<PatientPerfilData, 'notaFiscal' | 'specialNeeds' | 'responsible'> & {
  financial: Parameters<typeof notaFiscalFromFinancial>[0] | null
  specialNeeds: { hasNeeds?: boolean | string; categories?: string[]; details?: string } | null
  responsible: Partial<ResponsavelForm> | null
}

function fromApi(api: PerfilApi): PatientPerfilData {
  const { financial, specialNeeds, responsible, ...resto } = api
  return {
    ...resto,
    notaFiscal: financial ? notaFiscalFromFinancial(financial) : { ...NOTA_FISCAL_VAZIA },
    specialNeeds: {
      ...NECESSIDADE_ESPECIAL_VAZIA,
      hasNeeds: specialNeeds?.hasNeeds === true || specialNeeds?.hasNeeds === 'sim' ? 'sim' : 'nao',
      categories: specialNeeds?.categories ?? [],
      details: specialNeeds?.details ?? '',
    },
    responsible: { ...RESPONSAVEL_VAZIO, ...(responsible ?? {}) },
  }
}

function toApi(perfil: PatientPerfilData) {
  const { notaFiscal, ...resto } = perfil
  return { ...resto, financial: notaFiscalToFinancial(perfil.precisaNf, notaFiscal) }
}

export interface ChangePatientPasswordPayload {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export function usePerfilPaciente() {
  const api = useApi()
  const [data, setData] = useState<PatientPerfilData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.get<{ data: PerfilApi }>('/api/portal/perfil')
      setData(fromApi(response.data))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar perfil')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    const run = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await api.get<{ data: PerfilApi }>('/api/portal/perfil')
        if (!mounted) return
        setData(fromApi(response.data))
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar perfil')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    void run()
    return () => {
      mounted = false
    }
  }, [api])

  const savePerfil = async (payload: PatientPerfilData) => {
    const response = await api.put<{ data: PerfilApi }>('/api/portal/perfil', toApi(payload))
    const salvo = fromApi(response.data)
    setData(salvo)
    return salvo
  }

  const changePassword = async (payload: ChangePatientPasswordPayload) => {
    const response = await api.put<{ data: { success: boolean } }>('/api/auth/password', payload)
    return response.data
  }

  return { data, isLoading, error, savePerfil, changePassword, reload: load }
}
