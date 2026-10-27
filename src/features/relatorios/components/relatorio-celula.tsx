import { Badge } from '@/components/ui/badge'
import type { ColunaRelatorio } from '@/features/relatorios/relatorio-config'
import { formatData, formatDataHora, formatMoeda, formatPct, ROTULO_FORMA } from '@/features/relatorios/format'

const TOM_BADGE: Array<[RegExp, string]> = [
  [/^(pago|concl|realiz|atendido|liquidado|receita|entrada|check-out)/i, 'app-status-success'],
  [/^(cancel|faltou|despesa|vencido|atrasad|saida|saída)/i, 'app-status-danger'],
  [/^(em aberto|parcial|pendente|a_receber|em and|agendado|confirmado)/i, 'app-status-warning'],
]

const ROTULO_BADGE: Record<string, string> = { a_receber: 'A receber', atrasado: 'Atrasado', liquidado: 'Liquidado', entrada: 'Entrada', saida: 'Saída' }

export function RelatorioCelula({ coluna, valor }: { coluna: ColunaRelatorio; valor: unknown }) {
  const vazio = valor === null || valor === undefined || valor === ''
  if (vazio) return <span className="text-app-text-muted">—</span>

  switch (coluna.tipo) {
    case 'data':
      return <>{formatData(valor)}</>
    case 'dataHora':
      return <>{formatDataHora(valor)}</>
    case 'dinheiro':
      return <>{formatMoeda(valor)}</>
    case 'pct':
      return <>{formatPct(valor)}</>
    case 'numero':
      return <>{Number(valor).toLocaleString('pt-BR')}</>
    case 'dias':
      return <>{`${Number(valor)} d`}</>
    case 'forma':
      return <>{ROTULO_FORMA[String(valor)] ?? String(valor)}</>
    case 'badge': {
      const texto = String(valor)
      const tom = TOM_BADGE.find(([regex]) => regex.test(texto))?.[1] ?? ''
      return (
        <Badge variant="outline" className={`w-fit border-none px-2 text-xs font-normal ${tom}`}>
          {ROTULO_BADGE[texto] ?? texto}
        </Badge>
      )
    }
    default:
      return <>{String(valor)}</>
  }
}
