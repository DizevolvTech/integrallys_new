'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Clock, MapPin, Users } from 'lucide-react'

import { ModalHeader } from '@/components/shared/modal-header'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

type TipoCompromisso = 'Reunião' | 'Tarefa' | 'Lembrete' | 'Evento' | 'Aprovação'

interface AgendarReuniaoModalProps {
  isOpen: boolean
  onClose: () => void
  professionals?: Array<{ id: string; nome: string }>
  onSave: (payload: {
    titulo: string
    tipo?: TipoCompromisso
    data: string
    hora: string
    duracao: string
    horarioFim: string
    profissionalId?: string
    profissional?: string
    participantes: string
    local?: string
    observacoes?: string
  }) => Promise<void>
}

function addMinutesToTime(hora: string, minutes: number): string {
  const [h, m] = hora.split(':').map(Number)
  const total = (h || 0) * 60 + (m || 0) + minutes
  const nh = Math.floor(total / 60) % 24
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

export function AgendarReuniaoModal({
  isOpen,
  onClose,
  professionals = [],
  onSave,
}: AgendarReuniaoModalProps) {
  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState<TipoCompromisso | ''>('')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [duracao, setDuracao] = useState('30')
  const [profissionalId, setProfissionalId] = useState('')
  const [local, setLocal] = useState('')
  const [participantes, setParticipantes] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setTitulo('')
    setTipo('')
    setData('')
    setHora('')
    setDuracao('30')
    setProfissionalId('')
    setLocal('')
    setParticipantes('')
    setObservacoes('')
    setIsSaving(false)
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo.trim() || !tipo || !data || !hora || !profissionalId) {
      toast.error('Preencha título, tipo, especialista, data e horário.')
      return
    }

    const profissional = professionals.find((item) => item.id === profissionalId)
    const minutos = Number(duracao) || 30
    const horarioFim = addMinutesToTime(hora, minutos)

    setIsSaving(true)
    try {
      await onSave({
        titulo: titulo.trim(),
        tipo: tipo as TipoCompromisso,
        data,
        hora,
        duracao,
        horarioFim,
        profissionalId,
        profissional: profissional?.nome,
        participantes: participantes.trim(),
        local: local.trim() || undefined,
        observacoes: observacoes.trim() || undefined,
      })
      toast.success('Compromisso registrado e agenda bloqueada no horário.')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível registrar o compromisso.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-app-card dark:bg-app-card-dark max-h-[90vh] overflow-y-auto">
        <ModalHeader
          title="Novo compromisso"
          description="Registra o compromisso e bloqueia a agenda do especialista no horário marcado"
        />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input
              placeholder="Ex: Reunião de Planejamento Trimestral"
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo de compromisso *</Label>
            <Select value={tipo} onValueChange={(value) => setTipo(value as TipoCompromisso)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo">
                  {tipo || 'Selecione o tipo'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Reunião">Reunião</SelectItem>
                <SelectItem value="Tarefa">Tarefa</SelectItem>
                <SelectItem value="Lembrete">Lembrete</SelectItem>
                <SelectItem value="Evento">Evento</SelectItem>
                <SelectItem value="Aprovação">Aprovação</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Especialista *</Label>
            <Select value={profissionalId} onValueChange={setProfissionalId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o especialista" />
              </SelectTrigger>
              <SelectContent>
                {professionals.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input
                type="date"
                value={data}
                onChange={(event) => setData(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[var(--app-primary)]" />
                Horário *
              </Label>
              <Input
                type="time"
                value={hora}
                onChange={(event) => setHora(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Duração</Label>
            <Select value={duracao} onValueChange={setDuracao}>
              <SelectTrigger>
                <SelectValue>
                  {duracao === '15' ? '15 minutos' :
                    duracao === '30' ? '30 minutos' :
                      duracao === '45' ? '45 minutos' :
                        duracao === '60' ? '1 hora' :
                          duracao === '90' ? '1 hora e 30 min' :
                            duracao === '120' ? '2 horas' : 'Selecione a duração'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutos</SelectItem>
                <SelectItem value="30">30 minutos</SelectItem>
                <SelectItem value="45">45 minutos</SelectItem>
                <SelectItem value="60">1 hora</SelectItem>
                <SelectItem value="90">1 hora e 30 min</SelectItem>
                <SelectItem value="120">2 horas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[var(--app-primary)]" />
              Local
            </Label>
            <Input
              placeholder="Ex: Sala de Reuniões 2 - Andar 3"
              value={local}
              onChange={(event) => setLocal(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[var(--app-primary)]" />
              Participantes
            </Label>
            <Input
              placeholder="Ex: 8 pessoas"
              value={participantes}
              onChange={(event) => setParticipantes(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição/Observações</Label>
            <Textarea
              placeholder="Adicione detalhes sobre a reunião..."
              rows={3}
              value={observacoes}
              onChange={(event) => setObservacoes(event.target.value)}
            />
          </div>

          <DialogFooter className="pt-2 gap-3 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="w-full sm:w-auto h-11 px-6 rounded-integrallys"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto h-11 px-8 bg-app-primary hover:bg-app-primary-hover text-white font-normal rounded-integrallys shadow-sm transition-all active:scale-[0.98]"
            >
              {isSaving ? 'Salvando...' : 'Criar compromisso'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
