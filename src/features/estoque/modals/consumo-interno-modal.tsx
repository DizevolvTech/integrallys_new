'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Combobox } from '@/components/ui/combobox'
import { Textarea } from '@/components/ui/textarea'
import { useColaboradoresEstoque } from '../hooks/use-colaboradores-estoque'
import type { EstoqueItem, MovimentacaoEstoqueInput } from '../hooks/use-estoque'

const OUTROS = '__outros'

interface BodyProps {
  items: EstoqueItem[]
  onConfirm: (payload: MovimentacaoEstoqueInput) => Promise<void>
  onClose: (open: boolean) => void
}

export function ConsumoInternoBody({ items, onConfirm, onClose }: BodyProps) {
  const colaboradores = useColaboradoresEstoque()
  const opcoesProduto = useMemo(() => items.map((item) => ({ value: item.id, label: item.produto, hint: `saldo: ${item.quantidade}` })), [items])
  const opcoesQuem = useMemo(
    () => [{ value: OUTROS, label: 'Outros' }, ...colaboradores],
    [colaboradores],
  )
  const [produtoId, setProdutoId] = useState('')
  const [quantidade, setQuantidade] = useState(0)
  const [justificativa, setJustificativa] = useState('')
  const [quemId, setQuemId] = useState('')
  const [outrosTexto, setOutrosTexto] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const selectedItem = useMemo(
    () => items.find((item) => item.id === produtoId) ?? null,
    [items, produtoId],
  )

  const submit = async () => {
    if (!produtoId || quantidade <= 0 || !justificativa.trim()) {
      toast.error('Preencha produto, quantidade e justificativa.')
      return
    }
    if (selectedItem && quantidade > selectedItem.quantidade) {
      toast.error('Quantidade excede o estoque disponível.')
      return
    }
    if (!selectedItem || quantidade > selectedItem.quantidade) {
      toast.error('Quantidade de consumo maior que o estoque disponível.')
      return
    }

    if (quemId === OUTROS && !outrosTexto.trim()) {
      toast.error('Escreva quem consumiu e o motivo.')
      return
    }

    setIsSaving(true)
    try {
      const colaborador = quemId && quemId !== OUTROS ? colaboradores.find((item) => item.value === quemId) : null
      await onConfirm({
        produtoId,
        quantidade,
        observacoes: justificativa.trim(),
        tipoMovimentacao: 'consumo_interno',
        ...(quemId === OUTROS
          ? { vinculoTipo: 'outro' as const, vinculoId: null, vinculoNome: outrosTexto.trim() }
          : colaborador
            ? { vinculoTipo: 'colaborador' as const, vinculoId: colaborador.value, vinculoNome: colaborador.label }
            : { vinculoTipo: null, vinculoId: null, vinculoNome: null }),
      })
      onClose(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível registrar o consumo interno.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="consumo-produto">Produto *</Label>
          <Combobox
            id="consumo-produto"
            value={produtoId}
            onChange={setProdutoId}
            options={opcoesProduto}
            placeholder="Selecione o produto"
            searchPlaceholder="Digite o nome do produto..."
            emptyText="Nenhum produto encontrado"
          />
        </div>

        {selectedItem && (
          <div className="flex items-center justify-between rounded-lg border border-app-border bg-app-bg-secondary/50 px-3 py-2 text-sm dark:border-app-border-dark dark:bg-app-card/5">
            <span className="text-app-text-secondary">Estoque atual</span>
            <span className={`font-medium tabular-nums ${quantidade > selectedItem.quantidade ? 'text-[var(--app-danger-text)]' : 'text-app-text-primary dark:text-white'}`}>
              {selectedItem.quantidade} un.
            </span>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="consumo-quantidade">Quantidade *</Label>
          <Input
            id="consumo-quantidade"
            type="number"
            min={1}
            value={quantidade}
            onChange={(event) => setQuantidade(Number(event.target.value) || 0)}
          />
          {selectedItem && quantidade > selectedItem.quantidade && (
            <p className="text-xs text-[var(--app-danger-text)] flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Quantidade excede o saldo disponível ({selectedItem.quantidade}).
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="consumo-justificativa">Justificativa *</Label>
          <Textarea
            id="consumo-justificativa"
            value={justificativa}
            onChange={(event) => setJustificativa(event.target.value)}
            placeholder="Ex: material de atendimento, uso administrativo, descarte por validade..."
            className="min-h-[96px]"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="consumo-quem">Quem consumiu (opcional)</Label>
          <Combobox
            id="consumo-quem"
            value={quemId}
            onChange={setQuemId}
            options={opcoesQuem}
            placeholder="Não informar"
            searchPlaceholder="Digite o nome de quem consumiu..."
            emptyText="Nenhum usuário encontrado"
          />
          {quemId && (
            <button type="button" className="text-xs text-app-text-muted underline" onClick={() => setQuemId('')}>
              Limpar (não informar)
            </button>
          )}
          <p className="text-xs text-app-text-muted">
            Escolha um usuário do sistema ou &quot;Outros&quot; para escrever quem foi e o motivo.
          </p>
        </div>

        {quemId === OUTROS && (
          <div className="space-y-1.5">
            <Label htmlFor="consumo-outros">Quem foi e por quê *</Label>
            <Input
              id="consumo-outros"
              value={outrosTexto}
              maxLength={200}
              onChange={(event) => setOutrosTexto(event.target.value)}
              placeholder="Ex.: Maria (limpeza) — higienização da sala"
            />
          </div>
        )}
      </div>

      <DialogFooter className="border-t border-app-border dark:border-app-border-dark px-6 py-4 shrink-0 bg-app-card dark:bg-app-card-dark">
        <Button variant="outline" onClick={() => onClose(false)}>
          Cancelar
        </Button>
        <Button
          className="bg-amber-600 hover:bg-amber-700 text-white"
          onClick={() => void submit()}
          disabled={isSaving}
        >
          Salvar consumo
        </Button>
      </DialogFooter>
    </>
  )
}
