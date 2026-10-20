'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { dentroDoPeriodo } from '@/features/tarefas/planner-utils'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Edit2,
  ExternalLink,
  FileText,
  Layers3,
  Loader2,
  Plus,
  Repeat,
  Trash2,
  Type,
  User,
  X,
} from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { DateInput } from '@/components/shared/date-input'
import { useTarefas, type TarefaItem } from '@/hooks/use-tarefas'
import { useUsuarios } from '@/hooks/use-usuarios'
import {
  formatDiasSemanaLabel,
  TAREFA_RECORRENCIA_LABELS,
  TAREFA_RECORRENCIA_VALUES,
  type TarefaRecorrencia,
} from '@/lib/tarefa-recorrencia'
import { DiasSemanaPicker } from '@/features/tarefas/components/dias-semana-picker'

interface TarefasModalProps {
  isOpen: boolean
  onClose: () => void
}

type FormData = {
  titulo: string
  descricao: string
  data: string
  horario: string
  prioridade: 'Alta' | 'Média' | 'Baixa'
  categoria: string
  responsavelId: string
  recorrencia: TarefaRecorrencia
  diasSemana: number[]
  alerta: boolean
}

const emptyForm: FormData = {
  titulo: '',
  descricao: '',
  data: '',
  horario: '',
  prioridade: 'Média',
  categoria: '',
  responsavelId: '',
  recorrencia: 'nenhuma',
  diasSemana: [],
  alerta: false,
}

function hojeLocalIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toPayload(formData: FormData, status: string) {
  return {
    titulo: formData.titulo.trim(),
    descricao: formData.descricao || undefined,
    data: formData.data || undefined,
    horario: formData.horario || undefined,
    prioridade: formData.prioridade,
    categoria: formData.categoria || undefined,
    responsavelId: formData.responsavelId || undefined,
    recorrencia: formData.recorrencia,
    diasSemana: formData.recorrencia === 'dias_especificos' ? formData.diasSemana : [],
    alerta: formData.alerta,
    status,
  }
}

export function TarefasModal({ isOpen, onClose }: TarefasModalProps) {
  const { data: tarefas, isLoading, error, createTarefa, updateTarefa, deleteTarefa } = useTarefas()
  const { data: usuarios } = useUsuarios()
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [tarefaEditando, setTarefaEditando] = useState<TarefaItem | null>(null)
  const [formData, setFormData] = useState<FormData>(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  // Abre sempre filtrado em hoje (data local do navegador).
  const user = useAuth((state) => state.user)
  const isGestao = ['master', 'admin', 'gestor'].includes(String(user?.role))
  const [escopo, setEscopo] = useState<'minhas' | 'time'>('minhas')
  const [filtroPessoa, setFiltroPessoa] = useState('todos')
  const [filtroDe, setFiltroDe] = useState(hojeLocalIso)
  const [filtroAte, setFiltroAte] = useState(hojeLocalIso)

  const resetForm = () => {
    setFormData(emptyForm)
    setTarefaEditando(null)
  }

  const handleClose = () => {
    resetForm()
    setFiltroDe(hojeLocalIso())
    setFiltroAte(hojeLocalIso())
    setEscopo('minhas')
    setFiltroPessoa('todos')
    setMostrarFormulario(false)
    onClose()
  }

  const handleCloseFormulario = () => {
    resetForm()
    setMostrarFormulario(false)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!formData.titulo.trim()) {
      toast.error('Título é obrigatório.')
      return
    }
    if (formData.recorrencia === 'dias_especificos' && formData.diasSemana.length === 0) {
      toast.error('Selecione ao menos um dia da semana.')
      return
    }

    setIsSaving(true)
    try {
      const payload = toPayload(formData, tarefaEditando?.status ?? 'Pendente')
      if (tarefaEditando) {
        await updateTarefa({ ...payload, id: tarefaEditando.id })
        toast.success('Tarefa atualizada.')
      } else {
        await createTarefa(payload)
        toast.success('Tarefa criada.')
      }
      resetForm()
      setMostrarFormulario(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar tarefa.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = (tarefa: TarefaItem) => {
    setTarefaEditando(tarefa)
    setFormData({
      titulo: tarefa.titulo,
      descricao: tarefa.descricao || '',
      data: tarefa.data || '',
      horario: tarefa.horario || '',
      prioridade: (tarefa.prioridade as FormData['prioridade']) || 'Média',
      categoria: tarefa.categoria || '',
      responsavelId: tarefa.responsavelId || '',
      recorrencia: (tarefa.recorrencia as TarefaRecorrencia) || 'nenhuma',
      diasSemana: tarefa.diasSemana || [],
      alerta: Boolean(tarefa.alerta),
    })
    setMostrarFormulario(true)
  }

  const handleToggleConcluir = async (tarefa: TarefaItem) => {
    try {
      const nextStatus = tarefa.status === 'Concluída' ? 'Pendente' : 'Concluída'
      await updateTarefa({
        id: tarefa.id,
        titulo: tarefa.titulo,
        descricao: tarefa.descricao || undefined,
        responsavelId: tarefa.responsavelId || undefined,
        responsavelNome: tarefa.responsavel || undefined,
        status: nextStatus,
        vencimentoEm: tarefa.vencimentoEm || undefined,
        data: tarefa.data || undefined,
        horario: tarefa.horario || undefined,
        recorrencia: tarefa.recorrencia || 'nenhuma',
        diasSemana: tarefa.diasSemana || [],
        alerta: Boolean(tarefa.alerta),
        prioridade: tarefa.prioridade || undefined,
        categoria: tarefa.categoria || undefined,
      })
      if (nextStatus === 'Concluída') {
        toast.success(
          tarefa.recorrencia && tarefa.recorrencia !== 'nenhuma'
            ? 'Tarefa concluída. Próxima ocorrência gerada.'
            : 'Tarefa concluída.',
        )
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar status.')
    }
  }

  const handleDelete = async (tarefa: TarefaItem) => {
    try {
      await deleteTarefa(tarefa.id)
      toast.success('Tarefa excluída.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir tarefa.')
    }
  }

  const tarefasAbertas = useMemo(
    () =>
      tarefas.filter(
        (item) =>
          item.status !== 'Concluída' &&
          item.status !== 'Cancelada' &&
          dentroDoPeriodo(item.data, filtroDe, filtroAte) &&
          (!isGestao ||
            (escopo === 'time'
              ? filtroPessoa === 'todos' || item.responsavelId === filtroPessoa
              : item.responsavelId === user?.id)),
      ),
    [tarefas, filtroDe, filtroAte, isGestao, escopo, filtroPessoa, user?.id],
  )

  const tarefasPendentes = tarefasAbertas.filter((item) => item.status === 'Pendente').length
  const tarefasEmAndamento = tarefasAbertas.filter((item) => item.status === 'Em andamento').length
  const tarefasComAlerta = tarefasAbertas.filter((item) => item.alerta).length

  const getPrioridadeBadge = (prioridade: string) => {
    switch (prioridade) {
      case 'Alta':
        return <Badge className="app-status-danger dark:bg-transparent text-[var(--app-danger-text)] dark:text-red-300 border-transparent dark:border-red-800 text-xs">Alta</Badge>
      case 'Média':
        return <Badge className="app-status-warning dark:bg-amber-900/30 text-[var(--app-warning-text)] dark:text-amber-300 border-transparent dark:border-amber-800 text-xs">Média</Badge>
      case 'Baixa':
        return <Badge className="app-status-info dark:bg-blue-900/30 text-[var(--app-info-text)] dark:text-[var(--app-info-text)] border-transparent text-xs">Baixa</Badge>
      default:
        return null
    }
  }

  return (
    <>
    <Dialog open={isOpen && !mostrarFormulario} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent size="xl" className="flex flex-col rounded-[24px] border-none bg-app-card p-0 shadow-2xl dark:bg-app-card-dark">
        <DialogHeader className="shrink-0 border-b border-app-border/60 bg-[linear-gradient(180deg,rgba(22,78,187,0.08),rgba(22,78,187,0.02))] px-6 pb-5 pt-6 dark:border-app-border-dark/60 dark:bg-[linear-gradient(180deg,rgba(59,130,246,0.12),rgba(59,130,246,0.02))]">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--app-primary)]/15 bg-white/80 shadow-sm dark:bg-app-bg-dark/60">
                <CheckCircle2 className="h-6 w-6 text-[var(--app-primary)]" />
              </div>
              <div>
                <DialogTitle className="text-xl font-normal text-app-text-primary dark:text-white">
                  Tarefas
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-app-text-secondary dark:text-white/65">
                  Concluídas somem daqui e ficam no relatório completo.
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" className="rounded-[12px]">
                <Link href="/tarefas/relatorio" onClick={handleClose}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Relatório
                </Link>
              </Button>
              <Button variant="ghost" size="icon" onClick={handleClose} className="rounded-full text-app-text-secondary hover:bg-app-bg-secondary dark:text-white/75 dark:hover:bg-app-hover">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 px-6 pt-5 md:grid-cols-3">
          <div className="rounded-[18px] border border-app-border/70 bg-white p-4 shadow-sm dark:border-app-border-dark/70 dark:bg-app-bg-dark/30">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-app-text-muted">Pendentes</p>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <p className="mt-3 text-3xl font-normal text-app-text-primary dark:text-white">{tarefasPendentes}</p>
          </div>
          <div className="rounded-[18px] border border-app-border/70 bg-white p-4 shadow-sm dark:border-app-border-dark/70 dark:bg-app-bg-dark/30">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-app-text-muted">Em andamento</p>
              <Layers3 className="h-4 w-4 text-[var(--app-primary)]" />
            </div>
            <p className="mt-3 text-3xl font-normal text-app-text-primary dark:text-white">{tarefasEmAndamento}</p>
          </div>
          <div className="rounded-[18px] border border-app-border/70 bg-white p-4 shadow-sm dark:border-app-border-dark/70 dark:bg-app-bg-dark/30">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-app-text-muted">Com alerta</p>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <p className="mt-3 text-3xl font-normal text-app-text-primary dark:text-white">{tarefasComAlerta}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {isGestao && (
              <select
                value={escopo}
                onChange={(event) => setEscopo(event.target.value as 'minhas' | 'time')}
                aria-label="Escopo das tarefas"
                className="h-10 rounded-[12px] border border-app-border bg-white px-3 text-sm dark:border-app-border-dark dark:bg-transparent"
              >
                <option value="minhas">Minhas tarefas</option>
                <option value="time">Tarefas do time</option>
              </select>
            )}
            {isGestao && escopo === 'time' && (
              <select
                value={filtroPessoa}
                onChange={(event) => setFiltroPessoa(event.target.value)}
                aria-label="Filtrar por pessoa do time"
                className="h-10 rounded-[12px] border border-app-border bg-white px-3 text-sm dark:border-app-border-dark dark:bg-transparent"
              >
                <option value="todos">Todo o time</option>
                {usuarios.filter((item) => item.perfil !== 'paciente').map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
            )}
            <span className="flex items-center gap-2">
              De
              <Input type="date" value={filtroDe} onChange={(event) => setFiltroDe(event.target.value)} className="h-10 w-[150px]" aria-label="Data inicial" />
            </span>
            <span className="flex items-center gap-2">
              Até
              <Input type="date" value={filtroAte} onChange={(event) => setFiltroAte(event.target.value)} className="h-10 w-[150px]" aria-label="Data final" />
            </span>
            {(filtroDe || filtroAte) && (
              <button type="button" className="underline" onClick={() => { setFiltroDe(''); setFiltroAte('') }}>
                Ver todas
              </button>
            )}
          </div>
          <Button className="h-11 rounded-[12px] bg-app-primary px-4 text-white shadow-sm hover:bg-app-primary-hover" onClick={() => setMostrarFormulario(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova tarefa
          </Button>
        </div>

        <div className="overflow-auto px-6 pb-6">
          {error && <p className="mb-3 text-sm text-[var(--app-danger-text)]">{error}</p>}
          <div className="overflow-hidden rounded-[18px] border border-app-border/70 bg-white shadow-sm dark:border-app-border-dark/70 dark:bg-app-bg-dark/20">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 px-6 py-14 text-sm text-app-text-secondary">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando tarefas...
              </div>
            ) : tarefasAbertas.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-app-bg-secondary dark:bg-app-hover">
                  <BarChart3 className="h-8 w-8 text-app-text-muted" />
                </div>
                <p className="mt-5 text-base text-app-text-primary dark:text-white">Nenhuma tarefa aberta.</p>
                <p className="mt-1 text-sm text-app-text-secondary dark:text-white/60">
                  Concluídas ficam apenas no relatório.
                </p>
              </div>
            ) : (
              tarefasAbertas.map((tarefa) => (
                <div key={tarefa.id} className="border-b border-app-border/70 px-5 py-4 last:border-b-0 dark:border-app-border-dark/70">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => void handleToggleConcluir(tarefa)}
                        className="mt-0.5 rounded-full"
                        title="Marcar como concluída"
                      >
                        <Circle className="h-5 w-5 text-app-text-muted" />
                      </button>
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-normal text-app-text-primary dark:text-white">{tarefa.titulo}</p>
                          {getPrioridadeBadge(tarefa.prioridade)}
                          {tarefa.alerta && (
                            <Badge className="app-status-warning border-transparent text-xs">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              Alerta
                            </Badge>
                          )}
                          {tarefa.recorrencia && tarefa.recorrencia !== 'nenhuma' && (
                            <Badge variant="outline" className="rounded-full text-xs">
                              <Repeat className="mr-1 h-3 w-3" />
                              {TAREFA_RECORRENCIA_LABELS[tarefa.recorrencia as TarefaRecorrencia] ?? tarefa.recorrencia}
                              {tarefa.recorrencia === 'dias_especificos' && tarefa.diasSemana?.length
                                ? ` (${formatDiasSemanaLabel(tarefa.diasSemana)})`
                                : ''}
                            </Badge>
                          )}
                          <Badge variant="outline" className="rounded-full text-xs">
                            {tarefa.status}
                          </Badge>
                        </div>
                        {tarefa.descricao && (
                          <p className="text-xs text-app-text-secondary dark:text-white/70">{tarefa.descricao}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-app-text-muted">
                          <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{tarefa.data || '-'}</span>
                          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{tarefa.horario || '-'}</span>
                          <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" />{tarefa.responsavel || '-'}</span>
                          <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{tarefa.categoria || '-'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="rounded-full hover:bg-app-bg-secondary dark:hover:bg-app-hover" onClick={() => handleEdit(tarefa)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="rounded-full hover:bg-red-50 dark:hover:bg-red-950/20" onClick={() => void handleDelete(tarefa)}>
                        <Trash2 className="h-4 w-4 text-[var(--app-danger-text)]" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isOpen && mostrarFormulario} onOpenChange={(open) => !open && handleCloseFormulario()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[24px] border-none bg-app-card p-0 shadow-2xl dark:bg-app-card-dark">
        <DialogHeader className="border-b border-app-border/60 bg-[linear-gradient(180deg,rgba(22,78,187,0.08),rgba(22,78,187,0.02))] px-6 pb-5 pt-6 dark:border-app-border-dark/60 dark:bg-[linear-gradient(180deg,rgba(59,130,246,0.12),rgba(59,130,246,0.02))]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-xl font-normal text-app-text-primary dark:text-white">
                {tarefaEditando ? 'Editar tarefa' : 'Nova tarefa'}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-app-text-secondary dark:text-white/60">
                Responsável, data, alerta e recorrência (semanal, diária, dias específicos…).
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 p-6">
          <div className="rounded-[16px] border border-app-border/60 bg-white/70 p-4 dark:border-app-border-dark/60 dark:bg-app-bg-dark/30">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-app-text-muted">
              <Type className="h-3.5 w-3.5" />
              Identificação
            </div>
            <div className="mt-4 grid gap-4">
              <div className="grid gap-2">
                <Label>Título</Label>
                <Input
                  value={formData.titulo}
                  onChange={(event) => setFormData({ ...formData, titulo: event.target.value })}
                  placeholder="Ex: Fazer café"
                  className="h-11 rounded-[12px] border-app-border/70 bg-white dark:border-app-border-dark/70 dark:bg-app-bg-dark/60"
                />
              </div>
              <div className="grid gap-2">
                <Label>Descrição</Label>
                <Textarea
                  value={formData.descricao}
                  onChange={(event) => setFormData({ ...formData, descricao: event.target.value })}
                  placeholder="Descrição opcional..."
                  className="min-h-[80px] rounded-[12px] border-app-border/70 bg-white dark:border-app-border-dark/70 dark:bg-app-bg-dark/60"
                />
              </div>
            </div>
          </div>

          <div className="rounded-[16px] border border-app-border/60 bg-white/70 p-4 dark:border-app-border-dark/60 dark:bg-app-bg-dark/30">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-app-text-muted">
              <Calendar className="h-3.5 w-3.5" />
              Agendamento
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Data</Label>
                <DateInput value={formData.data} onChange={(value) => setFormData({ ...formData, data: value })} className="h-11" />
              </div>
              <div className="grid gap-2">
                <Label>Horário</Label>
                <Input
                  type="time"
                  value={formData.horario}
                  onChange={(event) => setFormData({ ...formData, horario: event.target.value })}
                  className="h-11 rounded-[12px] border-app-border/70 bg-white dark:border-app-border-dark/70 dark:bg-app-bg-dark/60"
                />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label>Recorrência</Label>
                <Select
                  value={formData.recorrencia}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      recorrencia: value as TarefaRecorrencia,
                      diasSemana: value === 'dias_especificos' ? formData.diasSemana : [],
                    })
                  }
                >
                  <SelectTrigger className="h-11 rounded-[12px] border-app-border/70 bg-white dark:border-app-border-dark/70 dark:bg-app-bg-dark/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAREFA_RECORRENCIA_VALUES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {TAREFA_RECORRENCIA_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formData.recorrencia === 'dias_especificos' && (
                <div className="grid gap-2 md:col-span-2">
                  <Label>Dias da semana</Label>
                  <DiasSemanaPicker
                    value={formData.diasSemana}
                    onChange={(diasSemana) => setFormData({ ...formData, diasSemana })}
                  />
                </div>
              )}
              <div className="flex items-center gap-2 md:col-span-2">
                <input
                  id="tarefa-alerta"
                  type="checkbox"
                  checked={formData.alerta}
                  onChange={(event) => setFormData({ ...formData, alerta: event.target.checked })}
                  className="h-4 w-4 rounded border-app-border"
                />
                <Label htmlFor="tarefa-alerta" className="font-normal">
                  Exibir alerta / notificação na lista
                </Label>
              </div>
            </div>
          </div>

          <div className="rounded-[16px] border border-app-border/60 bg-white/70 p-4 dark:border-app-border-dark/60 dark:bg-app-bg-dark/30">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-app-text-muted">
              <User className="h-3.5 w-3.5" />
              Classificação
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="grid gap-2 md:col-span-2">
                <Label>Responsável</Label>
                <Select
                  value={formData.responsavelId || '__none__'}
                  onValueChange={(value) =>
                    setFormData({ ...formData, responsavelId: value === '__none__' ? '' : value })
                  }
                >
                  <SelectTrigger className="h-11 rounded-[12px] border-app-border/70 bg-white dark:border-app-border-dark/70 dark:bg-app-bg-dark/60">
                    <SelectValue placeholder="Selecione o responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem responsável</SelectItem>
                    {usuarios.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Prioridade</Label>
                <Select value={formData.prioridade} onValueChange={(value) => setFormData({ ...formData, prioridade: value as FormData['prioridade'] })}>
                  <SelectTrigger className="h-11 rounded-[12px] border-app-border/70 bg-white dark:border-app-border-dark/70 dark:bg-app-bg-dark/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Alta">Alta</SelectItem>
                    <SelectItem value="Média">Média</SelectItem>
                    <SelectItem value="Baixa">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Categoria / tag</Label>
                <Input
                  value={formData.categoria}
                  onChange={(event) => setFormData({ ...formData, categoria: event.target.value })}
                  placeholder="Ex: Rotina, comercial"
                  className="h-11 rounded-[12px] border-app-border/70 bg-white dark:border-app-border-dark/70 dark:bg-app-bg-dark/60"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-app-border/50 px-0 pt-2 dark:border-app-border-dark/50">
            <Button type="button" variant="outline" className="rounded-[12px]" onClick={handleCloseFormulario}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving} className="rounded-[12px] bg-app-primary text-white hover:bg-app-primary-hover">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tarefaEditando ? 'Salvar alterações' : 'Criar tarefa'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    </>
  )
}
