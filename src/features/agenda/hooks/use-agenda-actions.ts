'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { AgendaModal, AgendaSlot } from '../agenda.types'

interface UseAgendaActionsProps {
  updateAgendamento: (payload: {
    id: string
    pacienteId: string
    profissional: string
    profissionalId?: string
    data: string
    horario: string
    status: string
    tipo?: string
    procedimentoId?: string
    valorProcedimento?: number
    observacoes?: string
    modalidade?: string
    plataformaOnline?: string
    urlOnline?: string
  }) => Promise<void>
  deleteAgendamento: (id: string, reason: string) => Promise<void>
  createWaitlistItem: (payload: {
    pacienteId: string
    prioridade: string
    observacoes?: string
    procedimentoId?: string
    especialistaId?: string
    preferenciaHorario?: string
  }) => Promise<void>
  createTarefa: (payload: {
    titulo: string
    descricao: string
    responsavelNome: string
    status: string
  }) => Promise<void>
  registerAgendamentoPagamento: (payload: {
    agendamentoId: string
    valor: number
    metodo: string
    observacoes?: string
    bandeira?: string
    parcelas?: number
    contaBancariaId?: string
    descricao?: string
    beneficiario?: string
  }) => Promise<{ caixaRegistrado: boolean }>
  reloadAgenda: () => Promise<void>
  findPacienteId: (slot: AgendaSlot) => string | undefined
}

export function useAgendaActions({
  updateAgendamento,
  deleteAgendamento,
  createWaitlistItem,
  createTarefa,
  registerAgendamentoPagamento,
  reloadAgenda,
  findPacienteId,
}: UseAgendaActionsProps) {
  const [activeModal, setActiveModal] = useState<AgendaModal>(null)
  const [selectedSlot, setSelectedSlot] = useState<AgendaSlot | null>(null)

  const openSlotModal = (
    modal: Extract<AgendaModal, 'remarcar' | 'cancelar' | 'detalhes' | 'visualizar' | 'ficha-paciente' | 'chamar-especialista'>,
    slot: AgendaSlot,
  ) => {
    setSelectedSlot(slot)
    setActiveModal(modal)
  }

  const handleOpenCharge = (slot: AgendaSlot) => {
    setSelectedSlot(slot)
    setActiveModal('cobranca')
  }

  const parseAgendaDate = (value?: string) => {
    if (!value) return ''
    const parts = value.split('/')
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`
    return value
  }

  const handleStatusChange = async (
    slot: AgendaSlot,
    status: string,
    options?: { openClinicalFlow?: boolean },
  ) => {
    if (status === 'Cancelado') {
      setSelectedSlot(slot)
      setActiveModal('cancelar')
      return
    }

    const pacienteId = findPacienteId(slot)
    if (!pacienteId) {
      toast.error('Não foi possível localizar o paciente deste agendamento.')
      return
    }

    try {
      await updateAgendamento({
        id: slot.id,
        pacienteId,
        profissional: slot.profissional,
        profissionalId: slot.profissionalId,
        data: parseAgendaDate(slot.data),
        horario: slot.hora,
        status,
        tipo: slot.tipo,
        procedimentoId: slot.procedimentoId,
        valorProcedimento: slot.valorProcedimento,
        observacoes: slot.observacoes,
        modalidade: slot.modalidade,
        plataformaOnline: slot.plataformaOnline,
        urlOnline: slot.urlOnline,
      })
      toast.success(`Status atualizado para ${status}.`)

      if (options?.openClinicalFlow && status === 'Em Atendimento' && typeof window !== 'undefined') {
        window.open(
          `/prontuarios?paciente_id=${encodeURIComponent(pacienteId)}&hardware=1`,
          '_blank',
          'noopener',
        )
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível atualizar o status.')
    }
  }

  const handleReschedule = async (payload: {
    id: string
    pacienteId?: string
    data: string
    horario: string
  }) => {
    if (!selectedSlot || !payload.pacienteId) return
    if (selectedSlot.status === 'Cancelado') {
      toast.error('Consulta cancelada não pode ser reagendada. Faça um novo agendamento.')
      return
    }
    try {
      await updateAgendamento({
        id: payload.id,
        pacienteId: payload.pacienteId,
        profissional: selectedSlot.profissional,
        profissionalId: selectedSlot.profissionalId,
        data: payload.data,
        horario: payload.horario,
        status: selectedSlot.status,
        tipo: selectedSlot.tipo,
        procedimentoId: selectedSlot.procedimentoId,
        valorProcedimento: selectedSlot.valorProcedimento,
        observacoes: selectedSlot.observacoes,
        modalidade: selectedSlot.modalidade,
        plataformaOnline: selectedSlot.plataformaOnline,
        urlOnline: selectedSlot.urlOnline,
      })
      toast.success('Agendamento remarcado com sucesso.')
      setActiveModal(null)
      setSelectedSlot(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível remarcar o agendamento.')
    }
  }

  const handleEditAppointment = async (payload: {
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
  }) => {
    await updateAgendamento({
      id: payload.id,
      pacienteId: payload.pacienteId,
      profissional: payload.profissional,
      profissionalId: payload.profissionalId,
      data: payload.data,
      horario: payload.horario,
      status: payload.status,
      tipo: payload.tipo,
      // string vazia limpa o vínculo no PUT (merge explícito)
      procedimentoId: payload.procedimentoId ?? '',
      valorProcedimento: payload.valorProcedimento,
      observacoes: payload.observacoes,
      modalidade: payload.modalidade,
      plataformaOnline: payload.plataformaOnline,
      urlOnline: payload.urlOnline,
    })
    setActiveModal(null)
    setSelectedSlot(null)
  }

  const handleCancel = async (payload: { id: string; reason: string }) => {
    try {
      await deleteAgendamento(payload.id, payload.reason)
      toast.success('Agendamento cancelado com sucesso.')
      setActiveModal(null)
      setSelectedSlot(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível cancelar o agendamento.')
    }
  }

  const handleAddToWaitlist = async (payload: {
    pacienteId: string
    prioridade: string
    observacoes: string
    procedimentoId?: string
    especialistaId?: string
    preferenciaHorario?: string
  }) => {
    try {
      await createWaitlistItem({
        pacienteId: payload.pacienteId,
        prioridade: payload.prioridade,
        observacoes: payload.observacoes || undefined,
        procedimentoId: payload.procedimentoId || undefined,
        especialistaId: payload.especialistaId || undefined,
        preferenciaHorario: payload.preferenciaHorario || undefined,
      })
      toast.success('Paciente adicionado à lista de espera.')
      setActiveModal(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível adicionar à lista de espera.')
    }
  }

  const handleEmitCharge = async (payload: {
    descricao: string
    valor: number
    metodo: string
    observacoes: string
    bandeira?: string
    parcelas?: number
    contaBancariaId?: string
  }) => {
    if (!selectedSlot) return
    try {
      const { caixaRegistrado } = await registerAgendamentoPagamento({
        agendamentoId: selectedSlot.id,
        valor: payload.valor,
        metodo: payload.metodo,
        observacoes: payload.observacoes || `${selectedSlot.profissional} • ${selectedSlot.hora}`,
        bandeira: payload.bandeira,
        parcelas: payload.parcelas,
        contaBancariaId: payload.contaBancariaId,
        descricao: payload.descricao,
        beneficiario: selectedSlot.paciente,
      })
      await reloadAgenda()
      toast.success(
        caixaRegistrado
          ? 'Recebimento registrado e lançado no caixa.'
          : 'Recebimento registrado. O caixa de hoje está fechado, então o valor não entrou no caixa.',
      )
      setActiveModal(null)
      setSelectedSlot(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível emitir a cobrança.')
    }
  }

  const handleCallSpecialist = async (profissionalId?: string, mensagem?: string) => {
    const slot = selectedSlot
    if (!slot) return
    const profNome = profissionalId ? undefined : slot.profissional
    try {
      await createTarefa({
        titulo: `Contato com especialista - ${slot.paciente}`,
        descricao: mensagem
          ? `${mensagem}\n\nReferente: ${slot.profissional} • ${slot.hora}${slot.data ? ` • ${slot.data}` : ''}`
          : `Solicitação gerada pela agenda para ${slot.profissional} referente ao horário ${slot.hora}${slot.data ? ` em ${slot.data}` : ''}.`,
        responsavelNome: profNome ?? slot.profissional,
        status: 'Pendente',
      })
      toast.success('Solicitação enviada para o especialista nas tarefas.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível chamar o especialista.')
    }
  }

  return {
    activeModal,
    setActiveModal,
    selectedSlot,
    setSelectedSlot,
    openSlotModal,
    handleOpenCharge,
    parseAgendaDate,
    handleStatusChange,
    handleReschedule,
    handleEditAppointment,
    handleCancel,
    handleAddToWaitlist,
    handleEmitCharge,
    handleCallSpecialist,
  }
}
