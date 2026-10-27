'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PRAZOS_RETORNO } from '@/lib/retorno-prazo'

export interface PrazoRetornoEscolhido {
  tipo: string
  dias?: number
}

interface PrazoRetornoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Grava o prazo; deve lançar erro com mensagem amigável se falhar (o modal permanece aberto). */
  onConfirm: (prazo: PrazoRetornoEscolhido) => Promise<void>
  /** Segue sem definir prazo. */
  onSkip: () => void
}

/** Modal "Definir prazo de retorno" — usado ao finalizar o atendimento (fluxo da agenda e do prontuário). */
export function PrazoRetornoModal({ open, onOpenChange, onConfirm, onSkip }: PrazoRetornoModalProps) {
  const [option, setOption] = useState('30')
  const [customDays, setCustomDays] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleConfirm = async () => {
    const days = Number(customDays)
    if (option === 'custom' && (!days || days <= 0)) {
      setError('Informe um prazo válido em dias.')
      return
    }
    setIsSaving(true)
    try {
      await onConfirm({ tipo: option, dias: option === 'custom' ? days : undefined })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o prazo de retorno.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="p-8">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-normal text-app-text-primary dark:text-white">Definir prazo de retorno</h2>
            <p className="text-sm text-app-text-muted font-normal">Informe em quanto tempo o paciente deve voltar. O prazo alimenta a lista de retornos da recepção.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRAZOS_RETORNO.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { setOption(item.id); setError('') }}
                className={`px-3 py-1.5 rounded-full text-xs font-normal border transition-all ${
                  option === item.id
                    ? 'bg-app-primary border-[var(--app-primary)] text-white'
                    : 'border-app-border text-app-text-secondary hover:border-[var(--app-primary)]/40 hover:text-[var(--app-primary)]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {option === 'custom' && (
            <div className="space-y-2">
              <Label className="text-xs font-normal text-app-text-muted uppercase tracking-wider">
                Informe o prazo em dias
              </Label>
              <Input
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="Ex: 45"
                className="h-11 rounded-integrallys bg-app-bg-secondary/50 dark:bg-app-card-dark/50 border-app-border dark:border-app-border-dark"
              />
            </div>
          )}
          {error && <p className="text-xs text-[var(--app-danger-text)]">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 font-normal" onClick={onSkip}>
              Finalizar sem prazo
            </Button>
            <Button className="flex-1 bg-app-primary font-normal" onClick={handleConfirm} disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar retorno'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
