'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ProdutoEstoqueBusca, type ProdutoEstoqueOpcao } from '@/features/evolucoes/produto-estoque-busca'
import { useApi } from '@/hooks/use-api'
import { Package, X } from 'lucide-react'

interface AdicionarProdutoModalProps {
  isOpen: boolean
  onClose: () => void
  evolucaoId: string
  pacienteNome?: string
  onSaved?: () => void | Promise<void>
}

const campo = 'h-12 rounded-[12px] bg-app-bg-secondary dark:bg-app-surface-muted border-app-border dark:border-app-border-dark'

export function AdicionarProdutoModal({ isOpen, onClose, evolucaoId, pacienteNome, onSaved }: AdicionarProdutoModalProps) {
  const api = useApi()
  const [produto, setProduto] = useState<ProdutoEstoqueOpcao | null>(null)
  const [modoUso, setModoUso] = useState('')
  const [frequencia, setFrequencia] = useState('')
  const [horarioIdeal, setHorarioIdeal] = useState('')
  const [salvando, setSalvando] = useState(false)

  const fechar = () => {
    if (salvando) return
    setProduto(null)
    setModoUso('')
    setFrequencia('')
    setHorarioIdeal('')
    onClose()
  }

  const salvar = async () => {
    if (!produto) {
      toast.error('Escolha um produto da lista do estoque.')
      return
    }
    setSalvando(true)
    try {
      await api.post(`/api/evolucoes/${evolucaoId}/produtos`, { produtoId: produto.id, modoUso, frequencia, horarioIdeal })
      await onSaved?.()
      toast.success('Produto adicionado.')
      setSalvando(false)
      fechar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível adicionar o produto.')
      setSalvando(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && fechar()}>
      <DialogContent
        hideCloseButton={true}
        className="block max-h-[90vh] w-[95vw] overflow-y-auto rounded-[24px] border-none bg-app-card p-6 shadow-2xl custom-scrollbar dark:bg-app-card-dark sm:max-w-[550px] md:p-8"
      >
        <div className="flex justify-between items-start mb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-app-text-primary dark:text-white" />
              <DialogTitle className="text-xl font-normal text-app-text-primary dark:text-white tracking-tight">
                Adicionar produto
              </DialogTitle>
            </div>
            <p className="text-base text-app-text-muted font-normal">
              {pacienteNome ? `Prescrição para ${pacienteNome}` : 'Adicione um produto à prescrição do paciente'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={fechar}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-app-border dark:border-app-border-dark bg-white dark:bg-transparent hover:bg-app-bg-secondary dark:hover:bg-app-hover transition-colors shrink-0"
          >
            <X className="h-4 w-4 text-app-text-muted" />
          </button>
        </div>

        <div className="space-y-5 mb-6">
          <div className="space-y-2">
            <Label className="text-sm font-normal text-app-text-primary dark:text-white">Nome do produto *</Label>
            <ProdutoEstoqueBusca selecionado={produto} onSelect={setProduto} />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-normal text-app-text-primary dark:text-white">Tipo</Label>
            <Input readOnly value={produto?.categoria ?? ''} placeholder="Preenchido pelo cadastro do produto" className={campo} />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-normal text-app-text-primary dark:text-white">Modo de uso</Label>
            <Input value={modoUso} onChange={(e) => setModoUso(e.target.value)} placeholder="Ex: 1 dose com água" className={campo} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-normal text-app-text-primary dark:text-white">Frequência</Label>
              <Input value={frequencia} onChange={(e) => setFrequencia(e.target.value)} placeholder="Ex: Diariamente" className={campo} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-normal text-app-text-primary dark:text-white">Horário ideal</Label>
              <Input value={horarioIdeal} onChange={(e) => setHorarioIdeal(e.target.value)} placeholder="Ex: Café da manhã" className={campo} />
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center gap-3 sm:justify-end border-t border-app-border dark:border-app-border-dark pt-5">
          <Button variant="outline" onClick={fechar} className="w-full sm:w-auto h-auto min-h-11 whitespace-normal px-6 rounded-integrallys font-normal">
            Cancelar
          </Button>
          <Button
            onClick={() => void salvar()}
            disabled={salvando}
            className="w-full sm:w-auto px-6 h-auto min-h-11 whitespace-normal bg-app-primary hover:bg-app-primary-hover text-white rounded-integrallys font-normal shadow-sm gap-2"
          >
            <Package className="h-4 w-4" />
            {salvando ? 'Salvando...' : 'Adicionar produto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
