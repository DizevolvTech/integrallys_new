'use client'

import { useCallback, useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'

/** Pacientes que já têm retorno marcado na agenda → data (aaaa-mm-dd) do mais próximo. */
export function useRetornosAgendados() {
  const api = useApi()
  const [datas, setDatas] = useState<Record<string, string>>({})

  const reload = useCallback(async () => {
    try {
      const response = await api.get<{ data: Record<string, string> }>('/api/prescricoes/retorno-agenda')
      setDatas(response.data ?? {})
    } catch {
      // sem permissão ou offline: o selo cai no caminho "Agendar retorno"
    }
  }, [api])

  useEffect(() => {
    void reload()
  }, [reload])

  return { retornosAgendados: datas, reload }
}
