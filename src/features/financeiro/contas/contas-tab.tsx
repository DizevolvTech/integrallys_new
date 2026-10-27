'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { FinanceiroItem } from '@/hooks/use-financeiro'
import { AnexosModal } from './anexos-modal'
import { ContasCards } from './contas-cards'
import { ContasFiltros } from './contas-filtros'
import { ContasTabela } from './contas-tabela'
import { NovaContaModal } from './nova-conta-modal'
import { useContas, type ContaItem } from './use-contas'

export type AcaoConta = 'ver' | 'editar' | 'liquidar' | 'excluir'

interface Props {
  tipo: 'receita' | 'despesa'
  /** Lançamentos já carregados pela tela (usados pelos modais de ver/editar/excluir). */
  lancamentos: FinanceiroItem[]
  /** Muda quando a tela alterou um lançamento: recarrega as contas. */
  refreshSignal: number
  novaContaOpen: boolean
  onNovaContaClose: () => void
  onChanged: () => void
  onAcao: (acao: AcaoConta, item: FinanceiroItem) => void
}

export function ContasTab({ tipo, lancamentos, refreshSignal, novaContaOpen, onNovaContaClose, onChanged, onAcao }: Props) {
  const contas = useContas(tipo)
  const [anexosDe, setAnexosDe] = useState<ContaItem | null>(null)
  const primeira = useRef(true)

  // biome-ignore lint/correctness/useExhaustiveDependencies: só reage ao sinal de atualização
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false
      return
    }
    void contas.reload()
  }, [refreshSignal])

  const agir = (acao: AcaoConta) => (conta: ContaItem) => {
    const item = lancamentos.find((lancamento) => lancamento.id === conta.id)
    if (!item) {
      toast.error('Lançamento não encontrado. Atualize a tela e tente de novo.')
      return
    }
    onAcao(acao, item)
  }

  return (
    <div className="space-y-4">
      <ContasCards tipo={tipo} contas={contas} />
      <ContasFiltros tipo={tipo} filtros={contas.filtros} opcoes={contas.opcoes} onChange={contas.setFiltros} />
      {contas.error && (
        <Card className="rounded-integrallys-lg border-[var(--app-danger-border)] bg-[var(--app-danger-bg)] p-4 text-sm text-[var(--app-danger-text)]">
          {contas.error}
        </Card>
      )}
      <div className="overflow-hidden rounded-[16px] border border-app-border bg-app-card shadow-sm dark:border-app-border-dark dark:bg-app-card-dark">
        <div className="flex items-center justify-between gap-4 border-b border-app-border px-6 py-5 dark:border-app-border-dark">
          <div>
            <h2 className="text-xl font-normal tracking-tight text-app-text-primary dark:text-white">
              {tipo === 'receita' ? 'Recebimentos: liquidados e a receber' : 'Pagamentos: liquidados e a vencer'}
            </h2>
            {tipo === 'receita' && (
              <p className="text-sm text-app-text-muted">Inclui o saldo a receber de atendimentos com pagamento antecipado ou parcial.</p>
            )}
          </div>
          <Badge variant="outline" className="w-fit shrink-0 rounded-full px-3 py-1 text-xs font-medium">
            {contas.contas.length} registros
          </Badge>
        </div>
        {contas.isLoading && contas.contas.length === 0 ? (
          <div className="divide-y divide-app-border dark:divide-app-border-dark">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="px-6 py-4"><div className="h-3 w-full animate-pulse rounded bg-app-bg-secondary dark:bg-white/10" /></div>
            ))}
          </div>
        ) : contas.contas.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-app-text-muted">Nenhuma conta encontrada para os filtros escolhidos.</p>
        ) : (
          <ContasTabela
            tipo={tipo}
            itens={contas.contas}
            onVisualizar={agir('ver')}
            onEditar={agir('editar')}
            onLiquidar={agir('liquidar')}
            onExcluir={agir('excluir')}
            onAnexos={setAnexosDe}
          />
        )}
      </div>
      <NovaContaModal
        open={novaContaOpen}
        tipo={tipo}
        opcoes={contas.opcoes}
        onClose={onNovaContaClose}
        onSaved={() => {
          void contas.reload()
          onChanged()
        }}
      />
      <AnexosModal
        open={anexosDe !== null}
        onClose={() => setAnexosDe(null)}
        lancamentoId={anexosDe?.id ?? null}
        titulo={anexosDe?.descricao ?? ''}
        onChanged={() => void contas.reload()}
      />
    </div>
  )
}
