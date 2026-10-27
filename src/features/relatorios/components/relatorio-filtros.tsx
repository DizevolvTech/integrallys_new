'use client'

import { Search } from 'lucide-react'
import { DateInput } from '@/components/shared/date-input'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { OpcaoFiltro, FonteOpcoes } from '@/features/relatorios/hooks/use-opcoes-filtro'
import type { FiltroRelatorio } from '@/features/relatorios/relatorio-config'

interface Props {
  filtros: FiltroRelatorio[]
  valores: Record<string, string>
  onChange: (key: string, valor: string) => void
  opcoes: Record<FonteOpcoes, OpcaoFiltro[]>
  proprio: boolean
}

const CAMPO = 'h-10 rounded-xl border-app-border dark:border-app-border-dark bg-app-bg-secondary/30 dark:bg-app-hover'

export function RelatorioFiltros({ filtros, valores, onChange, opcoes, proprio }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {filtros
        .filter((f) => !(proprio && f.ocultarSeProprio))
        .map((filtro) => {
          const valor = valores[filtro.key] ?? ''
          return (
            <div key={filtro.key} className="space-y-1.5">
              <label
                htmlFor={`filtro-${filtro.key}`}
                className="text-xs font-normal text-app-text-secondary dark:text-white/60"
              >
                {filtro.label}
              </label>
              {filtro.tipo === 'busca' && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-muted" />
                  <Input id={`filtro-${filtro.key}`} value={valor} onChange={(e) => onChange(filtro.key, e.target.value)} className={`${CAMPO} pl-9`} />
                </div>
              )}
              {filtro.tipo === 'texto' && (
                <Input id={`filtro-${filtro.key}`} value={valor} onChange={(e) => onChange(filtro.key, e.target.value)} className={CAMPO} />
              )}
              {filtro.tipo === 'data' && (
                <DateInput id={`filtro-${filtro.key}`} value={valor} onChange={(v) => onChange(filtro.key, v)} className="h-10" />
              )}
              {filtro.tipo === 'select' && (
                <Select value={valor || 'todos'} onValueChange={(v) => onChange(filtro.key, v)}>
                  <SelectTrigger id={`filtro-${filtro.key}`} className={CAMPO}>
                    <SelectValue preferPlaceholder placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    {filtro.opcoes ? null : <SelectItem value="todos">Todos</SelectItem>}
                    {(filtro.opcoes ?? (filtro.fonte ? opcoes[filtro.fonte] : [])).map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )
        })}
    </div>
  )
}
