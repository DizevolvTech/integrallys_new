'use client'

import { BellRing } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import type { RetornosListaMeta } from '@/types/retorno'

/** Alerta da recepção: retornos a agendar (vencidos / no limite), com link para /retornos. */
export function RetornosAlerta() {
  const api = useApi()
  const [contagem, setContagem] = useState<RetornosListaMeta['contagem'] | null>(null)

  useEffect(() => {
    let ativo = true
    api
      .get<{ meta: RetornosListaMeta }>('/api/retornos?page=1&pageSize=1')
      .then((r) => ativo && setContagem(r.meta.contagem))
      .catch(() => undefined)
    return () => {
      ativo = false
    }
  }, [api])

  if (!contagem || contagem.vencido + contagem.limite === 0) return null

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-integrallys-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300"
    >
      <BellRing className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        Retornos para agendar: <strong>{contagem.vencido}</strong> vencido(s) e{' '}
        <strong>{contagem.limite}</strong> no limite.
      </span>
      <Link href="/retornos" className="font-medium underline">
        Ver retornos
      </Link>
    </div>
  )
}
