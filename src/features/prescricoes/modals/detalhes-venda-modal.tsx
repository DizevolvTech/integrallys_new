'use client'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { FileText, User, CreditCard, Receipt, Printer, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatarMoeda } from '@/lib/moeda'

interface VendaItem {
  productName: string
  quantity: number
  posology?: string
  unitPrice: number
  total: number
  custoUnitario?: number
  margem?: number
  margemPercentual?: number
}

interface DetalhesVendaModalProps {
  isOpen: boolean
  onClose: () => void
  venda: {
    number: string
    patientName: string
    specialistName?: string
    paymentMethod?: string
    parcela?: string
    createdAt?: string
    totalValue: number
    items?: VendaItem[]
    /** Só vem preenchido para gestor/admin/master. */
    custoTotal?: number
    margemTotal?: number
    margemPercentual?: number
  } | null
  /** Venda convertida: abre o recibo/NF. */
  onEmitirRecibo?: () => void
}

export function DetalhesVendaModal({ isOpen, onClose, venda, onEmitirRecibo }: DetalhesVendaModalProps) {
  if (!venda) return null
  const items = venda.items || []
  const mostraCusto = venda.custoTotal !== undefined
  const colunas = mostraCusto ? 7 : 5

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="xl" className="w-full bg-app-card dark:bg-app-card-dark rounded-[24px] border-none p-0 shadow-2xl flex flex-col">
        <div className="px-8 py-6 bg-app-card dark:bg-app-card-dark border-b border-app-border dark:border-app-border-dark flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 app-status-info rounded-2xl flex items-center justify-center"><Receipt className="h-6 w-6" /></div>
            <div>
              <DialogTitle className="text-xl font-bold text-app-text-primary dark:text-white flex items-center gap-2">Detalhes da Venda<Badge variant="secondary" className="app-status-neutral font-medium">#{venda.number}</Badge></DialogTitle>
              <p className="text-sm text-app-text-secondary dark:text-white/60 font-medium mt-1">Realizada em {venda.createdAt || '-'}</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="p-4 rounded-2xl bg-app-bg-secondary dark:bg-app-hover border border-app-border dark:border-app-border-dark space-y-3"><div className="flex items-center gap-2 text-app-text-secondary dark:text-white/60 font-medium text-sm"><User size={16} />Paciente</div><p className="text-lg font-bold text-app-text-primary dark:text-white truncate">{venda.patientName}</p></div>
            <div className="p-4 rounded-2xl bg-app-bg-secondary dark:bg-app-hover border border-app-border dark:border-app-border-dark space-y-3"><div className="flex items-center gap-2 text-app-text-secondary dark:text-white/60 font-medium text-sm"><User size={16} />Profissional</div><p className="text-lg font-bold text-app-text-primary dark:text-white truncate">{venda.specialistName || '-'}</p></div>
            <div className="p-4 rounded-2xl bg-app-bg-secondary dark:bg-app-hover border border-app-border dark:border-app-border-dark space-y-3"><div className="flex items-center gap-2 text-app-text-secondary dark:text-white/60 font-medium text-sm"><CreditCard size={16} />Pagamento</div><div className="flex items-center gap-2"><Badge className="text-sm font-medium px-3 py-1 app-status-success border-none">{venda.paymentMethod || 'Não informado'}</Badge><span className="text-sm text-app-text-secondary dark:text-white/60">Parcela: {venda.parcela || '1/1'}</span></div></div>
          </div>
          <div className="rounded-2xl border border-app-border dark:border-app-border-dark overflow-hidden mb-8">
            <div className="bg-app-bg-secondary dark:bg-app-hover px-6 py-4 border-b border-app-border dark:border-app-border-dark"><h3 className="font-bold text-app-text-primary dark:text-white flex items-center gap-2"><FileText size={18} className="text-[var(--app-info-text)]" />Itens da Venda</h3></div>
            <Table>
              <TableHeader><TableRow className="hover:bg-transparent border-app-border dark:border-app-border-dark"><TableHead className="pl-6 h-12 text-app-text-secondary dark:text-white/60 font-medium">Produto</TableHead><TableHead className="text-center h-12 text-app-text-secondary dark:text-white/60 font-medium">Qtd</TableHead><TableHead className="h-12 text-app-text-secondary dark:text-white/60 font-medium">Posologia</TableHead><TableHead className="text-right h-12 text-app-text-secondary dark:text-white/60 font-medium">Valor Unit.</TableHead>{mostraCusto && <TableHead className="text-right h-12 text-app-text-secondary dark:text-white/60 font-medium">Custo unit.</TableHead>}<TableHead className="text-right pr-6 h-12 text-app-text-secondary dark:text-white/60 font-medium">Total</TableHead>{mostraCusto && <TableHead className="text-right pr-6 h-12 text-app-text-secondary dark:text-white/60 font-medium">Margem</TableHead>}</TableRow></TableHeader>
              <TableBody>
                {items.length === 0 ? <TableRow><TableCell colSpan={colunas} className="py-8 text-center text-app-text-secondary dark:text-white/60">Nenhum item encontrado para esta venda.</TableCell></TableRow> : items.map((item, i) => <TableRow key={i} className="hover:bg-app-bg-secondary/50 dark:hover:bg-app-hover border-app-border dark:border-app-border-dark"><TableCell className="pl-6 py-4 font-medium text-app-text-primary dark:text-white">{item.productName}</TableCell><TableCell className="text-center py-4 text-app-text-secondary dark:text-white/70">{item.quantity}</TableCell><TableCell className="py-4 text-sm text-app-text-secondary dark:text-white/70 max-w-[240px]">{item.posology || '-'}</TableCell><TableCell className="text-right py-4 text-app-text-secondary dark:text-white/70">{formatarMoeda(item.unitPrice)}</TableCell>{mostraCusto && <TableCell className="text-right py-4 text-app-text-secondary dark:text-white/70">{item.custoUnitario != null ? formatarMoeda(item.custoUnitario) : '—'}</TableCell>}<TableCell className="text-right pr-6 py-4 font-bold text-app-text-primary dark:text-white">{formatarMoeda(item.total)}</TableCell>{mostraCusto && <TableCell className="text-right pr-6 py-4 text-[var(--app-success-text)]">{item.margem != null ? `${formatarMoeda(item.margem)}${item.margemPercentual != null ? ` (${item.margemPercentual.toFixed(1)}%)` : ''}` : '—'}</TableCell>}</TableRow>)}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end"><div className="w-full md:w-1/3 bg-app-bg-secondary dark:bg-app-hover rounded-2xl p-6 border border-app-border dark:border-app-border-dark space-y-3"><div className="flex justify-between items-center pt-2"><span className="text-lg font-bold text-app-text-primary dark:text-white">Total Pago</span><span className="text-2xl font-extrabold text-app-primary dark:text-[var(--app-info-text)]">{formatarMoeda(venda.totalValue)}</span></div>{mostraCusto && (<div className="space-y-1 border-t border-app-border dark:border-app-border-dark pt-3 text-sm text-app-text-secondary dark:text-white/70" data-testid="venda-custo-margem"><div className="flex justify-between"><span>Custo total</span><span>{formatarMoeda((venda.custoTotal ?? 0))}</span></div><div className="flex justify-between text-[var(--app-success-text)] font-semibold"><span>Margem (% sobre o custo)</span><span>{formatarMoeda(venda.margemTotal ?? 0)}{venda.margemPercentual != null ? ` (${venda.margemPercentual.toFixed(1)}%)` : ''}</span></div></div>)}</div></div>
        </div>
        <div className="p-6 bg-app-bg-secondary dark:bg-app-card-dark border-t border-app-border dark:border-app-border-dark flex justify-between items-center">
          <Button variant="outline" onClick={() => toast.info('O compartilhamento ficará disponível nesta mesma área da venda.')} className="h-12 px-6 rounded-xl border-app-border dark:border-app-border-dark text-app-text-secondary dark:text-white/70 hover:bg-white dark:hover:bg-app-hover font-semibold gap-2"><Share2 size={18} />Compartilhar</Button>
          <div className="flex gap-3"><Button variant="outline" onClick={onEmitirRecibo} disabled={!onEmitirRecibo} className="h-12 px-6 rounded-xl border-app-border dark:border-app-border-dark text-app-text-secondary dark:text-white/70 hover:bg-white dark:hover:bg-app-hover font-semibold gap-2"><Printer size={18} />Emitir recibo / NF</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
