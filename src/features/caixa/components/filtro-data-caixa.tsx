'use client'

import { CalendarDays } from 'lucide-react'
import { useState } from 'react'
import { DateInput } from '@/components/shared/date-input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { diaValido, hojeClinicaChave, somarDias } from '../periodo-caixa'

export interface PeriodoEscolhido {
  de: string
  ate: string
}

interface FiltroDataCaixaProps {
  periodo: PeriodoEscolhido
  onChange: (periodo: PeriodoEscolhido) => void
}

/** Seletor de data do caixa: atalhos Hoje/Ontem, um dia específico ou intervalo De/Até (nunca depois de hoje). */
export function FiltroDataCaixa({ periodo, onChange }: FiltroDataCaixaProps) {
  const hoje = hojeClinicaChave()
  const ontem = somarDias(hoje, -1)
  const [intervalo, setIntervalo] = useState(periodo.de !== periodo.ate)
  const [aviso, setAviso] = useState<string | null>(null)

  const escolher = (de: string, ate: string) => {
    if (!diaValido(de) || !diaValido(ate)) return
    if (de > hoje || ate > hoje) {
      setAviso('Não há movimentações em datas futuras.')
      return
    }
    if (ate < de) {
      setAviso('A data final não pode ser anterior à inicial.')
      return
    }
    setAviso(null)
    onChange({ de, ate })
  }

  const ehHoje = periodo.de === hoje && periodo.ate === hoje
  const ehOntem = periodo.de === ontem && periodo.ate === ontem

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-app-card p-4 dark:bg-app-card-dark lg:flex-row lg:items-end" data-testid="filtro-data-caixa">
      <div className="flex items-center gap-2 text-sm text-app-text-secondary dark:text-white/70">
        <CalendarDays size={18} />
        <span>Ver caixa de</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={ehHoje ? 'default' : 'outline'}
          className={cn('h-11 rounded-xl', ehHoje && 'bg-app-primary text-white hover:bg-app-primary-hover')}
          aria-pressed={ehHoje}
          onClick={() => {
            setIntervalo(false)
            escolher(hoje, hoje)
          }}
        >
          Hoje
        </Button>
        <Button
          type="button"
          variant={ehOntem ? 'default' : 'outline'}
          className={cn('h-11 rounded-xl', ehOntem && 'bg-app-primary text-white hover:bg-app-primary-hover')}
          aria-pressed={ehOntem}
          onClick={() => {
            setIntervalo(false)
            escolher(ontem, ontem)
          }}
        >
          Ontem
        </Button>
      </div>
      {!intervalo ? (
        <div className="w-full space-y-1 sm:w-48">
          <Label className="text-xs">Data</Label>
          <DateInput aria-label="Data do caixa" value={periodo.de} onChange={(valor) => escolher(valor, valor)} />
        </div>
      ) : (
        <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-2">
          <div className="space-y-1 sm:w-44">
            <Label className="text-xs">De</Label>
            <DateInput aria-label="Data inicial" value={periodo.de} onChange={(valor) => escolher(valor, periodo.ate < valor ? valor : periodo.ate)} />
          </div>
          <div className="space-y-1 sm:w-44">
            <Label className="text-xs">Até</Label>
            <DateInput aria-label="Data final" value={periodo.ate} onChange={(valor) => escolher(periodo.de > valor ? valor : periodo.de, valor)} />
          </div>
        </div>
      )}
      <Button
        type="button"
        variant="ghost"
        className="h-11 rounded-xl text-sm"
        onClick={() => {
          if (intervalo) escolher(periodo.de, periodo.de)
          setIntervalo(!intervalo)
        }}
      >
        {intervalo ? 'Um dia só' : 'Escolher intervalo'}
      </Button>
      {aviso && (
        <p className="text-xs text-[var(--app-danger-text)]" role="alert">
          {aviso}
        </p>
      )}
    </div>
  )
}
