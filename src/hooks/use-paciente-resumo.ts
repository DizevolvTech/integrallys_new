'use client'

import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import type { PacienteResumo } from '@/lib/paciente-resumo'

export function usePacienteResumo(pacienteId?: string | null) {
  const api = useApi()
  const [data, setData] = useState<PacienteResumo | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!pacienteId) {
      setData(null)
      return
    }
    let ativo = true
    setIsLoading(true)
    api
      .get<{ data: PacienteResumo }>(`/api/pacientes/resumo?id=${encodeURIComponent(pacienteId)}`)
      .then((r) => ativo && setData(r.data))
      .catch(() => ativo && setData(null))
      .finally(() => ativo && setIsLoading(false))
    return () => {
      ativo = false
    }
  }, [api, pacienteId])

  return { data, isLoading }
}
