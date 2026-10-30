'use client'

import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { TarefaCategoria } from '@/hooks/use-tarefa-categorias'

const SEM_CATEGORIA = '__none__'

interface CategoriaTarefaFieldProps {
  value: string
  categorias: TarefaCategoria[]
  onChange: (value: string) => void
  onGerenciar: () => void
  triggerClassName?: string
}

/** Select de categorias cadastradas. Valor antigo (texto livre/desativada) continua visível na tarefa. */
export function CategoriaTarefaField({ value, categorias, onChange, onGerenciar, triggerClassName }: CategoriaTarefaFieldProps) {
  const legado = value && !categorias.some((categoria) => categoria.nome === value) ? value : null
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Categoria / tag</Label>
        <button type="button" className="text-xs text-app-primary underline" onClick={onGerenciar}>
          Gerenciar categorias
        </button>
      </div>
      <Select value={value || SEM_CATEGORIA} onValueChange={(next) => onChange(next === SEM_CATEGORIA ? '' : next)}>
        <SelectTrigger className={triggerClassName} aria-label="Categoria / tag">
          <SelectValue placeholder="Selecione a categoria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SEM_CATEGORIA}>Sem categoria</SelectItem>
          {legado && <SelectItem value={legado}>{legado}</SelectItem>}
          {categorias.map((categoria) => (
            <SelectItem key={categoria.id} value={categoria.nome}>
              {categoria.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
