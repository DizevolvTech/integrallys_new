import { Lock } from 'lucide-react'
import { formatarMoeda } from '@/lib/moeda'

interface DescontoFormaTravadoProps {
  isConsumo: boolean
  percentual: number
  desconto: number
}

/** Desconto da forma de pagamento: vem do cadastro do gestor, a tela só exibe (o servidor recalcula e confere). */
export function DescontoFormaTravado({ isConsumo, percentual, desconto }: DescontoFormaTravadoProps) {
  return (
    <div
      data-testid="desconto-forma-travado"
      className="flex items-center justify-between rounded-xl border border-app-border bg-app-bg-secondary px-4 py-3 dark:border-app-border-dark dark:bg-app-hover"
    >
      <span className="flex items-center gap-2 text-sm text-app-text-secondary dark:text-white/70">
        <Lock size={14} />
        {isConsumo ? 'Consumo: sem desconto' : `${percentual.toFixed(2).replace('.', ',')}% (cadastro do gestor)`}
      </span>
      <span className="text-base font-semibold tabular-nums text-app-text-primary dark:text-white">
        {desconto > 0 ? `- ${formatarMoeda(desconto)}` : formatarMoeda(0)}
      </span>
    </div>
  )
}
