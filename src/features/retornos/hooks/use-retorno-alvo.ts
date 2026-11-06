'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useApi } from '@/hooks/use-api'

export interface RetornoOpcao {
  id: string
  nome: string
}

export interface RetornoOpcoes {
  profissionais: RetornoOpcao[]
  procedimentos: RetornoOpcao[]
  padrao: { especialistaId: string | null; procedimentoId: string | null }
}

/** "De que e com quem" é o retorno: ids vazios = sem escolha (o servidor repete os do atendimento). */
export interface RetornoAlvo {
  especialistaId: string
  procedimentoId: string
}

export const RETORNO_ALVO_VAZIO: RetornoAlvo = { especialistaId: '', procedimentoId: '' }

export function montarQueryOpcoes(origem: { agendamentoId?: string | null; pacienteId?: string | null }) {
  const params = new URLSearchParams()
  if (origem.agendamentoId) params.set('agendamentoId', origem.agendamentoId)
  if (origem.pacienteId) params.set('pacienteId', origem.pacienteId)
  const query = params.toString()
  return query ? `/api/retornos/opcoes?${query}` : '/api/retornos/opcoes'
}

/**
 * Carrega especialistas/procedimentos ativos e pré-preenche o alvo com os do atendimento de origem
 * (só enquanto a pessoa não mexeu e o valor inicial estava vazio).
 */
export function useRetornoAlvo(params: {
  enabled: boolean
  agendamentoId?: string | null
  pacienteId?: string | null
  inicial?: RetornoAlvo
}) {
  const api = useApi()
  const { enabled, agendamentoId, pacienteId, inicial } = params
  const [opcoes, setOpcoes] = useState<RetornoOpcoes | null>(null)
  const [alvo, setAlvoState] = useState<RetornoAlvo>(inicial ?? RETORNO_ALVO_VAZIO)
  const [erro, setErro] = useState('')
  const tocado = useRef(Boolean(inicial?.especialistaId || inicial?.procedimentoId))

  useEffect(() => {
    if (!enabled) return
    let ativo = true
    api
      .get<{ data: RetornoOpcoes }>(montarQueryOpcoes({ agendamentoId, pacienteId }))
      .then((resposta) => {
        if (!ativo) return
        setOpcoes(resposta.data)
        setErro('')
        if (!tocado.current) {
          setAlvoState({
            especialistaId: resposta.data.padrao.especialistaId ?? '',
            procedimentoId: resposta.data.padrao.procedimentoId ?? '',
          })
        }
      })
      .catch((err) => {
        if (ativo) setErro(err instanceof Error ? err.message : 'Não foi possível carregar as opções do retorno.')
      })
    return () => {
      ativo = false
    }
  }, [api, enabled, agendamentoId, pacienteId])

  const setAlvo = useCallback((proximo: RetornoAlvo) => {
    tocado.current = true
    setAlvoState(proximo)
  }, [])

  return { opcoes, alvo, setAlvo, erro }
}

/** Corpo enviado à API: só inclui o que foi escolhido. */
export function alvoParaCorpo(alvo: RetornoAlvo) {
  return {
    ...(alvo.especialistaId ? { especialistaRetornoId: alvo.especialistaId } : {}),
    ...(alvo.procedimentoId ? { procedimentoRetornoId: alvo.procedimentoId } : {}),
  }
}
