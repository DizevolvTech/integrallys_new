'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { DateInput } from '@/components/shared/date-input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { MovimentoSuprimentoInput, SuprimentoItem } from '../hooks/use-suprimentos'

export type TipoMovimentoSuprimento = 'entrada' | 'saida' | 'ajuste'

interface Props {
  isOpen: boolean
  onClose: () => void
  tipo: TipoMovimentoSuprimento
  suprimento: SuprimentoItem | null
  onConfirm: (payload: MovimentoSuprimentoInput) => Promise<void>
}

const TITULOS: Record<TipoMovimentoSuprimento, string> = { entrada: 'Entrada de suprimento', saida: 'Saída de suprimento', ajuste: 'Ajuste de saldo' }

export function MovimentoSuprimentoModal({ isOpen, onClose, tipo, suprimento, onConfirm }: Props) {
  const [quantidade, setQuantidade] = useState('')
  const [motivo, setMotivo] = useState('')
  const [lote, setLote] = useState('')
  const [validade, setValidade] = useState('')
  const [custo, setCusto] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setQuantidade(tipo === 'ajuste' ? String(suprimento?.quantidade ?? 0) : '')
    setMotivo('')
    setLote('')
    setValidade('')
    setCusto('')
  }, [isOpen, tipo, suprimento])

  const submit = async () => {
    if (!suprimento) return
    const qtd = Number(quantidade)
    if (!Number.isInteger(qtd) || qtd < (tipo === 'ajuste' ? 0 : 1)) {
      toast.error('Informe uma quantidade válida.')
      return
    }
    if (tipo !== 'entrada' && motivo.trim().length < 5) {
      toast.error('Informe a justificativa (mínimo 5 caracteres).')
      return
    }
    setSalvando(true)
    try {
      await onConfirm({
        action: tipo,
        suprimentoId: suprimento.id,
        quantidade: qtd,
        motivo: motivo.trim() || undefined,
        lote: lote.trim() || undefined,
        validade: validade || undefined,
        precoCusto: custo !== '' ? Number(custo) : undefined,
      })
      toast.success('Movimentação registrada.')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível registrar a movimentação.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-lg rounded-[24px] bg-app-card dark:bg-app-card-dark">
        <DialogTitle>{TITULOS[tipo]}</DialogTitle>
        <DialogDescription>
          {suprimento?.nome} — saldo atual: {suprimento?.quantidade ?? 0}
        </DialogDescription>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="mov-qtd">{tipo === 'ajuste' ? 'Novo saldo *' : 'Quantidade *'}</Label>
            <Input id="mov-qtd" type="number" min={tipo === 'ajuste' ? 0 : 1} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
          </div>
          {tipo === 'entrada' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label htmlFor="mov-lote">Lote</Label><Input id="mov-lote" value={lote} onChange={(e) => setLote(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="mov-val">Validade</Label><DateInput id="mov-val" value={validade} onChange={setValidade} /></div>
              <div className="space-y-1.5"><Label htmlFor="mov-custo">Custo (R$)</Label><Input id="mov-custo" type="number" min={0} step="0.01" value={custo} onChange={(e) => setCusto(e.target.value)} /></div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="mov-motivo">{tipo === 'entrada' ? 'Observação' : 'Justificativa *'}</Label>
            <Input id="mov-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={tipo === 'entrada' ? 'Ex.: compra NF 123' : 'Por que está dando baixa?'} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-app-primary text-white hover:bg-app-primary-hover" onClick={() => void submit()} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
