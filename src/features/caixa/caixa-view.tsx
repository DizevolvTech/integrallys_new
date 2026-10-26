'use client'

import { useMemo, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  DollarSign,
  Edit,
  Eye,
  FileText,
  Lock,
  MoreVertical,
  Printer,
  RotateCcw,
  Wallet,
} from 'lucide-react'
import { useCaixa, type CaixaItem } from '@/hooks/use-caixa'
import { cn } from '@/lib/utils'
import { calcularDinheiroNaGaveta, sugerirTransferenciaCofre, validarTransferenciaCofre } from '@/features/caixa/fechamento'
import { DetalheFormaModal } from '@/features/caixa/modals/detalhe-forma-modal'
import { usePaymentConfig } from '@/features/prescricoes/hooks/use-payment-config'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { diaDoMovimento, formaCaixaLabel } from './caixa-format'

type CaixaModal = 'abrircaixa' | 'suprimento' | 'sangria' | 'fecharcaixa' | 'edit_caixa' | null

interface ResumoFechamentoSnapshot {
  saldoInicial: number
  totalEntradas: number
  totalSaidas: number
  saldoFinal: number
  valorTransferido: number
  saldoRestante: number
  resumoForma: { label: string; forma: string; value: number }[]
  observacoes: string
  fechadoEm: string
}

interface BandeiraBreakdownRow {
  bandeira: string
  parcelas: number | null
  bruto: number
  taxa: number
  taxaValor: number
  liquido: number
}

interface CardBreakdown {
  debito: BandeiraBreakdownRow[]
  credito: BandeiraBreakdownRow[]
  totalBrutoDebito: number
  totalBrutoCredito: number
  totalLiquidoDebito: number
  totalLiquidoCredito: number
}

const BANDEIRA_DESCONHECIDA = 'Sem bandeira'

function buildCardBreakdown(items: CaixaItem[], getCardFee: (parcelas: number) => number): CardBreakdown {
  const debitoMap = new Map<string, BandeiraBreakdownRow>()
  const creditoMap = new Map<string, BandeiraBreakdownRow>()

  for (const item of items) {
    if (item.tipo !== 'entrada') continue
    if (item.forma !== 'cartao_debito' && item.forma !== 'cartao_credito') continue

    const bandeira = item.bandeira || BANDEIRA_DESCONHECIDA
    const isCredito = item.forma === 'cartao_credito'
    const parcelas = isCredito ? Math.max(1, Math.min(12, Math.floor(item.parcelas ?? 1))) : null
    const taxa = isCredito && parcelas ? getCardFee(parcelas) : 0
    const key = isCredito ? `${bandeira}|${parcelas}` : bandeira
    const map = isCredito ? creditoMap : debitoMap
    const existing = map.get(key)
    const bruto = (existing?.bruto ?? 0) + item.valor
    const taxaValor = Number(((bruto * taxa) / 100).toFixed(2))
    const liquido = Number((bruto - taxaValor).toFixed(2))
    map.set(key, { bandeira, parcelas, bruto, taxa, taxaValor, liquido })
  }

  const sortRows = (rows: BandeiraBreakdownRow[]) =>
    rows.sort((a, b) => {
      const bandeiraCmp = a.bandeira.localeCompare(b.bandeira)
      if (bandeiraCmp !== 0) return bandeiraCmp
      return (a.parcelas ?? 0) - (b.parcelas ?? 0)
    })

  const debito = sortRows(Array.from(debitoMap.values()))
  const credito = sortRows(Array.from(creditoMap.values()))

  return {
    debito,
    credito,
    totalBrutoDebito: debito.reduce((sum, r) => sum + r.bruto, 0),
    totalBrutoCredito: credito.reduce((sum, r) => sum + r.bruto, 0),
    totalLiquidoDebito: debito.reduce((sum, r) => sum + r.liquido, 0),
    totalLiquidoCredito: credito.reduce((sum, r) => sum + r.liquido, 0),
  }
}

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function BandeiraBreakdownLine({ row }: { row: BandeiraBreakdownRow }) {
  const label = row.parcelas && row.parcelas > 1 ? `${row.bandeira} ${row.parcelas}x` : row.bandeira
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 pl-3 text-xs">
      <span className="text-app-text-secondary dark:text-white/60">└── {label}</span>
      <span className="text-app-text-primary dark:text-white">
        R$ {formatBRL(row.bruto)} bruto · taxa {row.taxa.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}% = R$ {formatBRL(row.taxaValor)} · líq. R$ {formatBRL(row.liquido)}
      </span>
    </div>
  )
}

function CartaoBandeiraBreakdown({
  scope,
  breakdown,
  hasMaquininhaConfig,
  isPaymentConfigLoading,
}: {
  scope: 'debito' | 'credito'
  breakdown: CardBreakdown
  hasMaquininhaConfig: boolean
  isPaymentConfigLoading: boolean
}) {
  const rows = scope === 'debito' ? breakdown.debito : breakdown.credito
  const totalBruto = scope === 'debito' ? breakdown.totalBrutoDebito : breakdown.totalBrutoCredito
  const totalLiquido = scope === 'debito' ? breakdown.totalLiquidoDebito : breakdown.totalLiquidoCredito
  const titulo = scope === 'debito' ? 'Cartão — breakdown por bandeira (Débito)' : 'Cartão — breakdown por bandeira (Crédito)'

  return (
    <div className="rounded-integrallys-lg border border-app-border dark:border-app-border-dark p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-app-text-primary dark:text-white">{titulo}</p>
        <span className="text-xs text-app-text-secondary dark:text-white/60">
          Bruto R$ {formatBRL(totalBruto)} · Líq. R$ {formatBRL(totalLiquido)}
        </span>
      </div>
      {!hasMaquininhaConfig && !isPaymentConfigLoading && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Taxas não configuradas — exibindo taxa 0% e valor líquido = bruto.
        </p>
      )}
      {rows.length === 0 ? (
        <p className="text-xs text-app-text-secondary dark:text-white/60">
          Nenhum recebimento por bandeira nesta forma.
        </p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row) => (
            <BandeiraBreakdownLine key={`${scope}-${row.bandeira}-${row.parcelas ?? 0}`} row={row} />
          ))}
        </div>
      )}
    </div>
  )
}

export function CaixaView() {
  const { data, error, isLoading, session, openCaixa, addMovimentacao, closeCaixa, updateMovimentacao, deleteMovimentacao } = useCaixa()
  const { getCardFee, hasMaquininhaConfig, isLoading: isPaymentConfigLoading } = usePaymentConfig()
  const [activeModal, setActiveModal] = useState<CaixaModal>(null)
  const [selectedMovimentacaoId, setSelectedMovimentacaoId] = useState<string | null>(null)
  const [form, setForm] = useState({
    saldoInicial: '',
    descricao: '',
    valor: '',
    tipo: 'entrada',
    forma: 'dinheiro',
    bandeira: '',
    parcelas: '1',
    valorTransferido: '',
    observacoes: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resumoFechamento, setResumoFechamento] = useState<ResumoFechamentoSnapshot | null>(null)
  const [detalheFormaOpen, setDetalheFormaOpen] = useState(false)
  const [detalheForma, setDetalheForma] = useState<string | null>(null)
  const isClosed = !session.isOpen

  const handleOpenDetalheForma = (forma: string) => {
    setDetalheForma(forma)
    setDetalheFormaOpen(true)
  }

  const handleCloseDetalheForma = () => {
    setDetalheFormaOpen(false)
    setDetalheForma(null)
  }

  const summary = useMemo(() => {
    const totalEntradas = data.filter((item) => item.tipo === 'entrada').reduce((sum, item) => sum + item.valor, 0)
    const totalSaidas = data.filter((item) => item.tipo === 'saida').reduce((sum, item) => sum + item.valor, 0)
    const saldoInicial = session.saldoInicial
    const saldoAtual = isClosed ? session.saldoAtual : saldoInicial + totalEntradas - totalSaidas
    const resumoForma = [
      { label: 'Dinheiro', forma: 'dinheiro', value: data.filter((i) => (i.forma === 'dinheiro' || !i.forma) && i.tipo === 'entrada').reduce((sum, i) => sum + i.valor, 0) },
      { label: 'PIX', forma: 'pix', value: data.filter((i) => i.forma === 'pix' && i.tipo === 'entrada').reduce((sum, i) => sum + i.valor, 0) },
      { label: 'Cartão crédito', forma: 'cartao_credito', value: data.filter((i) => i.forma === 'cartao_credito' && i.tipo === 'entrada').reduce((sum, i) => sum + i.valor, 0) },
      { label: 'Cartão débito', forma: 'cartao_debito', value: data.filter((i) => i.forma === 'cartao_debito' && i.tipo === 'entrada').reduce((sum, i) => sum + i.valor, 0) },
    ]
    return { saldoInicial, totalEntradas, totalSaidas, saldoAtual, resumoForma }
  }, [data, session, isClosed])

  const dinheiroNaGaveta = useMemo(
    () => calcularDinheiroNaGaveta(summary.saldoInicial, data),
    [data, summary.saldoInicial],
  )
  const sugestaoCofre = sugerirTransferenciaCofre(summary.saldoInicial, dinheiroNaGaveta)
  const valorCofreNum = form.valorTransferido ? Number(form.valorTransferido) : 0
  const erroCofre = validarTransferenciaCofre(valorCofreNum, dinheiroNaGaveta)
  const brl = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  const cardBreakdown = useMemo(() => buildCardBreakdown(data, getCardFee), [data, getCardFee])

  const resetForm = () =>
    setForm({ saldoInicial: '', descricao: '', valor: '', tipo: 'entrada', forma: 'dinheiro', bandeira: '', parcelas: '1', valorTransferido: '', observacoes: '' })

  const handleModalClose = () => {
    setActiveModal(null)
    setSelectedMovimentacaoId(null)
    resetForm()
  }

  const openModal = (type: string, itemId?: string) => {
    if (itemId) setSelectedMovimentacaoId(itemId)
    else setSelectedMovimentacaoId(null)

    if (type === 'edit_caixa' && itemId) {
      const item = data.find((i) => i.id === itemId)
      if (item) {
        setForm((c) => ({ ...c, descricao: item.descricao, valor: String(item.valor), tipo: item.tipo, forma: item.forma || 'dinheiro' }))
      }
    }
    setActiveModal(type as CaixaModal)
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      if (activeModal === 'abrircaixa') {
        await openCaixa({ saldoInicial: Number(form.saldoInicial || 0), observacoes: form.observacoes || undefined })
        toast.success('Caixa aberto com sucesso.')
      } else if (activeModal === 'suprimento') {
        const valorNum = Number(form.valor || 0)
        const isCard = form.forma === 'cartao_credito' || form.forma === 'cartao_debito'
        const parcelasNum = form.forma === 'cartao_credito' ? Number(form.parcelas) || 1 : null
        await addMovimentacao({
          descricao: form.descricao || 'Recebimento',
          valor: valorNum,
          tipo: 'entrada',
          forma: form.forma,
          bandeira: isCard && form.bandeira ? form.bandeira : null,
          parcelas: parcelasNum,
          valorParcela:
            parcelasNum && parcelasNum > 0 && valorNum > 0 ? Number((valorNum / parcelasNum).toFixed(2)) : null,
        })
        toast.success('Recebimento lançado com sucesso.')
      } else if (activeModal === 'sangria') {
        await addMovimentacao({ descricao: form.descricao || 'Pagamento', valor: Number(form.valor || 0), tipo: 'saida', forma: form.forma })
        toast.success('Pagamento lançado com sucesso.')
      } else if (activeModal === 'fecharcaixa') {
        const valorTransferidoNum = form.valorTransferido ? Number(form.valorTransferido) : 0
        if (erroCofre) {
          toast.error(erroCofre)
          setIsSubmitting(false)
          return
        }
        const saldoFinal = summary.saldoInicial + summary.totalEntradas - summary.totalSaidas
        const saldoRestante = Math.max(0, Math.round((dinheiroNaGaveta - valorTransferidoNum) * 100) / 100)
        const snapshot: ResumoFechamentoSnapshot = {
          saldoInicial: summary.saldoInicial,
          totalEntradas: summary.totalEntradas,
          totalSaidas: summary.totalSaidas,
          saldoFinal,
          valorTransferido: valorTransferidoNum,
          saldoRestante,
          resumoForma: summary.resumoForma,
          observacoes: form.observacoes || '',
          fechadoEm: new Date().toISOString(),
        }
        await closeCaixa({
          valorTransferido: valorTransferidoNum || undefined,
          observacoes: form.observacoes || undefined,
          resumo: snapshot as unknown as Record<string, unknown>,
        })
        setResumoFechamento(snapshot)
        toast.success('Caixa fechado com sucesso.')
      } else if (activeModal === 'edit_caixa' && selectedMovimentacaoId) {
        await updateMovimentacao({ id: selectedMovimentacaoId, descricao: form.descricao, valor: Number(form.valor || 0), tipo: form.tipo as 'entrada' | 'saida', forma: form.forma })
        toast.success('Movimentação atualizada com sucesso.')
      }
      handleModalClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível concluir a operação do caixa.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="app-page">
      {/* UI-18: banner de status sempre visível ao chegar no turno.
          Sessão atual não expõe `abertura_em` (CaixaSessionState só tem
          isOpen/saldos/contadores), então não exibimos timestamp — fix
          do hook fica pra outro agente. */}
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl p-4',
          !isClosed
            ? 'bg-[var(--app-success-bg)] text-[var(--app-success-text)]'
            : 'bg-[var(--app-warning-bg)] text-[var(--app-warning-text)]',
        )}
        role="status"
      >
        {!isClosed ? (
          <>
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span className="font-medium">Caixa aberto</span>
            <span className="text-sm opacity-80">
              {summary.totalEntradas + summary.totalSaidas > 0
                ? `${data.length} movimento(s) registrado(s) na sessão`
                : 'Pronto pra receber movimentos'}
            </span>
          </>
        ) : (
          <>
            <Lock className="h-5 w-5 shrink-0" />
            <span className="font-medium">Caixa fechado</span>
            <span className="text-sm opacity-80">Abra o caixa para registrar movimentos</span>
          </>
        )}
      </div>

      {/* Status + Stat Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="p-6 border-none shadow-none bg-app-card dark:bg-app-card-dark flex flex-col justify-center items-center text-center">
          <p className="text-sm font-normal text-app-text-primary dark:text-white mb-4">Status do caixa</p>
          <Badge className={`${isClosed ? 'app-status-danger' : 'app-status-success'} px-4 py-1.5 rounded-lg mb-2`}>
            {isClosed ? 'FECHADO' : 'ABERTO'}
          </Badge>
          <p className="text-xs text-app-text-secondary dark:text-white/60 mt-1">Controle de caixa</p>
        </Card>
        <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Saldo Inicial', value: summary.saldoInicial, color: 'text-app-text-primary dark:text-white' },
            { label: 'Entradas', value: summary.totalEntradas, color: 'text-[var(--app-success-text)]' },
            { label: 'Saídas', value: summary.totalSaidas, color: 'text-[var(--app-danger-text)]' },
            { label: 'Saldo Atual', value: summary.saldoAtual, color: 'text-app-text-primary dark:text-white' },
          ].map((stat) => (
            <Card key={stat.label} className="p-6 border-none shadow-sm bg-app-card dark:bg-app-card-dark flex flex-col justify-center">
              <p className="text-sm font-normal text-app-text-secondary dark:text-white/60 mb-4">{stat.label}</p>
              <p className={`text-2xl font-normal ${stat.color}`}>
                R$ {stat.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </Card>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:flex lg:flex-wrap lg:items-center gap-3">
        <Button
          disabled={!isClosed}
          onClick={() => openModal('abrircaixa')}
          variant="outline"
          className="rounded-xl h-14 lg:h-12 flex items-center justify-center gap-3 border-app-border dark:border-app-border-dark shadow-sm font-normal text-app-text-primary dark:text-white/80 px-6 w-full lg:w-auto"
        >
          <Wallet size={18} />
          <span>{isClosed ? 'Abrir caixa' : 'Caixa aberto'}</span>
        </Button>
        <Button
          disabled={isClosed}
          onClick={() => openModal('suprimento')}
          variant="outline"
          className="rounded-xl h-14 lg:h-12 flex items-center justify-center gap-3 border-app-border dark:border-app-border-dark shadow-sm font-normal text-app-text-primary dark:text-white/80 px-6 w-full lg:w-auto"
        >
          <ArrowUpRight size={18} />
          <span>Recebimento</span>
        </Button>
        <Button
          disabled={isClosed}
          onClick={() => openModal('sangria')}
          variant="outline"
          className="rounded-xl h-14 lg:h-12 flex items-center justify-center gap-3 border-app-border dark:border-app-border-dark shadow-sm font-normal text-app-text-primary dark:text-white/80 px-6 w-full lg:w-auto"
        >
          <ArrowDownRight size={18} />
          <span>Pagamento</span>
        </Button>
        <Button
          disabled={isClosed}
          onClick={() => openModal('fecharcaixa')}
          variant="outline"
          className="rounded-xl h-14 lg:h-12 flex items-center justify-center gap-3 border-app-border dark:border-app-border-dark shadow-sm font-normal text-app-text-primary dark:text-white/80 px-6 w-full lg:w-auto"
        >
          <DollarSign size={18} />
          <span>Fechar caixa</span>
        </Button>
      </div>

      {/* Two-Panel: Table + Summary Sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Movimentações Table */}
        <Card className="xl:col-span-2 p-0 border-none shadow-xl bg-app-card dark:bg-app-card-dark">
          <div className="p-6 border-b border-app-border dark:border-app-border-dark">
            <h3 className="text-lg font-normal text-app-text-primary dark:text-white">Movimentações da sessão</h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-app-bg-secondary/50 dark:bg-app-hover/20 border-none">
                  <TableHead className="text-xs font-normal text-app-text-secondary dark:text-white/60">Data</TableHead>
                  <TableHead className="text-xs font-normal text-app-text-secondary dark:text-white/60">Hora</TableHead>
                  <TableHead className="text-xs font-normal text-app-text-secondary dark:text-white/60">Tipo</TableHead>
                  <TableHead className="text-xs font-normal text-app-text-secondary dark:text-white/60">Descrição</TableHead>
                  <TableHead className="text-xs font-normal text-app-text-secondary dark:text-white/60">Forma</TableHead>
                  <TableHead className="text-right text-xs font-normal text-app-text-secondary dark:text-white/60">Valor</TableHead>
                  <TableHead className="text-xs font-normal text-app-text-secondary dark:text-white/60">Operador</TableHead>
                  <TableHead className="text-center text-xs font-normal text-app-text-secondary dark:text-white/60">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-app-text-secondary dark:text-white/60">
                      Carregando movimentações...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && error && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-[var(--app-danger-text)]">
                      {error}
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && !error && data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-app-text-secondary dark:text-white/60">
                      Sem movimentações no período.
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && data.map((item) => (
                  <TableRow key={item.id} className="border-app-border dark:border-app-border-dark hover:bg-app-bg-secondary/50 dark:hover:bg-app-hover/20 transition-colors">
                    <TableCell className="text-app-text-secondary font-normal">{diaDoMovimento(item)}</TableCell>
                    <TableCell className="text-app-text-secondary font-normal">{item.hora || '--:--'}</TableCell>
                    <TableCell>
                      <Badge className={`${item.tipo === 'entrada' ? 'app-status-success' : 'app-status-danger'} font-normal border-none`}>
                        {item.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-app-text-primary dark:text-white font-normal">{item.descricao}</TableCell>
                    <TableCell className="text-app-text-secondary dark:text-white/60 font-normal">
                      {(() => {
                        const parts: string[] = [formaCaixaLabel(item.forma)]
                        if (item.bandeira) parts.push(item.bandeira)
                        if (item.parcelas && item.parcelas > 1) {
                          const valorParcela = item.valorParcela
                          parts.push(
                            valorParcela != null
                              ? `${item.parcelas}× de R$ ${valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                              : `${item.parcelas}×`,
                          )
                        }
                        return parts.join(' · ')
                      })()}
                    </TableCell>
                    <TableCell className={`text-right font-normal ${item.tipo === 'entrada' ? 'text-[var(--app-success-text)]' : 'text-[var(--app-danger-text)]'}`}>
                      R$ {formatBRL(item.valor)}
                    </TableCell>
                    <TableCell className="text-app-text-secondary dark:text-white/60 font-normal">{item.operador || '—'}</TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()} className="h-8 w-8 text-app-text-muted hover:text-app-text-primary mx-auto transition-colors">
                            <MoreVertical size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => toast.info(`Movimentação: ${item.descricao} — R$ ${formatBRL(item.valor)}`)}>
                            <Eye className="h-4 w-4 mr-2 text-app-text-secondary" />
                            <span>Visualizar</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openModal('edit_caixa', item.id)}>
                            <Edit className="h-4 w-4 mr-2 text-app-text-secondary" />
                            <span>Editar</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.info('Comprovante disponível em breve.')}>
                            <FileText className="h-4 w-4 mr-2 text-app-text-secondary" />
                            <span>Comprovante</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => { void deleteMovimentacao(item.id).then(() => toast.success('Movimentação estornada.')) }}
                            className="text-[var(--app-danger-text)]"
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            <span>Estornar</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Summary Sidebar */}
        <Card className="p-8 border-none shadow-xl bg-app-card dark:bg-app-card-dark h-fit sticky top-8 text-app-text-primary dark:text-white">
          <h3 className="text-lg font-normal mb-8">Resumo</h3>
          <div className="space-y-6">
            <div>
              <p className="text-sm font-normal mb-4">Por forma de pagamento</p>
              <div className="space-y-1">
                {summary.resumoForma.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleOpenDetalheForma(item.forma)}
                    title="Clique para ver transações"
                    className="flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-2 text-sm transition-colors hover:bg-app-bg-secondary dark:hover:bg-app-hover"
                  >
                    <span className="text-app-text-secondary dark:text-white/60">{item.label}</span>
                    <span className="font-normal">R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="h-px bg-app-bg-secondary dark:bg-app-hover" />
            <div>
              <p className="text-sm font-normal mb-4">Por tipo</p>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-app-text-secondary dark:text-white/60">Total de entradas</span>
                  <span className="font-normal text-[var(--app-success-text)]">R$ {summary.totalEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-app-text-secondary dark:text-white/60">Total de saídas</span>
                  <span className="font-normal text-[var(--app-danger-text)]">R$ {summary.totalSaidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
            <div className="h-px bg-app-bg-secondary dark:bg-app-hover" />
            <div className="flex justify-between items-center pt-2">
              <span className="text-base font-normal">Saldo final</span>
              <span className="text-xl font-normal">R$ {summary.saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Operation Modals */}
      <Dialog open={activeModal !== null} onOpenChange={(open) => !open && handleModalClose()}>
        <DialogContent size="sm" className="gap-0 overflow-hidden rounded-[24px] border border-app-border p-0 dark:border-app-border-dark">
          <div className="bg-app-card p-8 dark:bg-app-card-dark">
            <DialogHeader className="space-y-2">
              <DialogTitle className="flex items-center gap-2 text-xl font-normal text-app-text-primary dark:text-white">
                {activeModal === 'abrircaixa' && <Wallet className="h-5 w-5 text-[var(--app-primary)]" />}
                {activeModal === 'suprimento' && <ArrowUpRight className="h-5 w-5 text-[var(--app-primary)]" />}
                {activeModal === 'sangria' && <ArrowDownRight className="h-5 w-5 text-[var(--app-primary)]" />}
                {activeModal === 'fecharcaixa' && <Lock className="h-5 w-5 text-[var(--app-primary)]" />}
                {activeModal === 'edit_caixa' && <Banknote className="h-5 w-5 text-[var(--app-primary)]" />}
                {activeModal === 'abrircaixa' && 'Abrir caixa'}
                {activeModal === 'suprimento' && 'Recebimento'}
                {activeModal === 'sangria' && 'Pagamento'}
                {activeModal === 'fecharcaixa' && 'Fechar caixa'}
                {activeModal === 'edit_caixa' && 'Editar movimentação'}
              </DialogTitle>
              <DialogDescription className="text-sm text-app-text-muted">
                Revise os dados desta operação antes de confirmar.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 space-y-4">
              {activeModal === 'abrircaixa' && (
                <>
                  <div className="space-y-2">
                    <Label>Saldo inicial (R$)</Label>
                    <Input type="number" step="0.01" className="h-12 rounded-[12px]" value={form.saldoInicial} onChange={(e) => setForm((c) => ({ ...c, saldoInicial: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Input className="h-12 rounded-[12px]" value={form.observacoes} onChange={(e) => setForm((c) => ({ ...c, observacoes: e.target.value }))} />
                  </div>
                </>
              )}

              {(activeModal === 'suprimento' || activeModal === 'sangria' || activeModal === 'edit_caixa') && (
                <>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Input className="h-12 rounded-[12px]" value={form.descricao} onChange={(e) => setForm((c) => ({ ...c, descricao: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Valor (R$)</Label>
                      <Input type="number" step="0.01" className="h-12 rounded-[12px]" value={form.valor} onChange={(e) => setForm((c) => ({ ...c, valor: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Forma</Label>
                      <Select value={form.forma} onValueChange={(value) => setForm((c) => ({ ...c, forma: value }))}>
                        <SelectTrigger className="h-12 rounded-[12px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dinheiro">Dinheiro</SelectItem>
                          <SelectItem value="pix">PIX</SelectItem>
                          <SelectItem value="cartao_credito">Cartão crédito</SelectItem>
                          <SelectItem value="cartao_debito">Cartão débito</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {(form.forma === 'cartao_credito' || form.forma === 'cartao_debito') && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Bandeira (opcional)</Label>
                        <Select value={form.bandeira || 'nenhuma'} onValueChange={(value) => setForm((c) => ({ ...c, bandeira: value === 'nenhuma' ? '' : value }))}>
                          <SelectTrigger className="h-12 rounded-[12px]">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nenhuma">Não informar</SelectItem>
                            <SelectItem value="Visa">Visa</SelectItem>
                            <SelectItem value="Mastercard">Mastercard</SelectItem>
                            <SelectItem value="Elo">Elo</SelectItem>
                            <SelectItem value="Amex">Amex</SelectItem>
                            <SelectItem value="Hipercard">Hipercard</SelectItem>
                            <SelectItem value="Outros">Outros</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {form.forma === 'cartao_credito' && (
                        <div className="space-y-2">
                          <Label>Parcelas</Label>
                          <Select value={form.parcelas} onValueChange={(value) => setForm((c) => ({ ...c, parcelas: value }))}>
                            <SelectTrigger className="h-12 rounded-[12px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 12 }, (_, idx) => idx + 1).map((n) => (
                                <SelectItem key={n} value={String(n)}>
                                  {n}x
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}

                  {form.forma === 'cartao_credito' && Number(form.parcelas) > 1 && Number(form.valor) > 0 && (
                    <p className="text-xs text-app-text-secondary dark:text-white/60">
                      {Number(form.parcelas)}× de{' '}
                      <span className="font-medium text-app-text-primary dark:text-white">
                        R$ {(Number(form.valor) / Number(form.parcelas)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </p>
                  )}
                </>
              )}

              {activeModal === 'fecharcaixa' && (
                <>
                  <div className="rounded-xl border border-app-border dark:border-app-border-dark p-4 space-y-2 text-sm" data-testid="fechamento-resumo">
                    <div className="flex justify-between"><span>Saldo inicial (abertura)</span><strong>{brl(summary.saldoInicial)}</strong></div>
                    <div className="flex justify-between"><span>Entradas do dia</span><strong>{brl(summary.totalEntradas)}</strong></div>
                    <div className="flex justify-between"><span>Saídas do dia</span><strong>{brl(summary.totalSaidas)}</strong></div>
                    <div className="flex justify-between border-t border-app-border dark:border-app-border-dark pt-2"><span>Dinheiro em caixa agora</span><strong data-testid="dinheiro-gaveta">{brl(dinheiroNaGaveta)}</strong></div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="valor-cofre">Valor transferido ao cofre (R$)</Label>
                    <Input id="valor-cofre" type="number" min="0" step="0.01" className="h-12 rounded-[12px]" value={form.valorTransferido} onChange={(e) => setForm((c) => ({ ...c, valorTransferido: e.target.value }))} aria-invalid={Boolean(erroCofre)} />
                    <Button type="button" variant="outline" size="sm" className="rounded-lg" disabled={sugestaoCofre <= 0} onClick={() => setForm((c) => ({ ...c, valorTransferido: String(sugestaoCofre) }))}>
                      Transferir {brl(sugestaoCofre)} (tudo que passa da abertura)
                    </Button>
                    {erroCofre ? (
                      <p className="text-xs text-[var(--app-danger-text)]" role="alert">{erroCofre}</p>
                    ) : (
                      <p className="text-xs text-app-text-secondary dark:text-white/60">Fica no caixa em dinheiro: <strong>{brl(dinheiroNaGaveta - valorCofreNum)}</strong></p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Input className="h-12 rounded-[12px]" value={form.observacoes} onChange={(e) => setForm((c) => ({ ...c, observacoes: e.target.value }))} />
                  </div>
                </>
              )}
            </div>

            <DialogFooter className="mt-8">
              <Button variant="outline" className="h-11 rounded-xl border-app-border dark:border-app-border-dark" onClick={handleModalClose}>
                Cancelar
              </Button>
              <Button className="h-11 rounded-xl bg-app-primary text-white hover:bg-app-primary-hover" disabled={isSubmitting || (activeModal === 'fecharcaixa' && Boolean(erroCofre))} onClick={() => void handleSubmit()}>
                {isSubmitting ? 'Salvando...' : activeModal === 'abrircaixa' ? 'Abrir caixa' : activeModal === 'fecharcaixa' ? 'Fechar caixa' : activeModal === 'edit_caixa' ? 'Salvar' : 'Registrar'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <DetalheFormaModal
        open={detalheFormaOpen}
        onClose={handleCloseDetalheForma}
        forma={detalheForma}
        items={data}
      />

      <Dialog open={resumoFechamento !== null} onOpenChange={(open) => !open && setResumoFechamento(null)}>
        <DialogContent className="gap-0 overflow-hidden rounded-[24px] border border-app-border p-0 dark:border-app-border-dark">
          <div id="resumo-fechamento-print" className="bg-app-card p-8 dark:bg-app-card-dark">
            <DialogHeader className="space-y-2">
              <DialogTitle className="flex items-center gap-2 text-xl font-normal text-app-text-primary dark:text-white">
                <CheckCircle2 className="h-5 w-5 text-[var(--app-success-text)]" />
                Resumo do fechamento
              </DialogTitle>
              <DialogDescription className="text-sm text-app-text-muted">
                {resumoFechamento && new Date(resumoFechamento.fechadoEm).toLocaleString('pt-BR')}
              </DialogDescription>
            </DialogHeader>

            {resumoFechamento && (
              <div className="mt-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-[12px] border border-app-border p-4 dark:border-app-border-dark">
                    <p className="text-xs text-app-text-secondary dark:text-white/60">Saldo inicial</p>
                    <p className="text-lg font-normal text-app-text-primary dark:text-white">
                      R$ {resumoFechamento.saldoInicial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="rounded-[12px] border border-app-border p-4 dark:border-app-border-dark">
                    <p className="text-xs text-app-text-secondary dark:text-white/60">Saldo do fechamento</p>
                    <p className="text-lg font-normal text-app-text-primary dark:text-white">
                      R$ {resumoFechamento.saldoFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-[12px] bg-app-bg-secondary/50 p-4 dark:bg-app-hover/30">
                    <p className="text-xs text-app-text-secondary dark:text-white/60">Total de entradas</p>
                    <p className="text-lg font-normal text-[var(--app-success-text)]">
                      R$ {resumoFechamento.totalEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="rounded-[12px] bg-app-bg-secondary/50 p-4 dark:bg-app-hover/30">
                    <p className="text-xs text-app-text-secondary dark:text-white/60">Total de saídas</p>
                    <p className="text-lg font-normal text-[var(--app-danger-text)]">
                      R$ {resumoFechamento.totalSaidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-[12px] border border-[var(--app-primary)]/30 bg-app-primary/5 p-4">
                    <p className="text-xs text-app-text-secondary dark:text-white/60">Transferido ao cofre</p>
                    <p className="text-lg font-normal text-app-text-primary dark:text-white">
                      R$ {resumoFechamento.valorTransferido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="rounded-[12px] border border-amber-300/40 bg-amber-50 p-4 dark:bg-amber-900/10">
                    <p className="text-xs text-app-text-secondary dark:text-white/60">Caixinha de troco</p>
                    <p className="text-lg font-normal text-app-text-primary dark:text-white">
                      R$ {resumoFechamento.saldoRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {resumoFechamento.resumoForma.some((item) => item.value > 0) && (
                  <div className="rounded-[12px] border border-app-border p-4 dark:border-app-border-dark">
                    <p className="mb-3 text-xs font-medium uppercase tracking-wider text-app-text-secondary dark:text-white/60">
                      Entradas por forma de pagamento
                    </p>
                    <div className="space-y-2">
                      {resumoFechamento.resumoForma
                        .filter((item) => item.forma !== 'cartao_credito' && item.forma !== 'cartao_debito')
                        .map((item) => (
                          <div key={item.label} className="flex justify-between text-sm">
                            <span className="text-app-text-secondary dark:text-white/60">{item.label}</span>
                            <span className="font-normal text-app-text-primary dark:text-white">
                              R$ {formatBRL(item.value)}
                            </span>
                          </div>
                        ))}
                      {(cardBreakdown.debito.length > 0 || cardBreakdown.credito.length > 0) && (
                        <div className="pt-2 mt-2 border-t border-app-border dark:border-app-border-dark space-y-3">
                          {!hasMaquininhaConfig && !isPaymentConfigLoading && (
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                              Taxas não configuradas — exibindo valores brutos.
                            </p>
                          )}
                          {cardBreakdown.debito.length > 0 && (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium text-app-text-primary dark:text-white">Débito</span>
                                <span className="text-xs text-app-text-secondary dark:text-white/60">
                                  Bruto R$ {formatBRL(cardBreakdown.totalBrutoDebito)} · Líq. R$ {formatBRL(cardBreakdown.totalLiquidoDebito)}
                                </span>
                              </div>
                              {cardBreakdown.debito.map((row) => (
                                <BandeiraBreakdownLine key={`d-${row.bandeira}`} row={row} />
                              ))}
                            </div>
                          )}
                          {cardBreakdown.credito.length > 0 && (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium text-app-text-primary dark:text-white">Crédito</span>
                                <span className="text-xs text-app-text-secondary dark:text-white/60">
                                  Bruto R$ {formatBRL(cardBreakdown.totalBrutoCredito)} · Líq. R$ {formatBRL(cardBreakdown.totalLiquidoCredito)}
                                </span>
                              </div>
                              {cardBreakdown.credito.map((row) => (
                                <BandeiraBreakdownLine key={`c-${row.bandeira}-${row.parcelas ?? 0}`} row={row} />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {resumoFechamento.observacoes && (
                  <div className="rounded-[12px] border border-app-border p-4 dark:border-app-border-dark">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-app-text-secondary dark:text-white/60">
                      Observações
                    </p>
                    <p className="text-sm text-app-text-primary dark:text-white">{resumoFechamento.observacoes}</p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="mt-8 print:hidden">
              <Button
                variant="outline"
                className="h-11 rounded-xl border-app-border dark:border-app-border-dark"
                onClick={() => setResumoFechamento(null)}
              >
                Fechar
              </Button>
              <Button
                className="h-11 rounded-xl bg-app-primary text-white hover:bg-app-primary-hover gap-2"
                onClick={() => window.print()}
              >
                <Printer className="h-4 w-4" />
                Imprimir resumo
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
