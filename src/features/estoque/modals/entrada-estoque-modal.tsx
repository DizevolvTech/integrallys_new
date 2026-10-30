'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { toast } from 'sonner'
import { DateInput } from '@/components/shared/date-input'
import { ModalHeader } from '@/components/shared/modal-header'
import { SegmentedControl } from '@/components/shared/segmented-control'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Combobox } from '@/components/ui/combobox'
import { useAuth } from '@/hooks/use-auth'
import { useApi } from '@/hooks/use-api'
import { FornecedorModal } from '@/features/fornecedores/modals/fornecedor-modal'
import type { FornecedorInput } from '@/types/fornecedor'
import type { EstoqueInput, EstoqueItem, MovimentacaoEstoqueInput } from '../hooks/use-estoque'
import { EntradaXmlBody } from './importar-nf-xml-modal'
import { NovoProdutoModal } from './novo-produto-modal'

interface EntradaEstoqueModalProps {
  isOpen: boolean
  onClose: (open: boolean) => void
  items: EstoqueItem[]
  categorias: string[]
  /** Cadastra o produto e devolve a lista atualizada (a entrada seleciona o novo item). */
  onCriarProduto: (payload: EstoqueInput) => Promise<EstoqueItem[]>
  onConfirm: (payload: MovimentacaoEstoqueInput) => Promise<void>
}

interface BodyProps {
  items: EstoqueItem[]
  categorias?: string[]
  onCriarProduto?: (payload: EstoqueInput) => Promise<EstoqueItem[]>
  onConfirm: (payload: MovimentacaoEstoqueInput) => Promise<void>
  onClose: (open: boolean) => void
}

interface EntradaFormState {
  nf: string
  fornecedorId: string
  data: string
  produtoId: string
  quantidade: number
  precoCusto: number
  lote: string
  validade: string
}

const initialState: EntradaFormState = {
  nf: '',
  fornecedorId: '',
  data: new Date().toISOString().split('T')[0],
  produtoId: '',
  quantidade: 0,
  precoCusto: 0,
  lote: '',
  validade: '',
}

function EntradaManualBody({ items, categorias = [], onCriarProduto, onConfirm, onClose }: BodyProps) {
  const [form, setForm] = useState<EntradaFormState>(initialState)
  const [isSaving, setIsSaving] = useState(false)
  const api = useApi()
  const [fornecedores, setFornecedores] = useState<Array<{ id: string; nome: string }>>([])
  const [novoFornecedor, setNovoFornecedor] = useState(false)
  const [novoProduto, setNovoProduto] = useState(false)
  const carregarFornecedores = useCallback(async () => {
    try {
      const res = await api.get<{ data: Array<{ id: string; nome: string }> }>('/api/estoque/fornecedores')
      setFornecedores(res.data)
    } catch {
      setFornecedores([])
    }
  }, [api])
  useEffect(() => {
    void carregarFornecedores()
  }, [carregarFornecedores])

  const opcoesFornecedor = useMemo(() => fornecedores.map((f) => ({ value: f.id, label: f.nome })), [fornecedores])
  const opcoesProduto = useMemo(() => items.map((item) => ({ value: item.id, label: item.produto })), [items])

  // Cadastro rápido: salva e volta à entrada com o item já escolhido; o resto do formulário fica como estava.
  const salvarFornecedor = async (payload: FornecedorInput) => {
    const res = await api.post<{ data: { id: string; nome: string } }>('/api/estoque/fornecedores', payload)
    await carregarFornecedores()
    setForm((current) => ({ ...current, fornecedorId: res.data.id }))
    setNovoFornecedor(false)
  }
  const salvarProduto = async (payload: EstoqueInput) => {
    if (!onCriarProduto) return
    const antes = new Set(items.map((item) => item.id))
    const lista = await onCriarProduto(payload)
    const criado = lista.find((item) => !antes.has(item.id))
    if (criado) setForm((current) => ({ ...current, produtoId: criado.id }))
    setNovoProduto(false)
  }

  const submit = async () => {
    if (!form.produtoId || form.quantidade <= 0) {
      toast.error('Selecione o produto e informe uma quantidade válida.')
      return
    }

    setIsSaving(true)
    try {
      await onConfirm({
        produtoId: form.produtoId,
        quantidade: form.quantidade,
        numeroNf: form.nf.trim() || undefined,
        fornecedorId: form.fornecedorId || undefined,
        dataNf: form.data || undefined,
        precoCusto: form.precoCusto > 0 ? form.precoCusto : undefined,
        lote: form.lote.trim() || undefined,
        validade: form.validade || undefined,
      })
      onClose(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível registrar a entrada.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="entrada-nf">Nota fiscal</Label>
            <Input id="entrada-nf" autoFocus value={form.nf} onChange={(event) => setForm((current) => ({ ...current, nf: event.target.value }))} placeholder="Número da nota fiscal" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entrada-fornecedor">Fornecedor</Label>
            <Combobox
              id="entrada-fornecedor"
              value={form.fornecedorId}
              onChange={(value) => setForm((current) => ({ ...current, fornecedorId: value }))}
              options={opcoesFornecedor}
              placeholder="Selecione o fornecedor"
              searchPlaceholder="Digite o nome do fornecedor..."
              emptyText="Nenhum fornecedor encontrado"
              footerAction={{ label: 'Cadastrar novo fornecedor', onSelect: () => setNovoFornecedor(true) }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entrada-data">Data da nota</Label>
            <DateInput id="entrada-data" value={form.data} onChange={(value) => setForm((current) => ({ ...current, data: value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entrada-produto">Produto *</Label>
            <Combobox
              id="entrada-produto"
              value={form.produtoId}
              onChange={(value) => setForm((current) => ({ ...current, produtoId: value }))}
              options={opcoesProduto}
              placeholder="Selecione o produto"
              searchPlaceholder="Digite o nome do produto..."
              emptyText="Nenhum produto encontrado"
              footerAction={onCriarProduto ? { label: 'Cadastrar novo produto', onSelect: () => setNovoProduto(true) } : undefined}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entrada-quantidade">Quantidade *</Label>
            <Input id="entrada-quantidade" type="number" min={1} value={form.quantidade} onChange={(event) => setForm((current) => ({ ...current, quantidade: Number(event.target.value) || 0 }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entrada-preco-custo">Preço de custo</Label>
            <Input id="entrada-preco-custo" type="number" min={0} step="0.01" value={form.precoCusto} onChange={(event) => setForm((current) => ({ ...current, precoCusto: Number(event.target.value) || 0 }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entrada-lote">Lote</Label>
            <Input id="entrada-lote" value={form.lote} onChange={(event) => setForm((current) => ({ ...current, lote: event.target.value }))} placeholder="Lote" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entrada-validade">Validade</Label>
            <DateInput id="entrada-validade" value={form.validade} onChange={(value) => setForm((current) => ({ ...current, validade: value }))} />
          </div>
        </div>
      </div>

      <DialogFooter className="border-t border-app-border dark:border-app-border-dark px-6 py-4 shrink-0 bg-app-card dark:bg-app-card-dark">
        <Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
        <Button className="bg-app-primary hover:bg-app-primary-hover text-white" onClick={() => void submit()} disabled={isSaving}>
          Salvar entrada
        </Button>
      </DialogFooter>

      <FornecedorModal isOpen={novoFornecedor} mode="create" onClose={() => setNovoFornecedor(false)} onSave={salvarFornecedor} />
      <NovoProdutoModal isOpen={novoProduto} onClose={(open) => !open && setNovoProduto(false)} categorias={categorias} onSave={salvarProduto} />
    </>
  )
}

export function EntradaEstoqueModal({ isOpen, onClose, onConfirm, items, categorias, onCriarProduto }: EntradaEstoqueModalProps) {
  // Chave escopada por userId evita vazamento de preferência entre usuários
  // que compartilham o mesmo navegador (recepcionistas em estação compartilhada).
  const userId = useAuth((state) => state.user?.id ?? null)
  const modeKey = userId ? `estoque-entrada-mode:${userId}` : null

  const [mode, setMode] = useState<'manual' | 'xml'>('manual')

  useEffect(() => {
    if (!modeKey) return
    const saved = localStorage.getItem(modeKey) as 'manual' | 'xml' | null
    if (saved === 'manual' || saved === 'xml') setMode(saved)
  }, [modeKey])

  useEffect(() => {
    if (!modeKey) return
    localStorage.setItem(modeKey, mode)
  }, [modeKey, mode])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="xl" className="w-[95vw] rounded-[24px] bg-app-card dark:bg-app-card-dark p-0 border border-app-border dark:border-app-border-dark flex flex-col">
        <ModalHeader
          icon={ArrowUpRight}
          className="border-b border-app-border dark:border-app-border-dark px-6 py-5 shrink-0"
          title="Entrada de estoque"
          description="Registre entrada manual ou importe via XML de compra."
        />

        <div className="px-6 pt-4 shrink-0">
          <SegmentedControl
            options={[
              { value: 'manual', label: 'Manual' },
              { value: 'xml', label: 'Importar XML de compra' },
            ]}
            value={mode}
            onChange={(value) => setMode(value as 'manual' | 'xml')}
          />
        </div>

        {mode === 'manual' ? (
          <EntradaManualBody items={items} categorias={categorias} onCriarProduto={onCriarProduto} onConfirm={onConfirm} onClose={onClose} />
        ) : (
          <EntradaXmlBody items={items} onConfirm={onConfirm} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  )
}
