'use client'

import { ReciboModal } from '@/features/recibos'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  Bell,
  Calendar,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  FileText,
  Lock,
  Plus,
  Trash2,
  Users,
} from 'lucide-react'
import { useAgenda } from '@/hooks/use-agenda'
import { useApi } from '@/hooks/use-api'
import { useAgendaBloqueios } from '@/features/agenda/hooks/use-agenda-bloqueios'
import { useAuth } from '@/hooks/use-auth'
import { useListaEspera } from '@/hooks/use-lista-espera'
import { buildAgendarUrl } from '@/features/lista-espera/lista-espera.utils'
import { usePacientes } from '@/hooks/use-pacientes'
import { useTarefas } from '@/hooks/use-tarefas'
import { useUsuarios } from '@/hooks/use-usuarios'
import { useProfissionais } from '@/features/profissionais/hooks/use-profissionais'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { SegmentedControl } from '@/components/shared/segmented-control'
import type { AgendaSlot, ViewMode } from './agenda.types'
import { RetornosAlerta } from '@/features/retornos'
import { AtendimentoView } from './atendimento-view'
import {
  formatAgendaDate,
  getStatusBadgeTone,
  getStatusCardTone,
  mapAgendaItemToSlot,
  normalizeAgendaStatus,
  getPagamentoLegendDot,
} from './agenda.utils'
import { useAgendaCalendar } from './hooks/use-agenda-calendar'
import { useAgendaActions } from './hooks/use-agenda-actions'
import { AgendaDayView } from './components/agenda-day-view'
import { AgendaCombinadaList } from './components/agenda-combinada-list'
import { AgendaWeekView } from './components/agenda-week-view'
import { AgendaMonthView } from './components/agenda-month-view'
import {
  AdiarCompromissoModal,
  AgendarReuniaoModal,
  AniversariantesModal,
  BloqueioAgendaModal,
  CancelarConsultaModal,
  CancelarCompromissoModal,
  DadosAgendamentoModal,
  EditarCompromissoModal,
  ChamarEspecialistaModal,
  EmitirCobrancaModal,
  ExcluirAgendaModal,
  GerarAgendaModal,
  ListaEsperaModal,
  NovoAgendamentoModal,
  RemarcarConsultaModal,
  TarefasModal,
  VisualizarConsultaModal,
} from './modals'
import { NovoPacienteModal, EditarPacienteModal } from '@/features/gestao-pacientes/modals'
import type { Patient } from '@/types/patient'

export function AgendaView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const user = useAuth((state) => state.user)
  const podeIniciarAtendimento = useAuth((state) => state.capabilities.iniciarAtendimento)
  const agendaClinica = useAuth((state) => state.capabilities.agendaClinica)
  // Marcar consulta / compromisso exige a permissão agenda:create (decidida pelo servidor em /api/auth/me).
  const podeCriarNaAgenda = useAuth((state) =>
    state.permissions.some((p) => p.resource === 'agenda' && p.actions.includes('create')),
  )
  const {
    data,
    patients: agendaPatients,
    professionals: agendaProfessionals,
    error,
    isLoading,
    createAgendamento,
    updateAgendamento,
    deleteAgendamento,
    load: reloadAgenda,
    podeEmitirRecibo,
  } = useAgenda()
  const api = useApi()
  const { data: bloqueios, create: createBloqueio, remove: removeBloqueio } = useAgendaBloqueios()
  const { data: pacientes, createPaciente, updatePaciente, units: pacienteUnits } = usePacientes()
  const { data: waitlistItems, createItem: createWaitlistItem, marcarAgendado: marcarListaEsperaAgendado } = useListaEspera()
  const { createTarefa } = useTarefas()
  const { data: usuarios } = useUsuarios()
  const { data: profissionaisCatalogo } = useProfissionais()
  const isEspecialista = agendaClinica
  const [activeTab, setActiveTab] = useState<'global' | 'pessoal' | 'ambas'>('global')
  const [selectedProfessional, setSelectedProfessional] = useState('todos')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPersonalSlot, setSelectedPersonalSlot] = useState<AgendaSlot | null>(null)
  const [reciboAgendamentoId, setReciboAgendamentoId] = useState<string | null>(null)
  const [activeAtendimento, setActiveAtendimento] = useState<{
    patientName: string
    id: string
    appointmentTime?: string
    slot: AgendaSlot
  } | null>(null)
  const [isAdiarCompromissoOpen, setIsAdiarCompromissoOpen] = useState(false)
  const [isAgendarReuniaoOpen, setIsAgendarReuniaoOpen] = useState(false)
  const [isEditarCompromissoOpen, setIsEditarCompromissoOpen] = useState(false)
  const [isCancelarCompromissoOpen, setIsCancelarCompromissoOpen] = useState(false)
  const [isGerarAgendaOpen, setIsGerarAgendaOpen] = useState(false)
  const [isExcluirAgendaOpen, setIsExcluirAgendaOpen] = useState(false)
  const [isNovoPacienteOpen, setIsNovoPacienteOpen] = useState(false)
  const [novoPacienteNomeHint, setNovoPacienteNomeHint] = useState('')
  const [createdPatientForAgenda, setCreatedPatientForAgenda] = useState<{
    id: string
    nome: string
  } | null>(null)
  const [novoAgendamentoPreset, setNovoAgendamentoPreset] = useState<{
    data?: string
    horario?: string
    profissional?: string
  }>({})
  const preselectedPatientId = searchParams?.get('patientId') ?? ''
  const preselectedProfissionalId = searchParams?.get('profissionalId') ?? ''
  const preselectedProfissional =
    searchParams?.get('profissional') ??
    (preselectedProfissionalId
      ? agendaProfessionals.find((item) => item.id === preselectedProfissionalId)?.nome ?? ''
      : '')
  const preselectedProcedimentoId = searchParams?.get('procedimentoId') ?? ''
  const preselectedTipo = searchParams?.get('tipo') === 'retorno' ? 'retorno' : ''
  const shouldOpenNewFromQuery = searchParams?.get('modal') === 'novo'
  const listaEsperaOrigemId = searchParams?.get('listaEsperaId') ?? ''

  const receitaFutura = useMemo(
    () => waitlistItems.reduce((sum, item) => sum + (item.procedimentoValor ?? 0), 0),
    [waitlistItems],
  )
  const formattedReceitaFutura = receitaFutura.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

  const professionalOptions = useMemo(() => {
    const apiOptions = agendaProfessionals.map((item) => item.nome).filter(Boolean)
    if (apiOptions.length > 0) {
      return Array.from(new Set(apiOptions)).sort()
    }

    const userOptions = usuarios
      .filter((item) => item.perfil?.toLowerCase() === 'especialista')
      .map((item) => item.nome)
      .filter(Boolean)

    if (userOptions.length > 0) {
      return Array.from(new Set(userOptions)).sort()
    }

    return Array.from(new Set(data.map((item) => item.profissional)))
      .filter(Boolean)
      .sort()
  }, [agendaProfessionals, data, usuarios])

  // IDs da agenda vêm de `usuarios`; vínculos de procedimento ficam em `profissionais`.
  // Junta por nome para filtrar a pasta sem enviar UUID errado no PUT/POST.
  const professionalDetailsForAgendamento = useMemo(() => {
    const byNome = new Map(
      profissionaisCatalogo.map((item) => [item.nome.trim().toLowerCase(), item] as const),
    )
    const fromAgenda = agendaProfessionals.map((item) => {
      const catalog = byNome.get(item.nome.trim().toLowerCase())
      return {
        id: item.id,
        nome: item.nome,
        procedimentoIds:
          item.procedimentoIds && item.procedimentoIds.length > 0
            ? item.procedimentoIds
            : (catalog?.procedimentoIds ?? []),
      }
    })
    if (fromAgenda.length > 0) return fromAgenda
    return profissionaisCatalogo.map((item) => ({
      id: item.id,
      nome: item.nome,
      procedimentoIds: item.procedimentoIds ?? [],
    }))
  }, [agendaProfessionals, profissionaisCatalogo])

  // Slots 'Disponível' (gerados na 2A) por profissional + data (ISO) para o modal
  // de novo agendamento — item.data vem como DD/MM/AAAA (formatDate), reconverto.
  const availableSlots = useMemo(
    () =>
      data
        .filter((item) => item.status === 'Disponível')
        .map((item) => {
          const [dia, mes, ano] = (item.data ?? '').split('/')
          const dataISO = dia && mes && ano ? `${ano}-${mes}-${dia}` : (item.data ?? '')
          return { profissional: item.profissional, data: dataISO, horario: item.horario }
        }),
    [data],
  )
  const filteredAgenda = useMemo(
    () =>
      data.filter(
        (item) =>
          (selectedProfessional === 'todos' || item.profissional === selectedProfessional) &&
          [item.paciente, item.profissional, item.horario, item.status]
            .join(' ')
            .toLowerCase()
            .includes(searchTerm.toLowerCase()),
      ),
    [data, searchTerm, selectedProfessional],
  )
  // Agenda de atendimentos: registros COM paciente preenchido OU slots livres (status "Disponível")
  const globalAgendaSlots = useMemo<AgendaSlot[]>(
    () =>
      filteredAgenda
        .filter(
          (item) =>
            (item.paciente && item.paciente.trim().length > 0) || item.status === 'Disponível',
        )
        .map(mapAgendaItemToSlot),
    [filteredAgenda],
  )
  // Agenda pessoal: compromissos SEM paciente (reuniões, tarefas, lembretes) — exclui slots "Disponível"
  const personalAgenda = useMemo(
    () =>
      data.filter((item) => {
        const semPaciente = !item.paciente || item.paciente.trim().length === 0
        if (!semPaciente) return false
        if (item.status === 'Disponível') return false

        return [item.profissional, item.horario, item.status, item.tipo ?? '']
          .join(' ')
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      }),
    [data, searchTerm],
  )
  const personalAgendaSlots = useMemo<AgendaSlot[]>(
    () =>
      personalAgenda.map(mapAgendaItemToSlot),
    [personalAgenda],
  )
  // Visão simultânea (item 1): atendimentos reais + compromissos pessoais, sem slots livres.
  const combinedAgendaSlots = useMemo<AgendaSlot[]>(
    () => [...globalAgendaSlots.filter((slot) => slot.status !== 'Disponível'), ...personalAgendaSlots],
    [globalAgendaSlots, personalAgendaSlots],
  )
  const activeAgendaSlots =
    activeTab === 'ambas'
      ? combinedAgendaSlots
      : activeTab === 'pessoal' || (isEspecialista && activeTab !== 'global')
        ? personalAgendaSlots
        : globalAgendaSlots
  const patientOptions = useMemo(() => {
    if (agendaPatients.length > 0) {
      return agendaPatients
    }
    return pacientes.map((item) => ({ id: item.id, nome: item.nome }))
  }, [agendaPatients, pacientes])
  const findPacienteId = (slot: AgendaSlot) =>
    slot.pacienteId || pacientes.find((item) => item.nome === slot.paciente)?.id
  const calendar = useAgendaCalendar(activeAgendaSlots)
  const showDaySlots =
    calendar.selectedFilter === 'todos' || calendar.selectedFilter === 'agendamentos'
  const actions = useAgendaActions({
    updateAgendamento: async (payload) => {
      await updateAgendamento(payload)
    },
    deleteAgendamento: async (id, reason) => {
      await deleteAgendamento(id, reason)
    },
    createWaitlistItem: async (payload) => {
      await createWaitlistItem(payload)
    },
    createTarefa: async (payload) => {
      await createTarefa(payload)
    },
    registerAgendamentoPagamento: async (payload) => {
      const res = await api.post<{ data?: { caixaRegistrado?: boolean } }>('/api/agenda/pagamentos', payload)
      return { caixaRegistrado: res?.data?.caixaRegistrado === true }
    },
    reloadAgenda,
    findPacienteId,
  })

  const selectedAgendaItem = useMemo(() => {
    const slot = actions.selectedSlot
    if (!slot) return null
    const match = data.find((item) => item.id === slot.id)
    if (match) return match
    return {
      id: slot.id,
      pacienteId: slot.pacienteId,
      paciente: slot.paciente,
      profissionalId: slot.profissionalId,
      profissional: slot.profissional,
      horario: slot.hora,
      status: slot.status,
      data: slot.data,
      tipo: slot.tipo,
      modalidade: slot.modalidade,
      valorProcedimento: slot.valorProcedimento,
      observacoes: slot.observacoes,
      pagamento: slot.pagamento,
      totalPago: slot.totalPago,
    }
  }, [actions.selectedSlot, data])

  const pacienteParaEdicao = useMemo(() => {
    const id =
      actions.selectedSlot?.pacienteId ||
      (actions.selectedSlot?.paciente
        ? pacientes.find((item) => item.nome === actions.selectedSlot?.paciente)?.id
        : undefined)
    if (!id) return null
    const item = pacientes.find((p) => p.id === id)
    if (!item) return null
    return {
      id: item.id,
      nome: item.nome,
      name: item.nome,
      telefone: item.telefone,
      phone: item.telefone,
      email: item.email,
      cpf: item.cpf,
      rg: item.rg,
      inscricaoEstadual: item.inscricaoEstadual,
      birthDate: item.birthDate,
      dataNascimento: item.birthDate,
      gender: item.gender,
      sexo: item.gender,
      source: item.source,
      indicacao: item.source,
      origemDetalhe: item.origemDetalhe,
      indicadoPorId: item.indicadoPorId,
      financial: item.financial,
      vinculoTipos: item.vinculoTipos,
      precisaNf: item.precisaNf,
      photoUrl: item.photoUrl,
      unidadeId: item.unidadeId,
      status: item.status,
      activeStatus: item.status,
      addressDetails: item.addressDetails,
      specialNeeds: item.specialNeeds,
      responsible: item.responsible,
      supplierData: item.supplierData,
    } as Patient
  }, [actions.selectedSlot, pacientes])

  useEffect(() => {
    if (activeTab === 'pessoal' && calendar.selectedFilter !== 'todos') {
      calendar.setSelectedFilter('todos')
    }
  }, [activeTab, calendar])

  const handleOpenPersonalModal = (modal: 'adiar' | 'editar' | 'cancelar', slot: AgendaSlot) => {
    setSelectedPersonalSlot(slot)
    if (modal === 'adiar') setIsAdiarCompromissoOpen(true)
    if (modal === 'editar') setIsEditarCompromissoOpen(true)
    if (modal === 'cancelar') setIsCancelarCompromissoOpen(true)
  }

  const closePersonalModals = () => {
    setIsAdiarCompromissoOpen(false)
    setIsEditarCompromissoOpen(false)
    setIsCancelarCompromissoOpen(false)
    setSelectedPersonalSlot(null)
  }

  const handleCreateAppointment = async (payload: {
    pacienteId: string
    profissional: string
    data: string
    horario: string
    tipo: string
    observacoes: string
    modalidade?: string
    plataformaOnline?: string
    urlOnline?: string
    foraJanela?: boolean
    motivoEncaixe?: string
    procedimentoId?: string
    valorProcedimento?: number
    serieQuantidade?: number
    serieIntervaloDias?: number
    pagamentoInicial?: {
      valor: number
      metodo: string
      bandeira?: string
      parcelas?: number
      contaBancariaId?: string
    }
  }) => {
    try {
      const profissionalId = agendaProfessionals.find(
        (p) => p.nome === payload.profissional,
      )?.id
      await createAgendamento({
        pacienteId: payload.pacienteId,
        profissional: payload.profissional,
        profissionalId,
        data: payload.data,
        horario: payload.horario,
        status: 'Agendado',
        tipo: payload.tipo,
        observacoes: payload.observacoes,
        modalidade: payload.modalidade,
        plataformaOnline: payload.plataformaOnline,
        urlOnline: payload.urlOnline,
        foraJanela: payload.foraJanela,
        motivoEncaixe: payload.motivoEncaixe,
        procedimentoId: payload.procedimentoId,
        valorProcedimento: payload.valorProcedimento,
        serieQuantidade: payload.serieQuantidade,
        serieIntervaloDias: payload.serieIntervaloDias,
        pagamentoInicial: payload.pagamentoInicial,
      })
      toast.success(
        payload.serieQuantidade && payload.serieQuantidade > 1
          ? `Pacote criado: ${payload.serieQuantidade} sessões.`
          : payload.foraJanela
            ? 'Encaixe registrado com sucesso.'
            : 'Agendamento criado com sucesso.',
      )
      const [ano, mes, dia] = payload.data.split('-').map(Number)
      if (ano && mes && dia) calendar.setCurrentDate(new Date(ano, mes - 1, dia))
      actions.setActiveModal(null)
      if (listaEsperaOrigemId) {
        // Agendamento concluído: o paciente sai da fila (fica no histórico como 'agendado').
        await marcarListaEsperaAgendado(listaEsperaOrigemId).catch(() =>
          toast.error('Agendamento criado, mas não foi possível tirar o paciente da lista de espera.'),
        )
      }
      if (shouldOpenNewFromQuery) router.replace('/agenda')
    } catch (err) {
      // Repassa o erro ao modal: ele mostra a mensagem e continua aberto com os dados preenchidos.
      throw err instanceof Error ? err : new Error('Não foi possível criar o agendamento.')
    }
  }

  const handleAgendarReuniao = async (payload: {
    titulo: string
    tipo?: 'Reunião' | 'Tarefa' | 'Lembrete' | 'Evento' | 'Aprovação'
    data: string
    hora: string
    duracao: string
    horarioFim: string
    profissionalId?: string
    profissional?: string
    participantes: string
    local?: string
    observacoes?: string
  }) => {
    const profissionalNome = payload.profissional || user?.name || ''
    const idsAntes = new Set(data.map((item) => item.id))
    const lista = await createAgendamento({
      profissional: profissionalNome,
      profissionalId: payload.profissionalId,
      data: payload.data,
      horario: payload.hora,
      horarioFim: payload.horarioFim,
      status: 'Agendado',
      tipo: payload.tipo,
      titulo: payload.titulo,
      local: payload.local,
      participantes: payload.participantes || undefined,
      observacoes:
        [payload.duracao ? `Duração: ${payload.duracao}` : '', payload.observacoes ?? '']
          .filter(Boolean)
          .join(' • ') || undefined,
    })

    const criado = lista.find((item) => !idsAntes.has(item.id) && !item.pacienteId)

    if (payload.profissionalId) {
      await createBloqueio({
        profissionalId: payload.profissionalId,
        dataInicio: payload.data,
        dataFim: payload.data,
        horarioInicio: payload.hora,
        horarioFim: payload.horarioFim,
        diaInteiro: false,
        tipo: 'Compromisso',
        justificativa: criado
          ? `Compromisso:${criado.id}|${payload.titulo}`
          : `Compromisso: ${payload.titulo}`,
      })
    }
  }

  const handleAdiarCompromisso = async (payload: {
    id: string
    novaData: string
    novaHora: string
    motivo?: string
  }) => {
    if (!selectedPersonalSlot) return
    // Compromissos pessoais não têm paciente — pacienteId fica undefined e a
    // rota PUT /api/agenda grava paciente_id = null normalmente.
    const pacienteId = findPacienteId(selectedPersonalSlot)

    await updateAgendamento({
      id: payload.id,
      pacienteId,
      profissional: selectedPersonalSlot.profissional,
      data: payload.novaData,
      horario: payload.novaHora,
      status: selectedPersonalSlot.status,
      titulo: selectedPersonalSlot.titulo,
      observacoes: payload.motivo
        ? `${selectedPersonalSlot.observacoes ?? ''}${selectedPersonalSlot.observacoes ? ' • ' : ''}Adiado: ${payload.motivo}`.trim()
        : selectedPersonalSlot.observacoes,
    })

    const linked = bloqueios.find((b) =>
      (b.justificativa ?? '').startsWith(`Compromisso:${payload.id}`),
    )
    if (linked) {
      try {
        await removeBloqueio(linked.id)
        await createBloqueio({
          profissionalId: linked.profissionalId ?? undefined,
          unidadeId: linked.unidadeId ?? undefined,
          dataInicio: payload.novaData,
          dataFim: payload.novaData,
          horarioInicio: payload.novaHora,
          horarioFim: linked.horarioFim,
          diaInteiro: linked.diaInteiro,
          tipo: linked.tipo || 'Compromisso',
          justificativa: linked.justificativa,
        })
      } catch {
        // bloqueio pode já ter sido removido
      }
    }
    closePersonalModals()
  }

  const handleEditarCompromisso = async (payload: {
    id: string
    titulo: string
    data: string
    hora: string
    duracao?: string
    local?: string
    observacoes?: string
  }) => {
    if (!selectedPersonalSlot) return
    // Compromissos pessoais não têm paciente — pacienteId fica undefined e a
    // rota PUT /api/agenda grava paciente_id = null normalmente.
    const pacienteId = findPacienteId(selectedPersonalSlot)

    await updateAgendamento({
      id: payload.id,
      pacienteId,
      profissional: selectedPersonalSlot.profissional,
      data: payload.data,
      horario: payload.hora,
      status: selectedPersonalSlot.status,
      titulo: payload.titulo,
      local: payload.local,
      observacoes: payload.observacoes,
    })

    const linked = bloqueios.find((b) =>
      (b.justificativa ?? '').startsWith(`Compromisso:${payload.id}`),
    )
    if (linked) {
      try {
        await removeBloqueio(linked.id)
        await createBloqueio({
          profissionalId: linked.profissionalId ?? undefined,
          unidadeId: linked.unidadeId ?? undefined,
          dataInicio: payload.data,
          dataFim: payload.data,
          horarioInicio: payload.hora,
          horarioFim: linked.horarioFim,
          diaInteiro: linked.diaInteiro,
          tipo: linked.tipo || 'Compromisso',
          justificativa: `Compromisso:${payload.id}|${payload.titulo}`,
        })
      } catch {
        // bloqueio pode já ter sido removido
      }
    }
    closePersonalModals()
  }

  const handleCancelarCompromisso = async () => {
    if (!selectedPersonalSlot) return
    const linked = bloqueios.find((b) =>
      (b.justificativa ?? '').startsWith(`Compromisso:${selectedPersonalSlot.id}`),
    )
    if (linked) {
      try {
        await removeBloqueio(linked.id)
      } catch {
        // segue cancelando o compromisso mesmo se o bloqueio já tiver sido removido
      }
    }
    await deleteAgendamento(
      selectedPersonalSlot.id,
      'Cancelado pela agenda pessoal do especialista.',
    )
    closePersonalModals()
  }

  const handleGerarAgenda = async (payload: {
    especialistaId: string
    dataInicio: string
    dataFim: string
    diasSemana: number[]
    datasAvulsas: string[]
    considerarFeriados: boolean
  }) => {
    const result = await api.post<{ gerados: number; pulados: number; alertas?: string[] }>(
      '/api/agenda/gerar',
      payload,
    )
    await reloadAgenda()
    return {
      gerados: result.gerados,
      pulados: result.pulados,
      alertas: result.alertas ?? [],
    }
  }

  const handleExcluirAgenda = async (payload: {
    especialistaId: string
    dataInicio: string
    dataFim: string
    diasSemana: number[]
    justificativa: string
  }) => {
    const result = await api.post<{ excluidos: number }>('/api/agenda/excluir', payload)
    await reloadAgenda()
    return { excluidos: result.excluidos }
  }

  const totalItems =
    activeTab === 'global'
      ? calendar.viewMode === 'semana'
        ? calendar.weekAgendaGroups.reduce((acc, day) => acc + day.items.length, 0)
        : calendar.viewMode === 'mes'
          ? calendar.monthAgendaSummary.reduce((acc, day) => acc + day.count, 0)
          : calendar.dayFilteredItems.length
      : 0

  if (activeAtendimento) {
    return (
      <AtendimentoView
        patientName={activeAtendimento.patientName}
        pacienteId={activeAtendimento.slot.pacienteId}
        appointmentId={activeAtendimento.id}
        appointmentTime={activeAtendimento.appointmentTime}
        onBack={() => setActiveAtendimento(null)}
        onFinalize={async () => {
          await actions.handleStatusChange(activeAtendimento.slot, 'Check-out')
        }}
      />
    )
  }

  const profissionalDosBloqueios = agendaClinica
    ? (agendaProfessionals.find((p) => p.id === user?.id)?.nome ?? user?.name ?? 'todos')
    : selectedProfessional

  return (
    <div className="app-page">
      <div className="space-y-4">
        {!isEspecialista && <RetornosAlerta />}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <PageHeader
            title={isEspecialista ? 'Agenda médica' : 'Agenda'}
            description={
              isEspecialista
                ? 'Consulte seus horários e gerencie seus atendimentos'
                : 'Gerencie os horários, atendimentos e bloqueios da clínica.'
            }
          />
          {!isEspecialista && (
            <div className="flex flex-wrap items-center gap-3 sm:justify-end justify-center">
              {podeCriarNaAgenda && (
                <Button
                  className="h-10 w-full rounded-xl bg-app-primary px-5 text-white shadow-sm shadow-blue-900/10 hover:bg-app-primary-hover md:w-auto"
                  onClick={() =>
                    activeTab === 'pessoal'
                      ? setIsAgendarReuniaoOpen(true)
                      : actions.setActiveModal('novo')
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">
                    {activeTab === 'pessoal' ? 'Novo compromisso' : 'Marcar consulta'}
                  </span>
                  <span className="sm:hidden">Marcar</span>
                </Button>
              )}
              <Button
                variant="outline"
                className="h-10 px-4 rounded-xl gap-2 font-normal border-app-border dark:border-app-border-dark hover:border-app-primary hover:text-app-primary whitespace-nowrap text-sm"
                onClick={() => actions.setActiveModal('lista-espera')}
              >
                <Users className="h-4 w-4" />
                Lista de espera
              </Button>
              {receitaFutura > 0 && (
                <div
                  className="flex h-10 items-center gap-2 rounded-xl border border-emerald-300/60 bg-emerald-50 px-3 text-xs font-normal text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-200"
                  title="Soma do valor dos procedimentos dos pacientes na lista de espera"
                >
                  <span className="font-medium">Receita futura:</span>
                  <span>{formattedReceitaFutura}</span>
                </div>
              )}
              <Button
                variant="outline"
                className="h-10 px-3 md:px-4 rounded-xl gap-2 font-normal border-app-border dark:border-app-border-dark hover:border-app-primary hover:text-app-primary whitespace-nowrap text-xs md:text-sm"
                onClick={() => actions.setActiveModal('tarefas')}
              >
                <Bell className="h-4 w-4" />
                Tarefas
              </Button>
              <Button
                variant="outline"
                className="h-10 px-4 rounded-xl gap-2 font-normal border-app-border dark:border-app-border-dark hover:border-app-primary hover:text-app-primary whitespace-nowrap"
                onClick={() => setIsGerarAgendaOpen(true)}
              >
                <Calendar className="h-4 w-4" />
                Gerar agenda
              </Button>
              <Button
                variant="outline"
                className="h-10 px-4 rounded-xl gap-2 font-normal border-app-border dark:border-app-border-dark hover:border-red-400 hover:text-red-600 whitespace-nowrap"
                onClick={() => setIsExcluirAgendaOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Excluir agenda
              </Button>
              <Button
                variant="outline"
                className="h-10 px-4 rounded-xl gap-2 font-normal border-app-border dark:border-app-border-dark hover:border-app-primary hover:text-app-primary whitespace-nowrap"
                onClick={() => actions.setActiveModal('bloqueio')}
              >
                <Lock className="h-4 w-4" />
                Bloqueios
              </Button>
              <Button
                variant="outline"
                className="h-10 px-4 rounded-xl gap-2 font-normal border-app-border dark:border-app-border-dark hover:border-app-primary hover:text-app-primary whitespace-nowrap"
                onClick={() => actions.setActiveModal('aniversariantes')}
              >
                <CalendarPlus className="h-4 w-4" />
                Aniversariantes
              </Button>
            </div>
          )}
        </div>
      </div>

      <Card className="overflow-hidden rounded-[24px] border border-app-border bg-app-card shadow-sm dark:border-app-border-dark dark:bg-app-card-dark">
        <div className="p-6 md:p-8 border-b border-app-border/50 dark:border-app-border-dark/50 space-y-5">
          <SegmentedControl
            options={[
              { value: 'global', label: 'Atendimentos' },
              { value: 'pessoal', label: 'Pessoal' },
              { value: 'ambas', label: 'Ambas' },
            ]}
            value={activeTab}
            onChange={(value) => setActiveTab(value as 'global' | 'pessoal' | 'ambas')}
            className={isEspecialista ? 'w-full' : 'min-w-[260px]'}
            fullWidth={isEspecialista}
          />
          {isEspecialista ? (
            <>
              {/* Especialista — Row 1: label + date nav + action buttons */}
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xl font-medium text-app-text-primary dark:text-white">
                    Agenda
                  </span>
                  <div className="flex items-center rounded-xl border border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-bg-dark px-1 py-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-app-text-secondary hover:text-app-text-primary"
                      onClick={calendar.goPrev}
                      aria-label="Período anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="mx-1 h-4 w-px bg-app-bg-secondary dark:bg-app-hover" />
                    <span className="min-w-[120px] whitespace-nowrap px-2 text-center text-sm font-medium text-app-text-primary dark:text-white">
                      {formatAgendaDate(calendar.currentDate, calendar.viewMode)}
                    </span>
                    <div className="mx-1 h-4 w-px bg-app-bg-secondary dark:bg-app-hover" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-app-text-secondary hover:text-app-text-primary"
                      onClick={calendar.goNext}
                      aria-label="Próximo período"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {podeCriarNaAgenda && (
                    <Button
                      className="h-10 rounded-xl bg-app-primary px-4 text-white shadow-sm shadow-blue-900/10 hover:bg-app-primary-hover md:px-6"
                      onClick={() =>
                        activeTab === 'pessoal'
                          ? setIsAgendarReuniaoOpen(true)
                          : actions.setActiveModal('novo')
                      }
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {activeTab === 'pessoal' ? 'Novo compromisso' : '+Marcar Consulta'}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="h-10 px-3 md:px-4 rounded-xl gap-2 font-normal border-app-border dark:border-app-border-dark hover:border-app-primary hover:text-app-primary whitespace-nowrap text-xs md:text-sm"
                    onClick={() => actions.setActiveModal('lista-espera')}
                  >
                    <Users className="h-4 w-4" />
                    Lista de Espera
                  </Button>
                  {receitaFutura > 0 && (
                    <div
                      className="flex h-10 items-center gap-2 rounded-xl border border-emerald-300/60 bg-emerald-50 px-3 text-xs font-normal text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-200"
                      title="Soma do valor dos procedimentos dos pacientes na lista de espera"
                    >
                      <span className="font-medium">Receita futura:</span>
                      <span>{formattedReceitaFutura}</span>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    className="h-10 px-3 md:px-4 rounded-xl gap-2 font-normal border-app-border dark:border-app-border-dark hover:border-app-primary hover:text-app-primary whitespace-nowrap text-xs md:text-sm"
                    onClick={() => actions.setActiveModal('tarefas')}
                  >
                    <Bell className="h-4 w-4" />
                    Tarefas
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 px-4 rounded-xl gap-2 font-normal border-app-border dark:border-app-border-dark hover:border-app-primary hover:text-app-primary whitespace-nowrap"
                    onClick={() => actions.setActiveModal('bloqueio')}
                  >
                    <Lock className="h-4 w-4" />
                    Bloqueios
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 px-4 rounded-xl gap-2 font-normal border-app-border dark:border-app-border-dark hover:border-app-primary hover:text-app-primary whitespace-nowrap"
                    onClick={() => setIsGerarAgendaOpen(true)}
                  >
                    <Calendar className="h-4 w-4" />
                    Gerar Agenda
                  </Button>
                </div>
              </div>
              {/* Especialista — Row 2: view mode + Novo Agendamento */}
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <SegmentedControl
                  options={[
                    { value: 'dia', label: 'Dia' },
                    { value: 'semana', label: 'Semana' },
                    { value: 'mes', label: 'Mês' },
                  ]}
                  value={calendar.viewMode}
                  onChange={(value) => calendar.setViewMode(value as ViewMode)}
                  className="min-w-[260px]"
                  fullWidth={false}
                />
              </div>
              {/* Especialista — status filter (only for "Atendimentos") */}
              {activeTab === 'global' && (
                <SegmentedControl
                  options={[
                    { value: 'todos', label: 'Todos' },
                    { value: 'agendamentos', label: 'Agendamentos' },
                    { value: 'aguardando', label: 'Aguardando' },
                    { value: 'atendimento', label: 'Em Atendimento' },
                    { value: 'atendidos', label: 'Atendidos' },
                  ]}
                  value={calendar.selectedFilter}
                  onChange={calendar.setSelectedFilter}
                />
              )}
            </>
          ) : (
            <>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center rounded-xl border border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-bg-dark px-1 py-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-app-text-secondary hover:text-app-text-primary"
                      onClick={calendar.goPrev}
                      aria-label="Período anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="mx-1 h-4 w-px bg-app-bg-secondary dark:bg-app-hover" />
                    <span className="min-w-[120px] whitespace-nowrap px-2 text-center text-sm font-medium text-app-text-primary dark:text-white">
                      {formatAgendaDate(calendar.currentDate, calendar.viewMode)}
                    </span>
                    <div className="mx-1 h-4 w-px bg-app-bg-secondary dark:bg-app-hover" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-app-text-secondary hover:text-app-text-primary"
                      onClick={calendar.goNext}
                      aria-label="Próximo período"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    className="h-10 rounded-xl"
                    onClick={() => calendar.setCurrentDate(new Date())}
                  >
                    Hoje
                  </Button>
                </div>
                <SegmentedControl
                  options={[
                    { value: 'dia', label: 'Dia' },
                    { value: 'semana', label: 'Semana' },
                    { value: 'mes', label: 'Mês' },
                  ]}
                  value={calendar.viewMode}
                  onChange={(value) => calendar.setViewMode(value as ViewMode)}
                  className="min-w-[260px]"
                  fullWidth={false}
                />
              </div>
              {activeTab === 'global' && (
                <SegmentedControl
                  options={[
                    { value: 'todos', label: 'Todos' },
                    { value: 'agendamentos', label: 'Agendamentos' },
                    { value: 'aguardando', label: 'Aguardando' },
                    { value: 'atendimento', label: 'Em Atendimento' },
                    { value: 'atendidos', label: 'Atendidos' },
                  ]}
                  value={calendar.selectedFilter}
                  onChange={calendar.setSelectedFilter}
                />
              )}
            </>
          )}
          <div className="rounded-integrallys-lg border border-app-border dark:border-app-border-dark bg-white dark:bg-app-bg-dark p-4 sm:p-6 space-y-6 overflow-x-hidden">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 shrink-0">
                <Calendar className="h-4 w-4 text-app-text-primary dark:text-white" />
                <span className="text-sm font-normal text-app-text-primary dark:text-white">
                  {activeTab === 'global'
                    ? `Consultas (${totalItems})`
                    : `Compromissos (${totalItems})`}
                </span>
              </div>
              {activeTab === 'global' && !isEspecialista && (
                <div className="w-full sm:w-auto">
                  <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
                    <SelectTrigger className="h-11 w-full sm:w-64 lg:w-80 rounded-integrallys border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-bg-dark text-sm font-normal text-app-text-primary dark:text-white/80">
                      <SelectValue placeholder="Todos os profissionais" />
                    </SelectTrigger>
                    <SelectContent className="rounded-integrallys border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-bg-dark">
                      <SelectItem value="todos">Todos os profissionais</SelectItem>
                      {professionalOptions.map((professional) => (
                        <SelectItem key={professional} value={professional}>
                          {professional}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <details className="group rounded-integrallys bg-app-bg-secondary/60 dark:bg-app-bg-dark/40 [&_summary]:cursor-pointer">
              <summary className="flex items-center justify-between gap-2 list-none px-3 py-2 text-xs font-medium text-app-text-secondary dark:text-white/70">
                <span>Legenda de status e pagamento</span>
                <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
              </summary>
              <div className="grid grid-cols-1 gap-6 px-3 pb-3 lg:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs text-app-text-secondary dark:text-app-text-muted">Status</p>
                  <div className="flex flex-wrap gap-4 text-xs text-app-text-secondary dark:text-white/80">
                    {[
                      ['Agendado', 'bg-slate-400 dark:bg-slate-500'],
                      ['Confirmado', 'bg-app-primary'],
                      ['Check-in', 'bg-sky-600'],
                      ['Em Atendimento', 'bg-indigo-600'],
                      ['Em Atraso', 'bg-[var(--app-warning-text)]'],
                      ['Cancelado', 'bg-[var(--app-danger-text)]'],
                      ['Check-out', 'bg-[var(--app-success-text)]'],
                    ].map(([label, tone]) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <div className={`h-2.5 w-2.5 rounded-full ${tone}`} />
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-app-text-secondary dark:text-app-text-muted">
                    Pagamento
                  </p>
                  <div className="flex flex-wrap gap-4 text-xs text-app-text-secondary dark:text-white/80">
                    {(
                      [
                        ['Pago', getPagamentoLegendDot('Pago')],
                        ['Pago Parcial', getPagamentoLegendDot('Parcial')],
                        ['Pendente', getPagamentoLegendDot('Pendente')],
                      ] as const
                    ).map(([label, tone]) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <div className={`h-2.5 w-2.5 rounded-full ${tone}`} />
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </details>
            <div className="flex-1 xl:max-w-[440px]">
              <Input
                placeholder="Buscar por paciente, profissional ou horário..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-11 rounded-integrallys border-app-border dark:border-app-border-dark"
              />
            </div>
          </div>
        </div>

        {error && <p className="px-8 pt-6 text-sm text-[var(--app-danger-text)]">{error}</p>}
        <div className="p-6 md:p-8">
          <div className="grid gap-4">
            {isLoading && (
              <div className="rounded-[20px] border border-app-border dark:border-app-border-dark px-6 py-16 text-center text-app-text-secondary dark:text-white/60">
                Carregando agenda...
              </div>
            )}
            {activeTab === 'global' && !isLoading && calendar.viewMode === 'dia' && (
              <AgendaDayView
                dayFilteredItems={calendar.dayFilteredItems}
                bloqueios={bloqueios}
                bloqueiosProfissionais={agendaProfessionals}
                currentDate={calendar.currentDate}
                selectedProfessional={profissionalDosBloqueios}
                showDaySlots={showDaySlots}
                onOpenSlotModal={actions.openSlotModal}
                onOpenCharge={actions.handleOpenCharge}
                onOpenRecibo={podeEmitirRecibo ? (slot) => setReciboAgendamentoId(slot.id) : undefined}
                onCallSpecialist={(slot) => actions.openSlotModal('chamar-especialista', slot)}
                onStatusChange={actions.handleStatusChange}
                onRemoveBloqueio={async (bloqueio) => {
                  try {
                    const match = (bloqueio.justificativa ?? '').match(/^Compromisso:([^|]+)/)
                    const compromissoId = match?.[1]?.trim()
                    await removeBloqueio(bloqueio.id)
                    if (compromissoId) {
                      try {
                        await deleteAgendamento(compromissoId, 'Bloqueio desfeito — compromisso removido.')
                      } catch {
                        // compromisso pode já ter sido cancelado
                      }
                    }
                    toast.success('Bloqueio removido.')
                    await reloadAgenda()
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Falha ao remover bloqueio')
                  }
                }}
                onOpenAvailableSlot={
                  podeCriarNaAgenda
                    ? (slot) => {
                        setNovoAgendamentoPreset({
                          data: actions.parseAgendaDate(slot.data),
                          horario: slot.hora,
                          profissional: slot.profissional,
                        })
                        actions.setActiveModal('novo')
                      }
                    : undefined
                }
                onContinueAtendimento={
                  podeIniciarAtendimento
                    ? (slot) =>
                        setActiveAtendimento({
                          patientName: slot.paciente || 'Paciente',
                          id: slot.id,
                          appointmentTime: slot.hora,
                          slot,
                        })
                    : undefined
                }
                onStartAtendimento={
                  podeIniciarAtendimento
                    ? async (slot) => {
                        await actions.handleStatusChange(slot, 'Em Atendimento', {
                          openClinicalFlow: true,
                        })
                        setActiveAtendimento({
                          patientName: slot.paciente || 'Paciente',
                          id: slot.id,
                          appointmentTime: slot.hora,
                          slot,
                        })
                      }
                    : undefined
                }
              />
            )}
            {activeTab === 'global' && !isLoading && calendar.viewMode === 'semana' && (
              <AgendaWeekView
                weekAgendaGroups={calendar.weekAgendaGroups}
                showDaySlots={showDaySlots}
                onOpenSlotModal={actions.openSlotModal}
                onSetCurrentDate={calendar.setCurrentDate}
                bloqueios={bloqueios}
                bloqueiosProfissionais={agendaProfessionals}
                selectedProfessional={profissionalDosBloqueios}
              />
            )}
            {activeTab === 'global' && !isLoading && calendar.viewMode === 'mes' && (
              <AgendaMonthView
                bloqueios={bloqueios}
                bloqueiosProfissionais={agendaProfessionals}
                selectedProfessional={profissionalDosBloqueios}
                monthAgendaSummary={calendar.monthAgendaSummary}
                onSelectDay={(date) => {
                  calendar.setCurrentDate(date)
                  calendar.setViewMode('dia')
                }}
              />
            )}
            {activeTab === 'ambas' && !isLoading && calendar.viewMode === 'dia' && (
              <AgendaCombinadaList
                groups={[
                  {
                    key: 'dia',
                    label: calendar.currentDate.toLocaleDateString('pt-BR'),
                    items: calendar.dayAgendaSlots,
                  },
                ]}
              />
            )}
            {activeTab === 'ambas' && !isLoading && calendar.viewMode === 'semana' && (
              <AgendaCombinadaList
                groups={calendar.weekAgendaGroups.map((group) => ({
                  key: group.formattedDay,
                  label: `${group.label} · ${group.formattedDay}`,
                  items: group.items,
                }))}
              />
            )}
            {activeTab === 'ambas' && !isLoading && calendar.viewMode === 'mes' && (
              <AgendaMonthView
                bloqueios={bloqueios}
                bloqueiosProfissionais={agendaProfessionals}
                selectedProfessional={profissionalDosBloqueios}
                monthAgendaSummary={calendar.monthAgendaSummary}
                onSelectDay={(date) => {
                  calendar.setCurrentDate(date)
                  calendar.setViewMode('dia')
                }}
              />
            )}
            {activeTab === 'pessoal' && !isLoading && calendar.viewMode === 'dia' && (
              <div className="space-y-3">
                <div className="rounded-integrallys bg-app-bg-secondary dark:bg-app-bg-dark/50 p-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-[var(--app-text-primary)] dark:text-app-text-muted">
                    Status das reuniões:
                  </p>
                  <Button
                    variant="outline"
                    className="h-9 rounded-xl"
                    onClick={() => setIsAgendarReuniaoOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Agendar reunião
                  </Button>
                </div>
                {calendar.dayAgendaSlots.length === 0 ? (
                  <EmptyState
                    icon={Calendar}
                    title="Nenhum compromisso encontrado"
                    description="Não há compromissos agendados para o período selecionado."
                  />
                ) : (
                  calendar.dayAgendaSlots.map((item) => (
                    <div
                      key={`personal-day-${item.id}`}
                      className={`${getStatusCardTone(item.status)} rounded-[16px] p-5 space-y-4`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-lg text-app-text-primary dark:text-white">
                            {item.titulo || item.paciente || 'Compromisso'}
                          </p>
                          <p className="text-sm text-app-text-secondary dark:text-white/60">
                            {item.data} às {item.hora}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs ${getStatusBadgeTone(item.status)}`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {podeIniciarAtendimento &&
                          item.paciente &&
                          !['Em Atendimento', 'Check-out', 'Cancelado'].includes(
                            normalizeAgendaStatus(item.status),
                          ) && (
                            <Button
                              className="rounded-xl bg-app-primary text-white hover:bg-app-primary-hover"
                              onClick={async () => {
                                await actions.handleStatusChange(item, 'Em Atendimento', {
                                  openClinicalFlow: true,
                                })
                                setActiveAtendimento({
                                  patientName: item.paciente || 'Paciente',
                                  id: item.id,
                                  appointmentTime: item.hora,
                                  slot: item,
                                })
                              }}
                            >
                              Iniciar atendimento
                            </Button>
                          )}
                        {podeIniciarAtendimento &&
                          item.paciente &&
                          normalizeAgendaStatus(item.status) === 'Em Atendimento' && (
                            <Button
                              className="rounded-xl bg-app-primary text-white hover:bg-app-primary-hover"
                              onClick={() =>
                                setActiveAtendimento({
                                  patientName: item.paciente || 'Paciente',
                                  id: item.id,
                                  appointmentTime: item.hora,
                                  slot: item,
                                })
                              }
                            >
                              Continuar atendimento
                            </Button>
                          )}
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => actions.openSlotModal('detalhes', item)}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Visualizar
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => handleOpenPersonalModal('adiar', item)}
                        >
                          Adiar
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => handleOpenPersonalModal('editar', item)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-xl text-[var(--app-danger-text)]"
                          onClick={() => handleOpenPersonalModal('cancelar', item)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {activeTab === 'pessoal' && !isLoading && calendar.viewMode === 'semana' && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
                {calendar.weekAgendaGroups.map((day) => (
                  <div
                    key={`personal-${day.key}`}
                    className="rounded-integrallys border border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-bg-dark overflow-hidden"
                  >
                    <div
                      className={`p-3 text-center border-b border-app-border dark:border-app-border-dark ${day.isToday ? 'bg-app-primary dark:bg-app-card-dark' : 'bg-app-bg-secondary dark:bg-app-bg-dark/50'}`}
                    >
                      <p
                        className={`text-sm ${day.isToday ? 'text-white/80' : 'text-app-text-secondary dark:text-app-text-muted'}`}
                      >
                        {day.shortLabel}
                      </p>
                      <p
                        className={`text-xl ${day.isToday ? 'text-white' : 'text-app-text-primary dark:text-white'}`}
                      >
                        {day.date.getDate().toString().padStart(2, '0')}
                      </p>
                      <p
                        className={`text-xs ${day.isToday ? 'text-white/60' : 'text-app-text-secondary dark:text-app-text-muted'}`}
                      >
                        ({day.items.length})
                      </p>
                    </div>
                    <div className="p-2 space-y-2 min-h-[180px]">
                      {day.items.length === 0 ? (
                        <div className="rounded-[8px] border border-dashed border-app-border dark:border-app-border-dark px-3 py-6 text-center text-xs text-app-text-secondary dark:text-app-text-muted">
                          Sem compromissos
                        </div>
                      ) : (
                        day.items.map((item) => (
                          <button
                            key={`personal-week-${item.id}`}
                            type="button"
                            onClick={() => {
                              calendar.setCurrentDate(day.date)
                              calendar.setViewMode('dia')
                            }}
                            className={`${getStatusCardTone(item.status)} w-full rounded-[8px] px-3 py-2 text-left`}
                          >
                            <p className="text-xs text-app-text-primary dark:text-white">
                              {item.hora} • {item.titulo || item.paciente || 'Compromisso'}
                            </p>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs ${getStatusBadgeTone(item.status)}`}
                              >
                                {item.status}
                              </span>
                              <p className="text-xs text-app-text-secondary dark:text-app-text-muted">
                                Abrir dia
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'pessoal' && !isLoading && calendar.viewMode === 'mes' && (
              <div className="overflow-hidden rounded-[16px] border border-app-border/70 bg-white shadow-sm dark:border-app-border-dark/70 dark:bg-app-bg-dark/20">
                <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] border-b border-app-border/60 bg-app-bg-secondary/40 dark:border-app-border-dark/60 dark:bg-app-bg-dark/40">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((label) => (
                    <div
                      key={`personal-month-${label}`}
                      className="py-3 text-center text-sm font-normal text-app-text-secondary dark:text-app-text-muted"
                    >
                      {label}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-[repeat(7,minmax(0,1fr))]">
                  {calendar.monthAgendaSummary.map((day, index) => (
                    <div
                      key={`personal-month-cell-${day.key}`}
                      className={`min-h-[120px] border-b border-r p-2 ${index % 7 === 6 ? 'border-r-0' : ''} ${day.date ? 'bg-white dark:bg-transparent' : 'bg-app-bg-secondary/20 dark:bg-app-bg-dark/10'} ${day.isToday ? 'bg-app-primary/5 dark:bg-app-primary/10' : ''} border-app-border/60 dark:border-app-border-dark/60`}
                    >
                      {day.date && (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${day.isToday ? 'bg-app-primary text-white' : 'text-app-text-primary dark:text-white'}`}
                            >
                              {day.date.getDate()}
                            </span>
                          </div>
                          <div className="mt-6 text-xs text-app-text-muted">
                            {day.count > 0
                              ? `${day.count} compromisso${day.count > 1 ? 's' : ''}`
                              : 'Sem compromissos'}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      <AniversariantesModal
        isOpen={actions.activeModal === 'aniversariantes'}
        onClose={() => actions.setActiveModal(null)}
      />
      <TarefasModal
        isOpen={actions.activeModal === 'tarefas'}
        onClose={() => actions.setActiveModal(null)}
      />
      <BloqueioAgendaModal
        isOpen={actions.activeModal === 'bloqueio'}
        onClose={() => actions.setActiveModal(null)}
        professionals={professionalOptions}
        onSave={async (payload) => {
          try {
            const profissionalId =
              agendaProfessionals.find((p) => p.nome === payload.profissional)?.id ?? null
            await createBloqueio({
              profissionalId,
              dataInicio: payload.dataInicio,
              dataFim: payload.dataFim,
              horarioInicio: payload.bloquearDiaInteiro ? null : payload.horarioInicio,
              horarioFim: payload.bloquearDiaInteiro ? null : payload.horarioFim,
              diaInteiro: payload.bloquearDiaInteiro,
              tipo: payload.tipo,
              justificativa: payload.justificativa || null,
            })
            toast.success('Bloqueio registrado.')
            actions.setActiveModal(null)
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Falha ao registrar bloqueio')
          }
        }}
      />
      <NovoAgendamentoModal
        isOpen={actions.activeModal === 'novo' || shouldOpenNewFromQuery}
        onClose={() => {
          actions.setActiveModal(null)
          setNovoAgendamentoPreset({})
          setCreatedPatientForAgenda(null)
          if (shouldOpenNewFromQuery) router.replace('/agenda')
        }}
        currentDate={calendar.currentDate}
        professionals={professionalOptions}
        professionalDetails={professionalDetailsForAgendamento}
        patients={patientOptions}
        availableSlots={availableSlots}
        initialPatientId={preselectedPatientId || createdPatientForAgenda?.id}
        initialDate={novoAgendamentoPreset.data}
        initialTime={novoAgendamentoPreset.horario}
        initialProfissional={novoAgendamentoPreset.profissional || preselectedProfissional || undefined}
        initialProcedimentoId={preselectedProcedimentoId || undefined}
        initialTipo={preselectedTipo || undefined}
        createdPatient={createdPatientForAgenda}
        onRequestFullCadastro={(nomeHint) => {
          setNovoPacienteNomeHint(nomeHint)
          setIsNovoPacienteOpen(true)
        }}
        onSave={handleCreateAppointment}
      />
      <NovoPacienteModal
        isOpen={isNovoPacienteOpen}
        onClose={() => setIsNovoPacienteOpen(false)}
        unitOptions={pacienteUnits}
        initialNome={novoPacienteNomeHint}
        onSave={async (patient: Patient) => {
          const response = await createPaciente({
            nome: patient.name || patient.nome || '',
            telefone: patient.phone || patient.telefone || '',
            email: patient.email || '',
            cpf: patient.cpf || '',
            rg: patient.rg || '',
            inscricaoEstadual: patient.inscricaoEstadual || '',
            dataNascimento: patient.birthDate || patient.dataNascimento || '',
            sexo: patient.gender || patient.sexo || '',
            status: patient.activeStatus || 'Ativo',
            indicacao: patient.source || patient.indicacao || '',
            origemDetalhe: patient.origemDetalhe || '',
            indicadoPorId: patient.indicadoPorId ?? null,
            financial: patient.financial as Record<string, unknown> | undefined,
            vinculoTipos:
              patient.vinculoTipos && patient.vinculoTipos.length > 0
                ? patient.vinculoTipos
                : ['cliente'],
            precisaNf: patient.precisaNf === true,
            unidadeId: patient.unidadeId ? String(patient.unidadeId) : '',
            photoUrl: patient.photoUrl || undefined,
            addressDetails: patient.addressDetails,
            specialNeeds: patient.specialNeeds as Record<string, unknown> | undefined,
            responsible: patient.responsible as Record<string, unknown> | undefined,
            supplierData: patient.supplierData as Record<string, unknown> | undefined,
            criarAcessoPortal: patient.criarAcessoPortal === true,
          })
          const createdId =
            response.createdId ??
            response.data.find(
              (item) =>
                item.nome === (patient.name || patient.nome) &&
                (item.cpf ?? '').replace(/\D/g, '') === (patient.cpf ?? '').replace(/\D/g, ''),
            )?.id
          if (!createdId) {
            throw new Error('Paciente criado, mas o id não retornou da API')
          }
          setCreatedPatientForAgenda({
            id: createdId,
            nome: patient.name || patient.nome || '',
          })
          setIsNovoPacienteOpen(false)
          return { portalAccess: response.portalAccess ?? null }
        }}
      />
      <ListaEsperaModal
        isOpen={actions.activeModal === 'lista-espera'}
        onClose={() => actions.setActiveModal(null)}
        patients={patientOptions}
        onSave={actions.handleAddToWaitlist}
        onAgendar={(item) => {
          actions.setActiveModal(null)
          router.push(buildAgendarUrl(item))
        }}
      />
      <RemarcarConsultaModal
        availableSlots={availableSlots}
        isOpen={actions.activeModal === 'remarcar'}
        onClose={() => actions.setActiveModal(null)}
        consulta={
          actions.selectedSlot
            ? {
                id: actions.selectedSlot.id,
                paciente: actions.selectedSlot.paciente,
                pacienteId: findPacienteId(actions.selectedSlot),
                especialista: actions.selectedSlot.profissional,
                data: actions.parseAgendaDate(actions.selectedSlot.data),
                horario: actions.selectedSlot.hora,
                tipo: 'Consulta',
              }
            : null
        }
        onSave={actions.handleReschedule}
      />
      <CancelarConsultaModal
        isOpen={actions.activeModal === 'cancelar'}
        onClose={() => actions.setActiveModal(null)}
        consulta={
          actions.selectedSlot
            ? {
                id: actions.selectedSlot.id,
                paciente: actions.selectedSlot.paciente,
                especialista: actions.selectedSlot.profissional,
                horario: actions.selectedSlot.hora,
                tipo: 'Consulta',
              }
            : null
        }
        onConfirm={actions.handleCancel}
      />
      <DadosAgendamentoModal
        isOpen={actions.activeModal === 'detalhes'}
        onClose={() => {
          actions.setActiveModal(null)
          actions.setSelectedSlot(null)
        }}
        professionals={professionalDetailsForAgendamento}
        agenda={
          selectedAgendaItem
            ? {
                id: selectedAgendaItem.id,
                pacienteId:
                  selectedAgendaItem.pacienteId ||
                  pacientes.find((item) => item.nome === selectedAgendaItem.paciente)?.id ||
                  '',
                paciente: selectedAgendaItem.paciente,
                profissional: selectedAgendaItem.profissional,
                profissionalId: selectedAgendaItem.profissionalId,
                data: selectedAgendaItem.data ?? '',
                horario: selectedAgendaItem.horario,
                tipo: selectedAgendaItem.tipo ?? 'consulta',
                status: selectedAgendaItem.status,
                procedimentoId: selectedAgendaItem.procedimentoId,
                procedimento: selectedAgendaItem.procedimento,
                valorProcedimento: selectedAgendaItem.valorProcedimento,
                observacoes: selectedAgendaItem.observacoes,
                modalidade: selectedAgendaItem.modalidade,
                plataformaOnline: selectedAgendaItem.plataformaOnline,
                urlOnline: selectedAgendaItem.urlOnline,
              }
            : null
        }
        onSave={actions.handleEditAppointment}
      />
      <EmitirCobrancaModal
        isOpen={actions.activeModal === 'cobranca'}
        onClose={() => {
          actions.setActiveModal(null)
          actions.setSelectedSlot(null)
        }}
        agenda={
          selectedAgendaItem
            ? {
                paciente: selectedAgendaItem.paciente,
                profissional: selectedAgendaItem.profissional,
                horario: selectedAgendaItem.horario,
                procedimento: selectedAgendaItem.procedimento,
                valorProcedimento: selectedAgendaItem.valorProcedimento,
                totalPago: selectedAgendaItem.totalPago,
                dataPagamentoAnterior: selectedAgendaItem.dataPagamentoAnterior,
              }
            : null
        }
        agendamentoId={selectedAgendaItem?.id}
        onConfirm={actions.handleEmitCharge}
      />
      <AdiarCompromissoModal
        isOpen={isAdiarCompromissoOpen}
        onClose={closePersonalModals}
        compromissoId={selectedPersonalSlot?.id}
        compromissoTitulo={selectedPersonalSlot?.paciente}
        onSave={handleAdiarCompromisso}
      />
      <AgendarReuniaoModal
        isOpen={isAgendarReuniaoOpen}
        onClose={() => setIsAgendarReuniaoOpen(false)}
        professionals={agendaProfessionals}
        onSave={handleAgendarReuniao}
      />
      <EditarCompromissoModal
        isOpen={isEditarCompromissoOpen}
        onClose={closePersonalModals}
        compromisso={
          selectedPersonalSlot
            ? {
                id: selectedPersonalSlot.id,
                titulo: selectedPersonalSlot.titulo || selectedPersonalSlot.paciente || 'Compromisso',
                data: actions.parseAgendaDate(selectedPersonalSlot.data),
                hora: selectedPersonalSlot.hora,
              }
            : null
        }
        onSave={handleEditarCompromisso}
      />
      <CancelarCompromissoModal
        isOpen={isCancelarCompromissoOpen}
        onClose={closePersonalModals}
        compromissoTitulo={selectedPersonalSlot?.paciente}
        onConfirm={handleCancelarCompromisso}
      />
      <GerarAgendaModal
        isOpen={isGerarAgendaOpen}
        onClose={() => setIsGerarAgendaOpen(false)}
        onSave={handleGerarAgenda}
      />
      <ExcluirAgendaModal
        isOpen={isExcluirAgendaOpen}
        onClose={() => setIsExcluirAgendaOpen(false)}
        onSave={handleExcluirAgenda}
      />
      <VisualizarConsultaModal
        open={actions.activeModal === 'visualizar'}
        onOpenChange={(v) => {
          if (!v) actions.setActiveModal(null)
        }}
        item={selectedAgendaItem}
      />
      <EditarPacienteModal
        isOpen={actions.activeModal === 'ficha-paciente'}
        onClose={() => {
          actions.setActiveModal(null)
          actions.setSelectedSlot(null)
        }}
        paciente={pacienteParaEdicao}
        unitOptions={pacienteUnits}
        onSave={async (patient: Patient) => {
          if (!patient.id) return
          await updatePaciente({
            id: String(patient.id),
            nome: patient.name || patient.nome || '',
            telefone: patient.phone || patient.telefone || '',
            email: patient.email || '',
            cpf: patient.cpf || '',
            rg: patient.rg || '',
            inscricaoEstadual: patient.inscricaoEstadual || '',
            dataNascimento: patient.birthDate || patient.dataNascimento || '',
            sexo: patient.gender || patient.sexo || '',
            status: patient.activeStatus || 'Ativo',
            indicacao: patient.source || patient.indicacao || '',
            origemDetalhe: patient.origemDetalhe || '',
            indicadoPorId: patient.indicadoPorId ?? null,
            financial: patient.financial as Record<string, unknown> | undefined,
            vinculoTipos:
              patient.vinculoTipos && patient.vinculoTipos.length > 0
                ? patient.vinculoTipos
                : ['cliente'],
            precisaNf: patient.precisaNf === true,
            unidadeId: patient.unidadeId ? String(patient.unidadeId) : '',
            photoUrl: patient.photoUrl || undefined,
            addressDetails: patient.addressDetails,
            specialNeeds: patient.specialNeeds as Record<string, unknown> | undefined,
            responsible: patient.responsible as Record<string, unknown> | undefined,
            supplierData: patient.supplierData as Record<string, unknown> | undefined,
            criarAcessoPortal: patient.criarAcessoPortal === true,
          })
          actions.setActiveModal(null)
          actions.setSelectedSlot(null)
        }}
      />
      <ChamarEspecialistaModal
        open={actions.activeModal === 'chamar-especialista'}
        onOpenChange={(v) => {
          if (!v) actions.setActiveModal(null)
        }}
        item={selectedAgendaItem}
        professionals={agendaProfessionals}
        onSubmit={async (profissionalId, mensagem) => {
          await actions.handleCallSpecialist(profissionalId, mensagem)
          actions.setActiveModal(null)
        }}
      />

      <ReciboModal isOpen={reciboAgendamentoId !== null} onClose={() => setReciboAgendamentoId(null)} tipo="agendamento" origemId={reciboAgendamentoId} />
    </div>
  )
}
