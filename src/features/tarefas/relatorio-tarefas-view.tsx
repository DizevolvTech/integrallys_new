'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'
import { useTarefas, type CreateTarefaPayload, type TarefaItem } from '@/hooks/use-tarefas'
import { useUsuarios } from '@/hooks/use-usuarios'
import {
  formatDiasSemanaLabel,
  TAREFA_RECORRENCIA_LABELS,
  TAREFA_RECORRENCIA_VALUES,
  type TarefaRecorrencia,
} from '@/lib/tarefa-recorrencia'
import { tarefaStatusLabel } from '@/lib/tarefa-status'
import { DiasSemanaPicker } from '@/features/tarefas/components/dias-semana-picker'
import { DateInput } from '@/components/shared/date-input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'

const STATUS_OPTIONS = ['Pendente', 'Em andamento', 'Concluída', 'Cancelada']

function statusTone(status: string) {
  const s = status.toLowerCase()
  if (s.includes('conclu')) return 'app-status-success'
  if (s.includes('andamento')) return 'app-status-info'
  if (s.includes('cancel')) return 'app-status-danger'
  return 'app-status-warning'
}

interface TarefaFormData {
  titulo: string
  descricao: string
  responsavelId: string
  status: string
  recorrencia: TarefaRecorrencia
  diasSemana: number[]
  alerta: boolean
  data: string
  horario: string
  prioridade: string
  categoria: string
  motivoCancelamento: string
}

const emptyForm: TarefaFormData = {
  titulo: '',
  descricao: '',
  responsavelId: '',
  status: 'Pendente',
  recorrencia: 'nenhuma',
  diasSemana: [],
  alerta: false,
  data: '',
  horario: '',
  prioridade: 'Média',
  categoria: '',
  motivoCancelamento: '',
}

export function RelatorioTarefasView() {
  const { data, isLoading, error, createTarefa, updateTarefa, deleteTarefa } = useTarefas()
  const { data: usuarios } = useUsuarios()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<TarefaItem | null>(null)
  const [form, setForm] = useState<TarefaFormData>(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState('todos')

  const stats = useMemo(() => {
    const abertas = data.filter((t) => t.status !== 'Concluída' && t.status !== 'Cancelada').length
    const concluidas = data.filter((t) => t.status === 'Concluída').length
    const pendentes = data.filter((t) => t.status === 'Pendente').length
    return { total: data.length, abertas, concluidas, pendentes }
  }, [data])

  const openCreate = () => {
    setEditingItem(null)
    setForm(emptyForm)
    setIsModalOpen(true)
  }

  const openEdit = (item: TarefaItem) => {
    setEditingItem(item)
    setForm({
      titulo: item.titulo,
      descricao: item.descricao || '',
      responsavelId: item.responsavelId || '',
      status: item.status,
      recorrencia: (item.recorrencia as TarefaRecorrencia) || 'nenhuma',
      diasSemana: item.diasSemana || [],
      alerta: Boolean(item.alerta),
      data: item.data || '',
      horario: item.horario || '',
      prioridade: item.prioridade || 'Média',
      categoria: item.categoria || '',
      motivoCancelamento: item.motivoCancelamento || '',
    })
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.titulo.trim()) {
      toast.error('Título é obrigatório.')
      return
    }
    if (form.recorrencia === 'dias_especificos' && form.diasSemana.length === 0) {
      toast.error('Selecione ao menos um dia da semana.')
      return
    }
    if (form.status === 'Cancelada' && !form.motivoCancelamento.trim()) {
      toast.error('Informe o motivo do cancelamento.')
      return
    }
    setIsSaving(true)
    try {
      const payload: CreateTarefaPayload = {
        titulo: form.titulo,
        descricao: form.descricao || undefined,
        responsavelId: form.responsavelId || undefined,
        status: form.status,
        recorrencia: form.recorrencia,
        diasSemana: form.recorrencia === 'dias_especificos' ? form.diasSemana : [],
        alerta: form.alerta,
        data: form.data || undefined,
        horario: form.horario || undefined,
        prioridade: form.prioridade || undefined,
        categoria: form.categoria || undefined,
        motivoCancelamento: form.status === 'Cancelada' ? form.motivoCancelamento.trim() : undefined,
      }
      if (editingItem) {
        await updateTarefa({ ...payload, id: editingItem.id })
        toast.success('Tarefa atualizada.')
      } else {
        await createTarefa(payload)
        toast.success('Tarefa criada.')
      }
      setIsModalOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar tarefa.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (item: TarefaItem) => {
    try {
      await deleteTarefa(item.id)
      toast.success('Tarefa excluída.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir tarefa.')
    }
  }

  const handleQuickStatus = async (item: TarefaItem, newStatus: string) => {
    try {
      await updateTarefa({
        id: item.id,
        titulo: item.titulo,
        descricao: item.descricao || undefined,
        responsavelNome: item.responsavel,
        responsavelId: item.responsavelId || undefined,
        status: newStatus,
        recorrencia: item.recorrencia || 'nenhuma',
        diasSemana: item.diasSemana || [],
        alerta: Boolean(item.alerta),
        vencimentoEm: item.vencimentoEm || undefined,
        prioridade: item.prioridade || undefined,
        categoria: item.categoria || undefined,
      })
      toast.success(
        newStatus === 'Concluída' && item.recorrencia && item.recorrencia !== 'nenhuma'
          ? 'Concluída. As próximas ocorrências seguem na agenda.'
          : `Status alterado para ${newStatus}.`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar status.')
    }
  }

  const filtered = filterStatus === 'todos' ? data : data.filter((item) => item.status === filterStatus)

  return (
    <div className="app-page">
      <PageHeader
        title="Relatório de Tarefas"
        description="Histórico completo: abertas e concluídas. A lista da agenda oculta as concluídas."
        actions={
          <>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{tarefaStatusLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={openCreate} className="text-white">
              <Plus className="mr-2 h-4 w-4" />
              Nova tarefa
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Card className="rounded-[16px] border-app-border dark:border-app-border-dark">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-app-text-muted">Total</p>
            <p className="mt-2 text-2xl text-app-text-primary dark:text-white">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="rounded-[16px] border-app-border dark:border-app-border-dark">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-app-text-muted">Abertas</p>
            <p className="mt-2 text-2xl text-app-text-primary dark:text-white">{stats.abertas}</p>
          </CardContent>
        </Card>
        <Card className="rounded-[16px] border-app-border dark:border-app-border-dark">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-app-text-muted">Pendentes</p>
            <p className="mt-2 text-2xl text-app-text-primary dark:text-white">{stats.pendentes}</p>
          </CardContent>
        </Card>
        <Card className="rounded-[16px] border-app-border dark:border-app-border-dark">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-app-text-muted">Concluídas</p>
            <p className="mt-2 text-2xl text-app-text-primary dark:text-white">{stats.concluidas}</p>
          </CardContent>
        </Card>
      </div>

      {error && <p className="text-sm text-[var(--app-danger-text)]">{error}</p>}
      {isLoading && <p className="text-app-text-secondary">Carregando tarefas...</p>}
      {!isLoading && filtered.length === 0 && <p className="text-app-text-secondary">Nenhuma tarefa encontrada.</p>}

      <div className="space-y-3">
        {filtered.map((item) => (
          <Card key={item.id} className="rounded-[16px] border-app-border dark:border-app-border-dark">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-app-text-primary dark:text-white">{item.titulo}</p>
                  {item.alerta && (
                    <Badge className="app-status-warning border-none text-xs">
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      Alerta
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-app-text-secondary">
                  {item.status === 'Cancelada' && item.motivoCancelamento ? `Motivo: ${item.motivoCancelamento} · ` : ''}
                  {item.responsavel || 'Sem responsável'}
                  {item.data ? ` · ${item.data}` : ''}
                  {item.horario ? ` ${item.horario}` : ''}
                  {item.recorrencia && item.recorrencia !== 'nenhuma'
                    ? ` · ${TAREFA_RECORRENCIA_LABELS[item.recorrencia as TarefaRecorrencia] ?? item.recorrencia}`
                    : ''}
                  {item.recorrencia === 'dias_especificos' && item.diasSemana?.length
                    ? ` (${formatDiasSemanaLabel(item.diasSemana)})`
                    : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge className={`${statusTone(item.status)} border-none text-xs`}>{tarefaStatusLabel(item.status)}</Badge>
                {item.status !== 'Concluída' && (
                  <Button variant="ghost" size="icon" title="Marcar como concluída" onClick={() => void handleQuickStatus(item, 'Concluída')}>
                    <CheckCircle2 className="h-4 w-4 text-[var(--app-success-text)]" />
                  </Button>
                )}
                {item.status === 'Concluída' && (
                  <Button variant="ghost" size="icon" title="Reabrir" onClick={() => void handleQuickStatus(item, 'Pendente')}>
                    <Clock className="h-4 w-4 text-[var(--app-warning-text)]" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(item)}>
                  <Edit className="h-4 w-4 text-app-text-secondary" />
                </Button>
                <Button variant="ghost" size="icon" title="Excluir" onClick={() => void handleDelete(item)}>
                  <Trash2 className="h-4 w-4 text-[var(--app-danger-text)]" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar tarefa' : 'Nova tarefa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Título da tarefa" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Opcional" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data</Label>
                <DateInput value={form.data} onChange={(value) => setForm({ ...form, data: value })} />
              </div>
              <div className="space-y-2">
                <Label>Horário</Label>
                <Input type="time" value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select
                value={form.responsavelId || '__none__'}
                onValueChange={(v) => setForm({ ...form, responsavelId: v === '__none__' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem responsável</SelectItem>
                  {usuarios.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Recorrência</Label>
              <Select
                value={form.recorrencia}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    recorrencia: v as TarefaRecorrencia,
                    diasSemana: v === 'dias_especificos' ? form.diasSemana : [],
                  })
                }
              >
                <SelectTrigger>
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
            {form.recorrencia === 'dias_especificos' && (
              <div className="space-y-2">
                <Label>Dias da semana</Label>
                <DiasSemanaPicker
                  value={form.diasSemana}
                  onChange={(diasSemana) => setForm({ ...form, diasSemana })}
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                id="relatorio-tarefa-alerta"
                type="checkbox"
                checked={form.alerta}
                onChange={(e) => setForm({ ...form, alerta: e.target.checked })}
                className="h-4 w-4 rounded border-app-border"
              />
              <Label htmlFor="relatorio-tarefa-alerta" className="font-normal">
                Exibir alerta
              </Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Alta">Alta</SelectItem>
                    <SelectItem value="Média">Média</SelectItem>
                    <SelectItem value="Baixa">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{tarefaStatusLabel(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.status === 'Cancelada' && (
                <Textarea
                  value={form.motivoCancelamento}
                  onChange={(e) => setForm({ ...form, motivoCancelamento: e.target.value })}
                  rows={2}
                  placeholder="Motivo do cancelamento (obrigatório)"
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleSave()} disabled={isSaving} className="text-white">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingItem ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
