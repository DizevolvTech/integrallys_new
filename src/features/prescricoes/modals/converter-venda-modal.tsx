'use client'

import { useEffect, useState } from 'react'
import { Package, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePaymentConfig } from '@/features/prescricoes/hooks/use-payment-config'
import { useDescontosForma } from '@/features/formas-pagamento/hooks/use-descontos-forma'
import { calcularVenda } from '@/lib/desconto-forma'
import { formatarMoeda } from '@/lib/moeda'
import { validarPagamentoVenda } from '@/lib/venda-pagamento'
import { DescontoFormaTravado } from '../components/desconto-forma-travado'
import { PAGAMENTO_VENDA_VAZIO, PagamentoVendaFields, type PagamentoVendaEstado } from '../components/pagamento-venda-fields'

export interface ConverterVendaPrescricao {
  id: string
  numero: string
  paciente: string
  valorTotal: number
  items: Array<{ productName: string; quantity: number; posology?: string; unitPrice: number; total: number }>
}

export interface ConverterVendaDados {
  formaPagamento: string
  bandeira?: string
  contaBancariaId?: string
  numeroParcelas?: number
  valorParcela?: number
  valorTotal: number
}

interface ConverterVendaModalProps {
  isOpen: boolean
  onClose: () => void
  prescription: ConverterVendaPrescricao | null
  /** Converte no servidor (baixa estoque, lança no caixa, exige caixa aberto). Falha: lança erro e o modal continua aberto; sucesso fecha o modal. */
  onConfirm: (dados: ConverterVendaDados) => Promise<void>
}

/** Conversão de uma prescrição ativa (orçamento) em venda: mesma forma de pagamento e desconto da nova venda. */
export function ConverterVendaModal({ isOpen, onClose, prescription, onConfirm }: ConverterVendaModalProps) {
  const [pagamento, setPagamento] = useState<PagamentoVendaEstado>(PAGAMENTO_VENDA_VAZIO)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { getCardFee } = usePaymentConfig()
  const { descontos } = useDescontosForma()

  useEffect(() => {
    if (isOpen) {
      setPagamento(PAGAMENTO_VENDA_VAZIO)
    }
  }, [isOpen, prescription?.id])

  if (!prescription) return null

  const isConsumo = pagamento.forma === 'consumo'
  const credito = pagamento.forma === 'cartao_credito'
  const itens = prescription.items
  // Sem itens detalhados (registro antigo) vale o total gravado; com itens o desconto da forma é recalculado como na nova venda.
  const venda = itens.length > 0
    ? calcularVenda(itens.map((item) => ({ quantidade: item.quantity, valorUnitario: item.unitPrice })), pagamento.forma, descontos)
    : { subtotal: prescription.valorTotal, percentual: 0, desconto: 0, total: prescription.valorTotal }
  const pendencia = validarPagamentoVenda({
    forma: pagamento.forma,
    bandeira: pagamento.bandeira,
    contaBancariaId: pagamento.contaBancariaId,
    numeroParcelas: pagamento.parcelas,
  })

  const handleConfirm = async () => {
    if (pendencia || isSubmitting) return
    setIsSubmitting(true)
    try {
      await onConfirm({
        formaPagamento: pagamento.forma,
        bandeira: credito || pagamento.forma === 'cartao_debito' ? pagamento.bandeira : undefined,
        contaBancariaId: pagamento.forma === 'pix' ? pagamento.contaBancariaId : undefined,
        numeroParcelas: credito ? pagamento.parcelas : undefined,
        valorParcela: credito ? Number((venda.total / pagamento.parcelas).toFixed(2)) : undefined,
        valorTotal: venda.total,
      })
      onClose()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Não foi possível converter em venda.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(aberto) => !aberto && !isSubmitting && onClose()}>
      <DialogContent size="xl" className="max-h-[92vh] w-[95%] overflow-y-auto rounded-[24px] border-none bg-app-card p-0 dark:bg-app-card-dark">
          <div className="space-y-6 p-5 sm:p-8">
            <div className="flex items-center gap-3 pr-8">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl app-status-info text-app-primary dark:text-[var(--app-info-text)]">
                <ShoppingCart className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-app-text-primary dark:text-white md:text-2xl">Converter em venda</DialogTitle>
                <p className="text-sm text-app-text-secondary dark:text-white/60">
                  {prescription.numero} · {prescription.paciente}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-bold text-app-text-primary dark:text-white">
                <Package className="h-5 w-5 text-app-text-secondary" />
                Itens
              </h3>
              <div className="overflow-x-auto rounded-2xl border border-app-border dark:border-app-border-dark">
                <Table>
                  <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-hover">
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                      <TableHead className="text-right">Unit.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-6 text-center text-app-text-secondary dark:text-white/60">
                          Nenhum item detalhado nesta prescrição.
                        </TableCell>
                      </TableRow>
                    ) : (
                      itens.map((item, idx) => (
                        <TableRow key={`${item.productName}-${idx}`}>
                          <TableCell className="font-medium text-app-text-primary dark:text-white">
                            {item.productName}
                            {item.posology && <p className="text-xs font-normal text-app-text-secondary dark:text-white/60">{item.posology}</p>}
                          </TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          <TableCell className="whitespace-nowrap text-right">{formatarMoeda(item.unitPrice)}</TableCell>
                          <TableCell className="whitespace-nowrap text-right font-semibold">{formatarMoeda(item.total)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-5 rounded-2xl border border-app-border p-4 dark:border-app-border-dark sm:p-5">
              <PagamentoVendaFields
                value={pagamento}
                onChange={setPagamento}
                total={venda.total}
                taxaParcelas={credito ? getCardFee(pagamento.parcelas) : 0}
              />
              {pagamento.forma && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-app-text-primary dark:text-white/70">Desconto da forma de pagamento</p>
                  <DescontoFormaTravado isConsumo={isConsumo} percentual={venda.percentual} desconto={venda.desconto} />
                </div>
              )}
              {isConsumo && (
                <p className="text-xs text-[var(--app-warning-text)]">
                  Venda por consumo: calculada ao preço de custo na conversão, não lança no caixa
                </p>
              )}
            </div>

            <div className="flex items-end justify-between gap-3">
              <div className="text-xs text-app-text-secondary dark:text-white/60">
                <p>
                  Subtotal <span className="tabular-nums">{formatarMoeda(venda.subtotal)}</span>
                </p>
                {venda.desconto > 0 && !isConsumo && (
                  <p className="text-[var(--app-success-text)]">
                    Desconto <span className="tabular-nums">- {formatarMoeda(venda.desconto)}</span>
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-app-text-primary dark:text-white">Total a Pagar</p>
                <p className="text-2xl font-extrabold tabular-nums text-app-primary dark:text-[var(--app-info-text)]">
                  {isConsumo ? '—' : formatarMoeda(venda.total)}
                </p>
              </div>
            </div>

            {pendencia && (
              <p role="alert" className="text-sm text-[var(--app-danger-text)]">
                {pendencia.message}
              </p>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="h-12 rounded-xl px-6 font-bold">
                Cancelar
              </Button>
              <Button
                onClick={() => void handleConfirm()}
                disabled={pendencia !== null || isSubmitting}
                title={pendencia?.message}
                className="h-12 rounded-xl bg-app-primary px-8 font-bold text-white shadow-lg hover:bg-app-primary-hover disabled:opacity-50"
              >
                {isSubmitting ? 'Processando...' : 'Converter em venda'}
              </Button>
            </div>
          </div>
      </DialogContent>
    </Dialog>
  )
}
