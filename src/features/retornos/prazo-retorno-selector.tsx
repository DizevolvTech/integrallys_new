'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { calcularPrazoRetorno, PRAZOS_RETORNO } from '@/lib/retorno-prazo'

export interface PrazoRetornoEscolhido {
  tipo: string
  dias?: number
}

/** Valor do seletor: `tipo` é um id de PRAZOS_RETORNO; `customDias` só vale para "custom". */
export interface PrazoRetornoValor {
  tipo: string
  customDias: string
}

export const PRAZO_RETORNO_INICIAL: PrazoRetornoValor = { tipo: '30', customDias: '' }

/** Converte o valor do seletor no payload da API; null + mensagem quando o personalizado é inválido. */
export function prazoEscolhido(valor: PrazoRetornoValor): PrazoRetornoEscolhido | { erro: string } {
  if (valor.tipo !== 'custom') return { tipo: valor.tipo }
  const dias = Number(valor.customDias)
  if (!Number.isInteger(dias) || dias <= 0) return { erro: 'Informe um prazo válido em dias.' }
  return { tipo: 'custom', dias }
}

/** Texto "Retorno previsto para dd/mm/aaaa" (ou "Retorno liberado…") para o prazo escolhido a partir de `dataBaseIso`. */
export function resumoPrazoRetorno(valor: PrazoRetornoValor, dataBaseIso: string): string {
  const escolhido = prazoEscolhido(valor)
  if ('erro' in escolhido) return 'Informe o prazo personalizado em dias.'
  const calculo = calcularPrazoRetorno(escolhido.tipo, dataBaseIso, escolhido.dias)
  if (!calculo.ok) return calculo.message
  if (!calculo.dataPrevista) return 'Retorno liberado, sem data prevista.'
  const [ano, mes, dia] = calculo.dataPrevista.split('-')
  return `Retorno previsto para ${dia}/${mes}/${ano}.`
}

interface PrazoRetornoSelectorProps {
  value: PrazoRetornoValor
  onChange: (value: PrazoRetornoValor) => void
  idPrefix?: string
}

/** Escolha do prazo de retorno (30/60/90/120 dias, 6 meses, liberado, personalizado em dias). */
export function PrazoRetornoSelector({ value, onChange, idPrefix = 'prazo-retorno' }: PrazoRetornoSelectorProps) {
  return (
    <div className="space-y-3">
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Prazo de retorno</legend>
        {PRAZOS_RETORNO.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={value.tipo === item.id}
            onClick={() => onChange({ ...value, tipo: item.id })}
            className={`px-3 py-1.5 rounded-full text-xs font-normal border transition-all ${
              value.tipo === item.id
                ? 'bg-app-primary border-[var(--app-primary)] text-white'
                : 'border-app-border text-app-text-secondary hover:border-[var(--app-primary)]/40 hover:text-[var(--app-primary)]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </fieldset>
      {value.tipo === 'custom' && (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-dias`} className="text-xs font-normal text-app-text-muted uppercase tracking-wider">
            Informe o prazo em dias
          </Label>
          <Input
            id={`${idPrefix}-dias`}
            inputMode="numeric"
            value={value.customDias}
            onChange={(e) => onChange({ ...value, customDias: e.target.value.replace(/[^\d]/g, '') })}
            placeholder="Ex: 45"
            className="h-11 rounded-integrallys bg-app-bg-secondary/50 dark:bg-app-card-dark/50 border-app-border dark:border-app-border-dark"
          />
        </div>
      )}
    </div>
  )
}
