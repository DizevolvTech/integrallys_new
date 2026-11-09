'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { hojeIso } from '@/features/relatorios/format'
import { moverDia } from './filtro-data-setas.utils'

interface FiltroDataSetasProps {
  /** Data (aaaa-mm-dd) filtrada; null = todas as datas. */
  valor: string | null
  onChange: (valor: string | null) => void
}

/** Filtro por data com seta para trás, a data e seta para frente; "Todas as datas" tira o filtro. */
export function FiltroDataSetas({ valor, onChange }: FiltroDataSetasProps) {
  const hoje = hojeIso()
  const botao = 'h-12 w-10 shrink-0 rounded-integrallys-lg border-app-border dark:border-app-border-dark'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="icon" className={botao} aria-label="Dia anterior" onClick={() => onChange(moverDia(valor, hoje, -1))}>
        <ChevronLeft size={18} />
      </Button>
      <input
        type="date"
        aria-label="Data da prescrição/venda"
        value={valor ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
        className="h-12 min-w-0 flex-1 rounded-integrallys-lg border border-app-border bg-app-bg-secondary/50 px-3 text-sm dark:border-app-border-dark dark:bg-app-bg-dark sm:flex-none"
      />
      <Button type="button" variant="outline" size="icon" className={botao} aria-label="Próximo dia" onClick={() => onChange(moverDia(valor, hoje, 1))}>
        <ChevronRight size={18} />
      </Button>
      <Button
        type="button"
        variant={valor === null ? 'default' : 'outline'}
        aria-pressed={valor === null}
        className="h-12 rounded-integrallys-lg px-3 font-normal"
        onClick={() => onChange(valor === null ? hoje : null)}
      >
        Todas as datas
      </Button>
    </div>
  )
}
