'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { useApi } from '@/hooks/use-api'
import type { SecaoCampoTexto } from '@/lib/documentos'

const CAMPO =
  'h-11 w-full bg-app-bg-secondary border border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-xl'

let cacheProfissionais: Promise<string[]> | null = null

/** Nomes dos especialistas ativos da unidade (uma chamada por tela; reaproveitada entre documentos). */
function useNomesProfissionais(ativo: boolean): string[] {
  const api = useApi()
  const [nomes, setNomes] = useState<string[]>([])
  useEffect(() => {
    if (!ativo) return
    let vivo = true
    cacheProfissionais ??= api
      .get<{ data: { nome: string }[] }>('/api/documentos/profissionais')
      .then((res) => (res.data ?? []).map((p) => p.nome))
      .catch(() => {
        cacheProfissionais = null
        return []
      })
    cacheProfissionais.then((lista) => vivo && setNomes(lista))
    return () => {
      vivo = false
    }
  }, [api, ativo])
  return nomes
}

/** Lista na ordem de exibição: respostas prontas, profissionais e o valor atual (se veio de outro lugar). */
export function opcoesDoCampo(
  secao: SecaoCampoTexto,
  profissionais: string[],
  valorAtual: string,
): string[] {
  const lista = [...(secao.opcoes ?? []), ...(secao.opcoes_profissionais ? profissionais : [])].map(
    (o) => o.trim(),
  )
  if (valorAtual && !lista.includes(valorAtual)) lista.push(valorAtual)
  return Array.from(new Set(lista.filter((o) => o.trim())))
}

interface Props {
  secao: SecaoCampoTexto
  valor: string
  disabled?: boolean
  onChange: (valor: string) => void
}

/**
 * Campo de texto com respostas prontas. Com `opcoes_profissionais`, vira uma lista (profissionais da clínica
 * + opções como "À escolha do paciente"); só com `opcoes`, texto livre com botões que preenchem.
 */
export function CampoTextoOpcoes({ secao, valor, disabled, onChange }: Props) {
  const profissionais = useNomesProfissionais(!!secao.opcoes_profissionais)

  if (secao.opcoes_profissionais) {
    const opcoes = opcoesDoCampo(secao, profissionais, valor)
    return (
      <select
        aria-label={secao.label}
        value={valor}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${CAMPO} px-3 text-sm text-app-text-primary dark:text-white`}
      >
        <option value="">Selecione…</option>
        {opcoes.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    )
  }

  return (
    <div className="space-y-2">
      <Input
        value={valor}
        placeholder={secao.placeholder}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={CAMPO}
      />
      <div className="flex flex-wrap gap-2">
        {opcoesDoCampo({ ...secao, opcoes_profissionais: false }, [], '').map((o) => (
          <button
            key={o}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o)}
            aria-pressed={valor === o}
            className={`min-h-9 rounded-full border px-3 py-1 text-xs transition-colors ${
              valor === o
                ? 'border-app-primary bg-app-primary text-white'
                : 'border-app-border dark:border-app-border-dark text-app-text-secondary dark:text-white/70 hover:bg-app-bg-secondary'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}
