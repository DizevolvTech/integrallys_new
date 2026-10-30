'use client'

import { Check, ChevronDown, Search } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { filtrarOpcoes, type OpcaoBusca } from '@/lib/busca-opcoes'
import { cn } from '@/lib/utils'

export interface ComboboxAcao {
  label: string
  onSelect: () => void
}

interface ComboboxProps {
  id?: string
  value: string
  onChange: (value: string) => void
  options: OpcaoBusca[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  /** Ação fixa no fim da lista (ex.: "Cadastrar novo fornecedor"). Aparece também sem resultados. */
  footerAction?: ComboboxAcao
  className?: string
}

/**
 * Seleção pesquisável: abre uma lista com campo de busca (digitar filtra pelo nome, sem acento).
 * A lista fica no fluxo da página (não flutua), então funciona dentro de modal com rolagem e no celular.
 */
export function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder = 'Selecione',
  searchPlaceholder = 'Digite para pesquisar...',
  emptyText = 'Nenhum resultado',
  disabled,
  footerAction,
  className,
}: ComboboxProps) {
  const listId = useId()
  const [aberto, setAberto] = useState(false)
  const [termo, setTermo] = useState('')
  const [ativo, setAtivo] = useState(0)
  const raiz = useRef<HTMLDivElement>(null)
  const busca = useRef<HTMLInputElement>(null)
  const painel = useRef<HTMLDivElement>(null)

  const filtradas = useMemo(() => filtrarOpcoes(options, termo), [options, termo])
  const selecionada = options.find((o) => o.value === value)

  useEffect(() => {
    if (!aberto) return
    busca.current?.focus({ preventScroll: true })
    // No celular o painel abre abaixo da dobra do modal: rola até ele ficar inteiro à vista.
    painel.current?.scrollIntoView({ block: 'nearest' })
    const fora = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  const fechar = () => {
    setAberto(false)
    setTermo('')
  }
  const escolher = (valor: string) => {
    onChange(valor)
    fechar()
  }
  const acionarRodape = () => {
    fechar()
    footerAction?.onSelect()
  }

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAtivo((i) => Math.min(i + 1, filtradas.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAtivo((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtradas[ativo]) escolher(filtradas[ativo].value)
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      fechar()
    }
  }

  return (
    <div ref={raiz} className={cn('relative', className)}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={aberto}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => setAberto((a) => !a)}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-app-border bg-transparent px-3 text-left text-sm disabled:opacity-50 dark:border-app-border-dark"
      >
        <span className={cn('truncate', !selecionada && 'text-app-text-muted')}>{selecionada?.label ?? placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-app-text-muted" aria-hidden="true" />
      </button>
      {aberto && (
        <div ref={painel} className="mt-1 overflow-hidden rounded-xl border border-app-border bg-app-card shadow-md dark:border-app-border-dark dark:bg-app-card-dark">
          <div className="relative border-b border-app-border dark:border-app-border-dark">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-muted" aria-hidden="true" />
            <input
              ref={busca}
              value={termo}
              onChange={(e) => {
                setTermo(e.target.value)
                setAtivo(0)
              }}
              onKeyDown={teclas}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              autoComplete="off"
              className="h-10 w-full bg-transparent pl-9 pr-3 text-sm outline-none"
            />
          </div>
          <div id={listId} role="listbox" className="max-h-56 overflow-y-auto py-1">
            {filtradas.length === 0 && <p className="px-3 py-2 text-sm text-app-text-muted">{emptyText}</p>}
            {filtradas.map((opcao, i) => (
              <div
                key={opcao.value}
                role="option"
                tabIndex={-1}
                aria-selected={opcao.value === value}
                onMouseEnter={() => setAtivo(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  escolher(opcao.value)
                }}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm',
                  i === ativo && 'bg-app-bg-secondary dark:bg-app-hover',
                )}
              >
                <span className="min-w-0 truncate">
                  {opcao.label}
                  {opcao.hint && <span className="ml-2 text-xs text-app-text-muted">{opcao.hint}</span>}
                </span>
                {opcao.value === value && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
              </div>
            ))}
          </div>
          {footerAction && (
            <button
              type="button"
              onClick={acionarRodape}
              className="w-full border-t border-app-border px-3 py-2.5 text-left text-sm font-medium text-app-primary hover:bg-app-bg-secondary dark:border-app-border-dark dark:hover:bg-app-hover"
            >
              + {footerAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
