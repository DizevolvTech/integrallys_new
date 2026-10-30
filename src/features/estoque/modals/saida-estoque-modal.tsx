'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowDownRight } from 'lucide-react'
import { toast } from 'sonner'
import { ModalHeader } from '@/components/shared/modal-header'
import { SegmentedControl } from '@/components/shared/segmented-control'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Combobox } from '@/components/ui/combobox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/use-auth'
import { usePacientes } from '@/hooks/use-pacientes'
import { useUsuarios } from '@/hooks/use-usuarios'
import { useColaboradoresEstoque } from '../hooks/use-colaboradores-estoque'
import type { EstoqueItem, MovimentacaoEstoqueInput } from '../hooks/use-estoque'
import { ConsumoInternoBody } from './consumo-interno-modal'

type VinculoForm = 'nenhum' | 'cliente' | 'especialista' | 'fornecedor' | 'colaborador'

interface SaidaEstoqueModalProps {
  isOpen: boolean
  onClose: (open: boolean) => void
  items: EstoqueItem[]
  onConfirm: (payload: MovimentacaoEstoqueInput) => Promise<void>
}

interface BodyProps {
  items: EstoqueItem[]
  onConfirm: (payload: MovimentacaoEstoqueInput) => Promise<void>
  onClose: (open: boolean) => void
}

function SaidaManualBody({ items, onConfirm, onClose }: BodyProps) {
  const { data: pacientes } = usePacientes()
  const { data: usuarios } = useUsuarios()
  const colaboradores = useColaboradoresEstoque()
  const opcoesProduto = useMemo(() => items.map((item) => ({ value: item.id, label: item.produto, hint: `saldo: ${item.quantidade}` })), [items])
  const opcoesCliente = useMemo(() => pacientes.map((p) => ({ value: p.id, label: p.nome })), [pacientes])
  const [produtoId, setProdutoId] = useState('')
  const [quantidade, setQuantidade] = useState(0)
  const [justificativa, setJustificativa] = useState('')
  const [vinculoTipo, setVinculoTipo] = useState<VinculoForm>('nenhum')
  const [vinculoEntityId, setVinculoEntityId] = useState('')
  const [fornecedorNome, setFornecedorNome] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const selectedItem = useMemo(
    () => items.find((item) => item.id === produtoId) ?? null,
    [items, produtoId],
  )

  const especialistas = useMemo(
    () =>
      usuarios.filter((user) => (user.perfil ?? '').toLowerCase() === 'especialista'),
    [usuarios],
  )

  const buildVinculoPayload = (): Pick<MovimentacaoEstoqueInput, 'vinculoTipo' | 'vinculoId' | 'vinculoNome'> => {
    if (vinculoTipo === 'nenhum') {
      return { vinculoTipo: null, vinculoId: null, vinculoNome: null }
    }
    if (vinculoTipo === 'fornecedor') {
      const trimmed = fornecedorNome.trim()
      return {
        vinculoTipo: 'fornecedor',
        vinculoId: null,
        vinculoNome: trimmed.length > 0 ? trimmed : null,
      }
    }
    if (!vinculoEntityId) {
      return { vinculoTipo, vinculoId: null, vinculoNome: null }
    }
    if (vinculoTipo === 'cliente') {
      const paciente = pacientes.find((item) => item.id === vinculoEntityId)
      return {
        vinculoTipo: 'cliente',
        vinculoId: vinculoEntityId,
        vinculoNome: paciente?.nome ?? null,
      }
    }
    if (vinculoTipo === 'colaborador') {
      const colaborador = colaboradores.find((item) => item.value === vinculoEntityId)
      return { vinculoTipo: 'colaborador', vinculoId: vinculoEntityId, vinculoNome: colaborador?.label ?? null }
    }
    const especialista = especialistas.find((item) => item.id === vinculoEntityId)
    return {
      vinculoTipo: 'especialista',
      vinculoId: vinculoEntityId,
      vinculoNome: especialista?.nome ?? null,
    }
  }

  const submit = async () => {
    if (vinculoTipo !== 'nenhum' && vinculoTipo !== 'fornecedor' && !vinculoEntityId) {
      toast.error(vinculoTipo === 'colaborador' ? 'Selecione o colaborador.' : 'Selecione quem está vinculado à saída.')
      return
    }
    if (!produtoId || quantidade <= 0 || !justificativa.trim()) {
      toast.error('Preencha produto, quantidade e justificativa.')
      return
    }

    if (selectedItem && quantidade > selectedItem.quantidade) {
      toast.error('Quantidade excede o estoque disponível.')
      return
    }

    if (!selectedItem || quantidade > selectedItem.quantidade) {
      toast.error('Quantidade de saída maior que o estoque disponível.')
      return
    }

    setIsSaving(true)
    try {
      await onConfirm({
        produtoId,
        quantidade,
        observacoes: justificativa.trim(),
        ...buildVinculoPayload(),
      })
      onClose(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível registrar a saída.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="saida-produto">Produto *</Label>
          <Combobox
            id="saida-produto"
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
          <Label htmlFor="saida-quantidade">Quantidade *</Label>
          <Input id="saida-quantidade" type="number" min={1} value={quantidade} onChange={(event) => setQuantidade(Number(event.target.value) || 0)} />
          {selectedItem && quantidade > selectedItem.quantidade && (
            <p className="text-xs text-[var(--app-danger-text)] flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Quantidade excede o saldo disponível ({selectedItem.quantidade}).
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="saida-justificativa">Justificativa *</Label>
          <Textarea
            id="saida-justificativa"
            value={justificativa}
            onChange={(event) => setJustificativa(event.target.value)}
            placeholder="Descreva o motivo da baixa de estoque"
            className="min-h-[96px]"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="saida-vinculo-tipo">Tipo de vínculo (opcional)</Label>
          <Select
            value={vinculoTipo}
            onValueChange={(value) => {
              setVinculoTipo(value as VinculoForm)
              setVinculoEntityId('')
              setFornecedorNome('')
            }}
          >
            <SelectTrigger id="saida-vinculo-tipo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nenhum">Nenhum</SelectItem>
              <SelectItem value="cliente">Cliente</SelectItem>
              <SelectItem value="especialista">Especialista</SelectItem>
              <SelectItem value="colaborador">Colaborador</SelectItem>
              <SelectItem value="fornecedor">Fornecedor</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-app-text-muted">
            Identifica para quem essa saída foi destinada (rastreabilidade — não obrigatório).
          </p>
        </div>

        {vinculoTipo === 'cliente' && (
          <div className="space-y-1.5">
            <Label htmlFor="saida-cliente">Cliente vinculado</Label>
            <Combobox
              id="saida-cliente"
              value={vinculoEntityId}
              onChange={setVinculoEntityId}
              options={opcoesCliente}
              placeholder="Selecione o cliente"
              searchPlaceholder="Digite o nome do cliente..."
              emptyText="Nenhum cliente encontrado"
            />
          </div>
        )}

        {vinculoTipo === 'especialista' && (
          <div className="space-y-1.5">
            <Label htmlFor="saida-especialista">Especialista vinculado</Label>
            <Select value={vinculoEntityId} onValueChange={setVinculoEntityId}>
              <SelectTrigger id="saida-especialista">
                <SelectValue preferPlaceholder placeholder="Selecione o especialista" />
              </SelectTrigger>
              <SelectContent>
                {especialistas.length === 0 && (
                  <SelectItem value="__empty_especialistas" disabled>
                    Nenhum especialista ativo
                  </SelectItem>
                )}
                {especialistas.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {vinculoTipo === 'colaborador' && (
          <div className="space-y-1.5">
            <Label htmlFor="saida-colaborador">Colaborador vinculado</Label>
            <Combobox
              id="saida-colaborador"
              value={vinculoEntityId}
              onChange={setVinculoEntityId}
              options={colaboradores}
              placeholder="Selecione o colaborador"
              searchPlaceholder="Digite o nome do colaborador..."
              emptyText="Nenhum colaborador encontrado"
            />
          </div>
        )}

        {vinculoTipo === 'fornecedor' && (
          <div className="space-y-1.5">
            <Label htmlFor="saida-fornecedor">Fornecedor</Label>
            <Input
              id="saida-fornecedor"
              value={fornecedorNome}
              onChange={(event) => setFornecedorNome(event.target.value)}
              placeholder="Nome do fornecedor"
            />
          </div>
        )}
      </div>

      <DialogFooter className="border-t border-app-border dark:border-app-border-dark px-6 py-4 shrink-0 bg-app-card dark:bg-app-card-dark">
        <Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
        <Button className="bg-[#E53E3E] hover:bg-[#C53030] text-white" onClick={() => void submit()} disabled={isSaving}>
          Salvar saída
        </Button>
      </DialogFooter>
    </>
  )
}

export function SaidaEstoqueModal({ isOpen, onClose, items, onConfirm }: SaidaEstoqueModalProps) {
  // Chave escopada por userId evita vazamento de preferência entre usuários
  // que compartilham o mesmo navegador (recepcionistas em estação compartilhada).
  const userId = useAuth((state) => state.user?.id ?? null)
  const modeKey = userId ? `estoque-saida-mode:${userId}` : null

  const [mode, setMode] = useState<'manual' | 'consumo'>('manual')

  useEffect(() => {
    if (!modeKey) return
    const saved = localStorage.getItem(modeKey) as 'manual' | 'consumo' | null
    if (saved === 'manual' || saved === 'consumo') setMode(saved)
  }, [modeKey])

  useEffect(() => {
    if (!modeKey) return
    localStorage.setItem(modeKey, mode)
  }, [modeKey, mode])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="xl" className="w-[95vw] rounded-[24px] bg-app-card dark:bg-app-card-dark p-0 border border-app-border dark:border-app-border-dark flex flex-col">
        <ModalHeader
          icon={ArrowDownRight}
          className="border-b border-app-border dark:border-app-border-dark px-6 py-5 shrink-0"
          title="Saída de estoque"
          description="Registre saída manual ou consumo interno do estoque."
        />

        <div className="px-6 pt-4 shrink-0">
          <SegmentedControl
            options={[
              { value: 'manual', label: 'Manual' },
              { value: 'consumo', label: 'Consumo interno' },
            ]}
            value={mode}
            onChange={(value) => setMode(value as 'manual' | 'consumo')}
          />
        </div>

        {mode === 'manual' ? (
          <SaidaManualBody items={items} onConfirm={onConfirm} onClose={onClose} />
        ) : (
          <ConsumoInternoBody items={items} onConfirm={onConfirm} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  )
}
