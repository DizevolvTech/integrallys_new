'use client'

import { useEffect, useMemo, useState } from 'react'
import { Clock3, Moon, Sun, Sunset, Users } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useListaEspera } from '@/hooks/use-lista-espera'

interface PacienteOption {
  id: string
  nome: string
}

export interface ListaEsperaModalSavePayload {
  pacienteId: string
  prioridade: string
  procedimentoId: string
  especialistaId: string
  observacoes: string
}

interface ListaEsperaModalProps {
  isOpen: boolean
  onClose: () => void
  patients?: PacienteOption[]
  onSave?: (payload: ListaEsperaModalSavePayload) => Promise<void> | void
}

const formatBRL = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function getPriorityBadge(priority: string) {
  switch (priority) {
    case 'Alta':
      return (
        <Badge className="bg-[var(--app-danger-text)] dark:bg-red-900/60 text-white dark:text-[var(--app-danger-text)] border-none shadow-sm font-normal rounded-full px-3 py-0.5 text-xs">
          Alta
        </Badge>
      )
    case 'Média':
      return (
        <Badge className="bg-[var(--app-warning-text)] dark:bg-amber-900/60 text-white dark:text-[var(--app-warning-text)] border-none shadow-sm font-normal rounded-full px-3 py-0.5 text-xs">
          Média
        </Badge>
      )
    case 'Baixa':
      return (
        <Badge className="bg-[var(--app-success-text)] dark:bg-emerald-900/60 text-white dark:text-[var(--app-success-text)] border-none shadow-sm font-normal rounded-full px-3 py-0.5 text-xs">
          Baixa
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="rounded-full px-3 py-0.5 text-xs font-normal text-app-text-secondary dark:text-white/60 border-app-border dark:border-app-border-dark">
          {priority || '-'}
        </Badge>
      )
  }
}

function getPreferenciaIcon(preferencia: string | undefined) {
  if (!preferencia) return null
  switch (preferencia) {
    case 'Manhã':
      return <Sun className="h-3.5 w-3.5 text-[var(--app-warning-text)]" />
    case 'Tarde':
      return <Sunset className="h-3.5 w-3.5 text-[var(--app-warning-text)]" />
    case 'Final do dia':
      return <Moon className="h-3.5 w-3.5 text-indigo-500" />
    default:
      return null
  }
}

export function ListaEsperaModal({ isOpen, onClose, patients = [], onSave }: ListaEsperaModalProps) {
  const {
    data,
    isLoading,
    error,
    load,
    createItem,
    procedimentosOptions,
    especialistasOptions,
  } = useListaEspera()

  const [tab, setTab] = useState<'add' | 'queue'>('add')
  const [pacienteId, setPacienteId] = useState('')
  const [prioridade, setPrioridade] = useState('media')
  const [procedimentoId, setProcedimentoId] = useState('')
  const [especialistaId, setEspecialistaId] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setTab('add')
    setSubmitAttempted(false)
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const selectedEspecialista = useMemo(
    () => especialistasOptions.find((option) => option.id === especialistaId) ?? null,
    [especialistasOptions, especialistaId],
  )

  const procedimentosFiltrados = useMemo(() => {
    if (!especialistaId) return []
    const allowed = new Set(selectedEspecialista?.procedimentoIds ?? [])
    if (allowed.size === 0) return []
    return procedimentosOptions.filter((option) => allowed.has(option.id))
  }, [especialistaId, selectedEspecialista, procedimentosOptions])

  useEffect(() => {
    if (!procedimentoId) return
    if (!procedimentosFiltrados.some((option) => option.id === procedimentoId)) {
      setProcedimentoId('')
    }
  }, [procedimentosFiltrados, procedimentoId])

  const selectedProcedimento = useMemo(
    () => procedimentosFiltrados.find((option) => option.id === procedimentoId) ?? null,
    [procedimentosFiltrados, procedimentoId],
  )

  const prioridadeLabel =
    prioridade === 'media' ? 'Média' : prioridade === 'alta' ? 'Alta' : 'Baixa'

  const isMissingProcedimento = !procedimentoId
  const isMissingEspecialista = !especialistaId

  const resetForm = () => {
    setPacienteId('')
    setPrioridade('media')
    setProcedimentoId('')
    setEspecialistaId('')
    setObservacoes('')
    setSubmitAttempted(false)
  }

  const handleSave = async () => {
    setSubmitAttempted(true)
    if (!pacienteId || isMissingProcedimento || isMissingEspecialista) return

    setIsSubmitting(true)
    try {
      const payload: ListaEsperaModalSavePayload = {
        pacienteId,
        prioridade: prioridadeLabel,
        procedimentoId,
        especialistaId,
        observacoes,
      }

      if (onSave) {
        await onSave(payload)
      } else {
        await createItem({
          pacienteId,
          prioridade: prioridadeLabel,
          procedimentoId,
          especialistaId,
          observacoes: observacoes || undefined,
        })
      }
      resetForm()
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="lg" className="bg-app-card dark:bg-app-card-dark">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-normal">
            <Clock3 className="h-5 w-5 text-[var(--app-primary)]" />
            Lista de Espera
          </DialogTitle>
          <DialogDescription>
            Adicione pacientes à fila ou consulte quem está aguardando atendimento.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2">
          <Tabs value={tab} onValueChange={(value) => setTab(value as 'add' | 'queue')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="add">Adicionar</TabsTrigger>
              <TabsTrigger value="queue" className="gap-2">
                <Users className="h-4 w-4" />
                Na fila
                {!isLoading && (
                  <span className="ml-1 rounded-full bg-app-bg-secondary px-2 py-0.5 text-xs font-medium text-app-text-secondary dark:bg-app-hover dark:text-white/70">
                    {data.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="add" className="space-y-4">
              <div className="space-y-2">
                <Label className="font-normal">Paciente</Label>
                <Select value={pacienteId} onValueChange={setPacienteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o paciente" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.length === 0 && (
                      <SelectItem value="__empty_patients" disabled>
                        Nenhum paciente disponível
                      </SelectItem>
                    )}
                    {patients.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {submitAttempted && !pacienteId && (
                  <p className="text-xs text-[var(--app-danger-text)]">Selecione um paciente.</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="font-normal">Especialista</Label>
                  <Select
                    value={especialistaId}
                    onValueChange={(value) => {
                      setEspecialistaId(value)
                      setProcedimentoId('')
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o especialista" />
                    </SelectTrigger>
                    <SelectContent>
                      {especialistasOptions.length === 0 && (
                        <SelectItem value="__empty_especialistas" disabled>
                          Nenhum especialista ativo
                        </SelectItem>
                      )}
                      {especialistasOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {submitAttempted && isMissingEspecialista && (
                    <p className="text-xs text-[var(--app-danger-text)]">
                      Selecione um especialista.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="font-normal">Procedimento</Label>
                  <Select
                    value={procedimentoId}
                    onValueChange={setProcedimentoId}
                    disabled={!especialistaId}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          especialistaId
                            ? 'Selecione o procedimento'
                            : 'Selecione o especialista primeiro'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {procedimentosFiltrados.length === 0 && (
                        <SelectItem value="__empty_procedimentos" disabled>
                          {especialistaId
                            ? 'Nenhum procedimento vinculado a este especialista'
                            : 'Selecione o especialista primeiro'}
                        </SelectItem>
                      )}
                      {procedimentosFiltrados.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedProcedimento && (
                    <p className="text-xs text-app-text-secondary dark:text-white/60">
                      Valor:{' '}
                      <span className="font-medium text-app-text-primary dark:text-white">
                        {selectedProcedimento.valor != null
                          ? formatBRL(selectedProcedimento.valor)
                          : 'não informado'}
                      </span>
                    </p>
                  )}
                  {submitAttempted && isMissingProcedimento && (
                    <p className="text-xs text-[var(--app-danger-text)]">
                      Selecione um procedimento.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-normal">Prioridade</Label>
                  <Select value={prioridade} onValueChange={setPrioridade}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="baixa">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-normal">Melhor horário</Label>
                  <Input type="time" disabled />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-normal">Observações</Label>
                <Input
                  value={observacoes}
                  onChange={(event) => setObservacoes(event.target.value)}
                  placeholder="Ex: prefere período da tarde"
                />
              </div>
            </TabsContent>

            <TabsContent value="queue">
              {error && (
                <p className="rounded-lg border border-[var(--app-danger-text)]/30 bg-red-50 px-3 py-2 text-xs text-[var(--app-danger-text)] dark:bg-red-900/20">
                  {error}
                </p>
              )}

              {isLoading ? (
                <div className="py-10 text-center text-sm text-app-text-secondary dark:text-white/60">
                  Carregando lista de espera...
                </div>
              ) : data.length === 0 ? (
                <div className="py-10 text-center text-sm text-app-text-secondary dark:text-white/60">
                  Nenhum paciente na fila no momento.
                </div>
              ) : (
                <ul className="max-h-[420px] divide-y divide-app-border overflow-y-auto rounded-xl border border-app-border dark:divide-app-border-dark dark:border-app-border-dark">
                  {data.map((item) => {
                    const preferenciaIcon = getPreferenciaIcon(item.preferenciaHorario)
                    return (
                      <li
                        key={item.id}
                        className="flex items-start justify-between gap-3 px-4 py-3"
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-app-text-primary dark:text-white">
                              {item.paciente || 'Paciente sem nome'}
                            </span>
                            {getPriorityBadge(item.prioridade)}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-app-text-secondary dark:text-white/60">
                            {item.procedimento && (
                              <span>
                                Procedimento:{' '}
                                <span className="text-app-text-primary dark:text-white/80">
                                  {item.procedimento}
                                </span>
                                {item.procedimentoValor != null && (
                                  <span className="ml-1 text-app-text-primary dark:text-white/80">
                                    · {formatBRL(item.procedimentoValor)}
                                  </span>
                                )}
                              </span>
                            )}
                            {item.especialista && (
                              <span>
                                Especialista:{' '}
                                <span className="text-app-text-primary dark:text-white/80">
                                  {item.especialista}
                                </span>
                              </span>
                            )}
                            {item.preferenciaHorario && (
                              <span className="flex items-center gap-1">
                                {preferenciaIcon}
                                {item.preferenciaHorario}
                              </span>
                            )}
                          </div>
                          {item.observacoes && (
                            <p className="text-xs text-app-text-muted dark:text-white/40">
                              {item.observacoes}
                            </p>
                          )}
                        </div>
                        <span className="whitespace-nowrap text-xs text-app-text-muted dark:text-white/40">
                          {item.entradaEm}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {tab === 'add' && (
          <DialogFooter className="gap-3 sm:gap-0">
            <Button
              variant="outline"
              onClick={onClose}
              className="h-11 w-full rounded-integrallys px-6 sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={isSubmitting}
              className="h-11 w-full rounded-integrallys bg-app-primary px-8 font-normal text-white shadow-sm hover:bg-app-primary-hover sm:w-auto"
            >
              {isSubmitting ? 'Adicionando...' : 'Adicionar à fila'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
