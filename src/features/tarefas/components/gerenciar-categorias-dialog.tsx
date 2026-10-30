'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { TarefaCategoriasApi } from '@/hooks/use-tarefa-categorias'

interface GerenciarCategoriasDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  api: TarefaCategoriasApi
}

export function GerenciarCategoriasDialog({ open, onOpenChange, api }: GerenciarCategoriasDialogProps) {
  const { categorias, addCategoria, renameCategoria, removeCategoria } = api
  const [novo, setNovo] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editandoNome, setEditandoNome] = useState('')
  const [removendoId, setRemovendoId] = useState<string | null>(null)

  const run = async (action: () => Promise<unknown>, okMessage: string) => {
    try {
      await action()
      toast.success(okMessage)
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível concluir a ação.')
      return false
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar categorias</DialogTitle>
          <DialogDescription>
            Estas categorias aparecem na lista ao criar ou editar uma tarefa. Remover uma categoria não apaga as tarefas.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex gap-2"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!novo.trim()) return
            if (await run(() => addCategoria(novo), 'Categoria criada.')) setNovo('')
          }}
        >
          <Input value={novo} onChange={(event) => setNovo(event.target.value)} placeholder="Nova categoria" maxLength={60} aria-label="Nome da nova categoria" />
          <Button type="submit" className="text-white">
            <Plus className="mr-1 h-4 w-4" />
            Adicionar
          </Button>
        </form>
        <ul className="space-y-2">
          {categorias.length === 0 && <li className="text-sm text-app-text-secondary">Nenhuma categoria cadastrada.</li>}
          {categorias.map((categoria) => (
            <li key={categoria.id} className="flex items-center gap-2 rounded-integrallys border border-app-border p-2 dark:border-app-border-dark">
              {editandoId === categoria.id ? (
                <>
                  <Input value={editandoNome} onChange={(event) => setEditandoNome(event.target.value)} maxLength={60} className="h-9" aria-label="Novo nome da categoria" />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Salvar nome"
                    onClick={async () => {
                      if (await run(() => renameCategoria(categoria.id, editandoNome), 'Categoria atualizada.')) setEditandoId(null)
                    }}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" aria-label="Cancelar edição" onClick={() => setEditandoId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : removendoId === categoria.id ? (
                <>
                  <span className="flex-1 text-sm">Remover “{categoria.nome}”? As tarefas continuam.</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await run(() => removeCategoria(categoria.id), 'Categoria removida.')
                      setRemovendoId(null)
                    }}
                  >
                    Remover
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setRemovendoId(null)}>
                    Manter
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{categoria.nome}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Editar ${categoria.nome}`}
                    onClick={() => {
                      setEditandoId(categoria.id)
                      setEditandoNome(categoria.nome)
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" aria-label={`Remover ${categoria.nome}`} onClick={() => setRemovendoId(categoria.id)}>
                    <Trash2 className="h-4 w-4 text-[var(--app-danger-text)]" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
