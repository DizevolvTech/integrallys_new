import { Info } from 'lucide-react'
import type { ColunaRelatorio } from '@/features/relatorios/relatorio-config'

/** Título da coluna; com `dica`, mostra um "i" e a explicação ao passar o mouse ou focar. */
export function RelatorioCabecalho({ coluna }: { coluna: ColunaRelatorio }) {
  if (!coluna.dica) return <>{coluna.label}</>
  return (
    <span className="inline-flex items-center gap-1" title={coluna.dica}>
      {coluna.label}
      <Info className="h-3.5 w-3.5 shrink-0 text-app-text-muted" aria-label={coluna.dica} />
    </span>
  )
}
