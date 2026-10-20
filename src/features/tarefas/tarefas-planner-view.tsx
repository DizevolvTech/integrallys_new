// biome-ignore-all lint/a11y/useSemanticElements: arrastar-e-soltar exige contêineres genéricos (zonas de soltar e cartão arrastável)
'use client'
import { createContext, useContext, useMemo, useState, type DragEvent } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Check, ChevronLeft, ChevronRight, Plus, Repeat, Trash2 } from 'lucide-react'
import { DateInput } from '@/components/shared/date-input'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/use-auth'
import { useTarefas, type CreateTarefaPayload, type TarefaItem } from '@/hooks/use-tarefas'
import { useUsuarios } from '@/hooks/use-usuarios'
import {
  TAREFA_RECORRENCIA_LABELS,
  TAREFA_RECORRENCIA_VALUES,
  type TarefaRecorrencia,
} from '@/lib/tarefa-recorrencia'
import { DiasSemanaPicker } from './components/dias-semana-picker'
import {
  addDays,
  applyFilters,
  buildMonthGrid,
  buildWeekDays,
  groupEntrada,
  isOpen,
  parseDateKey,
  sortTarefas,
  toDateKey,
  type PlannerFilters,
  type PlannerView,
} from './planner-utils'

const VIEWS: Array<{ value: PlannerView; label: string }> = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'dia', label: 'Dia' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mês' },
]

const HOURS = Array.from({ length: 17 }, (_, index) => index + 6) // 06h–22h
const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const PRIORIDADE_DOT: Record<string, string> = {
  Alta: 'bg-red-500',
  Média: 'bg-amber-400',
  Baixa: 'bg-emerald-500',
}

interface FormState {
  titulo: string
  descricao: string
  data: string
  horario: string
  prioridade: string
  categoria: string
  recorrencia: TarefaRecorrencia
  diasSemana: number[]
  alerta: boolean
  responsavelId: string
  status: string
}

const emptyForm: FormState = {
  titulo: '',
  descricao: '',
  data: '',
  horario: '',
  prioridade: 'Média',
  categoria: '',
  recorrencia: 'nenhuma',
  diasSemana: [],
  alerta: false,
  responsavelId: '',
  status: 'Pendente',
}

function toPayload(tarefa: TarefaItem, overrides: Partial<CreateTarefaPayload> = {}): CreateTarefaPayload & { id: string } {
  return {
    id: tarefa.id,
    titulo: tarefa.titulo,
    descricao: tarefa.descricao || undefined,
    responsavelId: tarefa.responsavelId || undefined,
    status: tarefa.status,
    data: tarefa.data || undefined,
    horario: tarefa.horario || undefined,
    recorrencia: tarefa.recorrencia || 'nenhuma',
    diasSemana: tarefa.diasSemana || [],
    alerta: Boolean(tarefa.alerta),
    prioridade: tarefa.prioridade || undefined,
    categoria: tarefa.categoria || undefined,
    ...overrides,
  }
}

interface TaskCardProps {
  tarefa: TarefaItem
  mostrarSubtarefas: boolean
  compact?: boolean
  onToggle: (tarefa: TarefaItem) => void
  onOpen: (tarefa: TarefaItem) => void
}

/** Em 'Tarefas do time' os cartões mostram quem é o responsável. */
const MostrarResponsavelContext = createContext(false)

function TaskCard({ tarefa, mostrarSubtarefas, compact, onToggle, onOpen }: TaskCardProps) {
  const done = !isOpen(tarefa)
  const total = tarefa.subtarefas.length
  const feitas = tarefa.subtarefas.filter((sub) => sub.concluida).length
  const mostrarResponsavel = useContext(MostrarResponsavelContext)
  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onOpen(tarefa)
      }}
      draggable
      onDragStart={(event: DragEvent) => event.dataTransfer.setData('text/tarefa-id', tarefa.id)}
      onClick={() => onOpen(tarefa)}
      className={`cursor-pointer rounded-integrallys border border-app-border bg-white p-2 text-left shadow-sm transition hover:shadow dark:border-app-border-dark dark:bg-app-card-dark ${
        done ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label={done ? 'Reabrir tarefa' : 'Concluir tarefa'}
          onClick={(event) => {
            event.stopPropagation()
            onToggle(tarefa)
          }}
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
            done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-app-border-dark'
          }`}
        >
          {done && <Check className="h-3 w-3" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className={`text-sm text-app-text-primary dark:text-white ${done ? 'line-through' : ''} ${compact ? 'truncate' : ''}`}>
            {tarefa.titulo}
          </p>
          {mostrarResponsavel && (
            <p className="truncate text-[11px] text-app-text-secondary">Resp.: {tarefa.responsavel || '-'}</p>
          )}
          {!compact && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-app-text-secondary">
              {tarefa.horario && <span>{tarefa.horario}</span>}
              <span className={`inline-block h-2 w-2 rounded-full ${PRIORIDADE_DOT[tarefa.prioridade] ?? 'bg-slate-300'}`} title={`Prioridade ${tarefa.prioridade || 'Média'}`} />
              {tarefa.categoria && (
                <span className="rounded-full bg-app-bg-secondary px-1.5 py-0.5 dark:bg-app-bg-dark/60">#{tarefa.categoria}</span>
              )}
              {tarefa.recorrencia && tarefa.recorrencia !== 'nenhuma' && <Repeat className="h-3 w-3" aria-label="Recorrente" />}
              {mostrarSubtarefas && total > 0 && (
                <span className="rounded-full bg-app-bg-secondary px-1.5 py-0.5 dark:bg-app-bg-dark/60">
                  {feitas}/{total}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface DayColumnProps {
  dateKey: string | null
  title: string
  subtitle?: string
  highlight?: boolean
  tarefas: TarefaItem[]
  mostrarSubtarefas: boolean
  onToggle: (tarefa: TarefaItem) => void
  onOpen: (tarefa: TarefaItem) => void
  onDropTarefa: (tarefaId: string, dateKey: string) => void
  onQuickAdd: (titulo: string, dateKey: string | null) => void
}

function DayColumn({
  dateKey,
  title,
  subtitle,
  highlight,
  tarefas,
  mostrarSubtarefas,
  onToggle,
  onOpen,
  onDropTarefa,
  onQuickAdd,
}: DayColumnProps) {
  const [draft, setDraft] = useState('')
  return (
    <div
      role="group"
      onDragOver={(event) => dateKey && event.preventDefault()}
      onDrop={(event) => {
        const id = event.dataTransfer.getData('text/tarefa-id')
        if (id && dateKey) onDropTarefa(id, dateKey)
      }}
      className={`flex min-h-[220px] flex-col gap-2 rounded-integrallys-lg border p-3 ${
        highlight ? 'border-app-primary bg-[#eaf2ff] dark:bg-[#10213e]' : 'border-app-border dark:border-app-border-dark'
      }`}
    >
      <div>
        <p className="text-sm font-medium text-app-text-primary dark:text-white">{title}</p>
        {subtitle && <p className="text-xs text-app-text-secondary">{subtitle}</p>}
      </div>
      <div className="flex-1 space-y-2">
        {tarefas.map((tarefa) => (
          <TaskCard key={tarefa.id} tarefa={tarefa} mostrarSubtarefas={mostrarSubtarefas} onToggle={onToggle} onOpen={onOpen} />
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!draft.trim()) return
          onQuickAdd(draft.trim(), dateKey)
          setDraft('')
        }}
      >
        <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="+ Adicionar tarefa" className="h-9 text-sm" />
      </form>
    </div>
  )
}

export function TarefasPlannerView() {
  const { data, isLoading, error, createTarefa, updateTarefa, deleteTarefa, addSubtarefa, toggleSubtarefa, removeSubtarefa } =
    useTarefas()
  const { data: usuarios } = useUsuarios()
  const user = useAuth((state) => state.user)
  const isPrivileged = ['master', 'admin', 'gestor'].includes(String(user?.role))

  const [view, setView] = useState<PlannerView>('semana')
  const [mode, setMode] = useState<'lista' | 'calendario'>('lista')
  const [cursor, setCursor] = useState(() => new Date())
  const [filters, setFilters] = useState<PlannerFilters>({
    escopo: isPrivileged ? 'minhas' : undefined,
    meuId: user?.id,
    responsavelId: 'todos',
    mostrarConcluidas: false,
    mostrarSubtarefas: true,
    projeto: 'todos',
    prioridade: 'todas',
    busca: '',
  })
  const [editing, setEditing] = useState<TarefaItem | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [novaSub, setNovaSub] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const todayKey = toDateKey(new Date())
  const projetos = useMemo(
    () => Array.from(new Set(data.map((tarefa) => tarefa.categoria).filter(Boolean))).sort(),
    [data],
  )
  const visiveis = useMemo(
    () => applyFilters(data, { ...filters, meuId: user?.id, escopo: isPrivileged ? filters.escopo ?? 'minhas' : undefined }),
    [data, filters, user?.id, isPrivileged],
  )
  const escopoAtual = isPrivileged ? filters.escopo ?? 'minhas' : 'minhas'
  const byDate = (key: string) => visiveis.filter((tarefa) => tarefa.data === key).sort(sortTarefas)

  const run = async (action: () => Promise<unknown>, okMessage?: string) => {
    try {
      await action()
      if (okMessage) toast.success(okMessage)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível concluir a ação.')
    }
  }

  const handleToggle = (tarefa: TarefaItem) =>
    run(
      () => updateTarefa(toPayload(tarefa, { status: isOpen(tarefa) ? 'Concluída' : 'Pendente' })),
      isOpen(tarefa) && tarefa.recorrencia !== 'nenhuma' ? 'Concluída. Próxima ocorrência criada.' : undefined,
    )

  const handleDrop = (tarefaId: string, dateKey: string) => {
    const tarefa = data.find((item) => item.id === tarefaId)
    if (!tarefa || tarefa.data === dateKey) return
    void run(() => updateTarefa(toPayload(tarefa, { data: dateKey })))
  }

  const handleQuickAdd = (titulo: string, dateKey: string | null) =>
    run(() =>
      createTarefa({
        titulo,
        data: dateKey ?? undefined,
        prioridade: 'Média',
        responsavelId: user?.id,
      }),
    )

  const openCreate = (dateKey?: string) => {
    setEditing(null)
    setForm({ ...emptyForm, data: dateKey ?? '', responsavelId: user?.id ?? '' })
    setIsDialogOpen(true)
  }

  const openEdit = (tarefa: TarefaItem) => {
    setEditing(tarefa)
    setForm({
      titulo: tarefa.titulo,
      descricao: tarefa.descricao,
      data: tarefa.data,
      horario: tarefa.horario,
      prioridade: tarefa.prioridade || 'Média',
      categoria: tarefa.categoria,
      recorrencia: (tarefa.recorrencia as TarefaRecorrencia) || 'nenhuma',
      diasSemana: tarefa.diasSemana,
      alerta: tarefa.alerta,
      responsavelId: tarefa.responsavelId,
      status: tarefa.status,
    })
    setNovaSub('')
    setIsDialogOpen(true)
  }

  // A tarefa aberta no diálogo acompanha os dados recarregados (subtarefas).
  const editingLive = editing ? (data.find((item) => item.id === editing.id) ?? editing) : null

  const handleSave = async () => {
    if (!form.titulo.trim()) {
      toast.error('Informe o título da tarefa.')
      return
    }
    setIsSaving(true)
    const payload: CreateTarefaPayload = {
      titulo: form.titulo.trim(),
      descricao: form.descricao || undefined,
      data: form.data || undefined,
      horario: form.horario || undefined,
      prioridade: form.prioridade,
      categoria: form.categoria.trim() || undefined,
      recorrencia: form.recorrencia,
      diasSemana: form.diasSemana,
      alerta: form.alerta,
      responsavelId: form.responsavelId || undefined,
      status: form.status,
    }
    try {
      if (editing) await updateTarefa({ ...payload, id: editing.id })
      else await createTarefa(payload)
      setIsDialogOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar a tarefa.')
    } finally {
      setIsSaving(false)
    }
  }

  const shift = (direction: -1 | 1) => {
    if (view === 'dia') setCursor((current) => addDays(current, direction))
    else if (view === 'semana') setCursor((current) => addDays(current, direction * 7))
    else if (view === 'mes') setCursor((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1))
  }

  const weekDays = buildWeekDays(cursor)
  const rangeLabel =
    view === 'dia'
      ? cursor.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
      : view === 'semana'
        ? `${weekDays[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${weekDays[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
        : cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const columnProps = {
    mostrarSubtarefas: filters.mostrarSubtarefas,
    onToggle: handleToggle,
    onOpen: openEdit,
    onDropTarefa: handleDrop,
    onQuickAdd: handleQuickAdd,
  }

  const renderTimeGrid = (days: Date[]) => (
    <div className="overflow-x-auto">
      <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))` }}>
        <div />
        {days.map((day) => (
          <div key={toDateKey(day)} className="border-b border-app-border p-2 text-center text-xs font-medium dark:border-app-border-dark">
            {day.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })}
          </div>
        ))}
        <div className="border-b border-app-border p-2 text-xs text-app-text-secondary dark:border-app-border-dark">Dia todo</div>
        {days.map((day) => (
          <div
            role="group"
            key={`allday-${toDateKey(day)}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const id = event.dataTransfer.getData('text/tarefa-id')
              if (id) handleDrop(id, toDateKey(day))
            }}
            className="space-y-1 border-b border-l border-app-border p-1 dark:border-app-border-dark"
          >
            {byDate(toDateKey(day))
              .filter((tarefa) => !tarefa.horario)
              .map((tarefa) => (
                <TaskCard key={tarefa.id} tarefa={tarefa} compact mostrarSubtarefas={false} onToggle={handleToggle} onOpen={openEdit} />
              ))}
          </div>
        ))}
        {HOURS.map((hour) => {
          const label = `${String(hour).padStart(2, '0')}:00`
          return (
            <div key={label} className="contents">
              <div className="border-b border-app-border p-2 text-xs text-app-text-secondary dark:border-app-border-dark">{label}</div>
              {days.map((day) => (
                <div
                  role="group"
                  key={`${label}-${toDateKey(day)}`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    const id = event.dataTransfer.getData('text/tarefa-id')
                    if (id) handleDrop(id, toDateKey(day))
                  }}
                  className="min-h-[44px] space-y-1 border-b border-l border-app-border p-1 dark:border-app-border-dark"
                >
                  {byDate(toDateKey(day))
                    .filter((tarefa) => tarefa.horario && Number(tarefa.horario.slice(0, 2)) === hour)
                    .map((tarefa) => (
                      <TaskCard key={tarefa.id} tarefa={tarefa} compact mostrarSubtarefas={false} onToggle={handleToggle} onOpen={openEdit} />
                    ))}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )

  const entrada = groupEntrada(visiveis, todayKey)
  const entradaSections: Array<[string, TarefaItem[]]> = [
    ['Atrasadas', entrada.atrasadas],
    ['Hoje', entrada.hoje],
    ['Próximas', entrada.proximas],
    ['Sem data', entrada.semData],
    ['Concluídas', entrada.concluidas],
  ]

  return (
    <MostrarResponsavelContext.Provider value={isPrivileged && escopoAtual === 'time'}>
    <div className="app-page">
      <PageHeader
        title="Tarefas"
        description="Planeje o seu dia, a semana e o mês. Arraste uma tarefa para outro dia para reagendar."
        actions={
          <>
            {isPrivileged && (
              <Button asChild variant="outline">
                <Link href="/tarefas/relatorio">Relatório da equipe</Link>
              </Button>
            )}
            <Button onClick={() => openCreate(view === 'dia' ? toDateKey(cursor) : undefined)} className="text-white">
              <Plus className="mr-2 h-4 w-4" />
              Nova tarefa
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-integrallys border border-app-border p-1 dark:border-app-border-dark" role="tablist" aria-label="Visualização">
          {VIEWS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={view === item.value}
              onClick={() => setView(item.value)}
              className={`rounded-integrallys px-3 py-1.5 text-sm ${view === item.value ? 'bg-app-primary text-white' : 'text-app-text-secondary'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {(view === 'dia' || view === 'semana') && (
          <div className="inline-flex rounded-integrallys border border-app-border p-1 dark:border-app-border-dark" role="tablist" aria-label="Modo">
            {(['lista', 'calendario'] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={mode === item}
                onClick={() => setMode(item)}
                className={`rounded-integrallys px-3 py-1.5 text-sm ${mode === item ? 'bg-app-primary text-white' : 'text-app-text-secondary'}`}
              >
                {item === 'lista' ? 'Lista' : 'Calendário'}
              </button>
            ))}
          </div>
        )}
        {view !== 'entrada' && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" aria-label="Anterior" onClick={() => shift(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => setCursor(new Date())}>
              Hoje
            </Button>
            <Button variant="outline" size="icon" aria-label="Próximo" onClick={() => shift(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="ml-2 text-sm capitalize text-app-text-primary dark:text-white">{rangeLabel}</span>
          </div>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Input
          value={filters.busca}
          onChange={(event) => setFilters({ ...filters, busca: event.target.value })}
          placeholder="Buscar tarefa"
          className="h-10 w-full sm:w-56"
        />
        {isPrivileged && (
          <Select
            value={filters.escopo ?? 'minhas'}
            onValueChange={(value) => setFilters({ ...filters, escopo: value as 'minhas' | 'time' })}
          >
            <SelectTrigger className="w-[170px]" aria-label="Escopo das tarefas">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minhas">Minhas tarefas</SelectItem>
              <SelectItem value="time">Tarefas do time</SelectItem>
            </SelectContent>
          </Select>
        )}
        {isPrivileged && escopoAtual === 'time' && (
          <Select
            value={filters.responsavelId ?? 'todos'}
            onValueChange={(value) => setFilters({ ...filters, responsavelId: value })}
          >
            <SelectTrigger className="w-[190px]" aria-label="Filtrar por pessoa do time">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todo o time</SelectItem>
              {usuarios.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={filters.projeto} onValueChange={(value) => setFilters({ ...filters, projeto: value })}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Projeto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os projetos</SelectItem>
            {projetos.map((projeto) => (
              <SelectItem key={projeto} value={projeto}>
                {projeto}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.prioridade} onValueChange={(value) => setFilters({ ...filters, prioridade: value })}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as prioridades</SelectItem>
            <SelectItem value="Alta">Alta</SelectItem>
            <SelectItem value="Média">Média</SelectItem>
            <SelectItem value="Baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>
        <span className="flex items-center gap-2 text-sm">
          De
          <Input
            type="date"
            value={filters.dataDe ?? ''}
            onChange={(event) => setFilters({ ...filters, dataDe: event.target.value })}
            className="h-10 w-[150px]"
            aria-label="Data inicial"
          />
        </span>
        <span className="flex items-center gap-2 text-sm">
          Até
          <Input
            type="date"
            value={filters.dataAte ?? ''}
            onChange={(event) => setFilters({ ...filters, dataAte: event.target.value })}
            className="h-10 w-[150px]"
            aria-label="Data final"
          />
        </span>
        {(filters.dataDe || filters.dataAte) && (
          <button
            type="button"
            className="text-sm underline"
            onClick={() => setFilters({ ...filters, dataDe: '', dataAte: '' })}
          >
            Limpar datas
          </button>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.mostrarConcluidas}
            onChange={(event) => setFilters({ ...filters, mostrarConcluidas: event.target.checked })}
          />
          Mostrar concluídas
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.mostrarSubtarefas}
            onChange={(event) => setFilters({ ...filters, mostrarSubtarefas: event.target.checked })}
          />
          Mostrar subtarefas
        </label>
      </div>

      {error && <p className="mb-3 text-sm text-[var(--app-danger-text)]">{error}</p>}
      {isLoading && data.length === 0 && <p className="text-app-text-secondary">Carregando tarefas...</p>}

      {view === 'entrada' && (
        <div className="space-y-6">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              const input = event.currentTarget.elements.namedItem('titulo') as HTMLInputElement
              if (!input.value.trim()) return
              void handleQuickAdd(input.value.trim(), null)
              input.value = ''
            }}
          >
            <Input name="titulo" placeholder="+ Nova tarefa na entrada (Enter para adicionar)" className="h-11" />
          </form>
          {entradaSections.map(([label, items]) =>
            items.length === 0 ? null : (
              <section key={label} aria-label={label} className="space-y-2">
                <h2 className="text-sm font-medium text-app-text-primary dark:text-white">
                  {label} <span className="text-app-text-secondary">({items.length})</span>
                </h2>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((tarefa) => (
                    <div key={tarefa.id}>
                      <TaskCard tarefa={tarefa} mostrarSubtarefas={filters.mostrarSubtarefas} onToggle={handleToggle} onOpen={openEdit} />
                      {tarefa.data && (
                        <p className="mt-1 pl-1 text-[11px] text-app-text-secondary">{parseDateKey(tarefa.data).toLocaleDateString('pt-BR')}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ),
          )}
          {entradaSections.every(([, items]) => items.length === 0) && !isLoading && (
            <p className="text-app-text-secondary">Nenhuma tarefa por aqui. Adicione a primeira acima.</p>
          )}
        </div>
      )}

      {view === 'dia' &&
        (mode === 'lista' ? (
          <DayColumn
            dateKey={toDateKey(cursor)}
            title={cursor.toLocaleDateString('pt-BR', { weekday: 'long' })}
            subtitle={cursor.toLocaleDateString('pt-BR')}
            highlight={toDateKey(cursor) === todayKey}
            tarefas={byDate(toDateKey(cursor))}
            {...columnProps}
          />
        ) : (
          renderTimeGrid([cursor])
        ))}

      {view === 'semana' &&
        (mode === 'lista' ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
            {weekDays.map((day) => (
              <DayColumn
                key={toDateKey(day)}
                dateKey={toDateKey(day)}
                title={day.toLocaleDateString('pt-BR', { weekday: 'long' })}
                subtitle={day.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                highlight={toDateKey(day) === todayKey}
                tarefas={byDate(toDateKey(day))}
                {...columnProps}
              />
            ))}
          </div>
        ) : (
          renderTimeGrid(weekDays)
        ))}

      {view === 'mes' && (
        <div className="overflow-x-auto">
          <div className="grid min-w-[700px] grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="p-1 text-center text-xs font-medium text-app-text-secondary">
                {label}
              </div>
            ))}
            {buildMonthGrid(cursor).map((day) => {
              const key = toDateKey(day)
              const items = byDate(key)
              const inMonth = day.getMonth() === cursor.getMonth()
              return (
                <div
                  role="group"
                  key={key}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    const id = event.dataTransfer.getData('text/tarefa-id')
                    if (id) handleDrop(id, key)
                  }}
                  className={`min-h-[96px] rounded-integrallys border p-1 ${
                    key === todayKey ? 'border-app-primary' : 'border-app-border dark:border-app-border-dark'
                  } ${inMonth ? '' : 'opacity-50'}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setCursor(day)
                      setView('dia')
                    }}
                    className="mb-1 text-xs text-app-text-secondary hover:underline"
                  >
                    {day.getDate()}
                  </button>
                  <div className="space-y-1">
                    {items.slice(0, 3).map((tarefa) => (
                      <TaskCard key={tarefa.id} tarefa={tarefa} compact mostrarSubtarefas={false} onToggle={handleToggle} onOpen={openEdit} />
                    ))}
                    {items.length > 3 && <p className="text-[11px] text-app-text-secondary">+{items.length - 3} mais</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar tarefa' : 'Nova tarefa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} placeholder="O que precisa ser feito?" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} rows={3} placeholder="Opcional" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data</Label>
                <DateInput value={form.data} onChange={(value) => setForm({ ...form, data: value })} />
              </div>
              <div className="space-y-2">
                <Label>Horário</Label>
                <Input type="time" value={form.horario} onChange={(event) => setForm({ ...form, horario: event.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={(value) => setForm({ ...form, prioridade: value })}>
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
                <Label>Projeto</Label>
                <Input
                  list="tarefa-projetos"
                  value={form.categoria}
                  onChange={(event) => setForm({ ...form, categoria: event.target.value })}
                  placeholder="Ex.: Marketing"
                />
                <datalist id="tarefa-projetos">
                  {projetos.map((projeto) => (
                    <option key={projeto} value={projeto} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Recorrência</Label>
              <Select
                value={form.recorrencia}
                onValueChange={(value) =>
                  setForm({
                    ...form,
                    recorrencia: value as TarefaRecorrencia,
                    diasSemana: value === 'dias_especificos' ? form.diasSemana : [],
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
              <DiasSemanaPicker value={form.diasSemana} onChange={(diasSemana) => setForm({ ...form, diasSemana })} />
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.alerta} onChange={(event) => setForm({ ...form, alerta: event.target.checked })} />
              Lembrete no horário da tarefa
            </label>
            {isPrivileged && (
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select
                  value={form.responsavelId || '__none__'}
                  onValueChange={(value) => setForm({ ...form, responsavelId: value === '__none__' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem responsável</SelectItem>
                    {usuarios.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {editingLive && (
              <div className="space-y-2">
                <Label>
                  Subtarefas{' '}
                  {editingLive.subtarefas.length > 0 &&
                    `(${editingLive.subtarefas.filter((sub) => sub.concluida).length}/${editingLive.subtarefas.length})`}
                </Label>
                <ul className="space-y-1">
                  {editingLive.subtarefas.map((sub) => (
                    <li key={sub.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={sub.concluida}
                        onChange={(event) => void run(() => toggleSubtarefa(sub.id, event.target.checked))}
                      />
                      <span className={`flex-1 ${sub.concluida ? 'line-through opacity-60' : ''}`}>{sub.titulo}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Excluir subtarefa"
                        onClick={() => void run(() => removeSubtarefa(sub.id))}
                      >
                        <Trash2 className="h-4 w-4 text-[var(--app-danger-text)]" />
                      </Button>
                    </li>
                  ))}
                </ul>
                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (!novaSub.trim()) return
                    const titulo = novaSub.trim()
                    setNovaSub('')
                    void run(() => addSubtarefa(editingLive.id, titulo))
                  }}
                >
                  <Input value={novaSub} onChange={(event) => setNovaSub(event.target.value)} placeholder="Nova subtarefa" className="h-9" />
                  <Button type="submit" variant="outline">
                    Adicionar
                  </Button>
                </form>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            {editing && (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void run(async () => {
                    await deleteTarefa(editing.id)
                    setIsDialogOpen(false)
                  }, 'Tarefa excluída.')
                }
              >
                <Trash2 className="mr-2 h-4 w-4 text-[var(--app-danger-text)]" />
                Excluir
              </Button>
            )}
            <Button type="button" onClick={() => void handleSave()} disabled={isSaving} className="text-white">
              {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </MostrarResponsavelContext.Provider>
  )
}
