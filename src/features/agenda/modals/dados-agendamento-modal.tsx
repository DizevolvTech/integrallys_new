'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ModalHeader } from '@/components/shared/modal-header'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useProcedimentos } from '@/features/procedimentos/hooks/use-procedimentos'
import { DateInput } from '@/components/shared/date-input'

export interface EditarAgendamentoForm {
  id: string
  pacienteId: string
  paciente: string
  profissional: string
  profissionalId?: string
  data: string
  horario: string
  tipo: string
  status: string
  procedimentoId?: string
  procedimento?: string
  valorProcedimento?: number
  observacoes?: string
  modalidade?: string
  plataformaOnline?: string
  urlOnline?: string
}

interface ProfessionalOption {
  id: string
  nome: string
  procedimentoIds?: string[]
}

interface DadosAgendamentoModalProps {
  isOpen: boolean
  onClose: () => void
  agenda?: EditarAgendamentoForm | null
  professionals?: ProfessionalOption[]
  onSave?: (payload: {
    id: string
    pacienteId: string
    profissional: string
    profissionalId?: string
    data: string
    horario: string
    tipo: string
    status: string
    procedimentoId?: string
    valorProcedimento?: number
    observacoes?: string
    modalidade?: string
    plataformaOnline?: string
    urlOnline?: string
  }) => Promise<void>
}

function toIsoDate(value?: string) {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const parts = value.split('/')
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`
  return value
}

export function DadosAgendamentoModal({
  isOpen,
  onClose,
  agenda,
  professionals = [],
  onSave,
}: DadosAgendamentoModalProps) {
  const { data: procedimentosCatalogo } = useProcedimentos()
  const [profissional, setProfissional] = useState('')
  const [data, setData] = useState('')
  const [horario, setHorario] = useState('')
  const [tipo, setTipo] = useState('consulta')
  const [procedimentoId, setProcedimentoId] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [modalidade, setModalidade] = useState('Presencial')
  const [plataformaOnline, setPlataformaOnline] = useState('google_meet')
  const [urlOnline, setUrlOnline] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isOpen || !agenda) return
    setProfissional(agenda.profissional || '')
    setData(toIsoDate(agenda.data))
    setHorario(agenda.horario?.slice(0, 5) || '')
    setTipo((agenda.tipo || 'consulta').toLowerCase())
    setProcedimentoId(agenda.procedimentoId || '')
    setObservacoes(agenda.observacoes || '')
    setModalidade(agenda.modalidade || 'Presencial')
    setPlataformaOnline(agenda.plataformaOnline || 'google_meet')
    setUrlOnline(agenda.urlOnline || '')
  }, [isOpen, agenda])

  const selectedProfessional = useMemo(
    () => professionals.find((item) => item.nome === profissional) ?? null,
    [professionals, profissional],
  )

  const procedimentosDisponiveis = useMemo(() => {
    const ativos = procedimentosCatalogo.filter((item) => item.ativo)
    if (!profissional) return []
    const vinculados = selectedProfessional?.procedimentoIds ?? []
    if (vinculados.length === 0) return []
    const allowed = new Set(vinculados)
    return ativos.filter((item) => allowed.has(item.id))
  }, [procedimentosCatalogo, profissional, selectedProfessional])

  const procedimentoSelecionado = useMemo(
    () => procedimentosDisponiveis.find((item) => item.id === procedimentoId) ?? null,
    [procedimentosDisponiveis, procedimentoId],
  )

  const valorCobrado = useMemo(() => {
    if (!procedimentoSelecionado) return agenda?.valorProcedimento
    if (tipo === 'retorno' && procedimentoSelecionado.temRetorno) {
      return procedimentoSelecionado.valorRetorno ?? procedimentoSelecionado.valor
    }
    return procedimentoSelecionado.valor
  }, [procedimentoSelecionado, tipo, agenda?.valorProcedimento])

  useEffect(() => {
    if (!procedimentoId) return
    // Não limpa enquanto a lista está vazia (carga/vínculos ausentes) — evita
    // apagar o procedimento já salvo no agendamento (BUG "volta consulta").
    if (procedimentosDisponiveis.length === 0) return
    if (!procedimentosDisponiveis.some((item) => item.id === procedimentoId)) {
      setProcedimentoId('')
    }
  }, [procedimentosDisponiveis, procedimentoId])

  if (!agenda) return null

  const handleSave = async () => {
    if (!agenda.pacienteId) {
      toast.error('Paciente do agendamento não encontrado.')
      return
    }
    if (!data || !horario) {
      toast.error('Informe data e horário.')
      return
    }
    setIsSaving(true)
    try {
      const needsUrl = modalidade === 'Online' || modalidade === 'Hibrido'
      const urlTrimmed = urlOnline.trim()
      if (needsUrl) {
        if (!urlTrimmed) {
          toast.error('Informe a URL do atendimento online/híbrido.')
          return
        }
        try {
          const parsed = new URL(urlTrimmed)
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            toast.error('A URL online deve começar com http:// ou https://.')
            return
          }
        } catch {
          toast.error('URL online inválida.')
          return
        }
      }
      await onSave?.({
        id: agenda.id,
        pacienteId: agenda.pacienteId,
        profissional,
        profissionalId: selectedProfessional?.id ?? agenda.profissionalId,
        data,
        horario,
        tipo,
        status: agenda.status,
        procedimentoId: procedimentoId || '',
        valorProcedimento: valorCobrado,
        observacoes,
        modalidade,
        plataformaOnline: needsUrl ? plataformaOnline : undefined,
        urlOnline: needsUrl ? urlTrimmed : undefined,
      })
      toast.success('Agendamento atualizado.')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-app-card dark:bg-app-card-dark">
        <ModalHeader
          title="Editar agendamento"
          description={`Paciente: ${agenda.paciente}`}
        />

        <div className="space-y-4 p-6 pt-0">
          <div className="space-y-1.5">
            <Label>Profissional</Label>
            <Select value={profissional} onValueChange={setProfissional}>
              <SelectTrigger className="h-11 rounded-integrallys">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {(professionals.length > 0
                  ? professionals.map((p) => p.nome)
                  : [profissional].filter(Boolean)
                ).map((nome) => (
                  <SelectItem key={nome} value={nome}>
                    {nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Procedimento</Label>
            <Select
              value={procedimentoId || '__none__'}
              onValueChange={(value) => setProcedimentoId(value === '__none__' ? '' : value)}
              disabled={!profissional}
            >
              <SelectTrigger className="h-11 rounded-integrallys">
                <SelectValue placeholder="Selecione o procedimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem procedimento</SelectItem>
                {procedimentosDisponiveis.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.nome}
                    {item.valor != null
                      ? ` — R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {procedimentosDisponiveis.length === 0 && profissional && (
              <p className="text-xs text-app-text-muted">
                Nenhum procedimento vinculado a este profissional.
              </p>
            )}
            {valorCobrado != null && (
              <p className="text-xs text-app-text-muted">
                Valor: R$ {Number(valorCobrado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <DateInput value={data} onChange={setData} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>Horário</Label>
              <Input
                type="time"
                value={horario}
                onChange={(event) => setHorario(event.target.value)}
                className="h-11 rounded-integrallys"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="h-11 rounded-integrallys">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consulta">Consulta</SelectItem>
                  <SelectItem value="exame">Exame</SelectItem>
                  <SelectItem value="retorno">Retorno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Modalidade</Label>
              <Select value={modalidade} onValueChange={setModalidade}>
                <SelectTrigger className="h-11 rounded-integrallys">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Presencial">Presencial</SelectItem>
                  <SelectItem value="Online">Online</SelectItem>
                  <SelectItem value="Hibrido">Híbrido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(modalidade === 'Online' || modalidade === 'Hibrido') && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Plataforma online</Label>
                <Select value={plataformaOnline} onValueChange={setPlataformaOnline}>
                  <SelectTrigger className="h-11 rounded-integrallys">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google_meet">Google Meet</SelectItem>
                    <SelectItem value="zoom">Zoom</SelectItem>
                    <SelectItem value="teams">Microsoft Teams</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Link da reunião</Label>
                <Input
                  type="url"
                  value={urlOnline}
                  onChange={(event) => setUrlOnline(event.target.value)}
                  placeholder="https://meet.google.com/..."
                  className="h-11 rounded-integrallys"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(event) => setObservacoes(event.target.value)}
              className="min-h-[96px] rounded-integrallys"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="h-11 rounded-integrallys">
            Cancelar
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="h-11 rounded-integrallys bg-app-primary px-8 text-white hover:bg-app-primary-hover"
          >
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
