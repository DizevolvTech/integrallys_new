'use client'

import { useCallback, useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import { DESCONTOS_PADRAO, type DescontosPorForma } from '@/lib/desconto-forma'

/** Descontos (%) por forma de pagamento: o gestor edita em Cadastros, a venda só lê (travado). */
export function useDescontosForma() {
  const api = useApi()
  const [descontos, setDescontos] = useState<DescontosPorForma>(DESCONTOS_PADRAO)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    api
      .get<{ data: DescontosPorForma }>('/api/formas-pagamento/descontos')
      .then((response) => {
        if (mounted) setDescontos(response.data)
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : 'Erro ao carregar descontos por forma')
      })
      .finally(() => {
        if (mounted) setIsLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [api])

  const salvar = useCallback(
    async (next: DescontosPorForma) => {
      const response = await api.put<{ data: DescontosPorForma }>('/api/formas-pagamento/descontos', next)
      setDescontos(response.data)
      return response.data
    },
    [api],
  )

  return { descontos, isLoading, error, salvar }
}
