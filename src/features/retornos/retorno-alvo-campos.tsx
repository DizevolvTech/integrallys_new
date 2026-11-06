'use client'

import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { RetornoAlvo, RetornoOpcoes } from './hooks/use-retorno-alvo'

const NENHUM = 'nenhum'

interface RetornoAlvoCamposProps {
  opcoes: RetornoOpcoes | null
  value: RetornoAlvo
  onChange: (value: RetornoAlvo) => void
  idPrefix?: string
  erro?: string
}

/** Campos "Especialista do retorno" e "Procedimento do retorno" (profissionais e procedimentos ativos). */
export function RetornoAlvoCampos({ opcoes, value, onChange, idPrefix = 'retorno-alvo', erro }: RetornoAlvoCamposProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-especialista`} className="text-xs font-normal uppercase tracking-wider text-app-text-muted">
          Especialista do retorno
        </Label>
        <Select
          value={value.especialistaId || NENHUM}
          onValueChange={(v) => onChange({ ...value, especialistaId: v === NENHUM ? '' : v })}
          disabled={!opcoes}
        >
          <SelectTrigger id={`${idPrefix}-especialista`} aria-label="Especialista do retorno">
            <SelectValue placeholder={opcoes ? 'Selecione' : 'Carregando…'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NENHUM}>Não informado</SelectItem>
            {(opcoes?.profissionais ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-procedimento`} className="text-xs font-normal uppercase tracking-wider text-app-text-muted">
          Procedimento do retorno
        </Label>
        <Select
          value={value.procedimentoId || NENHUM}
          onValueChange={(v) => onChange({ ...value, procedimentoId: v === NENHUM ? '' : v })}
          disabled={!opcoes}
        >
          <SelectTrigger id={`${idPrefix}-procedimento`} aria-label="Procedimento do retorno">
            <SelectValue placeholder={opcoes ? 'Selecione' : 'Carregando…'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NENHUM}>Não informado</SelectItem>
            {(opcoes?.procedimentos ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {erro && <p className="text-xs text-[var(--app-danger-text)]">{erro}</p>}
    </div>
  )
}
