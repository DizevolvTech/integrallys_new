'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { StatCard } from '@/components/shared/stat-card'
import type { SituacaoFinanceira } from '@/lib/financeiro-situacao'
import { formatCurrency } from '../financeiro.utils'
import { DetalheGruposModal, type GrupoDetalhe } from './detalhe-grupos-modal'
import type { PeriodoContas, useContas } from './use-contas'

type Contas = ReturnType<typeof useContas>
type SituacaoCard = Exclude<SituacaoFinanceira, 'cancelado'>

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

function rotuloPeriodo(periodo: PeriodoContas | null) {
  if (!periodo) return ''
  if (!periodo.informado) return 'Hoje'
  if (periodo.de.startsWith('0001')) return `Até ${formatarData(periodo.ate)}`
  if (periodo.ate.startsWith('9999')) return `A partir de ${formatarData(periodo.de)}`
  return `${formatarData(periodo.de)} a ${formatarData(periodo.ate)}`
}

const ROTULOS = {
  receita: {
    liquidado: ['Recebido', 'Liquidado'],
    a_vencer: ['A receber', 'A vencer'],
    atrasado: ['Atrasado', 'Venceu e ainda não foi recebido'],
  },
  despesa: {
    liquidado: ['Pago', 'Liquidado'],
    a_vencer: ['A pagar', 'A vencer'],
    atrasado: ['Atrasado', 'Venceu e ainda não foi pago'],
  },
} as const

/** Cards de totais; cada um abre o detalhamento (por forma de pagamento) do que compõe o valor. */
export function ContasCards({ tipo, contas }: { tipo: 'receita' | 'despesa'; contas: Contas }) {
  const [aberto, setAberto] = useState<SituacaoCard | null>(null)
  const [grupos, setGrupos] = useState<GrupoDetalhe[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const { resumo, periodo } = contas

  const cards: Array<{ situacao: SituacaoCard; valor: number; icone: typeof Clock; tom: 'success' | 'warning' | 'danger' }> = [
    { situacao: 'liquidado', valor: resumo.liquidado, icone: CheckCircle2, tom: 'success' },
    { situacao: 'a_vencer', valor: resumo.aVencer, icone: Clock, tom: 'warning' },
    { situacao: 'atrasado', valor: resumo.atrasado, icone: AlertTriangle, tom: 'danger' },
  ]

  const abrir = async (situacao: SituacaoCard) => {
    setAberto(situacao)
    setCarregando(true)
    setErro(null)
    try {
      const response = await contas.buscarDetalhe(situacao)
      setGrupos(
        response.data.map((grupo) => ({
          chave: grupo.forma,
          rotulo: grupo.forma,
          total: grupo.total,
          linhas: grupo.itens.map((item) => ({
            id: item.id,
            titulo: item.pessoa ? `${item.descricao} — ${item.pessoa}` : item.descricao,
            subtitulo: `${item.parcela ? `Parcela ${item.parcela} · ` : ''}${item.vencimento ? `Vence ${formatarData(item.vencimento)}` : item.situacaoLabel}`,
            valor: item.valor,
          })),
        })),
      )
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível carregar o detalhamento.')
    } finally {
      setCarregando(false)
    }
  }

  const atual = aberto ? cards.find((card) => card.situacao === aberto) : null
  const rotulos = ROTULOS[tipo]

  return (
    <>
      <div className="space-y-2">
        <p className="text-xs text-app-text-muted">
          Totais de: <span className="font-medium text-app-text-secondary">{rotuloPeriodo(periodo)}</span>
          {periodo && !periodo.informado ? ' (sem filtro de período, mostra o dia de hoje; atrasado mostra tudo que já venceu)' : ''}
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {cards.map((card) => (
            <StatCard
              key={card.situacao}
              role="button"
              tabIndex={0}
              aria-label={`${rotulos[card.situacao][0]}: ${formatCurrency(card.valor)}. Abrir detalhamento`}
              onClick={() => void abrir(card.situacao)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  void abrir(card.situacao)
                }
              }}
              className="cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary/50"
              label={rotulos[card.situacao][0]}
              value={formatCurrency(card.valor)}
              sub={`${rotulos[card.situacao][1]} · clique para detalhar`}
              icon={card.icone}
              iconTone={card.tom}
            />
          ))}
        </div>
      </div>
      <DetalheGruposModal
        open={aberto !== null}
        onClose={() => setAberto(null)}
        titulo={atual ? `${rotulos[atual.situacao][0]} — ${tipo === 'receita' ? 'recebimentos' : 'pagamentos'}` : ''}
        descricao={rotuloPeriodo(periodo)}
        total={atual?.valor ?? 0}
        grupos={grupos}
        carregando={carregando}
        erro={erro}
      />
    </>
  )
}
