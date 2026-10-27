'use client'

import { useCallback, useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'

export interface AniversarianteLinha {
  id: string
  nome: string
  telefone: string
  nascimento: string
  idade: number
  enviado: boolean
}

interface Params {
  modo: 'dia' | 'mes'
  data: string
  q: string
  enviado: string
  ativo?: boolean
}

interface Resposta {
  data: AniversarianteLinha[]
  meta: { total: number; totais: { enviados?: number } }
}

/** Aniversariantes do dia/mês; o "ok, mensagem enviada" é gravado no banco por paciente e ano. */
export function useAniversariantes({ modo, data, q, enviado, ativo = true }: Params) {
  const api = useApi()
  const [linhas, setLinhas] = useState<AniversarianteLinha[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const ano = Number(data.slice(0, 4))

  useEffect(() => {
    if (!ativo || !data) return
    let atual = true
    setIsLoading(true)
    const timer = setTimeout(async () => {
      try {
        const query = new URLSearchParams({ modo, data, porPagina: '500' })
        if (q.trim()) query.set('q', q.trim())
        if (enviado !== 'todos') query.set('enviado', enviado)
        const resposta = await api.get<Resposta>(`/api/relatorios/aniversariantes?${query.toString()}`)
        if (!atual) return
        setLinhas(resposta.data)
        setTotal(resposta.meta.total)
        setError(null)
      } catch (err) {
        if (atual) setError(err instanceof Error ? err.message : 'Erro ao carregar aniversariantes')
      } finally {
        if (atual) setIsLoading(false)
      }
    }, 300)
    return () => {
      atual = false
      clearTimeout(timer)
    }
  }, [api, ativo, modo, data, q, enviado])

  const marcar = useCallback(
    async (pacienteId: string, valor: boolean) => {
      setLinhas((prev) => prev.map((l) => (l.id === pacienteId ? { ...l, enviado: valor } : l)))
      try {
        await api.put('/api/relatorios/aniversariantes', { pacienteId, ano, enviado: valor })
      } catch (err) {
        setLinhas((prev) => prev.map((l) => (l.id === pacienteId ? { ...l, enviado: !valor } : l)))
        setError(err instanceof Error ? err.message : 'Não foi possível gravar o envio da mensagem')
      }
    },
    [api, ano],
  )

  return { linhas, total, isLoading, error, marcar }
}
