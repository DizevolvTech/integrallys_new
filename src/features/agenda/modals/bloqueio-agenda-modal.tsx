'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Clock, Lock, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useApi } from '@/hooks/use-api'

const DEFAULT_TIPOS_BLOQUEIO = ['Férias', 'Folga', 'Reunião', 'Outro']
const NEW_TYPE_SENTINEL = '__new_tipo__'

interface BloqueioAgendaModalProps {
  isOpen: boolean
  onClose: () => void
  professionals?: string[]
  onSave?: (payload: {
    dataInicio: string
    dataFim: string
    horarioInicio: string
    horarioFim: string
    profissional: string
    tipo: string
    justificativa: string
    bloquearDiaInteiro: boolean
  }) => void
}

export function BloqueioAgendaModal({
  isOpen,
  onClose,
  professionals = [],
  onSave,
}: BloqueioAgendaModalProps) {
  const api = useApi()
  const getInitialFormData = useCallback(
    () => ({
      dataInicio: '',
      dataFim: '',
      horarioInicio: '08:00',
      horarioFim: '18:00',
      profissional: '',
      tipo: '',
      tipoBloqueio: 'horario' as 'horario' | 'dia_inteiro',
      justificativa: '',
      bloquearDiaInteiro: false,
    }),
    [],
  )

  const [formData, setFormData] = useState(getInitialFormData())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [tiposDisponiveis, setTiposDisponiveis] = useState<string[]>(DEFAULT_TIPOS_BLOQUEIO)
  const [isCreatingNewTipo, setIsCreatingNewTipo] = useState(false)
  const [newTipoLabel, setNewTipoLabel] = useState('')
  const [isSavingNewTipo, setIsSavingNewTipo] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setFormData(getInitialFormData())
    setErrors({})
    setIsCreatingNewTipo(false)
    setNewTipoLabel('')

    let cancelled = false
    const load = async () => {
      try {
        const response = await api.get<{ data: string[] }>('/api/agenda/bloqueios/tipos')
        if (cancelled) return
        setTiposDisponiveis(response.data)
      } catch {
        if (!cancelled) setTiposDisponiveis(DEFAULT_TIPOS_BLOQUEIO)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [api, getInitialFormData, isOpen])

  const sortedTipos = useMemo(
    () => [...tiposDisponiveis].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [tiposDisponiveis],
  )

  const validateForm = () => {
    const nextErrors: Record<string, string> = {}

    if (!formData.dataInicio) nextErrors.dataInicio = 'Data de início é obrigatória'
    if (!formData.dataFim) nextErrors.dataFim = 'Data de fim é obrigatória'
    if (!formData.profissional) nextErrors.profissional = 'Profissional é obrigatório'
    if (!formData.tipo) nextErrors.tipo = 'Tipo de bloqueio é obrigatório'
    if (!formData.justificativa.trim()) nextErrors.justificativa = 'Justificativa é obrigatória'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleClose = () => {
    setFormData(getInitialFormData())
    setErrors({})
    setIsCreatingNewTipo(false)
    setNewTipoLabel('')
    onClose()
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!validateForm()) return

    onSave?.({
      dataInicio: formData.dataInicio,
      dataFim: formData.dataFim,
      horarioInicio: formData.horarioInicio,
      horarioFim: formData.horarioFim,
      profissional: formData.profissional,
      tipo: formData.tipo,
      justificativa: formData.justificativa.trim(),
      bloquearDiaInteiro: formData.bloquearDiaInteiro,
    })

    handleClose()
  }

  const handleTipoChange = (value: string) => {
    if (value === NEW_TYPE_SENTINEL) {
      setIsCreatingNewTipo(true)
      setNewTipoLabel('')
      return
    }
    setFormData({ ...formData, tipo: value })
  }

  const handleSaveNewTipo = async () => {
    const trimmed = newTipoLabel.trim()
    if (!trimmed) {
      toast.error('Informe um nome para o novo tipo de bloqueio.')
      return
    }
    if (tiposDisponiveis.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Este tipo já existe.')
      return
    }

    setIsSavingNewTipo(true)
    try {
      const response = await api.post<{ data: string[] }>('/api/agenda/bloqueios/tipos', { nome: trimmed })
      setTiposDisponiveis(response.data)
      setFormData((current) => ({ ...current, tipo: trimmed }))
      setIsCreatingNewTipo(false)
      setNewTipoLabel('')
      toast.success(`Tipo "${trimmed}" criado.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar o novo tipo.')
    } finally {
      setIsSavingNewTipo(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-app-card dark:bg-app-card-dark rounded-integrallys-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-normal">
            <Lock className="h-5 w-5 text-[var(--app-primary)]" />
            Bloquear Agenda
          </DialogTitle>
          <DialogDescription className="text-app-text-muted mt-1.5">
            Bloqueie horários na agenda do profissional informando o motivo
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 pt-2 space-y-5 pb-8">
          <div className="app-status-info dark:bg-transparent border border-transparent dark:border-transparent rounded-integrallys p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-[var(--app-info-text)] mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--app-info-text)]">
                O bloqueio impedirá novos agendamentos no período selecionado. O horário ficará indisponível na grade da agenda.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-normal text-app-text-primary dark:text-white">
              Profissional *
            </Label>
            <Select
              value={formData.profissional}
              onValueChange={(value) => setFormData({ ...formData, profissional: value })}
            >
              <SelectTrigger className={`h-11 rounded-integrallys dark:bg-app-bg-dark ${errors.profissional ? 'border-red-500' : ''}`}>
                <SelectValue preferPlaceholder placeholder="Selecione o profissional" />
              </SelectTrigger>
              <SelectContent className="rounded-integrallys">
                {professionals.map((profissional) => (
                  <SelectItem key={profissional} value={profissional}>
                    {profissional}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.profissional && <p className="text-xs text-[var(--app-danger-text)]">{errors.profissional}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-normal">Data início *</Label>
              <Input
                type="date"
                value={formData.dataInicio}
                onChange={(event) => setFormData({ ...formData, dataInicio: event.target.value })}
                className={`h-11 rounded-integrallys dark:bg-app-bg-dark ${errors.dataInicio ? 'border-red-500' : ''}`}
              />
              {errors.dataInicio && <p className="text-xs text-[var(--app-danger-text)]">{errors.dataInicio}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-normal">Data fim *</Label>
              <Input
                type="date"
                value={formData.dataFim}
                onChange={(event) => setFormData({ ...formData, dataFim: event.target.value })}
                className={`h-11 rounded-integrallys dark:bg-app-bg-dark ${errors.dataFim ? 'border-red-500' : ''}`}
              />
              {errors.dataFim && <p className="text-xs text-[var(--app-danger-text)]">{errors.dataFim}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-normal text-app-text-primary dark:text-white">Tipo *</Label>
            <Select
              value={formData.tipoBloqueio}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  tipoBloqueio: value as 'horario' | 'dia_inteiro',
                  bloquearDiaInteiro: value === 'dia_inteiro',
                })
              }
            >
              <SelectTrigger className="h-11 rounded-integrallys dark:bg-app-bg-dark">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-integrallys">
                <SelectItem value="horario">Horário específico</SelectItem>
                <SelectItem value="dia_inteiro">Dia inteiro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!formData.bloquearDiaInteiro && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2 text-sm font-normal">
                  <Clock className="h-4 w-4 text-[var(--app-primary)]" />
                  Horário início
                </Label>
                <Input
                  type="time"
                  value={formData.horarioInicio}
                  onChange={(event) => setFormData({ ...formData, horarioInicio: event.target.value })}
                  className="h-11 rounded-integrallys dark:bg-app-bg-dark"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2 text-sm font-normal">
                  <Clock className="h-4 w-4 text-[var(--app-primary)]" />
                  Horário fim
                </Label>
                <Input
                  type="time"
                  value={formData.horarioFim}
                  onChange={(event) => setFormData({ ...formData, horarioFim: event.target.value })}
                  className="h-11 rounded-integrallys dark:bg-app-bg-dark"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm font-normal text-app-text-primary dark:text-white">
              Tipo de bloqueio *
            </Label>
            {isCreatingNewTipo ? (
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  value={newTipoLabel}
                  onChange={(event) => setNewTipoLabel(event.target.value)}
                  placeholder="Ex: Dentista, Marketing..."
                  className="h-11 rounded-integrallys dark:bg-app-bg-dark"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void handleSaveNewTipo()
                    }
                    if (event.key === 'Escape') {
                      setIsCreatingNewTipo(false)
                      setNewTipoLabel('')
                    }
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  className="h-11 w-11 rounded-integrallys bg-app-primary text-white hover:bg-app-primary-hover shrink-0"
                  onClick={() => void handleSaveNewTipo()}
                  disabled={isSavingNewTipo || !newTipoLabel.trim()}
                  title="Salvar novo tipo"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 rounded-integrallys shrink-0"
                  onClick={() => {
                    setIsCreatingNewTipo(false)
                    setNewTipoLabel('')
                  }}
                  title="Cancelar"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Select value={formData.tipo} onValueChange={handleTipoChange}>
                <SelectTrigger className={`h-11 rounded-integrallys dark:bg-app-bg-dark ${errors.tipo ? 'border-red-500' : ''}`}>
                  <SelectValue preferPlaceholder placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent className="rounded-integrallys">
                  {sortedTipos.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {tipo}
                    </SelectItem>
                  ))}
                  <SelectSeparator />
                  <SelectItem value={NEW_TYPE_SENTINEL} className="font-medium text-[var(--app-primary)]">
                    <span className="flex items-center gap-2">
                      <Plus className="h-3.5 w-3.5" />
                      Criar novo tipo
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
            {errors.tipo && <p className="text-xs text-[var(--app-danger-text)]">{errors.tipo}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-normal text-app-text-primary dark:text-white">
              Justificativa *
            </Label>
            <Textarea
              placeholder="Informe o motivo do bloqueio..."
              value={formData.justificativa}
              onChange={(event) => setFormData({ ...formData, justificativa: event.target.value })}
              className={`min-h-[80px] rounded-integrallys dark:bg-app-bg-dark resize-none ${errors.justificativa ? 'border-red-500' : ''}`}
            />
            {errors.justificativa && <p className="text-xs text-[var(--app-danger-text)]">{errors.justificativa}</p>}
          </div>

          <DialogFooter className="pt-2 gap-3 sm:gap-0">
            <Button type="button" variant="outline" onClick={handleClose} className="w-full sm:w-auto h-11 px-6 rounded-integrallys">
              Cancelar
            </Button>
            <Button type="submit" className="w-full sm:w-auto h-11 px-6 rounded-integrallys bg-app-primary hover:bg-app-primary-hover text-white">
              Salvar bloqueio
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
