'use client'

import { useEffect, useRef } from 'react'
import type { PrazoRetornoValor } from '../prazo-retorno-selector'
import { prazoDentroDe30Dias, procedimentoRetornoSugerido } from '../retorno-procedimento'
import type { RetornoAlvo, RetornoOpcoes } from './use-retorno-alvo'

/**
 * Sugere o procedimento do retorno pelo prazo escolhido (até 30 dias: "Retorno de X"; acima: "X").
 * Roda quando as opções carregam e quando o prazo muda; a troca manual depois disso fica como a pessoa deixou.
 */
export function useProcedimentoRetornoAutomatico(params: {
  opcoes: RetornoOpcoes | null
  prazo: PrazoRetornoValor
  alvo: RetornoAlvo
  onAlvoChange: (alvo: RetornoAlvo) => void
}) {
  const { opcoes, prazo, alvo, onAlvoChange } = params
  const alvoRef = useRef(alvo)
  const onChangeRef = useRef(onAlvoChange)
  useEffect(() => {
    alvoRef.current = alvo
    onChangeRef.current = onAlvoChange
  })
  const dentro = prazoDentroDe30Dias(prazo)
  useEffect(() => {
    if (!opcoes) return
    const sugerido = procedimentoRetornoSugerido({
      origemId: opcoes.padrao.procedimentoId,
      procedimentos: opcoes.procedimentos,
      dentroDe30Dias: dentro,
    })
    if (sugerido && sugerido !== alvoRef.current.procedimentoId) {
      onChangeRef.current({ ...alvoRef.current, procedimentoId: sugerido })
    }
  }, [opcoes, dentro])
}
