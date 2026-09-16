'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Tags } from 'lucide-react'
import { ModalHeader } from '@/components/shared/modal-header'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { EstoqueCategoria } from '../hooks/use-estoque-categorias'

interface CategoriasEstoqueModalProps {
  isOpen: boolean
  onClose: () => void
  categorias: EstoqueCategoria[]
  onCreate: (nome: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
}

export function CategoriasEstoqueModal({
  isOpen,
  onClose,
  categorias,
  onCreate,
  onRemove,
}: CategoriasEstoqueModalProps) {
  const [nome, setNome] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleCreate = async () => {
    if (!nome.trim()) {
      toast.error('Informe o nome da categoria.')
      return
    }
    setIsSaving(true)
    try {
      await onCreate(nome.trim())
      setNome('')
      toast.success('Categoria criada.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao criar categoria')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-[24px]">
        <ModalHeader
          icon={Tags}
          title="Categorias de estoque"
          description="Cadastre categorias para filtrar produtos e relatórios."
        />
        <div className="flex gap-2">
          <Input
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            placeholder="Nova categoria"
          />
          <Button
            onClick={() => void handleCreate()}
            disabled={isSaving}
            className="bg-app-primary text-white hover:bg-app-primary-hover"
          >
            Adicionar
          </Button>
        </div>
        <div className="max-h-64 overflow-y-auto space-y-2 mt-2">
          {categorias.length === 0 && (
            <p className="text-sm text-app-text-muted">Nenhuma categoria cadastrada.</p>
          )}
          {categorias.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-app-border px-3 py-2 dark:border-app-border-dark"
            >
              <span className="text-sm">{item.nome}</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-[var(--app-danger-text)]"
                onClick={() => {
                  void onRemove(item.id).then(
                    () => toast.success('Categoria removida.'),
                    (err: unknown) =>
                      toast.error(err instanceof Error ? err.message : 'Falha ao remover'),
                  )
                }}
              >
                Remover
              </Button>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
