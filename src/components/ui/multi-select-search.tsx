'use client'

import { Check, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Input } from '@/components/ui/input'

export interface MultiSelectOption {
  value: string
  label: string
  /** Texto de apoio (ex.: perfil do usuário). */
  hint?: string
}

interface MultiSelectSearchProps {
  options: MultiSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  emptyText?: string
  disabled?: boolean
}

const normalizar = (texto: string) =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

/** Lista pesquisável com seleção múltipla (chips dos escolhidos + lista rolável com busca). */
export function MultiSelectSearch({
  options,
  value,
  onChange,
  placeholder = 'Buscar...',
  emptyText = 'Nenhum resultado.',
  disabled,
}: MultiSelectSearchProps) {
  const [busca, setBusca] = useState('')
  const selecionados = useMemo(() => new Set(value), [value])
  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim())
    return termo ? options.filter((o) => normalizar(`${o.label} ${o.hint ?? ''}`).includes(termo)) : options
  }, [options, busca])

  const alternar = (id: string) =>
    onChange(selecionados.has(id) ? value.filter((v) => v !== id) : [...value, id])

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((id) => {
            const opcao = options.find((o) => o.value === id)
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full bg-app-primary/10 px-3 py-1 text-xs text-app-primary"
              >
                {opcao?.label ?? id}
                <button
                  type="button"
                  aria-label={`Remover ${opcao?.label ?? 'participante'}`}
                  disabled={disabled}
                  onClick={() => alternar(id)}
                  className="rounded-full hover:bg-app-primary/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-muted" />
        <Input
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-9"
        />
      </div>
      <ul
        className="max-h-44 overflow-y-auto rounded-[12px] border border-app-border dark:border-app-border-dark"
      >
        {filtradas.length === 0 && <li className="px-3 py-3 text-sm text-app-text-muted">{emptyText}</li>}
        {filtradas.map((opcao) => {
          const marcado = selecionados.has(opcao.value)
          return (
            <li key={opcao.value}>
              <button
                type="button"
                aria-pressed={marcado}
                disabled={disabled}
                onClick={() => alternar(opcao.value)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-app-bg-secondary dark:hover:bg-app-hover"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    marcado ? 'border-app-primary bg-app-primary text-white' : 'border-app-border dark:border-app-border-dark'
                  }`}
                >
                  {marcado && <Check className="h-3 w-3" />}
                </span>
                <span className="flex-1 truncate text-app-text-primary dark:text-white">{opcao.label}</span>
                {opcao.hint && <span className="text-xs text-app-text-muted">{opcao.hint}</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
