'use client'

import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import type { OpcaoBusca } from '@/lib/busca-opcoes'

export type VinculoTipoCampo = 'paciente' | 'fornecedor' | 'prestador' | 'colaborador' | 'outro'

interface OpcaoApi {
  id: string
  nome: string
  hint?: string
}

/** Pessoas que podem ser escolhidas em "Vinculado a" para o tipo informado (lista mínima, perfil decidido no servidor). */
export function useVinculoOpcoes(tipo: VinculoTipoCampo | '') {
  const api = useApi()
  const [opcoes, setOpcoes] = useState<OpcaoBusca[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!tipo || tipo === 'outro') {
      setOpcoes([])
      setErro(null)
      return
    }
    let ativo = true
    setCarregando(true)
    setErro(null)
    api
      .get<{ data: OpcaoApi[] }>(`/api/caixa/vinculos?tipo=${tipo}`)
      .then((res) => {
        if (ativo) setOpcoes(res.data.map((o) => ({ value: o.id, label: o.nome, hint: o.hint })))
      })
      .catch((err) => {
        if (!ativo) return
        setOpcoes([])
        setErro(err instanceof Error ? err.message : 'Não foi possível carregar a lista.')
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [api, tipo])

  return { opcoes, carregando, erro }
}
