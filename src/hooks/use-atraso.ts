'use client'

import { useEffect, useState } from 'react'

/** Valor que só muda depois de `ms` sem novas alterações (busca digitada vira uma consulta, não uma por letra). */
export function useAtraso<T>(valor: T, ms: number): T {
  const [atrasado, setAtrasado] = useState(valor)
  useEffect(() => {
    const timer = setTimeout(() => setAtrasado(valor), ms)
    return () => clearTimeout(timer)
  }, [valor, ms])
  return atrasado
}
