'use client'

import { AlertTriangle, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { DateInput } from '@/components/shared/date-input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useUsuarios } from '@/hooks/use-usuarios'

export interface ExcluirAgendaResumo {
  excluidos: number
}

interface ExcluirAgendaModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (payload: {
    especialistaId: string
    dataInicio: string
    dataFim: string
    diasSemana: number[]
    justificativa: string
  }) => Promise<ExcluirAgendaResumo>
}

// 0=Dom .. 6=Sáb, alinhado ao getDay() / profissional_horarios (migration 079).
const DIAS = [
  { label: 'Dom', value: 0 },
  { label: 'Seg', value: 1 },
  { label: 'Ter', value: 2 },
  { label: 'Qua', value: 3 },
  { label: 'Qui', value: 4 },
  { label: 'Sex', value: 5 },
  { label: 'Sáb', value: 6 },
]

const TODOS_OS_DIAS = DIAS.map((dia) => dia.value)

export function ExcluirAgendaModal({ isOpen, onClose, onSave }: ExcluirAgendaModalProps) {
  const { data: usuarios } = useUsuarios()
  const [especialistaId, setEspecialistaId] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [diasSemana, setDiasSemana] = useState<number[]>(TODOS_OS_DIAS)
  const [justificativa, setJustificativa] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [resumo, setResumo] = useState<ExcluirAgendaResumo | null>(null)

  const especialistas = useMemo(
    () => usuarios.filter((item) => item.perfil === 'especialista'),
    [usuarios],
  )

  const resetForm = () => {
    setEspecialistaId('')
    setDataInicio('')
    setDataFim('')
    setDiasSemana(TODOS_OS_DIAS)
    setJustificativa('')
    setResumo(null)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const toggleDay = (day: number) => {
    setDiasSemana((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day].sort((a, b) => a - b),
    )
  }

  const handleSave = async () => {
    if (!especialistaId || !dataInicio || !dataFim || diasSemana.length === 0) {
      toast.error('Preencha especialista, período e ao menos um dia da semana.')
      return
    }
    if (!justificativa.trim()) {
      toast.error('Informe a justificativa da exclusão.')
      return
    }

    setIsSaving(true)
    try {
      const result = await onSave({
        especialistaId,
        dataInicio,
        dataFim,
        diasSemana,
        justificativa: justificativa.trim(),
      })
      setResumo(result)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível excluir a agenda.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        hideCloseButton={true}
        className="w-[95vw] sm:max-w-[620px] max-h-[90vh] p-0 rounded-[24px] overflow-hidden border border-app-border dark:border-app-border-dark shadow-lg flex flex-col"
      >
        <DialogTitle className="sr-only">Excluir agenda gerada</DialogTitle>
        <div className="bg-app-card dark:bg-app-card-dark p-8 overflow-y-auto custom-scrollbar min-h-0">
          <div className="flex justify-between items-start mb-8">
            <div className="space-y-1">
              <h2 className="text-xl font-normal text-app-text-primary dark:text-white">
                Excluir agenda gerada
              </h2>
              <p className="text-sm text-app-text-muted">
                {resumo
                  ? 'Resumo da exclusão.'
                  : 'Remove os horários livres gerados de um profissional no período.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark hover:bg-app-bg-secondary dark:hover:bg-app-hover transition-colors shrink-0"
            >
              <X className="h-4 w-4 text-app-text-muted" />
            </button>
          </div>

          {resumo ? (
            <div className="space-y-6">
              <div className="rounded-xl border border-app-border bg-app-bg-secondary/50 px-5 py-6 text-center dark:border-app-border-dark dark:bg-app-bg-dark">
                <p className="text-4xl font-semibold text-app-text-primary dark:text-white">
                  {resumo.excluidos}
                </p>
                <p className="mt-1 text-sm text-app-text-muted">horário(s) livre(s) excluído(s)</p>
                {resumo.excluidos === 0 ? (
                  <p className="mt-1 text-xs text-app-text-muted">
                    Nenhum horário livre correspondia ao filtro (agendamentos com paciente não são
                    afetados).
                  </p>
                ) : null}
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setResumo(null)}>
                  Excluir novamente
                </Button>
                <Button className="app-action-primary" onClick={handleClose}>
                  Concluir
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-6">
                <div className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Apenas horários <strong>livres</strong> (Disponível, sem paciente) serão
                    excluídos. Agendamentos com paciente vinculado não são afetados.
                  </span>
                </div>

                <div className="space-y-2">
                  <Label>Especialista</Label>
                  <Select value={especialistaId} onValueChange={setEspecialistaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o profissional" />
                    </SelectTrigger>
                    <SelectContent>
                      {especialistas.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label>Período</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DateInput value={dataInicio} onChange={setDataInicio} />
                    <DateInput value={dataFim} onChange={setDataFim} />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Dias da semana</Label>
                  <p className="text-xs text-app-text-muted">
                    Restringe quais dias do período serão limpos.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {DIAS.map((dia) => {
                      const active = diasSemana.includes(dia.value)
                      return (
                        <button
                          key={dia.value}
                          type="button"
                          onClick={() => toggleDay(dia.value)}
                          className={`h-11 px-4 rounded-xl border text-sm transition-colors ${
                            active
                              ? 'border-app-primary bg-app-primary text-white'
                              : 'border-app-border bg-app-card text-app-text-primary dark:border-app-border-dark dark:bg-app-bg-dark dark:text-white'
                          }`}
                        >
                          {dia.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Justificativa</Label>
                  <Textarea
                    value={justificativa}
                    onChange={(event) => setJustificativa(event.target.value)}
                    placeholder="Motivo da exclusão (obrigatório) — será registrado e notificado ao gestor/admin da unidade."
                    className="min-h-[90px] resize-none rounded-integrallys"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <Button variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button
                  className="bg-red-600 text-white hover:bg-red-700"
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                >
                  {isSaving ? 'Excluindo...' : 'Excluir agenda'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
