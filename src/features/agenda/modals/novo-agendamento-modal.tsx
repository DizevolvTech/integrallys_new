'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Activity, Clock, FileText, Stethoscope, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { ModalHeader } from '@/components/shared/modal-header'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { isProcedimentoRetornoNome } from '@/lib/procedimento-retorno'
import { Switch } from '@/components/ui/switch'
import { isHorarioPassado } from '../agenda.utils'
import { mensagemSemHorario, resolveModalidade, type TipoAtendimento } from './novo-agendamento.utils'
import { useProcedimentos } from '@/features/procedimentos/hooks/use-procedimentos'
import { useContasBancarias } from '@/features/gestao-bancaria/hooks/use-contas-bancarias'

interface PacienteOption {
  id: string
  nome: string
}

export interface SlotDisponivel {
  profissional: string
  data: string // YYYY-MM-DD
  horario: string // HH:MM
}

// YYYY-MM-DD no fuso LOCAL — toISOString() é UTC e desalinha do fuso dos slots
// (perto da meia-noite cairia no dia seguinte → "0 horários disponíveis").
function toLocalISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

interface ProfessionalOption {
  id: string
  nome: string
  procedimentoIds?: string[]
}

interface NovoAgendamentoModalProps {
  isOpen: boolean
  onClose: () => void
  currentDate?: Date
  professionals?: string[]
  /** Detalhes dos profissionais (id + procedimentos vinculados) para filtrar a pasta. */
  professionalDetails?: ProfessionalOption[]
  patients?: PacienteOption[]
  /** Slots 'Disponível' (gerados na 2A) para oferecer fora do encaixe. */
  availableSlots?: SlotDisponivel[]
  initialPatientId?: string
  initialDate?: string
  initialTime?: string
  initialProfissional?: string
  initialProcedimentoId?: string
  /** Tipo pré-selecionado ao abrir (ex.: 'retorno' vindo da lista de retornos). */
  initialTipo?: string
  /** Paciente recém-criado no cadastro completo (seleciona no formulário). */
  createdPatient?: PacienteOption | null
  /** Abre o cadastro completo (modal Novo Paciente) em vez do formulário rápido. */
  onRequestFullCadastro?: (nomeHint: string) => void
  onSave?: (payload: {
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
  }) => Promise<void> | void
}

export function NovoAgendamentoModal({
  isOpen,
  onClose,
  currentDate,
  professionals = [],
  professionalDetails = [],
  patients = [],
  availableSlots = [],
  initialPatientId,
  initialDate,
  initialTime,
  initialProfissional,
  initialProcedimentoId,
  initialTipo,
  createdPatient = null,
  onRequestFullCadastro,
  onSave,
}: NovoAgendamentoModalProps) {
  const formRef = useRef<HTMLFormElement | null>(null)
  const [pacienteId, setPacienteId] = useState('')
  const [patientQuery, setPatientQuery] = useState('')
  const [patientListOpen, setPatientListOpen] = useState(false)
  const [extraPatients, setExtraPatients] = useState<PacienteOption[]>([])
  const [profissional, setProfissional] = useState('')
  const [data, setData] = useState(currentDate ? toLocalISODate(currentDate) : '')
  const [horario, setHorario] = useState('')
  const [tipo, setTipo] = useState('consulta')
  const [observacoes, setObservacoes] = useState('')
  const [tipoAtendimento, setTipoAtendimento] = useState<TipoAtendimento>('presencial')
  const [plataformaOnline, setPlataformaOnline] = useState<'zoom' | 'google_meet' | 'teams'>('google_meet')
  const [urlOnline, setUrlOnline] = useState('')
  const [encaixeExtraHorario, setEncaixeExtraHorario] = useState(false)
  const [motivoEncaixe, setMotivoEncaixe] = useState('')
  const [procedimentoId, setProcedimentoId] = useState('')
  const [gerarPacote, setGerarPacote] = useState(false)
  const [serieQuantidade, setSerieQuantidade] = useState('')
  const [pagamentoValor, setPagamentoValor] = useState('')
  const [pagamentoMetodo, setPagamentoMetodo] = useState('')
  const [pagamentoBandeira, setPagamentoBandeira] = useState('')
  const [pagamentoParcelas, setPagamentoParcelas] = useState('1')
  const [pagamentoContaId, setPagamentoContaId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { data: procedimentosCatalogo } = useProcedimentos()
  const { data: contasBancarias } = useContasBancarias()
  const contasAtivas = useMemo(() => contasBancarias.filter((item) => item.ativo), [contasBancarias])

  const selectedProfessional = useMemo(
    () =>
      professionalDetails.find(
        (item) => item.nome.trim().toLowerCase() === profissional.trim().toLowerCase(),
      ) ?? null,
    [professionalDetails, profissional],
  )

  const procedimentosDisponiveis = useMemo(() => {
    const ativos = procedimentosCatalogo.filter((item) => item.ativo)
    if (!profissional) return []
    // Sem vínculos cadastrados: lista vazia (não libera todos os procedimentos).
    const vinculados = selectedProfessional?.procedimentoIds ?? []
    if (vinculados.length === 0) return []
    const allowed = new Set(vinculados)
    return ativos.filter((item) => allowed.has(item.id))
  }, [procedimentosCatalogo, profissional, selectedProfessional])

  const procedimentoSelecionado = useMemo(
    () => procedimentosDisponiveis.find((item) => item.id === procedimentoId) ?? null,
    [procedimentosDisponiveis, procedimentoId],
  )

  // Procedimento "Retorno…": sempre agenda como retorno (duração de retorno do profissional).
  const procedimentoDeRetorno = isProcedimentoRetornoNome(procedimentoSelecionado?.nome)
  useEffect(() => {
    if (procedimentoDeRetorno) setTipo('retorno')
  }, [procedimentoDeRetorno])

  const valorCobrado = useMemo(() => {
    if (!procedimentoSelecionado) return undefined
    if (tipo === 'retorno' && procedimentoSelecionado.temRetorno) {
      return procedimentoSelecionado.valorRetorno ?? procedimentoSelecionado.valor
    }
    return procedimentoSelecionado.valor
  }, [procedimentoSelecionado, tipo])

  useEffect(() => {
    if (valorCobrado != null && Number.isFinite(valorCobrado)) {
      setPagamentoValor((current) => (current.trim() ? current : String(Number(valorCobrado.toFixed(2)))))
    }
  }, [valorCobrado])

  useEffect(() => {
    if (skipProcedimentoResetRef.current) {
      skipProcedimentoResetRef.current = false
      return
    }
    setProcedimentoId('')
    setGerarPacote(false)
    setSerieQuantidade('')
  }, [profissional])

  useEffect(() => {
    if (!procedimentoSelecionado?.temPacote) {
      setGerarPacote(false)
      setSerieQuantidade('')
      return
    }
    if (procedimentoSelecionado.quantidadeSugeridaPacote) {
      setSerieQuantidade(String(procedimentoSelecionado.quantidadeSugeridaPacote))
    }
  }, [procedimentoSelecionado])

  const allPatients = useMemo(() => {
    const map = new Map<string, PacienteOption>()
    for (const item of [...patients, ...extraPatients]) {
      map.set(item.id, item)
    }
    return Array.from(map.values())
  }, [extraPatients, patients])

  const patientName = useMemo(
    () => allPatients.find((item) => item.id === pacienteId)?.nome ?? '',
    [allPatients, pacienteId],
  )

  const filteredPatients = useMemo(() => {
    const query = patientQuery.trim().toLowerCase()
    if (!query) return []
    return allPatients
      .filter((item) => item.nome.toLowerCase().includes(query))
      .slice(0, 8)
  }, [allPatients, patientQuery])

  const noPatientMatch = patientQuery.trim().length > 0 && filteredPatients.length === 0

  // Horários 'Disponível' do profissional selecionado naquela data (ordenados, únicos).
  // No dia de hoje, remove horários já passados (não permite booking retroativo).
  const slotsForSelection = useMemo(() => {
    if (!profissional || !data) return [] as string[]
    const hoje = toLocalISODate(new Date())
    const horarios = availableSlots
      .filter((slot) => slot.profissional === profissional && slot.data === data)
      .map((slot) => slot.horario)
      .filter((horario) => {
        if (data !== hoje) return true
        const [hh, mm] = horario.split(':').map(Number)
        if (!Number.isFinite(hh) || !Number.isFinite(mm)) return true
        const agora = new Date()
        const slotDate = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), hh, mm, 0, 0)
        return slotDate.getTime() >= agora.getTime()
      })
    return Array.from(new Set(horarios)).sort()
  }, [availableSlots, profissional, data])

  // Fora do encaixe, o horário precisa ser um slot disponível — limpa seleções
  // inválidas quando o profissional/data muda.
  useEffect(() => {
    if (encaixeExtraHorario) return
    if (horario && !slotsForSelection.includes(horario)) {
      setHorario('')
    }
  }, [encaixeExtraHorario, horario, slotsForSelection])

  // Reset só na transição fechado→aberto (e presets iniciais). NÃO depender de
  // `patients`: após createPaciente a lista troca de identidade e apagaria o
  // paciente recém-selecionado.
  const wasOpenRef = useRef(false)
  const skipProcedimentoResetRef = useRef(false)
  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false
      return
    }
    const justOpened = !wasOpenRef.current
    wasOpenRef.current = true
    if (!justOpened) return

    setExtraPatients([])
    setPatientListOpen(false)
    setPacienteId('')
    setPatientQuery('')
    if (initialPatientId) {
      const initial = patients.find((item) => item.id === initialPatientId)
      if (initial) {
        setPacienteId(initial.id)
        setPatientQuery(initial.nome)
      } else {
        setPacienteId(initialPatientId)
      }
    }
    if (initialDate) setData(initialDate)
    if (initialTime) setHorario(initialTime)
    if (initialProfissional) {
      skipProcedimentoResetRef.current = Boolean(initialProcedimentoId)
      setProfissional(initialProfissional)
    } else {
      setProfissional('')
    }
    setProcedimentoId(initialProcedimentoId || '')
    setTipo(initialTipo || 'consulta')
    setUrlOnline('')
    setPlataformaOnline('google_meet')
    // patients intencionalmente omitido — lookup usa o valor do render da abertura
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open transition only
  }, [isOpen, initialDate, initialPatientId, initialProfissional, initialProcedimentoId, initialTime, initialTipo])

  // Profissional do preset (ex.: vindo de /retornos) pode chegar depois da abertura,
  // quando a lista de profissionais termina de carregar — preenche só se ainda vazio.
  useEffect(() => {
    if (!isOpen || !initialProfissional || profissional) return
    // O efeito de troca de profissional limpa o procedimento; preserva o do preset (ex.: lista de espera).
    skipProcedimentoResetRef.current = Boolean(initialProcedimentoId)
    setProfissional(initialProfissional)
    if (initialProcedimentoId) setProcedimentoId(initialProcedimentoId)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando o profissional do preset chega
  }, [isOpen, initialProfissional])

  // Se o modal abriu com preset antes da lista carregar, preenche o nome quando
  // `patients` chegar — sem limpar seleção feita pelo usuário/create.
  useEffect(() => {
    if (!isOpen || !initialPatientId) return
    const initial = patients.find((item) => item.id === initialPatientId)
    if (!initial) return
    setPacienteId((current) => {
      if (!current || current === initialPatientId) return initial.id
      return current
    })
    setPatientQuery((current) => {
      if (!current.trim() || current === initial.nome) return initial.nome
      return current
    })
  }, [isOpen, initialPatientId, patients])

  // Paciente criado no cadastro completo (fora deste modal).
  useEffect(() => {
    if (!isOpen || !createdPatient?.id) return
    setExtraPatients((prev) => {
      if (prev.some((item) => item.id === createdPatient.id)) return prev
      return [...prev, createdPatient]
    })
    setPacienteId(createdPatient.id)
    setPatientQuery(createdPatient.nome)
    setPatientListOpen(false)
  }, [createdPatient, isOpen])

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose()
  }

  const handleClose = () => {
    onClose()
  }

  const selectPatient = (patient: PacienteOption) => {
    setPacienteId(patient.id)
    setPatientQuery(patient.nome)
    setPatientListOpen(false)
  }

  const clearPatient = () => {
    setPacienteId('')
    setPatientQuery('')
    setPatientListOpen(false)
  }

  const handleRequestFullCadastro = () => {
    if (!onRequestFullCadastro) {
      toast.error('Cadastro de paciente indisponível.')
      return
    }
    setPatientListOpen(false)
    onRequestFullCadastro(patientQuery.trim())
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return
    if (!pacienteId) {
      toast.error('Selecione o paciente para agendar.')
      return
    }
    if (!profissional) {
      toast.error('Selecione o profissional.')
      return
    }
    if (!data) {
      toast.error('Informe a data do agendamento.')
      return
    }
    if (!horario) {
      toast.error(
        mensagemSemHorario({
          data,
          hoje: toLocalISODate(new Date()),
          encaixe: encaixeExtraHorario,
          temHorarios: slotsForSelection.length > 0,
        }),
      )
      return
    }

    if (isHorarioPassado(data, horario)) {
      toast.error(
        mensagemSemHorario({ data, hoje: toLocalISODate(new Date()), encaixe: encaixeExtraHorario, temHorarios: true, horarioPassado: true }),
      )
      return
    }

    if (
      tipo === 'retorno' &&
      procedimentoSelecionado &&
      !procedimentoSelecionado.temRetorno &&
      !procedimentoDeRetorno
    ) {
      toast.error('Este procedimento não possui retorno cadastrado. Agende como consulta.')
      return
    }

    if (gerarPacote && tipo === 'retorno') {
      toast.error('Pacote recorrente não se aplica a retorno. Use consulta.')
      return
    }

    const qtdPacote = Number(serieQuantidade)
    if (gerarPacote && (!Number.isFinite(qtdPacote) || qtdPacote < 2)) {
      toast.error('Informe a quantidade de sessões do pacote (mínimo 2).')
      return
    }
    if (gerarPacote && !procedimentoSelecionado?.intervaloRecorrenciaDias) {
      toast.error('Procedimento sem intervalo de recorrência cadastrado.')
      return
    }

    const valorPago = Number(String(pagamentoValor).replace(',', '.'))
    // Procedimento de R$ 0 (ex.: retorno sem cobrança): pagamento inicial opcional.
    const semCobranca = valorCobrado === 0 && (!pagamentoMetodo || !(valorPago > 0))
    if (!semCobranca && !pagamentoMetodo) {
      toast.error('Informe o método do pagamento inicial.')
      return
    }
    if (!semCobranca && (!Number.isFinite(valorPago) || valorPago <= 0)) {
      toast.error('Informe um valor de pagamento inicial (pode ser parcial).')
      return
    }
    const metodoLower = pagamentoMetodo.toLowerCase()
    const isCartao = metodoLower.includes('cartão') || metodoLower.includes('cartao')
    const isCredito = metodoLower.includes('crédito') || metodoLower.includes('credito')
    const isPix = metodoLower.includes('pix')
    if (isCartao && !pagamentoBandeira) {
      toast.error('Informe a bandeira do cartão.')
      return
    }
    if (isPix && !pagamentoContaId) {
      toast.error('Selecione a conta bancária do PIX.')
      return
    }

    const { modalidade, plataformaOnline: plataforma } = resolveModalidade(tipoAtendimento, plataformaOnline)
    const needsUrl = tipoAtendimento === 'online' || tipoAtendimento === 'hibrido'
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
    setIsSubmitting(true)
    try {
      await onSave?.({
        pacienteId,
        profissional,
        data,
        horario,
        tipo,
        observacoes,
        modalidade,
        plataformaOnline: plataforma,
        urlOnline: needsUrl ? urlTrimmed : undefined,
        foraJanela: encaixeExtraHorario,
        motivoEncaixe: encaixeExtraHorario ? motivoEncaixe : undefined,
        procedimentoId: procedimentoId || undefined,
        valorProcedimento: valorCobrado,
        serieQuantidade: gerarPacote ? qtdPacote : undefined,
        serieIntervaloDias: gerarPacote
          ? procedimentoSelecionado?.intervaloRecorrenciaDias
          : undefined,
        pagamentoInicial: semCobranca
          ? undefined
          : {
              valor: Number(valorPago.toFixed(2)),
              metodo: pagamentoMetodo,
              bandeira: isCartao ? pagamentoBandeira : undefined,
              parcelas: isCredito ? Number(pagamentoParcelas) || 1 : undefined,
              contaBancariaId: isPix ? pagamentoContaId : undefined,
            },
      })
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível criar o agendamento.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-integrallys-lg bg-app-card dark:bg-app-card-dark">
        <ModalHeader
          title="Novo Agendamento"
          description="Preencha os dados abaixo para realizar o agendamento."
        />

        <form ref={formRef} onSubmit={(event) => void handleSubmit(event)} className="space-y-5 p-6 pb-8 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="paciente-busca" className="text-sm font-normal text-app-text-primary dark:text-white">
              Paciente
            </Label>
            <div className="relative">
              <Input
                id="paciente-busca"
                role="combobox"
                aria-expanded={patientListOpen}
                aria-controls="paciente-sugestoes"
                aria-autocomplete="list"
                value={patientQuery}
                onChange={(event) => {
                  const value = event.target.value
                  setPatientQuery(value)
                  setPacienteId('')
                  setPatientListOpen(true)
                }}
                onFocus={() => setPatientListOpen(true)}
                placeholder="Buscar ou digitar nome do paciente"
                className="h-11 rounded-integrallys bg-app-bg-secondary/50 pr-10 dark:bg-app-bg-dark"
                autoComplete="off"
              />
              {(pacienteId || patientQuery) && (
                <button
                  type="button"
                  aria-label="Limpar paciente"
                  onClick={clearPatient}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-app-text-muted hover:text-app-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {patientListOpen && patientQuery.trim().length > 0 && (
                <div
                  id="paciente-sugestoes"
                  role="listbox"
                  className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-integrallys border border-app-border bg-white shadow-md dark:border-app-border-dark dark:bg-app-card-dark"
                >
                  {filteredPatients.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={item.id === pacienteId}
                      className="flex w-full px-3 py-2 text-left text-sm text-app-text-primary hover:bg-app-bg-secondary dark:text-white dark:hover:bg-app-hover"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectPatient(item)}
                    >
                      {item.nome}
                    </button>
                  ))}
                  {noPatientMatch && (
                    <div className="space-y-2 p-3">
                      <p className="text-xs font-medium text-app-text-primary dark:text-white">
                        Paciente não encontrado
                      </p>
                      <p className="text-xs text-app-text-muted">
                        Abra o cadastro completo para incluir o paciente na clínica.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 w-full gap-2 rounded-integrallys"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={handleRequestFullCadastro}
                      >
                        <UserPlus className="h-4 w-4" />
                        Cadastrar paciente completo
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {pacienteId && patientName && (
              <p className="text-xs text-app-text-muted">Selecionado: {patientName}</p>
            )}
            {!pacienteId && noPatientMatch && (
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full gap-2 rounded-integrallys"
                onClick={handleRequestFullCadastro}
              >
                <UserPlus className="h-4 w-4" />
                Cadastrar paciente completo
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-normal text-app-text-primary dark:text-white">Profissional</Label>
            <Select value={profissional} onValueChange={setProfissional}>
              <SelectTrigger className="h-11 rounded-integrallys border-app-border bg-white dark:border-app-border-dark dark:bg-app-bg-dark">
                <SelectValue placeholder="Selecione o profissional" />
              </SelectTrigger>
              <SelectContent className="rounded-integrallys">
                {professionals.length === 0 && <SelectItem value="__empty_professionals" disabled>Nenhum especialista disponível</SelectItem>}
                {professionals.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-normal text-app-text-primary dark:text-white flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-[var(--app-primary)]" />
              Procedimento
            </Label>
            <Select
              value={procedimentoId}
              onValueChange={setProcedimentoId}
              disabled={!profissional}
            >
              <SelectTrigger className="h-11 rounded-integrallys border-app-border bg-white dark:border-app-border-dark dark:bg-app-bg-dark">
                <SelectValue placeholder={profissional ? 'Selecione o procedimento' : 'Escolha o profissional primeiro'} />
              </SelectTrigger>
              <SelectContent className="rounded-integrallys">
                {procedimentosDisponiveis.length === 0 && (
                  <SelectItem value="__empty_procedimentos" disabled>
                    Nenhum procedimento disponível
                  </SelectItem>
                )}
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
                Nenhum procedimento vinculado a este profissional. Cadastre o vínculo em Profissionais.
              </p>
            )}
            {valorCobrado != null && (
              <p className="text-xs text-app-text-muted">
                Valor para cobrança{tipo === 'retorno' ? ' (retorno)' : ''}: R${' '}
                {valorCobrado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            )}
            {tipo === 'retorno' && procedimentoSelecionado?.temRetorno && (
              <p className="text-xs text-app-text-muted">
                Retorno válido em até {procedimentoSelecionado.prazoRetornoDias ?? 35} dias após o
                último atendimento deste procedimento.
              </p>
            )}
          </div>

          {procedimentoSelecionado?.temPacote && tipo !== 'retorno' && (
            <div className="space-y-3 rounded-integrallys border border-app-border bg-app-bg-secondary/50 p-3 dark:border-app-border-dark dark:bg-app-bg-dark">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <Label className="text-sm font-normal text-app-text-primary dark:text-white">
                    Gerar pacote recorrente
                  </Label>
                  <p className="text-xs text-app-text-muted">
                    A cada {procedimentoSelecionado.intervaloRecorrenciaDias} dia(s), mesmo horário.
                  </p>
                </div>
                <Switch checked={gerarPacote} onCheckedChange={setGerarPacote} />
              </div>
              {gerarPacote && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-normal">Quantidade de sessões</Label>
                  <Input
                    type="number"
                    min={2}
                    value={serieQuantidade}
                    onChange={(event) => setSerieQuantidade(event.target.value)}
                    className="h-10 rounded-integrallys"
                    placeholder="Ex: 10"
                  />
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-normal text-app-text-primary dark:text-white">Data</Label>
              <Input
                type="date"
                value={data}
                onChange={(event) => setData(event.target.value)}
                className="h-11 rounded-integrallys bg-app-bg-secondary/50 dark:bg-app-bg-dark"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-sm font-normal text-app-text-primary dark:text-white">
                <Clock className="h-4 w-4 text-[var(--app-primary)]" />
                Horário
              </Label>
              {encaixeExtraHorario ? (
                <Input
                  type="time"
                  value={horario}
                  onChange={(event) => setHorario(event.target.value)}
                  className="h-11 rounded-integrallys bg-app-bg-secondary/50 dark:bg-app-bg-dark"
                />
              ) : (
                <Select value={horario} onValueChange={setHorario} disabled={slotsForSelection.length === 0}>
                  <SelectTrigger className="h-11 rounded-integrallys border-app-border bg-white dark:border-app-border-dark dark:bg-app-bg-dark">
                    <SelectValue
                      placeholder={
                        !profissional || !data
                          ? 'Selecione profissional e data'
                          : slotsForSelection.length === 0
                            ? 'Nenhum horário disponível'
                            : 'Selecione o horário'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="rounded-integrallys">
                    {slotsForSelection.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          {!encaixeExtraHorario && profissional && data && slotsForSelection.length === 0 && (
            <p className="text-xs text-app-text-muted">
              Nenhum horário disponível para este profissional nesta data. Gere a agenda ou ligue o
              encaixe abaixo para marcar fora da grade.
            </p>
          )}

          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-sm font-normal text-app-text-primary dark:text-white">
              <Activity className="h-4 w-4 text-[var(--app-primary)]" />
              Tipo
            </Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="h-11 rounded-integrallys border-app-border bg-white dark:border-app-border-dark dark:bg-app-bg-dark">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent className="rounded-integrallys">
                <SelectItem value="consulta">Consulta</SelectItem>
                <SelectItem value="exame">Exame</SelectItem>
                <SelectItem value="retorno">Retorno</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-normal text-app-text-primary dark:text-white">Tipo de atendimento</Label>
            <Select value={tipoAtendimento} onValueChange={(value) => setTipoAtendimento(value as TipoAtendimento)}>
              <SelectTrigger className="h-11 rounded-integrallys border-app-border bg-white dark:border-app-border-dark dark:bg-app-bg-dark">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent className="rounded-integrallys">
                <SelectItem value="presencial">Presencial</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="hibrido">Híbrido</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(tipoAtendimento === 'online' || tipoAtendimento === 'hibrido') && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-normal text-app-text-primary dark:text-white">Plataforma online</Label>
                <Select value={plataformaOnline} onValueChange={(value) => setPlataformaOnline(value as 'zoom' | 'google_meet' | 'teams')}>
                  <SelectTrigger className="h-11 rounded-integrallys border-app-border bg-white dark:border-app-border-dark dark:bg-app-bg-dark">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="rounded-integrallys">
                    <SelectItem value="google_meet">Google Meet</SelectItem>
                    <SelectItem value="zoom">Zoom</SelectItem>
                    <SelectItem value="teams">Microsoft Teams</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-normal text-app-text-primary dark:text-white">Link da reunião</Label>
                <Input
                  type="url"
                  value={urlOnline}
                  onChange={(event) => setUrlOnline(event.target.value)}
                  placeholder="https://meet.google.com/..."
                  className="h-11 rounded-integrallys border-app-border bg-white dark:border-app-border-dark dark:bg-app-bg-dark"
                />
              </div>
            </div>
          )}

          <div className="space-y-2 rounded-integrallys border border-app-border bg-app-bg-secondary/50 p-3 dark:border-app-border-dark dark:bg-app-bg-dark">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm font-normal text-app-text-primary dark:text-white">Encaixe fora do horário padrão</Label>
              <Switch checked={encaixeExtraHorario} onCheckedChange={setEncaixeExtraHorario} />
            </div>
            {encaixeExtraHorario && (
              <Input
                value={motivoEncaixe}
                onChange={(event) => setMotivoEncaixe(event.target.value)}
                placeholder="Motivo do encaixe extra-horário"
                className="h-10 rounded-integrallys"
              />
            )}
          </div>

          <div className="space-y-3 rounded-integrallys border border-app-border p-4 dark:border-app-border-dark">
            <div>
              <p className="text-sm font-medium text-app-text-primary dark:text-white">
                Pagamento inicial{valorCobrado === 0 ? '' : ' *'}
              </p>
              <p className="text-xs text-app-text-muted">
                {valorCobrado === 0
                  ? 'Procedimento sem cobrança (R$ 0,00): o pagamento inicial é opcional.'
                  : 'Obrigatório no agendamento. Pode ser parcial — o saldo fica em aberto.'}
              </p>
              {valorCobrado != null && (
                <p className="mt-1 text-xs text-app-text-secondary dark:text-white/70">
                  Valor do procedimento: R${' '}
                  {Number(valorCobrado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Método</Label>
                <Select value={pagamentoMetodo} onValueChange={setPagamentoMetodo}>
                  <SelectTrigger className="h-11 rounded-integrallys">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                    <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                    <SelectItem value="Transferência">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Valor recebido agora</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={pagamentoValor}
                  onChange={(event) => setPagamentoValor(event.target.value)}
                  className="h-11 rounded-integrallys"
                  placeholder="0,00"
                />
              </div>
            </div>
            {(pagamentoMetodo.toLowerCase().includes('cartão') || pagamentoMetodo.toLowerCase().includes('cartao')) && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Bandeira *</Label>
                  <Select value={pagamentoBandeira || '__none__'} onValueChange={(v) => setPagamentoBandeira(v === '__none__' ? '' : v)}>
                    <SelectTrigger className="h-11 rounded-integrallys">
                      <SelectValue placeholder="Bandeira" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__" disabled>Selecione</SelectItem>
                      <SelectItem value="Visa">Visa</SelectItem>
                      <SelectItem value="Mastercard">Mastercard</SelectItem>
                      <SelectItem value="Elo">Elo</SelectItem>
                      <SelectItem value="Amex">Amex</SelectItem>
                      <SelectItem value="Hipercard">Hipercard</SelectItem>
                      <SelectItem value="Outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(pagamentoMetodo.toLowerCase().includes('crédito') || pagamentoMetodo.toLowerCase().includes('credito')) && (
                  <div className="space-y-1.5">
                    <Label>Parcelas</Label>
                    <Select value={pagamentoParcelas} onValueChange={setPagamentoParcelas}>
                      <SelectTrigger className="h-11 rounded-integrallys">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, idx) => idx + 1).map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
            {pagamentoMetodo.toLowerCase().includes('pix') && (
              <div className="space-y-1.5">
                <Label>Conta PIX *</Label>
                <Select value={pagamentoContaId || '__none__'} onValueChange={(v) => setPagamentoContaId(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="h-11 rounded-integrallys">
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" disabled>Selecione</SelectItem>
                    {contasAtivas.map((conta) => (
                      <SelectItem key={conta.id} value={conta.id}>
                        {conta.nome}{conta.banco ? ` · ${conta.banco}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-normal text-app-text-primary dark:text-white">Observações</Label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 z-10 h-5 w-5 text-app-text-muted" />
              <Textarea
                placeholder="Detalhes adicionais..."
                value={observacoes}
                onChange={(event) => setObservacoes(event.target.value)}
                className="min-h-[100px] resize-none rounded-integrallys border-app-border bg-app-bg-secondary/50 py-3 pl-11 dark:border-app-border-dark dark:bg-app-bg-dark"
              />
            </div>
          </div>

          <DialogFooter className="gap-3 pt-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="h-11 w-full rounded-integrallys border-app-border px-6 text-app-text-primary hover:bg-app-bg-secondary dark:text-white/70 dark:hover:bg-app-hover sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => formRef.current?.requestSubmit()}
              disabled={isSubmitting}
              className="h-11 w-full rounded-integrallys bg-app-primary px-8 font-normal text-white shadow-sm hover:bg-app-primary-hover sm:w-auto"
            >
              {isSubmitting ? 'Agendando…' : 'Agendar'}
            </Button>
          </DialogFooter>
        </form>

        <div className="sr-only">{patientName}</div>
      </DialogContent>
    </Dialog>
  )
}
