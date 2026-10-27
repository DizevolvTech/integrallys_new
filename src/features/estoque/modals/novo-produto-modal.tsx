'use client'

import { Package } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ModalHeader } from '@/components/shared/modal-header'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { EstoqueInput } from '../hooks/use-estoque'

interface NovoProdutoModalProps {
  isOpen: boolean
  onClose: (open: boolean) => void
  onSave: (payload: EstoqueInput) => Promise<void>
  categorias?: string[]
}

const labelClass = 'text-sm font-semibold text-[var(--app-text-primary)] dark:text-white'

export function NovoProdutoModal({ isOpen, onClose, onSave, categorias = [] }: NovoProdutoModalProps) {
  const [produto, setProduto] = useState('')
  const [categoria, setCategoria] = useState('')
  const [sku, setSku] = useState('')
  const [unidadeMedida, setUnidadeMedida] = useState('')
  const [quantidade, setQuantidade] = useState('0')
  const [estoqueMinimo, setEstoqueMinimo] = useState('0')
  const [precoCusto, setPrecoCusto] = useState('')
  const [precoVenda, setPrecoVenda] = useState('')
  const [lote, setLote] = useState('')
  const [validade, setValidade] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Margem calculada em tela (não persistida) — mesmo cálculo do estoque-view.
  const custo = Number(precoCusto)
  const venda = Number(precoVenda)
  const margem =
    precoCusto.trim() !== '' &&
    precoVenda.trim() !== '' &&
    Number.isFinite(custo) &&
    Number.isFinite(venda) &&
    custo > 0
      ? ((venda - custo) / custo) * 100
      : null

  const resetForm = () => {
    setProduto('')
    setCategoria('')
    setSku('')
    setUnidadeMedida('')
    setQuantidade('0')
    setEstoqueMinimo('0')
    setPrecoCusto('')
    setPrecoVenda('')
    setLote('')
    setValidade('')
  }

  const handleClose = () => {
    resetForm()
    onClose(false)
  }

  const handleSubmit = async () => {
    if (!produto.trim() || !categoria.trim()) {
      toast.error('Preencha nome e categoria para continuar.')
      return
    }
    setIsSaving(true)
    try {
      await onSave({
        produto: produto.trim(),
        categoria: categoria.trim(),
        sku: sku.trim() || null,
        quantidade: Number(quantidade) || 0,
        estoqueMinimo: estoqueMinimo.trim() === '' ? null : Number(estoqueMinimo) || 0,
        lote: lote.trim() || null,
        validade: validade.trim() || null,
        precoCusto: precoCusto.trim() === '' ? null : Number(precoCusto),
        precoVenda: precoVenda.trim() === '' ? null : Number(precoVenda),
        unidadeMedida: unidadeMedida.trim() || null,
      })
      resetForm()
      onClose(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível cadastrar o produto.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent size="2xl" className="gap-0 overflow-hidden rounded-[24px] p-0">
        <ModalHeader
          className="px-6 pt-6 pb-4 shrink-0"
          icon={Package}
          title="Novo Produto"
          description="Cadastre um produto no estoque com preços, unidade e controle de validade."
        />

        <div className="max-h-[70vh] overflow-y-auto custom-scrollbar px-6 py-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label className={labelClass}>Nome do produto</Label>
              <Input
                placeholder="Nome do produto"
                value={produto}
                onChange={(e) => setProduto(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={labelClass}>Categoria</Label>
              {categorias.length > 0 ? (
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="Ex.: Medicamento, Insumo"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label className={labelClass}>SKU / Código</Label>
              <Input
                placeholder="Deixe vazio para gerar automaticamente"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={labelClass}>Unidade de medida</Label>
              <Input
                placeholder="Ex.: unidade, caixa, ml, kg"
                value={unidadeMedida}
                onChange={(e) => setUnidadeMedida(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={labelClass}>Status</Label>
              <Input
                value={Number(quantidade) > 0 ? 'Disponível (automático)' : 'Indisponível (automático)'}
                disabled
                className="bg-app-bg-secondary"
              />
            </div>
            <div className="space-y-1.5">
              <Label className={labelClass}>Quantidade inicial</Label>
              <Input
                type="number"
                min={0}
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={labelClass}>Estoque mínimo</Label>
              <Input
                type="number"
                min={0}
                value={estoqueMinimo}
                onChange={(e) => setEstoqueMinimo(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={labelClass}>Preço de custo (R$)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={precoCusto}
                onChange={(e) => setPrecoCusto(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={labelClass}>Preço de venda (R$)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={precoVenda}
                onChange={(e) => setPrecoVenda(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={labelClass}>Lote</Label>
              <Input
                placeholder="Lote (opcional)"
                value={lote}
                onChange={(e) => setLote(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={labelClass}>Validade</Label>
              <Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
            </div>
          </div>

          <div className="rounded-xl border border-app-border bg-app-bg-secondary/50 px-4 py-3 dark:border-app-border-dark dark:bg-app-bg-dark">
            <p className="text-xs text-app-text-muted">Margem (% sobre o custo)</p>
            <p className="text-lg font-semibold text-app-text-primary dark:text-white">
              {margem == null ? '—' : `${margem.toFixed(1)}%`}
            </p>
            <p className="text-[11px] text-app-text-muted">
              Derivada de custo/venda — exibida aqui, não armazenada.
            </p>
          </div>
        </div>

        <DialogFooter className="px-6 py-5 shrink-0 gap-3 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleClose}
            className="h-11 rounded-lg border-app-border px-6 dark:border-app-border-dark"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={isSaving}
            className="h-11 rounded-lg bg-app-primary px-8 font-medium text-white shadow-sm hover:bg-app-primary-hover"
          >
            {isSaving ? 'Salvando...' : 'Salvar produto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
