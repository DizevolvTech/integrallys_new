'use client'

import { useEffect, useState } from 'react'
import { Package, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { EstoqueInput, EstoqueItem } from '../hooks/use-estoque'

interface EditarProdutoModalProps {
  isOpen: boolean
  onClose: (open: boolean) => void
  produto: EstoqueItem | null
  onSave: (payload: EstoqueInput) => Promise<void>
  categorias?: string[]
}

export function EditarProdutoModal({
  isOpen,
  onClose,
  produto,
  onSave,
  categorias = [],
}: EditarProdutoModalProps) {
  const [produtoNome, setProdutoNome] = useState('')
  const [categoria, setCategoria] = useState('')
  const [sku, setSku] = useState('')
  const [quantidade, setQuantidade] = useState(0)
  const [estoqueMinimo, setEstoqueMinimo] = useState(0)
  const [lote, setLote] = useState('')
  const [validade, setValidade] = useState('')
  const [precoCusto, setPrecoCusto] = useState('')
  const [precoVenda, setPrecoVenda] = useState('')
  const [unidadeMedida, setUnidadeMedida] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (produto) {
      setProdutoNome(produto.produto)
      setCategoria(produto.categoria)
      setSku(produto.sku ?? '')
      setQuantidade(produto.quantidade)
      setEstoqueMinimo(produto.estoqueMinimo ?? 0)
      setLote(produto.lote ?? '')
      setValidade(
        produto.validade && /^\d{4}-\d{2}-\d{2}/.test(produto.validade)
          ? produto.validade.slice(0, 10)
          : produto.validade && /^\d{2}\/\d{2}\/\d{4}$/.test(produto.validade)
            ? (() => {
                const [d, m, y] = produto.validade!.split('/')
                return `${y}-${m}-${d}`
              })()
            : '',
      )
      setPrecoCusto(produto.precoCusto != null ? String(produto.precoCusto) : '')
      setPrecoVenda(produto.precoVenda != null ? String(produto.precoVenda) : '')
      setUnidadeMedida(produto.unidadeMedida ?? '')
    }
  }, [produto])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!produto) return
    if (!produtoNome.trim() || !categoria.trim()) {
      toast.error('Preencha produto e categoria para continuar.')
      return
    }

    setIsSaving(true)
    try {
      await onSave({
        id: produto.id,
        produto: produtoNome.trim(),
        categoria: categoria.trim(),
        sku: sku.trim() || null,
        quantidade,
        estoqueMinimo,
        lote: lote.trim() || null,
        validade: validade.trim() || null,
        precoCusto: precoCusto.trim() === '' ? null : Number(precoCusto),
        precoVenda: precoVenda.trim() === '' ? null : Number(precoVenda),
        unidadeMedida: unidadeMedida.trim() || null,
      })
      onClose(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível atualizar o produto.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen || !produto) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-app-bg-dark/50 backdrop-blur-sm" onClick={() => onClose(false)} />

      <div className="relative bg-app-card dark:bg-app-card-dark rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-app-border dark:border-app-border-dark">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl app-status-info dark:app-status-info flex items-center justify-center">
              <Package className="h-5 w-5 text-[var(--app-primary)] dark:text-[var(--app-success-text)]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-app-text-primary dark:text-white">Editar Produto</h2>
              <p className="text-sm text-app-text-secondary dark:text-white/60">Atualize estoque inteligente (lote, validade, mínimos e preços)</p>
            </div>
          </div>
          <button
            onClick={() => onClose(false)}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-app-text-muted hover:text-app-text-secondary hover:bg-app-bg-secondary dark:hover:bg-app-hover transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-app-text-primary dark:text-white/70">Nome do Produto</label>
            <Input value={produtoNome} onChange={(event) => setProdutoNome(event.target.value)} placeholder="Nome do produto" className="w-full" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-app-text-primary dark:text-white/70">Categoria</label>
              {categorias.length > 0 ? (
                <select
                  value={categoria}
                  onChange={(event) => setCategoria(event.target.value)}
                  className="w-full h-10 rounded-md border border-app-border bg-transparent px-3 text-sm"
                  required
                >
                  <option value="">Selecione</option>
                  {Array.from(new Set([...categorias, categoria].filter(Boolean))).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              ) : (
                <Input value={categoria} onChange={(event) => setCategoria(event.target.value)} placeholder="Categoria" className="w-full" required />
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-app-text-primary dark:text-white/70">SKU</label>
              <Input value={sku} onChange={(event) => setSku(event.target.value)} placeholder="SKU" className="w-full" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-app-text-primary dark:text-white/70">Quantidade</label>
              <Input type="number" value={quantidade} onChange={(event) => setQuantidade(Number(event.target.value) || 0)} min={0} className="w-full" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-app-text-primary dark:text-white/70">Estoque mínimo</label>
              <Input type="number" value={estoqueMinimo} onChange={(event) => setEstoqueMinimo(Number(event.target.value) || 0)} min={0} className="w-full" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-app-text-primary dark:text-white/70">Lote</label>
              <Input value={lote} onChange={(event) => setLote(event.target.value)} className="w-full" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-app-text-primary dark:text-white/70">Validade</label>
              <Input type="date" value={validade} onChange={(event) => setValidade(event.target.value)} className="w-full" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-app-text-primary dark:text-white/70">Preço custo</label>
              <Input type="number" step="0.01" value={precoCusto} onChange={(event) => setPrecoCusto(event.target.value)} className="w-full" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-app-text-primary dark:text-white/70">Preço venda</label>
              <Input type="number" step="0.01" value={precoVenda} onChange={(event) => setPrecoVenda(event.target.value)} className="w-full" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-app-text-primary dark:text-white/70">Unidade de medida</label>
              <Input value={unidadeMedida} onChange={(event) => setUnidadeMedida(event.target.value)} placeholder="un, cx, ml…" className="w-full" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-app-text-primary dark:text-white/70">Status</label>
              <Input
                value={quantidade > 0 ? 'Disponível (automático)' : 'Indisponível (automático)'}
                disabled
                className="w-full bg-app-bg-secondary"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onClose(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-app-primary hover:bg-app-primary-hover text-white" disabled={isSaving}>
              Salvar Alterações
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
