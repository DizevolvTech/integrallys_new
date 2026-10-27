'use client'

import { CheckCircle2, CreditCard, ListChecks, Lock, LockOpen, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { CartaoEmpresarial } from '../hooks/use-cartoes-empresariais'
import { formatCurrency, formatDiaMes } from '../formato'

interface Props {
  cartao: CartaoEmpresarial
  contaNome: string | null
  pagando: boolean
  onNovaCompra: () => void
  onVerFaturas: () => void
  onPagar: () => void
}

function Rotulo({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-xs text-app-text-secondary dark:text-white/60 ${className}`}>{children}</p>
}

export function CartaoCard({ cartao, contaNome, pagando, onNovaCompra, onVerFaturas, onPagar }: Props) {
  const utilizacao = cartao.limiteTotal > 0 ? Math.min(100, Math.round((cartao.limiteUtilizado / cartao.limiteTotal) * 100)) : 0
  const fatura = cartao.faturaAtual
  const fechada = fatura?.status === 'fechada'
  const podePagar = fechada && (fatura?.total ?? 0) > 0

  return (
    <Card className="rounded-[24px] border-app-border/60 shadow-sm dark:border-app-border-dark">
      <CardContent className="space-y-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="rounded-2xl bg-[color:var(--app-info-bg)] p-2.5 text-[color:var(--app-info-text)]">
              <CreditCard className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="line-clamp-2 text-base font-medium leading-tight text-app-text-primary dark:text-white">{cartao.nome}</p>
              <p className="text-xs text-app-text-muted">
                {cartao.bandeira ?? 'Bandeira não informada'}
                {cartao.ultimosDigitos ? ` · •••• ${cartao.ultimosDigitos}` : ''}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button type="button" variant="ghost" size="icon" onClick={onNovaCompra} aria-label={`Nova compra no cartão ${cartao.nome}`} title="Nova compra">
              <Plus className="h-5 w-5" />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={onVerFaturas} aria-label={`Lançamentos e faturas futuras do cartão ${cartao.nome}`} title="Lançamentos e faturas futuras">
              <ListChecks className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <Rotulo>Limite</Rotulo>
            <p className="tabular-nums text-app-text-primary dark:text-white">{formatCurrency(cartao.limiteTotal)}</p>
          </div>
          <div className="text-center">
            <Rotulo>Em aberto</Rotulo>
            <p className="tabular-nums text-app-text-primary dark:text-white">{formatCurrency(cartao.limiteUtilizado)}</p>
          </div>
          <div className="text-right">
            <Rotulo>Limite disp.</Rotulo>
            <p className="tabular-nums text-app-text-primary dark:text-white">{formatCurrency(cartao.limiteDisponivel)}</p>
          </div>
        </div>

        <div
          role="progressbar"
          aria-valuenow={utilizacao}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Limite utilizado"
          className="relative h-5 overflow-hidden rounded-full bg-app-bg-secondary dark:bg-app-hover"
        >
          <div
            className={`h-full rounded-full ${utilizacao >= 90 ? 'bg-[color:var(--app-danger-text)]' : 'bg-[color:var(--app-success-text)]'}`}
            style={{ width: `${utilizacao}%` }}
          />
          <span className="absolute inset-y-0 right-2 flex items-center text-[11px] tabular-nums text-app-text-secondary">{utilizacao}%</span>
        </div>

        <div className="grid grid-cols-3 gap-2 border-t border-dotted border-app-border pt-4 text-sm dark:border-app-border-dark">
          <div className="min-w-0">
            <Rotulo>Conta</Rotulo>
            <p className="truncate text-app-text-primary dark:text-white">{contaNome ?? '—'}</p>
          </div>
          <div className="text-center">
            <Rotulo>Fechamento</Rotulo>
            <p className="text-app-text-primary dark:text-white">{formatDiaMes(fatura?.fechamento ?? null)}</p>
          </div>
          <div className="text-right">
            <Rotulo>Vencimento</Rotulo>
            <p className="text-app-text-primary dark:text-white">{formatDiaMes(fatura?.vencimento ?? null)}</p>
          </div>
        </div>

        <div className="flex items-baseline justify-between gap-3 border-t border-dotted border-app-border pt-4 dark:border-app-border-dark">
          <span className="text-base text-app-text-secondary dark:text-white/70">{fechada ? 'Fatura' : 'Fatura parcial'}</span>
          <span className={`text-xl font-medium tabular-nums ${fechada && podePagar ? 'text-[color:var(--app-danger-text)]' : 'text-app-text-primary dark:text-white'}`}>
            {formatCurrency(fatura?.total ?? 0)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white ${fechada ? 'bg-[color:var(--app-danger-text)]' : 'bg-[color:var(--app-info-text)]'}`}
          >
            {fechada ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
            {fechada ? 'Fechada' : 'Aberta'}
          </span>
          <Button
            type="button"
            variant="ghost"
            disabled={!podePagar || pagando}
            onClick={onPagar}
            className="h-9 shrink-0 gap-1.5 whitespace-nowrap px-2 text-sm text-[color:var(--app-info-text)]"
          >
            <CheckCircle2 className="h-4 w-4" />
            {pagando ? 'Registrando...' : 'Registrar pagamento'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
