'use client'

import { useEffect, useRef, useState } from 'react'
import { useApi } from '@/hooks/use-api'

export interface RelatorioMeta {
  total: number
  pagina: number
  porPagina: number
  totalPaginas: number
  totais: Record<string, unknown>
}

export type LinhaRelatorio = Record<string, unknown> & { id: string }

const ATRASO_BUSCA_MS = 350

function montarQuery(filtros: Record<string, string>, pagina: number, porPagina: number) {
  const params = new URLSearchParams()
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor && valor !== 'todos') params.set(chave, valor)
  }
  params.set('pagina', String(pagina))
  params.set('porPagina', String(porPagina))
  return params.toString()
}

/** Busca uma página do relatório já filtrada, paginada e totalizada pelo servidor. */
export function useRelatorioTabela(tipo: string, filtros: Record<string, string>, pagina: number, porPagina = 20) {
  const api = useApi()
  const [linhas, setLinhas] = useState<LinhaRelatorio[]>([])
  const [meta, setMeta] = useState<RelatorioMeta | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const sequencia = useRef(0)
  const chaveFiltros = JSON.stringify(filtros)

  useEffect(() => {
    const minha = ++sequencia.current
    setIsLoading(true)
    const timer = setTimeout(async () => {
      try {
        const query = montarQuery(JSON.parse(chaveFiltros) as Record<string, string>, pagina, porPagina)
        const resposta = await api.get<{ data: LinhaRelatorio[]; meta: RelatorioMeta }>(`/api/relatorios/${tipo}?${query}`)
        if (minha !== sequencia.current) return
        setLinhas(resposta.data)
        setMeta(resposta.meta)
        setError(null)
      } catch (err) {
        if (minha !== sequencia.current) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar o relatório')
      } finally {
        if (minha === sequencia.current) setIsLoading(false)
      }
    }, ATRASO_BUSCA_MS)
    return () => clearTimeout(timer)
  }, [api, tipo, chaveFiltros, pagina, porPagina])

  return { linhas, meta, isLoading, error }
}
