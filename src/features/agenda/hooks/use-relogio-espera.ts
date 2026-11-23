'use client'

import { useEffect, useState } from 'react'

/**
 * Relógio único da tela da agenda para os cronômetros de espera: um só setInterval (não um por card),
 * ligado apenas enquanto há alguém em check-in. Devolve "agora" já corrigido pelo relógio do servidor.
 */
export function useRelogioEspera(ativo: boolean, offsetMs: number): number {
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => {
    if (!ativo) return
    setAgora(Date.now())
    const timer = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [ativo])

  return agora + offsetMs
}
