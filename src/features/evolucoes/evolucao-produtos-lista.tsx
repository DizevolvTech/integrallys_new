'use client'

import { Package } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'

interface ProdutoEvolucao {
  id: string
  nome: string
  tipo: string | null
  modoUso: string | null
  frequencia: string | null
  horarioIdeal: string | null
}

/** Produtos do Estoque adicionados à evolução (some se não houver nenhum). */
export function EvolucaoProdutosLista({
  evolucaoId,
  versao,
}: {
  evolucaoId: string
  versao: number
}) {
  const api = useApi()
  const [produtos, setProdutos] = useState<ProdutoEvolucao[]>([])

  useEffect(() => {
    let ativo = true
    api
      .get<{ data: ProdutoEvolucao[] }>(`/api/evolucoes/${evolucaoId}/produtos`)
      .then((r) => ativo && setProdutos(r.data))
      .catch(() => ativo && setProdutos([]))
    return () => {
      ativo = false
    }
  }, [api, evolucaoId, versao])

  if (produtos.length === 0) return null
  return (
    <section
      className="space-y-2 rounded-[12px] border border-app-border p-5 dark:border-app-border-dark"
      aria-label="Produtos da evolução"
    >
      <p className="text-sm font-normal text-app-text-primary dark:text-white">
        Produtos adicionados ({produtos.length})
      </p>
      <ul className="space-y-1.5">
        {produtos.map((p) => (
          <li
            key={p.id}
            className="flex items-start gap-2 text-sm text-app-text-primary dark:text-white"
          >
            <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-app-text-muted" />
            <span className="min-w-0 break-words">
              {p.nome}
              <span className="text-app-text-muted">
                {[p.tipo, p.modoUso, p.frequencia, p.horarioIdeal]
                  .filter(Boolean)
                  .map((x) => ` · ${x}`)
                  .join('')}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
