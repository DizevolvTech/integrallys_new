'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useSuprimentos } from '../hooks/use-suprimentos'

export type SuprimentoDoProcedimento = { suprimentoId: string; quantidade: number }

interface Props {
  baixa: boolean
  itens: SuprimentoDoProcedimento[]
  disabled?: boolean
  onChange: (next: { baixa: boolean; itens: SuprimentoDoProcedimento[] }) => void
}

/** No cadastro de procedimento: baixa automática de suprimentos (quais e quantos) quando o pagamento for efetuado. */
export function ProcedimentoSuprimentosField({ baixa, itens, disabled, onChange }: Props) {
  const { data: suprimentos } = useSuprimentos()
  const livres = suprimentos.filter((s) => !itens.some((i) => i.suprimentoId === s.id))

  return (
    <div className="rounded-2xl border border-app-border px-4 py-3 dark:border-app-border-dark space-y-3" data-testid="procedimento-suprimentos">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-normal text-app-text-primary dark:text-white">Baixar suprimentos ao pagar</p>
          <p className="text-sm text-app-text-secondary dark:text-white/60 font-normal">
            Quando o pagamento do procedimento for efetuado, os suprimentos abaixo saem do estoque automaticamente (uma única vez por atendimento).
          </p>
        </div>
        <Switch checked={baixa} disabled={disabled} onCheckedChange={(v) => onChange({ baixa: v, itens })} aria-label="Baixar suprimentos ao pagar" />
      </div>

      {baixa && (
        <div className="space-y-2">
          {itens.map((item, index) => (
            <div key={item.suprimentoId} className="flex items-center gap-2">
              <span className="flex-1 min-w-0 truncate text-sm">{suprimentos.find((s) => s.id === item.suprimentoId)?.nome ?? 'Suprimento removido'}</span>
              <Input
                type="number"
                min={1}
                value={item.quantidade}
                disabled={disabled}
                aria-label="Quantidade a baixar"
                className="w-24"
                onChange={(e) => onChange({ baixa, itens: itens.map((x, i) => (i === index ? { ...x, quantidade: Math.max(1, Number(e.target.value) || 1) } : x)) })}
              />
              {!disabled && (
                <Button type="button" variant="ghost" size="icon" aria-label="Remover suprimento" onClick={() => onChange({ baixa, itens: itens.filter((_, i) => i !== index) })}>
                  <Trash2 className="h-4 w-4 text-[var(--app-danger-text)]" />
                </Button>
              )}
            </div>
          ))}
          {!disabled && (
            <Select value="" onValueChange={(id) => onChange({ baixa, itens: [...itens, { suprimentoId: id, quantidade: 1 }] })}>
              <SelectTrigger aria-label="Adicionar suprimento" className="h-10">
                <Plus className="h-4 w-4 mr-2" />
                <SelectValue preferPlaceholder placeholder={livres.length ? 'Adicionar suprimento' : suprimentos.length ? 'Todos os suprimentos já adicionados' : 'Cadastre suprimentos em Estoque > Suprimentos'} />
              </SelectTrigger>
              <SelectContent>
                {livres.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </div>
  )
}
