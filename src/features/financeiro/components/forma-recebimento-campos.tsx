'use client'

import { BANDEIRAS_CARTAO, FORMAS_RECEBIMENTO_CAIXA, isFormaCartao } from '@/features/caixa/caixa-format'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { parseCurrencyInput } from '../financeiro.utils'

interface Props {
  forma: string
  bandeira: string
  parcelas: string
  valor: string
  onChange: (patch: { forma?: string; bandeira?: string; parcelas?: string }) => void
}

/** Forma do recebimento; em débito/crédito pede a bandeira e, no crédito, as parcelas. */
export function FormaRecebimentoCampos({ forma, bandeira, parcelas, valor, onChange }: Props) {
  const cartao = isFormaCartao(forma)
  const credito = forma === 'cartao_credito'
  const total = parseCurrencyInput(valor)
  const quantidade = Number(parcelas) || 1

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Label>Forma de recebimento</Label>
        <Select
          value={forma}
          onValueChange={(value) => onChange({ forma: value, bandeira: '', parcelas: '1' })}
        >
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORMAS_RECEBIMENTO_CAIXA.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {cartao && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <Label>Bandeira</Label>
            <Select value={bandeira || 'nenhuma'} onValueChange={(value) => onChange({ bandeira: value === 'nenhuma' ? '' : value })}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma" disabled>
                  Selecione a bandeira
                </SelectItem>
                {BANDEIRAS_CARTAO.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {credito && (
            <div className="space-y-3">
              <Label>Parcelas</Label>
              <Select value={parcelas} onValueChange={(value) => onChange({ parcelas: value })}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n === 1 ? 'À vista (1x)' : `${n}x`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
      {credito && quantidade > 1 && total > 0 && (
        <p className="text-xs text-app-text-secondary dark:text-white/60">
          {quantidade}× de {(total / quantidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>
      )}
    </div>
  )
}
