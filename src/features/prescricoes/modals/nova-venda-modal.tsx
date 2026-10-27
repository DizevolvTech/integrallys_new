'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ShoppingCart,
  CheckCircle2,
  Plus,
  Trash2,
  CreditCard,
  Package,
  User,
  ShoppingBag,
  Banknote,
  QrCode,
} from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import type { PrescricaoInput, PrescricaoItemInput } from '@/hooks/use-prescricoes'
import { usePaymentConfig, DEFAULT_PAYMENT_DISCOUNTS } from '@/features/prescricoes/hooks/use-payment-config'
import { formatarMoeda } from '@/lib/moeda'

export interface NovaVendaModalProduct {
  id: string
  name: string
  stock: number
  price: number
  costPrice: number
}

export interface NovaVendaModalUser {
  id: string
  name: string
  tipoVinculo?: string
}

interface CartItem {
  productId: string
  productName: string
  quantity: number
  salePrice: number
  costPrice: number
  posology?: string
}

interface NovaVendaModalProps {
  isOpen: boolean
  onClose: () => void
  patients: Array<{ id: string; nome: string }>
  products?: NovaVendaModalProduct[]
  users?: NovaVendaModalUser[]
  onSave: (venda: PrescricaoInput) => Promise<void> | void
  onAfterSale?: (payload: { prescriptionId: string; patientName: string }) => void
}

type PaymentMethodKey = 'pix' | 'dinheiro' | 'cartao_debito' | 'cartao_credito'
type PaymentDiscountConfig = Record<PaymentMethodKey, number>

export function NovaVendaModal({
  isOpen,
  onClose,
  onSave,
  onAfterSale,
  patients = [],
  products = [],
  users = [],
}: NovaVendaModalProps) {
  const [isSuccess, setIsSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [selectedSellerId, setSelectedSellerId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [installmentCount, setInstallmentCount] = useState(1)
  const [patientSearch, setPatientSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')

  const [selectedProductId, setSelectedProductId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [posology, setPosology] = useState('')

  const [cartItems, setCartItems] = useState<CartItem[]>([])

  const {
    paymentDiscounts,
    savePaymentDiscounts,
    getCardFee,
  } = usePaymentConfig()

  const [discountType, setDiscountType] = useState<'value' | 'percent'>('value')
  const [discountValue, setDiscountValue] = useState('')
  const [justificativaDesconto, setJustificativaDesconto] = useState('')
  const [discountError, setDiscountError] = useState('')
  const [discountConfig, setDiscountConfig] = useState<PaymentDiscountConfig>(DEFAULT_PAYMENT_DISCOUNTS)
  const [isDiscountConfigOpen, setIsDiscountConfigOpen] = useState(false)
  const [discountConfigDirty, setDiscountConfigDirty] = useState(false)
  const [isSavingDiscountConfig, setIsSavingDiscountConfig] = useState(false)

  useEffect(() => {
    if (!discountConfigDirty) {
      setDiscountConfig(paymentDiscounts)
    }
  }, [paymentDiscounts, discountConfigDirty])

  const isConsumo = paymentMethod === 'consumo'

  const subtotal = cartItems.reduce((acc, item) => {
    const unitPrice = isConsumo ? item.costPrice : item.salePrice
    return acc + unitPrice * item.quantity
  }, 0)

  const manualDiscountAmount = useMemo(() => {
    const val = parseFloat(discountValue) || 0
    if (discountType === 'value') return val
    return subtotal * (val / 100)
  }, [discountValue, discountType, subtotal])

  const configuredDiscountPercent =
    paymentMethod === 'pix' ||
    paymentMethod === 'dinheiro' ||
    paymentMethod === 'cartao_debito' ||
    paymentMethod === 'cartao_credito'
      ? discountConfig[paymentMethod]
      : 0
  const configuredDiscountAmount = isConsumo
    ? 0
    : subtotal * (configuredDiscountPercent / 100)
  const discountAmount = isConsumo
    ? 0
    : Math.min(subtotal, configuredDiscountAmount + manualDiscountAmount)
  const total = isConsumo ? subtotal : Math.max(0, subtotal - discountAmount)

  const installmentLabel = paymentMethod === 'cartao_credito' ? `1/${installmentCount}` : '1/1'
  void installmentLabel

  const isCartaoCredito = paymentMethod === 'cartao_credito'
  const installmentValue = isCartaoCredito && installmentCount > 0 ? total / installmentCount : 0
  const installmentFeePercent = isCartaoCredito ? getCardFee(installmentCount) : 0

  const handleSaveDiscountConfig = async () => {
    if (isSavingDiscountConfig) return
    setIsSavingDiscountConfig(true)
    try {
      await savePaymentDiscounts(discountConfig)
      setDiscountConfigDirty(false)
      toast.success('Descontos por forma de pagamento atualizados.')
    } catch {
      toast.error('Não foi possível salvar os descontos. Tente novamente.')
    } finally {
      setIsSavingDiscountConfig(false)
    }
  }

  const handlePaymentMethodChange = (methodId: string) => {
    const nextMethod = methodId === paymentMethod ? '' : methodId
    setPaymentMethod(nextMethod)
    if (nextMethod !== 'cartao_credito') {
      setInstallmentCount(1)
    }
  }

  const handleDiscountConfigChange = (method: PaymentMethodKey, rawValue: string) => {
    const numeric = Number(rawValue)
    const normalized = Number.isFinite(numeric) ? Math.min(100, Math.max(0, numeric)) : 0
    setDiscountConfig((prev) => ({ ...prev, [method]: normalized }))
    setDiscountConfigDirty(true)
  }

  const handleAddProduct = () => {
    const product = products.find((p) => p.id === selectedProductId)
    if (!product) return

    if (quantity > product.stock) {
      toast.error('Quantidade maior que o estoque disponível.')
      return
    }

    const newItem: CartItem = {
      productId: product.id,
      productName: product.name,
      quantity,
      salePrice: product.price,
      costPrice: product.costPrice,
      posology: posology.trim() || undefined,
    }

    setCartItems((prev) => [...prev, newItem])
    setSelectedProductId('')
    setQuantity(1)
    setPosology('')
  }

  const handleRemoveItem = (index: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index))
  }

  const resetForm = () => {
    setSelectedPatientId('')
    setSelectedSellerId('')
    setPaymentMethod('')
    setCartItems([])
    setDiscountValue('')
    setJustificativaDesconto('')
    setDiscountError('')
    setInstallmentCount(1)
    setSelectedProductId('')
    setQuantity(1)
    setPosology('')
    setPatientSearch('')
    setProductSearch('')
  }

  const handleSave = async () => {
    if (isSubmitting) return

    if (discountAmount > 0 && !justificativaDesconto.trim()) {
      setDiscountError('Justificativa obrigatória quando há desconto.')
      return
    }
    setDiscountError('')

    setIsSubmitting(true)
    try {
      const patient = patients.find((p) => p.id === selectedPatientId)
      const hasDiscount = discountAmount > 0
      const itemsPayload: PrescricaoItemInput[] = cartItems.map((item) => ({
        productId: item.productId || undefined,
        descricao: item.productName,
        quantidade: item.quantity,
        valorUnitario: isConsumo ? item.costPrice : item.salePrice,
        posologia: item.posology || undefined,
      }))
      await onSave({
        pacienteId: selectedPatientId,
        valorTotal: Number(total.toFixed(2)),
        valorBruto: hasDiscount ? Number(subtotal.toFixed(2)) : undefined,
        numeroParcelas: isCartaoCredito ? installmentCount : undefined,
        valorParcela: isCartaoCredito ? Number(installmentValue.toFixed(2)) : undefined,
        descontoTipo: hasDiscount ? discountType : undefined,
        descontoPercentual:
          hasDiscount && discountType === 'percent' ? parseFloat(discountValue) || 0 : undefined,
        descontoValor: hasDiscount ? Number(discountAmount.toFixed(2)) : undefined,
        justificativaDesconto: hasDiscount ? justificativaDesconto.trim() : undefined,
        vendedorId: selectedSellerId || undefined,
        status: paymentMethod ? 'Convertida' : 'Ativa',
        tipo: 'Prescrição',
        data: new Date().toISOString().slice(0, 10),
        formaPagamento: paymentMethod || undefined,
        items: itemsPayload,
      })
      onAfterSale?.({ prescriptionId: '', patientName: patient?.nome || 'Paciente' })
      setIsSuccess(true)
      setTimeout(() => {
        setIsSuccess(false)
        resetForm()
        onClose()
      }, 1200)
    } catch {
      toast.error('Não foi possível concluir a prescrição/venda agora. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedProductDetails = products.find((p) => p.id === selectedProductId)
  const filteredPatients = patients.filter((p) =>
    p.nome.toLowerCase().includes(patientSearch.toLowerCase()),
  )
  const filteredProducts = products.filter(
    (p) =>
      Number(p.stock ?? 0) > 0 &&
      p.name.toLowerCase().includes(productSearch.toLowerCase()),
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="2xl" className="bg-app-card dark:bg-app-card-dark rounded-[24px] border-none p-0 flex flex-col shadow-2xl">
        {isSuccess ? (
          <div className="flex flex-col items-center justify-center p-20 space-y-6 h-full bg-app-card dark:bg-app-card-dark">
            <div className="w-24 h-24 app-status-success rounded-full flex items-center justify-center animate-in zoom-in duration-300">
              <CheckCircle2 size={48} />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold text-app-text-primary dark:text-white">
                {paymentMethod ? 'Prescrição/Vendas realizada!' : 'Prescrição/Vendas salva!'}
              </h2>
              <p className="text-app-text-secondary dark:text-white/60 text-xl">
                {paymentMethod
                  ? paymentMethod === 'consumo'
                    ? 'Estoque atualizado com preço de custo. Venda não lançada no caixa.'
                    : 'Estoque atualizado e transação lançada no caixa.'
                  : 'A prescrição foi gerada e está aguardando pagamento.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-8 py-6 bg-app-card dark:bg-app-card-dark border-b border-app-border dark:border-app-border-dark flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 app-status-info rounded-2xl flex items-center justify-center text-app-primary dark:text-[var(--app-info-text)]">
                  <ShoppingCart className="h-6 w-6" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold text-app-text-primary dark:text-white">
                    Nova Prescrição/Vendas
                  </DialogTitle>
                  <p className="text-base text-app-text-secondary dark:text-white/60 font-normal">
                    Registre a Prescrição/Vendas de produtos e prescrições avulsas
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-hidden grid grid-cols-12 relative">
              <div className="col-span-12 lg:col-span-8 p-8 overflow-y-auto bg-app-bg-secondary/50 dark:bg-app-surface-muted border-r border-app-border dark:border-app-border-dark flex flex-col gap-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-white dark:bg-app-hover rounded-2xl border border-app-border dark:border-app-border-dark shadow-sm">
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-app-text-primary dark:text-white/70 flex items-center gap-2 uppercase tracking-wide">
                      <User size={16} className="text-[var(--app-info-text)]" />
                      Paciente
                    </Label>
                    <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                      <SelectTrigger className="h-12 rounded-xl bg-app-bg-secondary dark:bg-app-surface-muted border-app-border dark:border-app-border-dark focus:ring-[var(--app-primary)]/20 text-app-text-primary dark:text-white font-medium">
                        <SelectValue preferPlaceholder placeholder="Selecione o paciente..." />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="px-2 pb-2">
                          <Input
                            value={patientSearch}
                            onChange={(event) => setPatientSearch(event.target.value)}
                            placeholder="Buscar paciente"
                            className="h-9"
                          />
                        </div>
                        {filteredPatients.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-app-text-primary dark:text-white/70 flex items-center gap-2 uppercase tracking-wide">
                      <CheckCircle2 size={16} className="text-[var(--app-info-text)]" />
                      Vendedor
                    </Label>
                    <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
                      <SelectTrigger className="h-12 rounded-xl bg-app-bg-secondary dark:bg-app-surface-muted border-app-border dark:border-app-border-dark focus:ring-[var(--app-primary)]/20 text-app-text-primary dark:text-white font-medium">
                        <SelectValue preferPlaceholder placeholder="Profissional responsável" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                            {u.tipoVinculo && (
                              <span className="text-app-text-muted text-xs ml-1">
                                (Especialista • {u.tipoVinculo})
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2 text-app-text-primary dark:text-white">
                    <Package className="text-app-primary dark:text-[var(--app-info-text)]" />
                    Adicionar Produtos
                  </h3>

                  <div className="flex flex-col gap-4 bg-white dark:bg-app-hover p-6 rounded-2xl border border-app-border dark:border-app-border-dark shadow-sm">
                    <div className="flex gap-4 items-end">
                    <div className="flex-1 space-y-2">
                      <Label className="text-xs font-semibold text-app-text-secondary dark:text-white/60 uppercase">
                        Buscar Produto
                      </Label>
                      <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                        <SelectTrigger className="h-12 rounded-xl bg-app-bg-secondary dark:bg-app-surface-muted border-app-border dark:border-app-border-dark text-base text-app-text-primary dark:text-white font-medium focus:ring-[var(--app-primary)]">
                          <SelectValue preferPlaceholder placeholder="Selecione um produto...">
                            {selectedProductId
                              ? products.find((p) => p.id === selectedProductId)?.name
                              : 'Selecione um produto...'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="min-w-[400px]">
                          <div className="px-2 pb-2">
                            <Input
                              value={productSearch}
                              onChange={(event) => setProductSearch(event.target.value)}
                              placeholder="Buscar produto"
                              className="h-9"
                            />
                          </div>
                          {filteredProducts.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="cursor-pointer">
                              <span className="font-medium mr-2">{p.name}</span>
                              <span className="text-app-text-secondary dark:text-white/60 text-sm">
                                (Estoque: {p.stock}) - {formatarMoeda(isConsumo ? p.costPrice : p.price)}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-24 shrink-0 space-y-2">
                      <Label className="text-xs font-semibold text-app-text-secondary dark:text-white/60 uppercase">
                        Qtd.
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        value={quantity}
                        onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                        className="h-12 rounded-xl bg-app-bg-secondary dark:bg-app-surface-muted text-center text-lg font-semibold text-app-text-primary dark:text-white focus-visible:ring-[var(--app-primary)]"
                      />
                    </div>

                    <div className="w-36 shrink-0 space-y-2">
                      <Label className="text-xs font-semibold text-app-text-secondary dark:text-white/60 uppercase">
                        Unitário
                      </Label>
                      <div className="h-12 flex items-center justify-center bg-app-bg-secondary dark:bg-app-hover rounded-xl text-base font-bold text-app-text-primary dark:text-white/70 whitespace-nowrap">
                        {formatarMoeda(isConsumo ? selectedProductDetails?.costPrice : selectedProductDetails?.price)}
                      </div>
                    </div>

                    <div className="flex-1 min-w-[140px] space-y-2">
                      <Label className="text-xs font-semibold text-app-text-secondary dark:text-white/60 uppercase">
                        Posologia
                      </Label>
                      <Input
                        value={posology}
                        onChange={(e) => setPosology(e.target.value)}
                        placeholder="Ex: 1 cápsula a cada 12h"
                        className="h-12 rounded-xl bg-app-bg-secondary dark:bg-app-surface-muted"
                      />
                    </div>
                    </div>

                    <Button
                      onClick={handleAddProduct}
                      disabled={!selectedProductId}
                      className="h-12 w-full rounded-xl bg-app-primary hover:bg-app-primary-hover text-white font-bold text-sm uppercase tracking-wide shadow-lg shadow-sm transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus size={18} className="mr-2" />
                      Adicionar
                    </Button>
                  </div>
                </div>

                <div className="flex-1 flex flex-col min-h-[250px] bg-white dark:bg-app-hover rounded-2xl border border-app-border dark:border-app-border-dark shadow-sm overflow-hidden">
                  <Table>
                    <TableHeader className="bg-app-bg-secondary dark:bg-app-hover">
                      <TableRow className="border-b-gray-100 dark:border-b-gray-800 hover:bg-transparent">
                        <TableHead className="py-4 pl-6 text-xs font-bold text-app-text-secondary dark:text-white/60 uppercase tracking-wider">
                          Produto
                        </TableHead>
                        <TableHead className="py-4 text-center text-xs font-bold text-app-text-secondary dark:text-white/60 uppercase tracking-wider">
                          Qtd
                        </TableHead>
                        <TableHead className="py-4 text-xs font-bold text-app-text-secondary dark:text-white/60 uppercase tracking-wider">
                          Posologia
                        </TableHead>
                        <TableHead className="py-4 text-right text-xs font-bold text-app-text-secondary dark:text-white/60 uppercase tracking-wider">
                          Unit.
                        </TableHead>
                        <TableHead className="py-4 text-right pr-6 text-xs font-bold text-app-text-secondary dark:text-white/60 uppercase tracking-wider">
                          Total
                        </TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cartItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-64 text-center hover:bg-transparent">
                            <div className="flex flex-col items-center justify-center text-app-text-muted gap-4 opacity-50">
                              <div className="h-20 w-20 bg-app-bg-secondary dark:bg-app-hover rounded-full flex items-center justify-center">
                                <ShoppingBag size={40} strokeWidth={1.5} />
                              </div>
                              <div className="space-y-1">
                                <p className="text-lg font-medium">O carrinho está vazio</p>
                                <p className="text-sm">Adicione produtos acima para começar</p>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        cartItems.map((item, idx) => (
                          <TableRow
                            key={idx}
                            className="hover:bg-app-hover dark:hover:bg-app-hover transition-colors border-b-gray-100 dark:border-b-gray-800"
                          >
                            <TableCell className="pl-6 py-5">
                              <span className="font-semibold text-app-text-primary dark:text-white text-base">
                                {item.productName}
                              </span>
                            </TableCell>
                            <TableCell className="text-center py-5">
                              <Badge
                                variant="outline"
                                className="px-3 py-1 border-app-border dark:border-app-border-dark text-app-text-primary dark:text-white font-bold text-sm rounded-lg"
                              >
                                {item.quantity}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-5 text-sm text-app-text-secondary dark:text-white/70 max-w-[220px]">
                              {item.posology || '-'}
                            </TableCell>
                            <TableCell className="text-right py-5 text-app-text-secondary dark:text-white/60 font-medium">
                              {formatarMoeda(isConsumo ? item.costPrice : item.salePrice)}
                            </TableCell>
                            <TableCell className="text-right pr-6 py-5 font-bold text-app-primary dark:text-[var(--app-info-text)] text-base">
                              R$ {((isConsumo ? item.costPrice : item.salePrice) * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="py-5 pr-4">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveItem(idx)}
                                className="h-10 w-10 text-app-text-muted hover:text-[var(--app-danger-text)] hover:bg-app-hover dark:hover:bg-app-hover rounded-xl transition-all"
                              >
                                <Trash2 size={18} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="col-span-12 lg:col-span-4 bg-app-card dark:bg-app-card-dark flex flex-col h-full border-l border-app-border dark:border-app-border-dark shadow-2xl z-10 relative overflow-hidden">
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                  <h3 className="text-xl font-bold text-app-text-primary dark:text-white flex items-center gap-2 mb-8">
                    <CreditCard className="h-6 w-6 text-app-primary dark:text-[var(--app-info-text)]" />
                    Status e Pagamento
                  </h3>

                  <div className="space-y-8 flex-1">
                    <div className="space-y-4">
                      <Label className="text-base font-semibold text-app-text-primary dark:text-white/70">
                        Forma de Pagamento
                        {!paymentMethod && (
                          <span className="text-sm font-normal text-app-text-muted ml-2">
                            (Opcional — salva como ativa)
                          </span>
                        )}
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { id: 'dinheiro', label: 'Dinheiro', icon: Banknote },
                          { id: 'pix', label: 'PIX', icon: QrCode },
                          { id: 'cartao_credito', label: 'Crédito', icon: CreditCard },
                          { id: 'cartao_debito', label: 'Débito', icon: CreditCard },
                          { id: 'consumo', label: 'Consumo', icon: Package },
                        ].map((method) => (
                          <button
                            key={method.id}
                            onClick={() => handlePaymentMethodChange(method.id)}
                            className={`
                              h-16 rounded-xl border-2 text-sm font-semibold transition-all flex flex-col items-center justify-center gap-1
                              ${
                                paymentMethod === method.id
                                  ? 'border-[var(--app-primary)] app-status-info dark:bg-transparent text-app-primary dark:text-[var(--app-info-text)] shadow-md ring-1 ring-[#0039A6]/20'
                                  : 'border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark text-app-text-secondary hover:border-app-hover-strong dark:hover:border-app-hover-strong hover:bg-app-hover dark:hover:bg-app-hover'
                              }
                            `}
                          >
                            <method.icon
                              className={`h-5 w-5 ${
                                paymentMethod === method.id
                                  ? 'text-app-primary dark:text-[var(--app-info-text)]'
                                  : 'text-app-text-muted'
                              }`}
                            />
                            <span>{method.label}</span>
                          </button>
                        ))}
                      </div>
                      {paymentMethod === 'cartao_credito' && (
                        <div className="space-y-2 pt-2">
                          <Label className="text-sm font-medium text-app-text-secondary dark:text-white/60">
                            Quantidade de parcelas
                          </Label>
                          <Select
                            value={String(installmentCount)}
                            onValueChange={(value) => setInstallmentCount(Number(value))}
                          >
                            <SelectTrigger className="h-12 rounded-xl bg-white dark:bg-app-hover border-app-border dark:border-app-border-dark">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 12 }, (_, idx) => idx + 1).map((parcel) => (
                                <SelectItem key={parcel} value={String(parcel)}>
                                  {`1/${parcel}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {total > 0 && (
                            <p className="text-xs text-app-text-secondary dark:text-white/60">
                              {installmentCount}x de{' '}
                              <span className="font-semibold text-app-text-primary dark:text-white">
                                R$ {installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                              {installmentFeePercent > 0 && (
                                <span className="ml-1 text-app-text-muted">
                                  (taxa da operadora {installmentFeePercent.toFixed(2).replace('.', ',')}%)
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-4 pt-4 border-t border-app-border dark:border-app-border-dark">
                      <Label className="text-base font-semibold text-app-text-primary dark:text-white/70">
                        Desconto
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        <Select
                          value={discountType}
                          onValueChange={(v) => setDiscountType(v as 'value' | 'percent')}
                        >
                          <SelectTrigger className="h-14 rounded-xl bg-white dark:bg-app-hover border-app-border dark:border-app-border-dark text-base font-medium text-app-text-primary dark:text-white shadow-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="value">Valor (R$)</SelectItem>
                            <SelectItem value="percent">Porcentagem (%)</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="relative w-full">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted font-medium">
                            {discountType === 'value' ? 'R$' : '%'}
                          </span>
                          <Input
                            type="number"
                            placeholder="0,00"
                            value={discountValue}
                            onChange={(e) => {
                              setDiscountValue(e.target.value)
                              setDiscountError('')
                            }}
                            disabled={isConsumo}
                            className="h-14 pl-12 rounded-xl bg-white dark:bg-app-hover border-app-border dark:border-app-border-dark text-lg font-semibold text-app-text-primary dark:text-white shadow-sm w-full"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-app-text-secondary dark:text-white/60">
                          Justificativa / Convênio {discountAmount > 0 && <span className="text-[var(--app-danger-text)]">*</span>}
                        </Label>
                        <Input
                          placeholder="Ex: Sindicato Água Boa, Convênio XYZ"
                          value={justificativaDesconto}
                          onChange={(e) => {
                            setJustificativaDesconto(e.target.value)
                            setDiscountError('')
                          }}
                          disabled={isConsumo}
                          className="h-11 rounded-xl bg-white dark:bg-app-hover border-app-border dark:border-app-border-dark"
                        />
                      </div>
                      {discountError && (
                        <p className="text-xs text-[var(--app-danger-text)]">{discountError}</p>
                      )}
                      {isConsumo && (
                        <p className="text-xs text-[var(--app-warning-text)]">
                          Venda por consumo: calculada ao preço de custo, não lança no caixa
                        </p>
                      )}
                    </div>

                    <div className="space-y-3 pt-4 border-t border-app-border dark:border-app-border-dark">
                      <button
                        type="button"
                        onClick={() => setIsDiscountConfigOpen((prev) => !prev)}
                        className="text-sm font-semibold text-app-primary dark:text-[var(--app-info-text)]"
                      >
                        {isDiscountConfigOpen ? 'Ocultar descontos por forma' : 'Configurar descontos por forma'}
                      </button>
                      {isDiscountConfigOpen && (
                        <div className="space-y-3 rounded-xl border border-app-border dark:border-app-border-dark p-4 bg-white dark:bg-app-hover">
                          {[
                            { key: 'pix', label: 'Pix' },
                            { key: 'dinheiro', label: 'Dinheiro' },
                            { key: 'cartao_debito', label: 'Cartão Débito' },
                            { key: 'cartao_credito', label: 'Cartão Crédito' },
                          ].map((entry) => (
                            <div key={entry.key} className="flex items-center justify-between gap-3">
                              <span className="text-sm text-app-text-secondary dark:text-white/70">
                                {entry.label}
                              </span>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step="0.01"
                                  value={discountConfig[entry.key as PaymentMethodKey]}
                                  onChange={(e) =>
                                    handleDiscountConfigChange(entry.key as PaymentMethodKey, e.target.value)
                                  }
                                  className="h-9 w-20 text-right"
                                />
                                <span className="text-xs text-app-text-muted">%</span>
                              </div>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void handleSaveDiscountConfig()}
                            disabled={isSavingDiscountConfig}
                            className="w-full h-10"
                          >
                            {isSavingDiscountConfig ? 'Salvando...' : 'Salvar configuração'}
                          </Button>
                        </div>
                      )}
                    </div>

                  </div>
                </div>

                <div className="mt-6 border-t border-app-border/80 px-6 pb-6 pt-5 dark:border-app-border-dark sm:px-8 sm:pb-8 sm:pt-6">
                  <div className="space-y-4 rounded-2xl bg-app-bg-secondary/35 p-4 dark:bg-app-surface-muted/60 sm:p-5">
                    <div className="space-y-3 rounded-xl bg-app-bg-secondary dark:bg-app-hover p-4 border border-app-border dark:border-app-border-dark">
                      <div className="flex justify-between text-sm text-app-text-secondary dark:text-white/60">
                        <span>Subtotal</span>
                        <span className="tabular-nums">R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      {configuredDiscountAmount > 0 && !isConsumo && (
                        <div className="flex justify-between text-xs text-app-text-secondary dark:text-white/60">
                          <span>Desc. configurado ({configuredDiscountPercent.toFixed(2)}%)</span>
                          <span className="tabular-nums">
                            - R$ {configuredDiscountAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      {discountAmount > 0 && !isConsumo && (
                        <div className="flex justify-between text-sm text-[var(--app-success-text)] font-medium">
                          <span>Desconto total</span>
                          <span className="tabular-nums">
                            - R$ {discountAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      <div className="h-px bg-app-bg-tertiary dark:bg-app-hover" />
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm font-bold text-app-text-primary dark:text-white">
                          Total a Pagar
                        </span>
                        <span className="text-2xl font-extrabold text-app-primary dark:text-[var(--app-info-text)] tabular-nums">
                          R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <Button
                      onClick={() => void handleSave()}
                      disabled={isSubmitting || cartItems.length === 0 || !selectedPatientId}
                      className="w-full h-14 rounded-xl bg-app-primary hover:bg-app-primary-hover text-white font-bold shadow-xl shadow-sm text-lg transition-all hover:scale-[1.02] active:scale-98 disabled:opacity-50 disabled:hover:scale-100"
                    >
                      {isSubmitting
                        ? 'Processando...'
                        : paymentMethod
                          ? 'Finalizar Prescrição/Vendas'
                          : 'Salvar prescrição ativa'}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={onClose}
                      disabled={isSubmitting}
                      className="w-full h-12 rounded-xl border border-transparent font-semibold text-app-text-secondary hover:border-app-border hover:text-app-text-primary hover:bg-app-hover dark:hover:border-app-border-dark dark:hover:bg-app-hover"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
