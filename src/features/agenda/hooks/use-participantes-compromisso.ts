'use client'

import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'

export interface ParticipanteOpcao {
  id: string
  nome: string
  perfil: string
  perfilRotulo: string
}

/** Usuários cadastrados que podem participar de um compromisso (carrega quando o modal abre). */
export function useParticipantesCompromisso(ativo: boolean) {
  const api = useApi()
  const [data, setData] = useState<ParticipanteOpcao[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ativo) return
    let atual = true
    setIsLoading(true)
    api
      .get<{ data: ParticipanteOpcao[] }>('/api/agenda/participantes')
      .then((res) => atual && (setData(res.data), setError(null)))
      .catch((err) => atual && setError(err instanceof Error ? err.message : 'Erro ao carregar usuários'))
      .finally(() => atual && setIsLoading(false))
    return () => {
      atual = false
    }
  }, [api, ativo])

  return { data, isLoading, error }
}
