'use client'

import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ChevronDown,
  Edit,
  Eye,
  FileSignature,
  FileText,
  Files,
  Filter,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { toast } from 'sonner'
import { useEvolucoes, type EvolucaoItem } from '@/features/evolucoes/hooks/use-evolucoes'
import { usePacientes } from '@/hooks/use-pacientes'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  AdicionarDocumentoEnviadoModal,
  AdicionarProdutoModal,
  EditarRetornoRecepcaoModal,
  MarcarRetornoModal,
} from './modals'
import { DocumentosDoPacienteCard } from '@/features/documentacao-gerar'

type FormState = {
  pacienteId: string
  data: string
  tipo: string
  resumo: string
  retornoRecepcao: string
}

const initialFormState: FormState = {
  pacienteId: '',
  data: '',
  tipo: 'Consulta',
  resumo: '',
  retornoRecepcao: 'Paciente avisado',
}

const getRetornoBadgeColor = (status?: string) => {
  switch (status) {
    case 'Paciente avisado':
      return 'app-status-info text-white'
    case 'Retorno confirmado':
      return 'app-status-success text-white'
    case 'Não localizado':
      return 'app-status-danger text-white'
    default:
      return 'app-status-neutral text-white'
  }
}

export function EvolucoesView() {
  const { data, error, isLoading, createEvolucao, updateEvolucao, deleteEvolucao } = useEvolucoes()
  const { data: pacientes, isLoading: isLoadingPacientes } = usePacientes()
  const [searchTerm, setSearchTerm] = useState('')
  const [patientFilter, setPatientFilter] = useState('Todos os Pacientes')
  const [typeFilter, setTypeFilter] = useState('Todos os Tipos')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false)
  const [isNoteOpen, setIsNoteOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDocEnviadoOpen, setIsDocEnviadoOpen] = useState(false)
  const [isEditarRetornoOpen, setIsEditarRetornoOpen] = useState(false)
  const [isMarcarRetornoOpen, setIsMarcarRetornoOpen] = useState(false)
  const [isAddProdutoOpen, setIsAddProdutoOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<EvolucaoItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>(initialFormState)
  const [note, setNote] = useState('')

  const patientOptions = useMemo(() => {
    return Array.from(new Set(data.map((item) => item.paciente).filter(Boolean)))
  }, [data])

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchesSearch =
        item.paciente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.resumo.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = typeFilter === 'Todos os Tipos' || item.tipo === typeFilter
      const matchesPatient = patientFilter === 'Todos os Pacientes' || item.paciente === patientFilter
      return matchesSearch && matchesType && matchesPatient
    })
  }, [data, patientFilter, searchTerm, typeFilter])

  const clearFilters = () => {
    setSearchTerm('')
    setPatientFilter('Todos os Pacientes')
    setTypeFilter('Todos os Tipos')
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)

    try {
      await createEvolucao({
        pacienteId: form.pacienteId,
        data: form.data.trim(),
        tipo: form.tipo,
        resumo: form.resumo.trim(),
        retornoRecepcao: form.retornoRecepcao,
      })
      setForm(initialFormState)
      setIsCreateOpen(false)
      toast.success('Evolução criada com sucesso.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar a evolução.')
    } finally {
      setSaving(false)
    }
  }

  const openNote = (item: EvolucaoItem) => {
    setSelectedItem(item)
    setNote('')
    setIsNoteOpen(true)
  }

  const handleSaveNote = async () => {
    if (!selectedItem || !selectedItem.pacienteId || !note.trim()) return
    setSaving(true)
    try {
      await updateEvolucao({
        id: selectedItem.id,
        pacienteId: selectedItem.pacienteId,
        data: selectedItem.data,
        tipo: selectedItem.tipo,
        resumo: `${selectedItem.resumo}\n\n--- Nota/Errata (${new Date().toLocaleDateString('pt-BR')}) ---\n${note.trim()}`,
        retornoRecepcao: selectedItem.retornoRecepcao,
      })
      toast.success('Nota/errata adicionada com sucesso.')
      setIsNoteOpen(false)
      setSelectedItem(null)
      setNote('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível atualizar a evolução.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedItem) return
    setSaving(true)
    try {
      await deleteEvolucao(selectedItem.id)
      toast.success('Evolução excluída com sucesso.')
      setIsDeleteOpen(false)
      setSelectedItem(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível excluir a evolução.')
    } finally {
      setSaving(false)
    }
  }

  const openDelete = (item: EvolucaoItem) => {
    setSelectedItem(item)
    setIsDeleteOpen(true)
  }

  const openView = (item: EvolucaoItem) => {
    setSelectedItem(item)
    setIsViewOpen(true)
  }

  const handleAddDocumentoEnviado = async (payload: {
    evolucaoId: string
    tipo: string
    meio: string
    dataEnvio: string
    recebido: boolean
    anexo?: string
  }) => {
    if (!selectedItem?.pacienteId) {
      throw new Error('Não foi possível localizar o paciente desta evolução.')
    }

    const registro = [
      '[Documento enviado]',
      `Tipo: ${payload.tipo}`,
      `Meio: ${payload.meio}`,
      `Data: ${payload.dataEnvio}`,
      `Recebido: ${payload.recebido ? 'Sim' : 'Não'}`,
      ...(payload.anexo ? [`Anexo: ${payload.anexo}`] : []),
    ].join(' | ')

    await updateEvolucao({
      id: selectedItem.id,
      pacienteId: selectedItem.pacienteId,
      data: selectedItem.data,
      tipo: selectedItem.tipo,
      resumo: `${selectedItem.resumo}\n\n${registro}`,
      retornoRecepcao: selectedItem.retornoRecepcao,
    })
  }

  const handleEditarRetornoRecepcao = async (payload: { id: string; retornoRecepcao: string }) => {
    if (!selectedItem?.pacienteId) {
      throw new Error('Não foi possível localizar o paciente desta evolução.')
    }

    await updateEvolucao({
      id: payload.id,
      pacienteId: selectedItem.pacienteId,
      data: selectedItem.data,
      tipo: selectedItem.tipo,
      resumo: selectedItem.resumo,
      retornoRecepcao: payload.retornoRecepcao,
    })
  }

  const handleMarcarRetorno = async (payload: {
    pacienteNome: string
    data: string
    hora: string
    especialista: string
    observacoes?: string
  }) => {
    if (!selectedItem?.pacienteId) {
      throw new Error('Não foi possível localizar o paciente desta evolução.')
    }

    const registro = [
      '[Retorno agendado]',
      `Data: ${payload.data}`,
      `Hora: ${payload.hora}`,
      `Especialista: ${payload.especialista}`,
      payload.observacoes ? `Observações: ${payload.observacoes}` : '',
    ]
      .filter(Boolean)
      .join(' | ')

    await updateEvolucao({
      id: selectedItem.id,
      pacienteId: selectedItem.pacienteId,
      data: selectedItem.data,
      tipo: selectedItem.tipo,
      resumo: `${selectedItem.resumo}\n\n${registro}`,
      retornoRecepcao: 'Retorno confirmado',
    })
    toast.info('Retorno agendado na agenda.')
  }

  return (
    <div className="app-page app-page-loose">
      <PageHeader
        title="Evoluções clínicas"
        description="Acompanhe a evolução clínica dos pacientes"
        actions={
          <>
            <Button variant="outline" onClick={clearFilters} className="h-11 rounded-integrallys px-4 font-normal">
              Limpar filtros
            </Button>
            <Button onClick={() => setIsCreateOpen(true)} className="h-11 rounded-integrallys px-6 text-white">
              <Plus className="mr-2 h-4 w-4" />
              Nova evolução clínica
            </Button>
          </>
        }
      />

      {error && (
        <Card className="rounded-integrallys-lg border-[var(--app-danger-border)] bg-[var(--app-danger-bg)] p-4 text-sm text-[var(--app-danger-text)]">
          {error}
        </Card>
      )}

      <div className="overflow-hidden rounded-integrallys-lg border border-app-border bg-app-card shadow-sm dark:border-app-border-dark dark:bg-app-card-dark">
        <div className="space-y-8 p-8">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-app-text-primary dark:text-white" />
            <h2 className="text-xl font-normal tracking-tight text-app-text-primary dark:text-white">
              Registro de evoluções ({filteredData.length})
            </h2>
          </div>

          <div className="app-toolbar">
            <div className="relative w-full flex-1">
              <Search className="absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-app-text-muted" />
              <Input
                placeholder="Buscar por paciente ou resumo..."
                className="h-12 w-full rounded-[12px] bg-app-bg-secondary pl-12 transition-all focus-visible:ring-[var(--app-primary)] dark:bg-app-card-dark"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex h-12 min-w-[200px] justify-between gap-3 rounded-[12px] font-normal text-app-text-secondary transition-all hover:bg-app-bg-secondary dark:text-white/80 dark:hover:bg-app-hover"
                  >
                    <div className="flex items-center gap-3">
                      <Filter className="h-4 w-4 text-app-text-muted" />
                      <span className="whitespace-nowrap">
                        {patientFilter === 'Todos os Pacientes' ? 'Todos os pacientes' : patientFilter}
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-app-text-muted" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[220px] rounded-integrallys-lg border-app-border bg-app-card p-2 dark:border-app-border-dark dark:bg-app-card-dark">
                  <DropdownMenuItem onClick={() => setPatientFilter('Todos os Pacientes')}>Todos os pacientes</DropdownMenuItem>
                  {patientOptions.map((patient) => (
                    <DropdownMenuItem key={patient} onClick={() => setPatientFilter(patient)}>
                      {patient}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex h-12 min-w-[180px] justify-between gap-3 rounded-[12px] font-normal text-app-text-secondary transition-all hover:bg-app-bg-secondary dark:text-white/80 dark:hover:bg-app-hover"
                  >
                    <div className="flex items-center gap-3">
                      <Filter className="h-4 w-4 text-app-text-muted" />
                      <span className="whitespace-nowrap">
                        {typeFilter === 'Todos os Tipos' ? 'Todos os tipos' : typeFilter}
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-app-text-muted" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[200px] rounded-integrallys-lg border-app-border bg-app-card p-2 dark:border-app-border-dark dark:bg-app-card-dark">
                  <DropdownMenuItem onClick={() => setTypeFilter('Todos os Tipos')}>Todos os tipos</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTypeFilter('Consulta')}>Consulta</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTypeFilter('Retorno')}>Retorno</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTypeFilter('Exame')}>Exame</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="px-8 pb-8 text-sm text-app-text-muted">Carregando evoluções...</div>
        ) : filteredData.length === 0 ? (
          <div className="px-8 pb-8">
            <div className="rounded-[12px] border border-dashed border-app-border bg-app-bg-secondary/40 p-8 text-center dark:border-app-border-dark dark:bg-app-bg-dark">
              <p className="text-base text-app-text-primary dark:text-white">Nenhuma evolução encontrada.</p>
              <p className="mt-2 text-sm text-app-text-muted">
                Os filtros e modais já estão prontos e aguardam os registros clínicos reais.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-app-border hover:bg-transparent dark:border-app-border-dark">
                  <TableHead className="px-6 py-4 font-normal text-app-text-secondary dark:text-white/60">Paciente</TableHead>
                  <TableHead className="py-4 font-normal text-app-text-secondary dark:text-white/60">Data da evolução</TableHead>
                  <TableHead className="py-4 font-normal text-app-text-secondary dark:text-white/60">Tipo</TableHead>
                  <TableHead className="w-[40%] py-4 font-normal text-app-text-secondary dark:text-white/60">Resumo</TableHead>
                  <TableHead className="py-4 text-center font-normal text-app-text-secondary dark:text-white/60">Retorno da recepção</TableHead>
                  <TableHead className="py-4 text-center font-normal text-app-text-secondary dark:text-white/60">Docs</TableHead>
                  <TableHead className="py-4 text-center font-normal text-app-text-secondary dark:text-white/60">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((item) => (
                  <TableRow
                    key={item.id}
                    className="border-b border-app-border transition-colors hover:bg-app-hover dark:border-app-border-dark dark:hover:bg-app-hover"
                  >
                    <TableCell className="px-6 font-normal text-app-text-primary dark:text-white">{item.paciente}</TableCell>
                    <TableCell className="text-app-text-secondary dark:text-white/80">{item.data}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="rounded-full border-app-border bg-app-card px-3 py-0.5 font-medium text-app-text-secondary shadow-sm dark:border-app-border-dark dark:bg-app-card-dark dark:text-app-text-muted"
                      >
                        {item.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-app-text-muted dark:text-app-text-muted">
                      <div className="max-w-[400px] truncate" title={item.resumo}>
                        {item.resumo}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        className={`rounded-[8px] border-0 px-3 py-1.5 text-xs font-normal tracking-wider shadow-sm ${getRetornoBadgeColor(item.retornoRecepcao)}`}
                      >
                        {item.retornoRecepcao ?? 'Sem retorno'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItem(item)
                          setIsDocumentsOpen(true)
                        }}
                        className="mx-auto flex w-fit items-center justify-center gap-1.5 rounded-lg border border-app-border bg-app-bg-secondary px-2 py-1 font-medium text-app-text-secondary transition-colors hover:bg-app-hover dark:border-app-border-dark dark:bg-app-hover dark:text-white/60"
                      >
                        <Files className="h-3.5 w-3.5" />
                        <span>{item.docsCount ?? 0}</span>
                      </button>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Visualizar"
                          onClick={() => openView(item)}
                        >
                          <Eye className="h-4 w-4 text-app-text-secondary dark:text-white/60" />
                        </Button>
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button className="mx-auto flex h-9 w-9 items-center justify-center border-none bg-transparent p-0 shadow-none hover:bg-app-hover">
                            <MoreHorizontal className="h-5 w-5 shrink-0 text-app-text-primary dark:text-white" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[240px] rounded-[16px] border-app-border bg-app-card p-2 shadow-xl dark:border-app-border-dark dark:bg-app-card-dark">
                          <DropdownMenuItem
                            onClick={() => openView(item)}
                            className="group flex cursor-pointer items-center gap-3.5 rounded-[12px] px-3 py-3 text-app-text-primary transition-colors hover:bg-app-bg-secondary dark:text-white dark:hover:bg-app-hover"
                          >
                            <Eye className="h-[20px] w-[20px] shrink-0 text-app-text-muted group-hover:text-app-text-secondary dark:group-hover:text-white" />
                            <span className="text-base font-normal">Visualizar</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openNote(item)}
                            className="group flex cursor-pointer items-center gap-3.5 rounded-[12px] px-3 py-3 text-app-text-primary transition-colors hover:bg-app-bg-secondary dark:text-white dark:hover:bg-app-hover"
                          >
                            <FileSignature className="h-[20px] w-[20px] shrink-0 text-app-text-muted group-hover:text-app-text-secondary dark:group-hover:text-white" />
                            <span className="text-base font-normal">Adicionar nota/errata</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => { setSelectedItem(item); setIsAddProdutoOpen(true) }}
                            className="group flex cursor-pointer items-center gap-3.5 rounded-[12px] px-3 py-3 text-app-text-primary transition-colors hover:bg-app-bg-secondary dark:text-white dark:hover:bg-app-hover"
                          >
                            <Package className="h-[20px] w-[20px] shrink-0 text-app-text-muted group-hover:text-app-text-secondary dark:group-hover:text-white" />
                            <span className="text-base font-normal">Adicionar produto</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedItem(item)
                              setIsDocEnviadoOpen(true)
                            }}
                            className="group flex cursor-pointer items-center gap-3.5 rounded-[12px] px-3 py-3 text-app-text-primary transition-colors hover:bg-app-bg-secondary dark:text-white dark:hover:bg-app-hover"
                          >
                            <Files className="h-[20px] w-[20px] shrink-0 text-app-text-muted group-hover:text-app-text-secondary dark:group-hover:text-white" />
                            <span className="text-base font-normal">Adicionar documento enviado</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedItem(item)
                              setIsEditarRetornoOpen(true)
                            }}
                            className="group flex cursor-pointer items-center gap-3.5 rounded-[12px] px-3 py-3 text-app-text-primary transition-colors hover:bg-app-bg-secondary dark:text-white dark:hover:bg-app-hover"
                          >
                            <Edit className="h-[20px] w-[20px] shrink-0 text-app-text-muted group-hover:text-app-text-secondary dark:group-hover:text-white" />
                            <span className="text-base font-normal">Editar retorno da recepção</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedItem(item)
                              setIsMarcarRetornoOpen(true)
                            }}
                            className="group flex cursor-pointer items-center gap-3.5 rounded-[12px] px-3 py-3 text-app-text-primary transition-colors hover:bg-app-bg-secondary dark:text-white dark:hover:bg-app-hover"
                          >
                            <Plus className="h-[20px] w-[20px] shrink-0 text-app-text-muted group-hover:text-app-text-secondary dark:group-hover:text-white" />
                            <span className="text-base font-normal">Marcar retorno</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openDelete(item)}
                            className="group flex cursor-pointer items-center gap-3.5 rounded-[12px] px-3 py-3 text-app-text-primary transition-colors hover:bg-app-bg-secondary dark:text-white dark:hover:bg-app-hover"
                          >
                            <Trash2 className="h-[20px] w-[20px] shrink-0 text-app-text-muted group-hover:text-[var(--app-danger-text)] dark:group-hover:text-red-400" />
                            <span className="text-base font-normal">Excluir</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent
          hideCloseButton={true}
          className="w-[95vw] sm:max-w-[600px] p-8 rounded-[24px] bg-app-card dark:bg-app-card-dark border border-app-border dark:border-app-border-dark shadow-lg gap-0 block overflow-y-auto max-h-[90vh] custom-scrollbar"
        >
          <form onSubmit={(event) => void handleCreate(event)}>
            <DialogHeader className="mb-6 space-y-1">
              <DialogTitle className="text-xl font-normal text-app-text-primary dark:text-white tracking-tight">
                Nova evolução clínica
              </DialogTitle>
              <DialogDescription className="text-base text-app-text-muted dark:text-app-text-muted font-normal">
                Registre uma nova evolução clínica do paciente
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <Label className="text-sm font-normal text-app-text-primary dark:text-white/80">Paciente *</Label>
                <Select
                  value={form.pacienteId}
                  onValueChange={(value) => setForm((current) => ({ ...current, pacienteId: value }))}
                >
                  <SelectTrigger className="h-12 rounded-[12px] bg-app-bg-secondary dark:bg-app-surface-muted border-app-border dark:border-app-border-dark">
                    <SelectValue placeholder={isLoadingPacientes ? 'Carregando pacientes...' : 'Selecione um paciente'} />
                  </SelectTrigger>
                  <SelectContent>
                    {pacientes.map((paciente) => (
                      <SelectItem key={paciente.id} value={paciente.id}>
                        {paciente.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!isLoadingPacientes && pacientes.length === 0 && (
                  <p className="text-xs text-app-text-muted">Cadastre um paciente antes de criar uma evolução.</p>
                )}
              </div>
              <div className="space-y-3">
                <Label className="text-sm font-normal text-app-text-primary dark:text-white/80">Data da evolução *</Label>
                <Input
                  value={form.data}
                  onChange={(event) => setForm((current) => ({ ...current, data: event.target.value }))}
                  placeholder="15/11/2025"
                  required
                  className="h-12 rounded-[12px] bg-app-bg-secondary dark:bg-app-surface-muted border-app-border dark:border-app-border-dark"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-sm font-normal text-app-text-primary dark:text-white/80">Tipo *</Label>
                <Select value={form.tipo} onValueChange={(value) => setForm((current) => ({ ...current, tipo: value }))}>
                  <SelectTrigger className="h-12 rounded-[12px] bg-app-bg-secondary dark:bg-app-surface-muted border-app-border dark:border-app-border-dark">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Consulta">Consulta</SelectItem>
                    <SelectItem value="Retorno">Retorno</SelectItem>
                    <SelectItem value="Exame">Exame</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-sm font-normal text-app-text-primary dark:text-white/80">Retorno da recepção</Label>
                <Select
                  value={form.retornoRecepcao}
                  onValueChange={(value) => setForm((current) => ({ ...current, retornoRecepcao: value }))}
                >
                  <SelectTrigger className="h-12 rounded-[12px] bg-app-bg-secondary dark:bg-app-surface-muted border-app-border dark:border-app-border-dark">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paciente avisado">Paciente avisado</SelectItem>
                    <SelectItem value="Retorno confirmado">Retorno confirmado</SelectItem>
                    <SelectItem value="Não localizado">Não localizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <Label className="text-sm font-normal text-app-text-primary dark:text-white/80">Resumo/notas *</Label>
              <Textarea
                value={form.resumo}
                onChange={(event) => setForm((current) => ({ ...current, resumo: event.target.value }))}
                placeholder="Descreva a evolução clínica..."
                required
                className="min-h-[100px] rounded-[12px] bg-app-bg-secondary dark:bg-app-surface-muted border-app-border dark:border-app-border-dark resize-none p-4 text-base focus:ring-[var(--app-primary)] focus:border-[var(--app-primary)]"
              />
            </div>

            <div className="space-y-6 pt-4 border-t border-app-border dark:border-app-border-dark mt-6 mb-2">
              <h3 className="text-base font-normal text-app-text-primary dark:text-white">Retorno da recepção</h3>
              <div className="space-y-2">
                <Label className="text-sm font-normal text-app-text-primary dark:text-white/80">Detalhes do retorno (Opcional)</Label>
                <Textarea
                  placeholder="Observações da recepção..."
                  className="min-h-[80px] rounded-[12px] bg-app-bg-secondary dark:bg-app-surface-muted border-app-border dark:border-app-border-dark resize-none p-4 text-base focus:ring-[var(--app-primary)] focus:border-[var(--app-primary)]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-app-border dark:border-app-border-dark">
              <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)} className="h-12 rounded-[12px] font-normal text-app-text-primary dark:text-white hover:bg-app-bg-secondary dark:hover:bg-app-hover border border-app-border dark:border-app-border-dark">
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || isLoadingPacientes || pacientes.length === 0 || !form.pacienteId} className="px-8 h-12 bg-app-primary hover:bg-app-primary-hover text-white rounded-[12px] font-normal shadow-sm transition-all active:scale-[0.98]">
                {saving ? 'Salvando...' : 'Criar evolução'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent
          hideCloseButton={true}
          className="w-[95vw] sm:max-w-[680px] p-0 rounded-[24px] bg-app-card dark:bg-app-card-dark border border-app-border dark:border-app-border-dark shadow-2xl block overflow-y-auto max-h-[90vh] custom-scrollbar"
        >
          {selectedItem && (
            <div className="p-8 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full bg-app-bg-secondary dark:bg-app-hover flex items-center justify-center shrink-0">
                    <span className="font-normal text-xl text-app-text-secondary dark:text-white/80">
                      {selectedItem.paciente.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-xl font-normal text-app-text-primary dark:text-white">{selectedItem.paciente}</h2>
                    <p className="text-sm text-app-text-muted mt-0.5">Evolução clínica — {selectedItem.data}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsViewOpen(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-app-border dark:border-app-border-dark hover:bg-app-bg-secondary dark:hover:bg-app-hover transition-colors shrink-0"
                >
                  <Plus className="h-4 w-4 text-app-text-muted rotate-45" />
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setIsViewOpen(false); openNote(selectedItem) }}
                  className="h-9 rounded-integrallys font-normal gap-2 text-sm"
                >
                  <FileSignature className="h-3.5 w-3.5" /> Adicionar nota/errata
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setIsViewOpen(false); setIsMarcarRetornoOpen(true) }}
                  className="h-9 rounded-integrallys font-normal gap-2 text-sm"
                >
                  <Plus className="h-3.5 w-3.5" /> Marcar retorno
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setIsViewOpen(false); setIsDocEnviadoOpen(true) }}
                  className="h-9 rounded-integrallys font-normal gap-2 text-sm"
                >
                  <Files className="h-3.5 w-3.5" /> Doc. enviado
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setIsViewOpen(false); setIsAddProdutoOpen(true) }}
                  className="h-9 rounded-integrallys font-normal gap-2 text-sm"
                >
                  <Package className="h-3.5 w-3.5" /> Adicionar produto
                </Button>
              </div>

              {/* Status banner */}
              <div className="flex items-center gap-2 px-4 py-3 rounded-integrallys bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/20">
                <span className="text-xs font-normal text-orange-700 dark:text-orange-300">
                  Finalizado — Protegido pela RN-009. Use &quot;Adicionar nota/errata&quot; para complementar.
                </span>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="rounded-[12px] border border-app-border p-4 dark:border-app-border-dark">
                  <p className="text-xs uppercase tracking-wider text-app-text-muted">Tipo</p>
                  <p className="mt-1 text-base font-normal text-app-text-primary dark:text-white">{selectedItem.tipo}</p>
                </Card>
                <Card className="rounded-[12px] border border-app-border p-4 dark:border-app-border-dark">
                  <p className="text-xs uppercase tracking-wider text-app-text-muted">Data</p>
                  <p className="mt-1 text-base font-normal text-app-text-primary dark:text-white">{selectedItem.data}</p>
                </Card>
                <Card className="rounded-[12px] border border-app-border p-4 dark:border-app-border-dark">
                  <p className="text-xs uppercase tracking-wider text-app-text-muted">Retorno da recepção</p>
                  <p className="mt-1 text-sm font-normal text-app-text-primary dark:text-white">{selectedItem.retornoRecepcao ?? 'Sem retorno'}</p>
                </Card>
              </div>

              {/* Clinical notes */}
              <div className="rounded-[12px] border border-app-border dark:border-app-border-dark p-5 space-y-2">
                <p className="text-sm font-normal text-app-text-primary dark:text-white">Notas clínicas</p>
                <p className="text-sm leading-6 text-app-text-secondary dark:text-white/80 whitespace-pre-wrap">{selectedItem.resumo}</p>
              </div>

              {selectedItem.pacienteId && (
                <DocumentosDoPacienteCard
                  pacienteId={selectedItem.pacienteId}
                  limit={5}
                  titulo="Documentos do paciente"
                />
              )}

              <div className="flex justify-end pt-2 border-t border-app-border dark:border-app-border-dark">
                <Button variant="outline" onClick={() => setIsViewOpen(false)} className="h-10 rounded-integrallys px-6 font-normal">
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDocumentsOpen} onOpenChange={setIsDocumentsOpen}>
        <DialogContent
          hideCloseButton={true}
          className="w-[95vw] sm:max-w-[600px] p-8 rounded-[24px] bg-app-card dark:bg-app-card-dark border border-app-border dark:border-app-border-dark shadow-lg block overflow-y-auto max-h-[90vh] custom-scrollbar"
        >
          <div className="flex justify-between items-start mb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-app-text-primary dark:text-white" />
                <h2 className="text-xl font-normal text-app-text-primary dark:text-white">Adicionar documento</h2>
              </div>
              <p className="text-base text-app-text-muted font-normal">Anexe um novo documento ao histórico do paciente</p>
            </div>
            <button
              onClick={() => setIsDocumentsOpen(false)}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-app-border dark:border-app-border-dark hover:bg-app-bg-secondary dark:hover:bg-app-hover transition-colors shrink-0"
            >
              <Plus className="h-4 w-4 text-app-text-muted rotate-45" />
            </button>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-normal text-app-text-primary dark:text-white/80">Tipo de documento *</Label>
              <Select>
                <SelectTrigger className="h-12 rounded-[12px] bg-app-bg-secondary dark:bg-app-surface-muted border-app-border dark:border-app-border-dark">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent className="rounded-[12px]">
                  <SelectItem value="prescricao">Prescrição</SelectItem>
                  <SelectItem value="atestado">Atestado</SelectItem>
                  <SelectItem value="exame">Resultado de Exame</SelectItem>
                  <SelectItem value="encaminhamento">Encaminhamento</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-normal text-app-text-primary dark:text-white/80">Meio de envio *</Label>
              <Select>
                <SelectTrigger className="h-12 rounded-[12px] bg-app-bg-secondary dark:bg-app-surface-muted border-app-border dark:border-app-border-dark">
                  <SelectValue placeholder="Selecione o meio" />
                </SelectTrigger>
                <SelectContent className="rounded-[12px]">
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="impresso">Impresso/Físico</SelectItem>
                  <SelectItem value="portal">Portal do Paciente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-[16px] border-2 border-dashed border-app-border dark:border-app-border-dark p-8 flex flex-col items-center justify-center text-center hover:bg-app-bg-secondary dark:hover:bg-app-hover transition-colors cursor-pointer bg-app-bg-secondary/50 dark:bg-app-surface-muted">
              <div className="h-12 w-12 rounded-full bg-app-bg-secondary dark:bg-app-hover flex items-center justify-center mb-3">
                <UploadCloud className="h-6 w-6 text-app-primary dark:text-white" />
              </div>
              <p className="text-sm font-normal text-app-text-primary dark:text-white mb-1">Clique para fazer upload ou arraste e solte</p>
              <p className="text-xs text-app-text-muted">PDF, JPG, PNG (máx. 10MB)</p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-normal text-app-text-primary dark:text-white/80">Observações (opcional)</Label>
              <Textarea
                placeholder="Adicione observações sobre este documento..."
                className="min-h-[100px] rounded-[12px] bg-app-bg-secondary dark:bg-app-surface-muted border-app-border dark:border-app-border-dark resize-none p-4 text-base"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-app-border dark:border-app-border-dark">
            <Button variant="ghost" onClick={() => setIsDocumentsOpen(false)} className="h-12 rounded-[12px] font-normal border border-app-border dark:border-app-border-dark">
              Cancelar
            </Button>
            <Button onClick={() => setIsDocumentsOpen(false)} className="px-8 h-12 bg-app-primary hover:bg-app-primary-hover text-white rounded-[12px] font-normal gap-2">
              Salvar documento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isNoteOpen} onOpenChange={setIsNoteOpen}>
        <DialogContent
          hideCloseButton={true}
          className="w-[95vw] sm:max-w-[550px] p-6 md:p-8 rounded-[24px] bg-app-card dark:bg-app-card-dark border border-app-border dark:border-app-border-dark shadow-lg block overflow-y-auto max-h-[90vh] custom-scrollbar"
        >
          <div className="bg-app-card p-8 dark:bg-app-card-dark">
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-xl font-normal text-app-text-primary dark:text-white">Adicionar nota/errata</DialogTitle>
              <DialogDescription className="text-base text-app-text-muted dark:text-app-text-muted font-normal">
                Adicione observações ou correções à evolução finalizada (RN-009)
              </DialogDescription>
            </DialogHeader>
            <div className="mt-6 space-y-5">
              <div className="space-y-2">
                <Label>Paciente</Label>
                <Input
                  readOnly
                  value={selectedItem?.paciente ?? ''}
                  className="h-12 rounded-[12px] bg-app-bg-secondary dark:bg-app-surface-muted border-app-border dark:border-app-border-dark text-app-text-muted dark:text-app-text-muted font-normal"
                />
              </div>
              <div className="space-y-2">
                <Label>Data da nota</Label>
                <Input
                  readOnly
                  value={selectedItem?.data ?? ''}
                  className="h-12 rounded-[12px] bg-app-bg-secondary dark:bg-app-surface-muted border-app-border dark:border-app-border-dark text-app-text-muted dark:text-app-text-muted font-normal"
                />
              </div>
              <div className="space-y-2">
                <Label>Texto da nota/errata</Label>
                <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Descreva a observação adicional ou correção necessária..." className="min-h-[120px] rounded-[12px] bg-white dark:bg-app-surface-muted border-app-border dark:border-app-border-dark resize-none p-4 text-base" />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3 border-t border-app-border dark:border-app-border-dark pt-6">
              <Button type="button" variant="outline" onClick={() => setIsNoteOpen(false)} className="h-11 rounded-integrallys px-6">
                Cancelar
              </Button>
              <Button type="button" onClick={() => void handleSaveNote()} disabled={saving || !note.trim()} className="px-6 h-11 bg-app-primary hover:bg-app-primary-hover text-white rounded-integrallys font-normal shadow-sm transition-all active:scale-[0.98]">
                Adicionar nota/errata
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent
          hideCloseButton={true}
          className="sm:max-w-[550px] p-0 rounded-[24px] overflow-hidden border-none shadow-2xl"
        >
          <div className="bg-app-card p-8 dark:bg-app-card-dark">
            <DialogHeader className="space-y-4">
              <DialogTitle className="text-2xl font-normal text-app-text-primary dark:text-white">Excluir evolução</DialogTitle>
              <DialogDescription className="text-[#64748b] dark:text-app-text-muted text-lg leading-relaxed font-normal">
                Tem certeza que deseja excluir a evolução de <span className="font-normal text-app-text-primary dark:text-white">{selectedItem?.paciente ?? 'registro selecionado'}</span>? Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-6 flex items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)} className="h-12 rounded-[12px] px-8">
                Cancelar
              </Button>
              <Button type="button" onClick={() => void handleDelete()} disabled={saving} className="h-12 px-10 rounded-[12px] bg-[#e11d48] hover:bg-[#be123c] text-white font-normal text-base shadow-lg shadow-red-500/20 transition-all hover:scale-[1.02]">
                {saving ? 'Excluindo...' : 'Excluir'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AdicionarDocumentoEnviadoModal
        isOpen={isDocEnviadoOpen}
        onClose={() => setIsDocEnviadoOpen(false)}
        evolucaoId={selectedItem?.id ?? ''}
        pacienteId={selectedItem?.pacienteId}
        onSave={handleAddDocumentoEnviado}
      />

      <AdicionarProdutoModal
        isOpen={isAddProdutoOpen}
        onClose={() => setIsAddProdutoOpen(false)}
        pacienteNome={selectedItem?.paciente}
      />

      <EditarRetornoRecepcaoModal
        isOpen={isEditarRetornoOpen}
        onClose={() => setIsEditarRetornoOpen(false)}
        evolucao={selectedItem}
        onSave={handleEditarRetornoRecepcao}
      />

      <MarcarRetornoModal
        isOpen={isMarcarRetornoOpen}
        onClose={() => setIsMarcarRetornoOpen(false)}
        pacienteNome={selectedItem?.paciente}
        onSave={handleMarcarRetorno}
      />
    </div>
  )
}
