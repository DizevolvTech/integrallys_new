'use client'

import { Banknote, CreditCard, Package, QrCode } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useContasPix } from '@/features/gestao-bancaria/hooks/use-contas-pix'
import { BANDEIRAS_VENDA } from '@/lib/bandeiras-cartao'
import { formatarMoeda } from '@/lib/moeda'

export interface PagamentoVendaEstado {
  forma: string
  parcelas: number
  bandeira: string
  contaBancariaId: string
}

export const PAGAMENTO_VENDA_VAZIO: PagamentoVendaEstado = { forma: '', parcelas: 1, bandeira: '', contaBancariaId: '' }

const FORMAS = [
  { id: 'dinheiro', label: 'Dinheiro', icon: Banknote },
  { id: 'pix', label: 'PIX', icon: QrCode },
  { id: 'cartao_credito', label: 'Crédito', icon: CreditCard },
  { id: 'cartao_debito', label: 'Débito', icon: CreditCard },
  { id: 'consumo', label: 'Consumo', icon: Package },
]

const GATILHO = 'h-11 rounded-xl bg-white dark:bg-app-hover border-app-border dark:border-app-border-dark'

interface PagamentoVendaFieldsProps {
  value: PagamentoVendaEstado
  onChange: (proximo: PagamentoVendaEstado) => void
  /** Total a pagar, para mostrar o valor de cada parcela no crédito. */
  total: number
  /** Taxa da operadora (%) da quantidade de parcelas escolhida. */
  taxaParcelas?: number
  /** Texto abaixo do campo da forma (ex.: "Opcional — salva como ativa"). */
  dica?: string
}

/**
 * Forma de pagamento da venda e seus dados: crédito (parcelas + bandeira), débito (bandeira), PIX (conta do PIX).
 * Usado na nova venda e na conversão de uma prescrição ativa em venda.
 */
export function PagamentoVendaFields({ value, onChange, total, taxaParcelas = 0, dica }: PagamentoVendaFieldsProps) {
  const { data: contasPix } = useContasPix()
  const credito = value.forma === 'cartao_credito'
  const cartao = credito || value.forma === 'cartao_debito'
  const valorParcela = credito && value.parcelas > 0 ? total / value.parcelas : 0

  const escolherForma = (id: string) => {
    const forma = id === value.forma ? '' : id
    onChange({ ...value, forma, parcelas: forma === 'cartao_credito' ? value.parcelas : 1 })
  }

  return (
    <div className="space-y-3">
      <Label className="text-sm font-semibold text-app-text-primary dark:text-white/70">
        Forma de Pagamento
        {dica && <span className="ml-2 text-xs font-normal text-app-text-muted">{dica}</span>}
      </Label>
      <div className="grid grid-cols-3 gap-2">
        {FORMAS.map((metodo) => (
          <button
            key={metodo.id}
            type="button"
            onClick={() => escolherForma(metodo.id)}
            aria-pressed={value.forma === metodo.id}
            className={`h-14 rounded-xl border-2 text-xs font-semibold transition-all flex flex-col items-center justify-center gap-0.5 ${
              value.forma === metodo.id
                ? 'border-[var(--app-primary)] app-status-info dark:bg-transparent text-app-primary dark:text-[var(--app-info-text)] shadow-md ring-1 ring-[#0039A6]/20'
                : 'border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark text-app-text-secondary hover:border-app-hover-strong dark:hover:border-app-hover-strong hover:bg-app-hover dark:hover:bg-app-hover'
            }`}
          >
            <metodo.icon className={`h-4 w-4 ${value.forma === metodo.id ? 'text-app-primary dark:text-[var(--app-info-text)]' : 'text-app-text-muted'}`} />
            <span>{metodo.label}</span>
          </button>
        ))}
      </div>

      {credito && (
        <div className="space-y-2 pt-1">
          <Label className="text-sm font-medium text-app-text-secondary dark:text-white/60">Quantidade de parcelas</Label>
          <Select value={String(value.parcelas)} onValueChange={(v) => onChange({ ...value, parcelas: Number(v) })}>
            <SelectTrigger className={GATILHO}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, idx) => idx + 1).map((parcela) => (
                <SelectItem key={parcela} value={String(parcela)}>{`1/${parcela}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {total > 0 && (
            <p className="text-xs text-app-text-secondary dark:text-white/60">
              {value.parcelas}x de <span className="font-semibold text-app-text-primary dark:text-white">{formatarMoeda(valorParcela)}</span>
              {taxaParcelas > 0 && (
                <span className="ml-1 text-app-text-muted">(taxa da operadora {taxaParcelas.toFixed(2).replace('.', ',')}%)</span>
              )}
            </p>
          )}
        </div>
      )}

      {cartao && (
        <div className="space-y-2 pt-1">
          <Label className="text-sm font-medium text-app-text-secondary dark:text-white/60">
            Bandeira <span className="text-[var(--app-danger-text)]">*</span>
          </Label>
          <Select value={value.bandeira} onValueChange={(v) => onChange({ ...value, bandeira: v })}>
            <SelectTrigger className={GATILHO} aria-label="Bandeira">
              <SelectValue preferPlaceholder placeholder="Selecione a bandeira" />
            </SelectTrigger>
            <SelectContent>
              {BANDEIRAS_VENDA.map((bandeira) => (
                <SelectItem key={bandeira} value={bandeira}>{bandeira}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {value.forma === 'pix' && (
        <div className="space-y-2 pt-1">
          <Label className="text-sm font-medium text-app-text-secondary dark:text-white/60">
            Conta do PIX <span className="text-[var(--app-danger-text)]">*</span>
          </Label>
          <Select value={value.contaBancariaId} onValueChange={(v) => onChange({ ...value, contaBancariaId: v })}>
            <SelectTrigger className={GATILHO} aria-label="Conta do PIX">
              <SelectValue preferPlaceholder placeholder="Selecione a conta que recebeu" />
            </SelectTrigger>
            <SelectContent>
              {contasPix.map((conta) => (
                <SelectItem key={conta.id} value={conta.id}>
                  {conta.nome}
                  {conta.banco ? ` · ${conta.banco}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
