'use client'

import { useMemo, useState } from 'react'
import { CreditCard, Plus } from 'lucide-react'
import { ModalHeader } from '@/components/shared/modal-header'
import { StatCard } from '@/components/shared/stat-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DateInput } from '@/components/shared/date-input'
import type { CartaoEmpresarial } from '../hooks/use-cartoes-empresariais'
import { FaturasCartao } from '../components/faturas-cartao'

interface Props {
  open: boolean
  cartao: CartaoEmpresarial | null
  onClose: () => void
  onRegistrarGasto: () => void
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return '—'
  return `${day}/${month}/${year}`
}

export function DetalheCartaoModal({ open, cartao, onClose, onRegistrarGasto }: Props) {
  const [filtroInicio, setFiltroInicio] = useState('')
  const [filtroFim, setFiltroFim] = useState('')

  const movimentos = cartao?.movimentos ?? []

  const movimentosFiltrados = useMemo(() => {
    return movimentos.filter((mov) => {
      if (!mov.dataCompra) return true
      if (filtroInicio && mov.dataCompra < filtroInicio) return false
      if (filtroFim && mov.dataCompra > filtroFim) return false
      return true
    })
  }, [movimentos, filtroInicio, filtroFim])

  if (!cartao) return null

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent size="xl" className="gap-0 rounded-[24px] border border-app-border p-0 dark:border-app-border-dark">
        <div className="flex flex-col bg-app-card dark:bg-app-card-dark">
          <ModalHeader
            className="px-8 pb-6 pt-8"
            icon={CreditCard}
            title={
              <span className="flex flex-wrap items-center gap-3">
                {cartao.nome}
                {cartao.bandeira && (
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-medium">
                    {cartao.bandeira}
                  </Badge>
                )}
                {cartao.ultimosDigitos && (
                  <span className="text-sm font-normal text-app-text-secondary">•••• {cartao.ultimosDigitos}</span>
                )}
              </span>
            }
            description="Detalhes consolidados de limite, fatura e movimentos."
          />

          <div className="flex-1 overflow-y-auto px-8 pb-8 pt-2 custom-scrollbar space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Limite total" value={formatCurrency(cartao.limiteTotal)} iconTone="primary" />
              <StatCard
                label="Limite utilizado"
                value={formatCurrency(cartao.limiteUtilizado)}
                iconTone="warning"
              />
              <StatCard
                label="Limite disponível"
                value={formatCurrency(cartao.limiteDisponivel)}
                iconTone="success"
              />
              <StatCard
                label="Próximo vencimento"
                value={formatDate(cartao.proximoVencimento)}
                sub={cartao.faturasAbertas > 0 ? `${formatCurrency(cartao.faturasAbertas)} em aberto` : 'Sem faturas abertas'}
              />
            </div>

            <FaturasCartao faturas={cartao.faturas} />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wider text-app-text-muted">De</span>
                  <DateInput value={filtroInicio} onChange={setFiltroInicio} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wider text-app-text-muted">Até</span>
                  <DateInput value={filtroFim} onChange={setFiltroFim} />
                </div>
              </div>
              <Button
                onClick={onRegistrarGasto}
                className="h-11 rounded-xl bg-app-primary px-6 text-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                Registrar gasto
              </Button>
            </div>

            <div className="overflow-hidden rounded-[18px] border border-app-border dark:border-app-border-dark">
              {movimentosFiltrados.length === 0 ? (
                <div className="py-12 text-center text-sm text-app-text-muted">
                  Nenhum movimento registrado no período.
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-hover">
                    <TableRow>
                      <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary">Data</TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary">Descrição</TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary">Beneficiário</TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary">Parcelas</TableHead>
                      <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-app-text-secondary">Valor total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimentosFiltrados.map((mov) => (
                      <TableRow key={mov.id}>
                        <TableCell className="text-app-text-secondary dark:text-white/70">
                          {formatDate(mov.dataCompra)}
                        </TableCell>
                        <TableCell className="font-normal text-app-text-primary dark:text-white">
                          {mov.descricao}
                          {mov.categoria && (
                            <span className="ml-2 text-xs text-app-text-muted">{mov.categoria}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-app-text-secondary dark:text-white/70">
                          {mov.beneficiario ?? '—'}
                        </TableCell>
                        <TableCell className="text-app-text-secondary dark:text-white/70">
                          {mov.parcelas > 1 ? `${mov.parcelas}x de ${formatCurrency(mov.valorParcela)}` : 'À vista'}
                        </TableCell>
                        <TableCell className="text-right font-normal tabular-nums text-app-text-primary dark:text-white">
                          {formatCurrency(mov.valor)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          <DialogFooter className="border-t border-app-border bg-app-bg-secondary/35 px-8 py-6 dark:border-app-border-dark dark:bg-app-hover/30">
            <Button type="button" variant="outline" onClick={onClose} className="h-11 rounded-xl px-6">
              Fechar
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
