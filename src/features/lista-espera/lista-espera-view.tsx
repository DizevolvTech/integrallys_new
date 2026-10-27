'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { CartaoMobile, ListaCartoesMobile } from '@/components/shared/mobile-card'
import { Textarea } from '@/components/ui/textarea'
import { Calendar, CheckCircle, Clock, Edit2, Moon, MoreVertical, Phone, Plus, Search, Sun, Sunset, Trash2, Users } from 'lucide-react'
import { useListaEspera } from '@/hooks/use-lista-espera'
import { usePacientes } from '@/hooks/use-pacientes'

function getPriorityBadge(priority: string) {
  switch (priority) {
    case 'Alta':
      return <Badge className="bg-[var(--app-danger-text)] dark:bg-red-900/60 text-white dark:text-[var(--app-danger-text)] border-none shadow-sm font-normal rounded-full px-4 py-1">Alta</Badge>
    case 'Média':
      return <Badge className="app-status-warning0 dark:bg-amber-900/60 text-white dark:text-[var(--app-warning-text)] border-none shadow-sm font-normal rounded-full px-4 py-1">Média</Badge>
    case 'Baixa':
      return <Badge className="bg-[var(--app-success-text)] dark:bg-emerald-900/60 text-white dark:text-[var(--app-success-text)] border-none shadow-sm font-normal rounded-full px-4 py-1">Baixa</Badge>
    default:
      return <Badge variant="outline" className="rounded-full px-4 py-1 font-normal text-app-text-secondary dark:text-white/60 border-app-border dark:border-app-border-dark">{priority}</Badge>
  }
}

function getPreferenciaHorarioBadge(preferencia: string | null | undefined) {
  if (!preferencia) return <span className="text-xs text-app-text-muted dark:text-white/40">-</span>

  switch (preferencia) {
    case 'Manhã':
      return (
        <div className="flex items-center gap-1.5">
          <Sun className="h-3.5 w-3.5 text-[var(--app-warning-text)]" />
          <span className="text-xs text-app-text-secondary dark:text-white/80">Manhã</span>
        </div>
      )
    case 'Tarde':
      return (
        <div className="flex items-center gap-1.5">
          <Sunset className="h-3.5 w-3.5 text-[var(--app-warning-text)]" />
          <span className="text-xs text-app-text-secondary dark:text-white/80">Tarde</span>
        </div>
      )
    case 'Final do dia':
      return (
        <div className="flex items-center gap-1.5">
          <Moon className="h-3.5 w-3.5 text-indigo-500" />
          <span className="text-xs text-app-text-secondary dark:text-white/80">Final do dia</span>
        </div>
      )
    default:
      return <span className="text-xs text-app-text-muted dark:text-white/40">-</span>
  }
}

export function ListaEsperaView() {
  const router = useRouter()
  const {
    data,
    specialists,
    error,
    isLoading,
    createItem,
    updateItem,
    deleteItem,
    especialistasOptions,
    procedimentosOptions,
  } = useListaEspera()
  const { data: pacientes } = usePacientes()
  const [searchTerm, setSearchTerm] = useState('')
  const [specialistFilter, setSpecialistFilter] = useState('todos')
  const [unitFilter, setUnitFilter] = useState('todos')
  const [priorityFilter, setPriorityFilter] = useState('todos')
  const [preferenciaFilter, setPreferenciaFilter] = useState('todos')
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [patientId, setPatientId] = useState('')
  const [priority, setPriority] = useState('Média')
  const [especialistaId, setEspecialistaId] = useState('')
  const [procedimentoId, setProcedimentoId] = useState('')
  const [preferenciaHorario, setPreferenciaHorario] = useState('Qualquer horário')
  const [observacoes, setObservacoes] = useState('')

  const selectedEspecialista = useMemo(
    () => especialistasOptions.find((item) => item.id === especialistaId) ?? null,
    [especialistasOptions, especialistaId],
  )

  const procedimentosFiltrados = useMemo(() => {
    if (!especialistaId) return []
    const allowed = new Set(selectedEspecialista?.procedimentoIds ?? [])
    if (allowed.size === 0) return []
    return procedimentosOptions.filter((item) => allowed.has(item.id))
  }, [especialistaId, selectedEspecialista, procedimentosOptions])

  const patients = useMemo(
    () =>
      data.map((item) => {
        const patientRecord = pacientes.find((patient) => patient.id === item.pacienteId)
        return {
        id: item.id,
        pacienteId: item.pacienteId,
        name: item.paciente,
        phone: patientRecord?.telefone || '',
        email: patientRecord?.email || '',
        specialist: item.especialista || '',
        specialistId: item.especialistaId || '',
        procedure: item.procedimento || '',
        procedureId: item.procedimentoId || '',
        unit: patientRecord?.unidadeName || '',
        waitTime: item.entradaEm || '-',
        preferenciaHorario: item.preferenciaHorario || '',
        priority: item.prioridade || 'Baixa',
        observacoes: item.observacoes || '',
      }}),
    [data, pacientes],
  )

  const selectedItem = useMemo(
    () => patients.find((item) => item.id === selectedItemId) ?? null,
    [patients, selectedItemId],
  )

  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.specialist.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.procedure.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesSpecialist = specialistFilter === 'todos' || p.specialist.toLowerCase() === specialistFilter.toLowerCase()
      const matchesUnit = unitFilter === 'todos' || p.unit.toLowerCase() === unitFilter.toLowerCase()
      const matchesPriority = priorityFilter === 'todos' || p.priority.toLowerCase() === priorityFilter.toLowerCase()
      const matchesPreferencia = preferenciaFilter === 'todos' || (p.preferenciaHorario || '').toLowerCase() === preferenciaFilter.toLowerCase()

      return matchesSearch && matchesSpecialist && matchesUnit && matchesPriority && matchesPreferencia
    })
  }, [searchTerm, patients, specialistFilter, unitFilter, priorityFilter, preferenciaFilter])

  const stats = useMemo(() => {
    const total = patients.length
    const highPriority = patients.filter((p) => p.priority === 'Alta').length
    const avgWaitTime = 0
    return { total, highPriority, avgWaitTime }
  }, [patients])

  const unitOptions = useMemo(
    () => Array.from(new Set(patients.map((item) => item.unit).filter(Boolean))).sort(),
    [patients],
  )
  const resetForm = () => {
    setSelectedItemId(null)
    setPatientId('')
    setPriority('Média')
    setEspecialistaId('')
    setProcedimentoId('')
    setPreferenciaHorario('Qualquer horário')
    setObservacoes('')
  }

  const handleCreate = () => {
    resetForm()
    setIsFormOpen(true)
  }

  const handleEdit = (itemId: string) => {
    const item = patients.find((patient) => patient.id === itemId)
    if (!item) return
    setSelectedItemId(item.id)
    setPatientId(item.pacienteId || '')
    setPriority(item.priority || 'Média')
    setEspecialistaId(item.specialistId || '')
    setProcedimentoId(item.procedureId || '')
    setPreferenciaHorario(item.preferenciaHorario || 'Qualquer horário')
    setObservacoes(item.observacoes || '')
    setIsFormOpen(true)
  }

  const handleDelete = (itemId: string) => {
    setSelectedItemId(itemId)
    setIsDeleteOpen(true)
  }

  const handleSave = async () => {
    if (!patientId || !priority) return

    if (selectedItemId) {
      await updateItem({
        id: selectedItemId,
        pacienteId: patientId,
        prioridade: priority,
        especialistaId: especialistaId || undefined,
        procedimentoId: procedimentoId || undefined,
        preferenciaHorario: preferenciaHorario || undefined,
        observacoes: observacoes || undefined,
      })
      toast.success('Item da lista de espera atualizado com sucesso.')
    } else {
      await createItem({
        pacienteId: patientId,
        prioridade: priority,
        especialistaId: especialistaId || undefined,
        procedimentoId: procedimentoId || undefined,
        preferenciaHorario: preferenciaHorario || undefined,
        observacoes: observacoes || undefined,
      })
      toast.success('Paciente adicionado à lista de espera.')
    }

    setIsFormOpen(false)
    resetForm()
  }

  const confirmDelete = async () => {
    if (!selectedItemId) return
    await deleteItem(selectedItemId)
    toast.success('Paciente removido da lista de espera.')
    setIsDeleteOpen(false)
    resetForm()
  }

  const renderAcoes = (patient: (typeof filteredPatients)[number]) => (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" aria-label="Ações" className="p-2 hover:bg-app-bg-secondary dark:hover:bg-app-hover rounded-lg transition-all text-app-text-muted">
                            <MoreVertical size={20} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 p-1 rounded-xl shadow-xl border-app-border dark:border-app-border-dark dark:bg-app-bg-dark">
                          <DropdownMenuItem
                            className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-app-bg-secondary dark:hover:bg-app-hover"
                            onClick={async () => {
                              toast.success(`Abrindo agenda para atendimento de ${patient.name}.`)
                              const params = new URLSearchParams({
                                modal: 'novo',
                                patientId: patient.pacienteId || '',
                              })
                              if (patient.specialistId) {
                                params.set('profissionalId', patient.specialistId)
                              } else if (patient.specialist) {
                                params.set('profissional', patient.specialist)
                              }
                              if (patient.procedureId) params.set('procedimentoId', patient.procedureId)
                              try {
                                await deleteItem(patient.id)
                              } catch {
                                // segue para agenda mesmo se a remoção da fila falhar
                              }
                              router.push(`/agenda?${params.toString()}`)
                            }}
                          >
                            <CheckCircle size={16} className="text-[var(--app-success-text)]" />
                            <span className="text-sm font-normal text-app-text-secondary dark:text-white/60">Agendar</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-app-bg-secondary dark:hover:bg-app-hover"
                            onClick={() => handleEdit(patient.id)}
                          >
                            <Edit2 size={16} className="text-app-text-secondary dark:text-white/60" />
                            <span className="text-sm font-normal text-app-text-secondary dark:text-white/60">Editar</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:app-status-danger dark:hover:bg-red-900/10 text-[var(--app-danger-text)]"
                            onClick={() => handleDelete(patient.id)}
                          >
                            <Trash2 size={16} />
                            <span className="text-sm font-normal">Remover</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
  )

  return (
    <div className="app-page max-w-full mx-auto pb-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm border-app-border dark:border-app-border-dark">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-sm font-normal text-app-text-secondary dark:text-white/60">Total na espera</span>
              <h2 className="text-2xl font-normal text-app-text-primary dark:text-white">{stats.total}</h2>
              <p className="text-xs text-app-text-muted font-normal">Pacientes aguardando</p>
            </div>
            <div>
              <Users size={28} className="text-app-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-app-border dark:border-app-border-dark">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-sm font-normal text-app-text-secondary dark:text-white/60">Alta prioridade</span>
              <h2 className="text-2xl font-normal text-app-text-primary dark:text-white">{stats.highPriority}</h2>
              <p className="text-xs text-app-text-muted font-normal">Casos urgentes</p>
            </div>
            <div>
              <Clock size={28} className="text-[var(--app-danger-text)]" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-app-border dark:border-app-border-dark">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-sm font-normal text-app-text-secondary dark:text-white/60">Tempo médio</span>
              <h2 className="text-2xl font-normal text-app-text-primary dark:text-white">{stats.avgWaitTime} dias</h2>
              <p className="text-xs text-app-text-muted font-normal">Tempo de espera</p>
            </div>
            <div>
              <Calendar size={28} className="text-[var(--app-info-text)]" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
        <div className="relative w-full lg:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-app-text-muted" />
          <Input
            placeholder="Buscar por paciente, especialista..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-10 h-11 bg-app-card dark:bg-app-card-dark border-app-border dark:border-app-border-dark rounded-xl font-normal focus-visible:ring-[var(--app-primary)] focus-visible:border-[var(--app-primary)]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 w-full lg:w-auto">
          <Select value={specialistFilter} onValueChange={setSpecialistFilter}>
                    <SelectTrigger className="w-full lg:w-[180px] h-11 text-xs px-4 rounded-xl border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark focus:ring-[var(--app-primary)] focus:border-[var(--app-primary)]">
                      <SelectValue preferPlaceholder placeholder="Especialista" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os especialistas</SelectItem>
                      {specialists.map((item) => (
                        <SelectItem key={item} value={item.toLowerCase()}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

          <Select value={unitFilter} onValueChange={setUnitFilter}>
            <SelectTrigger className="w-full lg:w-[150px] h-11 text-xs px-4 rounded-xl border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark focus:ring-[var(--app-primary)] focus:border-[var(--app-primary)]">
              <SelectValue preferPlaceholder placeholder="Unidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as unidades</SelectItem>
              {unitOptions.map((unit) => (
                <SelectItem key={unit} value={unit.toLowerCase()}>
                  {unit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-full lg:w-[150px] h-11 text-xs px-4 rounded-xl border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark focus:ring-[var(--app-primary)] focus:border-[var(--app-primary)]">
              <SelectValue preferPlaceholder placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as prioridades</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="média">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>

          <Select value={preferenciaFilter} onValueChange={setPreferenciaFilter}>
            <SelectTrigger className="w-full lg:w-[170px] h-11 text-xs px-4 rounded-xl border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark focus:ring-[var(--app-primary)] focus:border-[var(--app-primary)]">
              <SelectValue preferPlaceholder placeholder="Preferência" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas preferências</SelectItem>
              <SelectItem value="manhã">Manhã</SelectItem>
              <SelectItem value="tarde">Tarde</SelectItem>
              <SelectItem value="final do dia">Final do dia</SelectItem>
            </SelectContent>
          </Select>
        </div>

      </div>

      {error && <p className="text-sm text-[var(--app-danger-text)]">{error}</p>}

      <div className="bg-app-card dark:bg-app-card-dark rounded-xl border border-app-border dark:border-app-border-dark shadow-sm overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-app-border px-6 py-4 dark:border-app-border-dark sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-normal text-app-text-primary dark:text-white">Pacientes em espera</h3>
            <p className="text-sm font-normal text-app-text-secondary dark:text-white/60">
              Gerencie a fila e inicie agendamentos quando houver disponibilidade.
            </p>
          </div>
          <Button
            onClick={handleCreate}
            className="h-10 rounded-xl bg-app-primary hover:bg-app-primary-hover px-4 text-white font-normal flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Adicionar paciente
          </Button>
        </div>

        {isLoading ? (
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-transparent hover:bg-transparent border-b border-app-border dark:border-app-border-dark">
                  <TableHead className="px-6 py-4 text-xs font-normal text-app-text-secondary dark:text-white/60 uppercase tracking-wide whitespace-nowrap">Paciente</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-normal text-app-text-secondary dark:text-white/60 uppercase tracking-wide whitespace-nowrap">Contato</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-normal text-app-text-secondary dark:text-white/60 uppercase tracking-wide whitespace-nowrap">Especialista</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-normal text-app-text-secondary dark:text-white/60 uppercase tracking-wide whitespace-nowrap">Procedimento</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-normal text-app-text-secondary dark:text-white/60 uppercase tracking-wide whitespace-nowrap">Unidade</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-normal text-app-text-secondary dark:text-white/60 uppercase tracking-wide whitespace-nowrap">Tempo de espera</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-normal text-app-text-secondary dark:text-white/60 uppercase tracking-wide whitespace-nowrap">Preferência</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-normal text-app-text-secondary dark:text-white/60 uppercase tracking-wide whitespace-nowrap">Prioridade</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-normal text-app-text-secondary dark:text-white/60 uppercase tracking-wide text-right whitespace-nowrap">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center text-app-text-secondary dark:text-white/60">Carregando lista de espera...</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        ) : (
          <>
          <ListaCartoesMobile>
            {filteredPatients.map((patient) => (
              <CartaoMobile
                key={patient.id}
                titulo={patient.name}
                subtitulo={[patient.procedure, patient.specialist].filter(Boolean).join(' · ')}
                selo={<div className="flex flex-wrap items-center gap-2">{getPriorityBadge(patient.priority)}{getPreferenciaHorarioBadge(patient.preferenciaHorario)}</div>}
                acoes={renderAcoes(patient)}
                campos={[
                  { rotulo: 'Contato', valor: patient.phone || '—' },
                  { rotulo: 'E-mail', valor: patient.email || '—' },
                  { rotulo: 'Tempo de espera', valor: patient.waitTime },
                  { rotulo: 'Unidade', valor: patient.unit || '—' },
                ]}
              />
            ))}
          </ListaCartoesMobile>
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-transparent hover:bg-transparent border-b border-app-border dark:border-app-border-dark">
                  <TableHead className="px-6 py-4 text-xs font-normal text-app-text-secondary dark:text-white/60 uppercase tracking-wide whitespace-nowrap">Paciente</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-normal text-app-text-secondary dark:text-white/60 uppercase tracking-wide whitespace-nowrap">Contato</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-normal text-app-text-secondary dark:text-white/60 uppercase tracking-wide whitespace-nowrap">Especialista</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-normal text-app-text-secondary dark:text-white/60 uppercase tracking-wide whitespace-nowrap">Procedimento</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-normal text-app-text-secondary dark:text-white/60 uppercase tracking-wide whitespace-nowrap">Unidade</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-normal text-app-text-secondary dark:text-white/60 uppercase tracking-wide whitespace-nowrap">Tempo de espera</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-normal text-app-text-secondary dark:text-white/60 uppercase tracking-wide whitespace-nowrap">Preferência</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-normal text-app-text-secondary dark:text-white/60 uppercase tracking-wide whitespace-nowrap">Prioridade</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-normal text-app-text-secondary dark:text-white/60 uppercase tracking-wide text-right whitespace-nowrap">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPatients.map((patient) => (
                  <TableRow key={patient.id} className="hover:bg-app-bg-secondary/50 dark:hover:bg-app-hover border-b border-app-border/50 dark:border-app-border-dark transition-colors">
                    <TableCell className="px-6 py-5">
                      <span className="font-normal text-app-text-primary dark:text-white whitespace-nowrap">{patient.name}</span>
                    </TableCell>
                    <TableCell className="px-6 py-5">
                      <div className="flex flex-col gap-1 text-xs text-app-text-secondary dark:text-white/60 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Phone size={12} />
                          {patient.phone}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs w-3 text-center">@</span>
                          {patient.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-5">
                      <span className="text-sm font-normal text-app-text-secondary dark:text-white/80 whitespace-nowrap">{patient.specialist}</span>
                    </TableCell>
                    <TableCell className="px-6 py-5">
                      <span className="text-sm text-app-text-secondary dark:text-white/60 whitespace-nowrap font-normal">{patient.procedure}</span>
                    </TableCell>
                    <TableCell className="px-6 py-5">
                      <span className="text-sm text-app-text-secondary dark:text-white/60 whitespace-nowrap font-normal">{patient.unit}</span>
                    </TableCell>
                    <TableCell className="px-6 py-5">
                      <div className="flex items-center gap-1.5 text-app-text-secondary dark:text-white/60 whitespace-nowrap">
                        <Clock size={14} />
                        <span className="text-sm">{patient.waitTime}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-5">
                      {getPreferenciaHorarioBadge(patient.preferenciaHorario)}
                    </TableCell>
                    <TableCell className="px-6 py-5">
                      {getPriorityBadge(patient.priority)}
                    </TableCell>
                    <TableCell className="px-6 py-5 text-right">
                      {renderAcoes(patient)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          </>
        )}
      </div>

      {!isLoading && filteredPatients.length === 0 && (
        <div className="text-center py-10 bg-app-card dark:bg-app-card-dark">
          <p className="text-app-text-muted dark:text-white/60">Nenhum paciente encontrado na fila de espera.</p>
        </div>
      )}

      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent size="lg" className="rounded-[24px]">
          <DialogHeader>
            <DialogTitle>{selectedItemId ? 'Editar item da lista de espera' : 'Adicionar paciente à lista de espera'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">Paciente</span>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Selecione o paciente" />
                </SelectTrigger>
                <SelectContent>
                  {pacientes.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">Prioridade</span>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Média">Média</SelectItem>
                  <SelectItem value="Baixa">Baixa</SelectItem>
                  <SelectItem value="Urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">Especialista</span>
              <Select
                value={especialistaId || 'sem-preferencia'}
                onValueChange={(value) => {
                  setEspecialistaId(value === 'sem-preferencia' ? '' : value)
                  setProcedimentoId('')
                }}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Selecione o especialista" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sem-preferencia">Sem preferência</SelectItem>
                  {especialistasOptions.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">Procedimento</span>
              <Select
                value={procedimentoId || 'nao-informado'}
                onValueChange={(value) => setProcedimentoId(value === 'nao-informado' ? '' : value)}
                disabled={!especialistaId}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue
                    placeholder={
                      especialistaId
                        ? 'Selecione o procedimento'
                        : 'Selecione o especialista primeiro'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao-informado">Não informado</SelectItem>
                  {procedimentosFiltrados.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {especialistaId && procedimentosFiltrados.length === 0 && (
                <p className="text-xs text-app-text-muted">
                  Nenhum procedimento vinculado a este especialista.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">Preferência de horário</span>
              <Select value={preferenciaHorario} onValueChange={setPreferenciaHorario}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Qualquer horário">Qualquer horário</SelectItem>
                  <SelectItem value="Manhã">Manhã</SelectItem>
                  <SelectItem value="Tarde">Tarde</SelectItem>
                  <SelectItem value="Final do dia">Final do dia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">Observações</span>
              <Textarea
                value={observacoes}
                onChange={(event) => setObservacoes(event.target.value)}
                className="min-h-[120px] rounded-xl"
                placeholder="Observações de atendimento e prioridade"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSave()} className="bg-app-primary hover:bg-app-primary-hover text-white">
              {selectedItemId ? 'Salvar alterações' : 'Adicionar paciente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="rounded-[24px]">
          <DialogHeader>
            <DialogTitle>Remover paciente da lista de espera</DialogTitle>
          </DialogHeader>
          <div className="rounded-xl border border-app-border p-4 text-sm text-app-text-secondary dark:border-app-border-dark dark:text-white/70">
            Confirme a remoção de {selectedItem?.name || 'este paciente'} da fila de espera.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void confirmDelete()} className="bg-[var(--app-danger-text)] hover:bg-[var(--app-danger-text)] text-white">
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
