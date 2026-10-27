'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, History, Inbox, RotateCcw } from 'lucide-react'
import { ModalHeader } from '@/components/shared/modal-header'
import { EmptyState } from '@/components/shared/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { useApi } from '@/hooks/use-api'
import type { EstoqueItem, MovimentacaoItem } from '@/features/estoque/hooks/use-estoque'
import { formatarDataHoraClinica } from '@/lib/fuso-clinica'

interface HistoricoProdutoModalProps {
  isOpen: boolean
  onClose: (open: boolean) => void
  produto: EstoqueItem | null
}

interface MovimentacoesResponse {
  data: MovimentacaoItem[]
  meta: { total: number; limit: number; offset: number }
}

export function HistoricoProdutoModal({ isOpen, onClose, produto }: HistoricoProdutoModalProps) {
  const api = useApi()
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !produto) return
    let mounted = true
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          view: 'movimentacoes',
          produto_id: produto.id,
          limit: '500',
        })
        const response = await api.get<MovimentacoesResponse>(`/api/estoque?${params.toString()}`)
        if (!mounted) return
        setMovimentacoes(response.data)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar histórico')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [api, isOpen, produto])

  const timelineItems = useMemo(() => {
    const sortedOldFirst = [...movimentacoes].sort((a, b) => {
      const left = new Date(a.criadoEm).getTime() || 0
      const right = new Date(b.criadoEm).getTime() || 0
      return left - right
    })
    let saldo = 0
    const enriched = sortedOldFirst.map((mov) => {
      if (!mov.estornada) {
        saldo = mov.tipo === 'entrada' ? saldo + mov.quantidade : saldo - mov.quantidade
      }
      return { ...mov, saldoAcumulado: saldo }
    })
    return enriched.reverse()
  }, [movimentacoes])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="lg" className="gap-0 rounded-[24px] border border-app-border p-0 dark:border-app-border-dark">
        <div className="flex flex-col bg-app-card dark:bg-app-card-dark">
          <ModalHeader
            className="px-8 pb-6 pt-8"
            icon={History}
            title={`Histórico — ${produto?.produto ?? ''}`}
            description="Timeline de entradas e saídas com saldo acumulado."
          />

          <div className="flex-1 overflow-y-auto px-8 pb-6 pt-2 custom-scrollbar max-h-[60vh]">
            {error && (
              <p className="mb-4 text-sm text-[var(--app-danger-text)]">{error}</p>
            )}

            {isLoading ? (
              <div className="py-12 text-center text-app-text-muted">Carregando histórico...</div>
            ) : timelineItems.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="Nenhuma movimentação registrada"
                description="Quando este produto receber entradas ou saídas, elas aparecerão aqui."
              />
            ) : (
              <ol className="space-y-4 border-l border-app-border pl-6 dark:border-app-border-dark md:pl-8">
                {timelineItems.map((mov) => {
                  const isEntrada = mov.tipo === 'entrada'
                  const isConsumo = mov.tipoMovimentacao === 'consumo_interno'
                  const Icon = mov.estornada ? RotateCcw : isEntrada ? ArrowUpRight : ArrowDownRight
                  const iconWrapClass = mov.estornada
                    ? 'bg-app-bg-secondary text-app-text-muted dark:bg-app-hover'
                    : isEntrada
                      ? 'bg-[color:var(--app-success-bg)] text-[color:var(--app-success-text)]'
                      : isConsumo
                        ? 'bg-[color:var(--app-warning-bg)] text-[color:var(--app-warning-text)]'
                        : 'bg-[color:var(--app-danger-bg)] text-[color:var(--app-danger-text)]'

                  const badgeClass = mov.estornada
                    ? 'rounded-full border-app-border bg-app-bg-secondary/60 text-app-text-muted dark:bg-app-hover'
                    : isEntrada
                      ? 'rounded-full app-status-success border-transparent text-[var(--app-success-text)] dark:bg-transparent'
                      : isConsumo
                        ? 'rounded-full app-status-warning border-transparent text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                        : 'rounded-full app-status-danger border-transparent text-[var(--app-danger-text)] dark:bg-transparent'

                  const tipoLabel = isEntrada ? 'Entrada' : isConsumo ? 'Consumo interno' : 'Saída'

                  return (
                    <li key={mov.id} className={`relative ${mov.estornada ? 'opacity-50' : ''}`}>
                      <span className={`absolute -left-[40px] flex h-9 w-9 items-center justify-center rounded-full ring-4 ring-app-card dark:ring-app-card-dark md:-left-[44px] ${iconWrapClass}`}>
                        <Icon className="h-4 w-4" />
                      </span>

                      <div className="rounded-[16px] border border-app-border bg-app-card p-4 shadow-sm dark:border-app-border-dark dark:bg-app-card-dark">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={`px-3 py-1 text-xs font-medium ${badgeClass}`}>
                              {tipoLabel}
                            </Badge>
                            {mov.estornada && (
                              <Badge variant="outline" className="rounded-full border-app-border bg-app-bg-secondary/40 px-2 py-0.5 text-[10px] font-medium text-app-text-muted">
                                Estornada
                              </Badge>
                            )}
                            <span className="text-xs text-app-text-muted">{formatarDataHoraClinica(mov.criadoEm)}</span>
                          </div>
                          <div className="flex items-baseline gap-3 tabular-nums">
                            <span className={`text-sm font-medium ${isEntrada ? 'text-[color:var(--app-success-text)]' : 'text-[color:var(--app-danger-text)]'}`}>
                              {isEntrada ? '+' : '-'}{mov.quantidade}
                            </span>
                            <span className="text-xs text-app-text-secondary dark:text-white/70">
                              Saldo: <span className="font-medium text-app-text-primary dark:text-white">{mov.saldoAcumulado}</span>
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-app-text-secondary dark:text-white/70">
                          {mov.operadorNome && <span>Operador: <span className="text-app-text-primary dark:text-white">{mov.operadorNome}</span></span>}
                          {mov.vinculoNome && (
                            <span>
                              {mov.vinculoTipo ? `${mov.vinculoTipo.charAt(0).toUpperCase()}${mov.vinculoTipo.slice(1)}` : 'Vínculo'}:{' '}
                              <span className="text-app-text-primary dark:text-white">{mov.vinculoNome}</span>
                            </span>
                          )}
                        </div>

                        {mov.observacoes && (
                          <p className="mt-3 text-xs italic text-app-text-muted">{mov.observacoes}</p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>

          <DialogFooter className="border-t border-app-border bg-app-bg-secondary/35 px-8 py-6 dark:border-app-border-dark dark:bg-app-hover/30">
            <Button type="button" variant="outline" onClick={() => onClose(false)} className="h-11 rounded-xl px-6">
              Fechar
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
