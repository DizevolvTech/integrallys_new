'use client'

import { Check, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { useApi } from '@/hooks/use-api'
import { cn } from '@/lib/utils'

export interface ProdutoEstoqueOpcao {
  id: string
  nome: string
  categoria: string
}

interface Props {
  selecionado: ProdutoEstoqueOpcao | null
  onSelect: (produto: ProdutoEstoqueOpcao) => void
}

/** Lista dos produtos do Estoque (rola) com busca por nome/categoria feita no servidor (até 30 por vez). */
export function ProdutoEstoqueBusca({ selecionado, onSelect }: Props) {
  const api = useApi()
  const [termo, setTermo] = useState('')
  const [lista, setLista] = useState<ProdutoEstoqueOpcao[] | null>(null)
  const [limite, setLimite] = useState(30)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    const espera = setTimeout(
      () => {
        api
          .get<{ data: ProdutoEstoqueOpcao[]; limite: number }>(
            `/api/evolucoes/produtos-estoque?q=${encodeURIComponent(termo)}`,
          )
          .then((r) => {
            if (!ativo) return
            setLista(r.data)
            setLimite(r.limite)
            setErro(null)
          })
          .catch(
            (e) =>
              ativo &&
              setErro(e instanceof Error ? e.message : 'Não foi possível carregar os produtos.'),
          )
      },
      termo ? 250 : 0,
    )
    return () => {
      ativo = false
      clearTimeout(espera)
    }
  }, [api, termo])

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-muted" />
        <Input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Digite para buscar por nome ou categoria..."
          aria-label="Buscar produto no estoque"
          className="h-12 rounded-[12px] border-app-border bg-app-bg-secondary pl-11 dark:border-app-border-dark dark:bg-app-surface-muted"
        />
      </div>
      <div
        role="listbox"
        aria-label="Produtos do estoque"
        className="max-h-56 overflow-y-auto rounded-[12px] border border-app-border custom-scrollbar dark:border-app-border-dark"
      >
        {erro && <p className="p-3 text-sm text-[var(--app-danger-text)]">{erro}</p>}
        {!erro && lista === null && (
          <p className="p-3 text-sm text-app-text-muted">Carregando produtos…</p>
        )}
        {lista?.length === 0 && (
          <p className="p-3 text-sm text-app-text-muted">Nenhum produto encontrado no estoque.</p>
        )}
        {lista?.map((p) => (
          <button
            key={p.id}
            type="button"
            role="option"
            aria-selected={selecionado?.id === p.id}
            onClick={() => onSelect(p)}
            className={cn(
              'flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-app-bg-secondary dark:hover:bg-app-hover',
              selecionado?.id === p.id && 'bg-app-bg-secondary dark:bg-app-hover',
            )}
          >
            <span className="min-w-0 flex-1 break-words text-app-text-primary dark:text-white">
              {p.nome}
            </span>
            <span className="shrink-0 text-xs text-app-text-muted">{p.categoria}</span>
            {selecionado?.id === p.id && <Check className="h-4 w-4 shrink-0 text-app-primary" />}
          </button>
        ))}
      </div>
      {lista && lista.length >= limite && (
        <p className="text-xs text-app-text-muted">
          Mostrando os primeiros {limite}. Digite para refinar a busca.
        </p>
      )}
    </div>
  )
}
