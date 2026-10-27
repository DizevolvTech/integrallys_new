import { calcularMargem, formatarMargem } from '@/lib/margem'
import { formatValidade, getValidadeStatus } from '../estoque-validade'
import type { EstoqueItem } from '../hooks/use-estoque'

const reais = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Lote, validade, custo, venda e margem (R$ e %) do produto — visível no desktop e no celular. */
export function EstoqueIndicadores({ item, className }: { item: EstoqueItem; className: string }) {
  const validade = getValidadeStatus(item.validade)
  const margem = calcularMargem(item.precoCusto, item.precoVenda)
  return (
    <div className={className} data-testid="estoque-indicadores">
      {item.lote && <span>Lote: {item.lote}</span>}
      {item.validade && (
        <span
          className={
            validade === 'vencida'
              ? 'app-status-danger px-2 py-0.5 rounded-md text-[var(--app-danger-text)] font-medium'
              : validade === 'proxima'
                ? 'app-status-warning px-2 py-0.5 rounded-md text-amber-700 dark:text-amber-300 font-medium'
                : 'text-app-text-muted'
          }
        >
          Val: {formatValidade(item.validade)}
          {validade === 'vencida' ? ' (vencida)' : ''}
        </span>
      )}
      {item.precoCusto != null && <span>Custo: {reais(item.precoCusto)}</span>}
      {item.precoVenda != null && <span>Venda: {reais(item.precoVenda)}</span>}
      {margem && <span className="text-[var(--app-success-text)]">Margem: {formatarMargem(margem)}</span>}
    </div>
  )
}
