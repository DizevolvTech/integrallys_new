'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { alvoParaCorpo, useRetornoAlvo } from './hooks/use-retorno-alvo'
import { RetornoAlvoCampos } from './retorno-alvo-campos'
import {
  PRAZO_RETORNO_INICIAL,
  PrazoRetornoSelector,
  prazoEscolhido,
  type PrazoRetornoEscolhido,
  type PrazoRetornoValor,
} from './prazo-retorno-selector'

export type { PrazoRetornoEscolhido }

interface PrazoRetornoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Grava o prazo; deve lançar erro com mensagem amigável se falhar (o modal permanece aberto). */
  onConfirm: (prazo: PrazoRetornoEscolhido, alvo: Record<string, string>) => Promise<void>
  /** Segue sem definir prazo. */
  onSkip: () => void
  /** Atendimento de origem: pré-preenche especialista e procedimento do retorno. */
  pacienteId?: string | null
  agendamentoId?: string | null
}

/** Modal "Definir prazo de retorno" — usado ao finalizar o atendimento (fluxo da agenda e do prontuário). */
export function PrazoRetornoModal({ open, onOpenChange, onConfirm, onSkip, pacienteId, agendamentoId }: PrazoRetornoModalProps) {
  const [valor, setValor] = useState<PrazoRetornoValor>(PRAZO_RETORNO_INICIAL)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const { opcoes, alvo, setAlvo, erro: erroOpcoes } = useRetornoAlvo({ enabled: open, pacienteId, agendamentoId })

  const handleConfirm = async () => {
    const escolhido = prazoEscolhido(valor)
    if ('erro' in escolhido) {
      setError(escolhido.erro)
      return
    }
    setIsSaving(true)
    try {
      await onConfirm(escolhido, alvoParaCorpo(alvo))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o prazo de retorno.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[90dvh] overflow-y-auto p-6 sm:p-8">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-normal text-app-text-primary dark:text-white">Definir prazo de retorno</h2>
            <p className="text-sm text-app-text-muted font-normal">Informe em quanto tempo o paciente deve voltar. O prazo alimenta a lista de retornos da recepção.</p>
          </div>
          <PrazoRetornoSelector
            value={valor}
            onChange={(next) => {
              setValor(next)
              setError('')
            }}
          />
          <RetornoAlvoCampos opcoes={opcoes} value={alvo} onChange={setAlvo} idPrefix="prazo-modal" erro={erroOpcoes} />
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
