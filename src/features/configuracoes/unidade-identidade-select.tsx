'use client'

import { useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useUnidades } from '@/hooks/use-unidades'

interface Props {
  value: string | null
  onChange: (unidadeId: string) => void
}

/** Admin/master com mais de uma unidade: escolhe de qual unidade é a identidade que vai nos documentos. */
export function UnidadeIdentidadeSelect({ value, onChange }: Props) {
  const { data: unidades, isLoading } = useUnidades()
  // Abre já com a primeira unidade, para a tela não vir com os campos vazios (a pessoa troca se quiser).
  const primeira = unidades[0]?.id
  useEffect(() => {
    if (!value && primeira) onChange(primeira)
  }, [value, primeira, onChange])
  return (
    <div className="space-y-2 max-w-md">
      <label
        htmlFor="identidade-unidade"
        className="text-sm font-normal text-app-text-primary dark:text-white/70 ml-1"
      >
        Unidade
      </label>
      <Select value={value ?? undefined} onValueChange={onChange} disabled={isLoading}>
        <SelectTrigger
          id="identidade-unidade"
          className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl"
        >
          <SelectValue placeholder={isLoading ? 'Carregando unidades…' : 'Escolha a unidade'} />
        </SelectTrigger>
        <SelectContent>
          {unidades.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-app-text-muted">
        Há mais de uma unidade: escolha qual nome, cidade e logotipo você quer ver e alterar.
      </p>
    </div>
  )
}
