'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AlertCircle, Clock, MapPin, Users, X } from 'lucide-react'

import { DateInput } from '@/components/shared/date-input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MultiSelectSearch } from '@/components/ui/multi-select-search'
import { Textarea } from '@/components/ui/textarea'
import { useParticipantesCompromisso } from '../hooks/use-participantes-compromisso'

type TipoCompromisso = 'Reunião' | 'Tarefa' | 'Lembrete' | 'Evento' | 'Aprovação'

interface EditarCompromissoModalProps {
  isOpen: boolean
  onClose: () => void
  compromisso: {
    id: string
    titulo: string
    tipo?: TipoCompromisso
    data: string
    hora: string
    duracao?: string
    local?: string
    /** Especialista que organiza (fixo); os demais participantes podem ser editados. */
    organizadorId?: string
    participanteIds?: string[]
    observacoes?: string
  } | null
  onSave: (payload: {
    id: string
    titulo: string
    tipo?: TipoCompromisso
    data: string
    hora: string
    duracao?: string
    local?: string
    participanteIds: string[]
    observacoes?: string
  }) => Promise<void>
}

export function EditarCompromissoModal({
  isOpen,
  onClose,
  compromisso,
  onSave,
}: EditarCompromissoModalProps) {
  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState<TipoCompromisso>('Reunião')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [duracao, setDuracao] = useState('30')
  const [local, setLocal] = useState('')
  const [participanteIds, setParticipanteIds] = useState<string[]>([])
  const { data: usuarios, isLoading: carregandoUsuarios, error: erroUsuarios } = useParticipantesCompromisso(isOpen)
  const [observacoes, setObservacoes] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setTitulo(compromisso?.titulo ?? '')
    setTipo(compromisso?.tipo ?? 'Reunião')
    setData(compromisso?.data ?? '')
    setHora(compromisso?.hora ?? '')
    setDuracao(compromisso?.duracao?.replace('min', '') ?? '30')
    setLocal(compromisso?.local ?? '')
    setParticipanteIds(compromisso?.participanteIds ?? [])
    setObservacoes(compromisso?.observacoes ?? '')
    setIsSaving(false)
  }, [compromisso, isOpen])

  if (!compromisso) return null

  const handleSave = async () => {
    if (!titulo.trim() || !data || !hora) {
      toast.error('Preencha título, data e horário do compromisso.')
      return
    }

    setIsSaving(true)
    try {
      await onSave({
        id: compromisso.id,
        titulo: titulo.trim(),
        tipo,
        data,
        hora,
        duracao: duracao || undefined,
        local: local.trim() || undefined,
        participanteIds,
        observacoes: observacoes.trim() || undefined,
      })
      toast.success('Compromisso atualizado.')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível atualizar o compromisso.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        hideCloseButton={true}
        className="w-[95vw] sm:max-w-[520px] p-0 rounded-[24px] overflow-hidden border border-app-border dark:border-app-border-dark shadow-lg"
      >
        <DialogTitle className="sr-only">Editar compromisso</DialogTitle>
        <div className="bg-app-card dark:bg-app-card-dark p-8 custom-scrollbar">
          <div className="flex justify-between items-start mb-6">
            <div className="space-y-1">
              <h2 className="text-xl font-normal text-app-text-primary dark:text-white">Editar compromisso</h2>
              <p className="text-sm text-app-text-muted font-normal">
                Edite os dados do compromisso agendado na sua agenda pessoal
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark hover:bg-app-bg-secondary dark:hover:bg-app-hover transition-colors shrink-0"
            >
              <X className="h-4 w-4 text-app-text-muted" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="font-normal">Título *</Label>
              <Input
                value={titulo}
                onChange={(event) => setTitulo(event.target.value)}
                placeholder="Ex: Reunião de planejamento trimestral"
                className="font-normal"
              />
            </div>

            <div className="space-y-2">
              <Label className="font-normal">Tipo de compromisso *</Label>
              <Select
                value={tipo}
                onValueChange={(value) => setTipo(value as TipoCompromisso)}
              >
                <SelectTrigger className="font-normal">
                  <SelectValue placeholder="Selecione o tipo">
                    {tipo}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Reunião" className="font-normal">Reunião</SelectItem>
                  <SelectItem value="Tarefa" className="font-normal">Tarefa</SelectItem>
                  <SelectItem value="Lembrete" className="font-normal">Lembrete</SelectItem>
                  <SelectItem value="Evento" className="font-normal">Evento</SelectItem>
                  <SelectItem value="Aprovação" className="font-normal">Aprovação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-normal">Data *</Label>
                <DateInput value={data} onChange={setData} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 font-normal">
                  <Clock className="h-4 w-4 text-[var(--app-primary)]" />
                  Horário *
                </Label>
                <Input
                  type="time"
                  value={hora}
                  onChange={(event) => setHora(event.target.value)}
                  className="font-normal"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-normal">Duração</Label>
              <Select value={duracao} onValueChange={setDuracao}>
                <SelectTrigger className="font-normal">
                  <SelectValue>
                    {duracao === '15' ? '15 minutos' :
                      duracao === '30' ? '30 minutos' :
                        duracao === '45' ? '45 minutos' :
                          duracao === '60' ? '1 hora' :
                            duracao === '90' ? '1 hora e 30 min' :
                              duracao === '120' ? '2 horas' : `${duracao} minutos`}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15" className="font-normal">15 minutos</SelectItem>
                  <SelectItem value="30" className="font-normal">30 minutos</SelectItem>
                  <SelectItem value="45" className="font-normal">45 minutos</SelectItem>
                  <SelectItem value="60" className="font-normal">1 hora</SelectItem>
                  <SelectItem value="90" className="font-normal">1 hora e 30 min</SelectItem>
                  <SelectItem value="120" className="font-normal">2 horas</SelectItem>
                  {!['15', '30', '45', '60', '90', '120'].includes(duracao) && (
                    <SelectItem value={duracao} className="font-normal">{duracao} minutos</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 font-normal">
                <MapPin className="h-4 w-4 text-[var(--app-primary)]" />
                Local
              </Label>
              <Input
                value={local}
                onChange={(event) => setLocal(event.target.value)}
                placeholder="Ex: Sala de reuniões 2 - Andar 3"
                className="font-normal"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 font-normal">
                <Users className="h-4 w-4 text-[var(--app-primary)]" />
                Participantes
              </Label>
              <MultiSelectSearch
                options={usuarios
                  .filter((usuario) => usuario.id !== compromisso.organizadorId)
                  .map((usuario) => ({ value: usuario.id, label: usuario.nome, hint: usuario.perfilRotulo }))}
                value={participanteIds}
                onChange={setParticipanteIds}
                placeholder="Buscar usuário pelo nome..."
                emptyText={carregandoUsuarios ? 'Carregando usuários...' : 'Nenhum usuário encontrado.'}
              />
              {erroUsuarios && <p className="text-xs text-[var(--app-danger-text)]">{erroUsuarios}</p>}
            </div>

            <div className="space-y-2">
              <Label className="font-normal">Descrição/observações</Label>
              <Textarea
                value={observacoes}
                onChange={(event) => setObservacoes(event.target.value)}
                placeholder="Adicione detalhes sobre o compromisso..."
                rows={3}
                className="resize-none font-normal"
              />
            </div>

            <div className="app-status-info border border-transparent rounded-[8px] p-3 flex gap-3">
              <AlertCircle className="h-5 w-5 text-[var(--app-info-text)] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-900 dark:text-[var(--app-info-text)] leading-relaxed font-normal">
                As alterações serão aplicadas imediatamente ao compromisso.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8 pt-2 sm:gap-0 flex-col sm:flex-row">
            <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto h-11 px-6 rounded-integrallys font-normal">
              Cancelar
            </Button>
            <Button
              className="w-full sm:w-auto h-11 px-8 bg-app-primary hover:bg-app-primary-hover text-white font-normal rounded-integrallys shadow-sm transition-all active:scale-[0.98]"
              onClick={() => void handleSave()}
              disabled={isSaving}
            >
              {isSaving ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
