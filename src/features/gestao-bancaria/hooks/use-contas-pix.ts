'use client'

import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'

export interface ContaPixOpcao {
  id: string
  nome: string
  banco: string | null
}

/** Contas ativas para escolher a conta do PIX ao receber na agenda (sem dados sensíveis). */
export function useContasPix() {
  const api = useApi()
  const [data, setData] = useState<ContaPixOpcao[]>([])

  useEffect(() => {
    let ativo = true
    api
      .get<{ data: ContaPixOpcao[] }>('/api/gestao-bancaria/opcoes')
      .then((res) => {
        if (ativo) setData(res.data)
      })
      .catch(() => {
        if (ativo) setData([])
      })
    return () => {
      ativo = false
    }
  }, [api])

  return { data }
}
