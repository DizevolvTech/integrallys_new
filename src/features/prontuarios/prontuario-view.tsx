'use client'

import { useMemo, useState } from 'react'
import {
  Calendar,
  CheckCircle,
  ChevronDown,
  ClipboardList,
  Edit3,
  Eye,
  FileText,
  Filter,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Stethoscope,
  Trash2,
  User,
} from 'lucide-react'
import { useProntuarios, type ProntuarioItem } from '@/features/prontuarios/hooks/use-prontuarios'
import { usePacientes } from '@/hooks/use-pacientes'
import { PacienteCadastroCard } from '@/components/shared/paciente-cadastro-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EditarProntuarioModal, ExcluirProntuarioModal, NovoProntuarioModal } from '@/features/prontuarios/modals'
import { HistoricoConsultas } from '@/features/prontuarios/historico-consultas'
import { DocumentosDoPacienteCard } from '@/features/documentacao-gerar'
import { ProntuarioHardwareGate } from '@/features/prontuarios/prontuario-live-viewer'

export function ProntuarioView() {
  return (
    <ProntuarioHardwareGate>
      <ProntuarioViewList />
    </ProntuarioHardwareGate>
  )
}

function ProntuarioViewList() {
  const { data, error, isLoading, createProntuario, updateProntuario, deleteProntuario } = useProntuarios()
  const { data: pacientes, isLoading: isLoadingPacientes } = usePacientes()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos os Status')
  const [typeFilter, setTypeFilter] = useState('Todos os Tipos')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ProntuarioItem | null>(null)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchesSearch = item.paciente.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'Todos os Status' || item.status === statusFilter
      const matchesType =
        typeFilter === 'Todos os Tipos' ||
        (typeFilter === 'Consultas' && item.tipo.toLowerCase().includes('consulta')) ||
        (typeFilter === 'Avaliações' && item.tipo.toLowerCase().includes('avalia'))

      return matchesSearch && matchesStatus && matchesType
    })
  }, [data, searchTerm, statusFilter, typeFilter])

  const openView = (item: ProntuarioItem) => {
    setSelectedItem(item)
    setIsViewOpen(true)
  }

  const openEdit = (item: ProntuarioItem) => {
    setSelectedItem(item)
    setIsEditOpen(true)
  }

  const openDelete = (item: ProntuarioItem) => {
    setSelectedItem(item)
    setIsDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (!selectedItem) return

    await deleteProntuario(selectedItem.id)
    setIsDeleteOpen(false)
    setSelectedItem(null)
  }

  return (
    <div className="app-page">
      <PageHeader
        title="Prontuários de atendimento"
        description="Gerencie os prontuários de atendimento dos pacientes."
        actions={
          <Button onClick={() => setIsCreateOpen(true)} className="h-11 rounded-integrallys px-6 text-white">
            <Plus className="mr-2 h-4 w-4" />
            Novo prontuário
          </Button>
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
              Lista de prontuários ({filteredData.length})
            </h2>
          </div>

          <div className="flex flex-col items-center gap-4 lg:flex-row">
            <div className="relative w-full flex-1">
              <Search className="absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-app-text-muted" />
              <Input
                placeholder="Buscar por nome do paciente..."
                className="h-12 w-full rounded-[12px] border-app-border bg-app-bg-secondary/50 pl-12 transition-all focus-visible:ring-[var(--app-primary)] dark:border-app-border-dark dark:bg-app-table-header-dark"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <div className="flex w-full items-center gap-3 lg:w-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex h-12 min-w-[180px] justify-between gap-3 rounded-[12px] border-app-border px-5 font-normal text-app-text-secondary transition-all hover:bg-app-bg-secondary dark:border-app-border-dark dark:text-white/80 dark:hover:bg-app-hover"
                  >
                    <div className="flex items-center gap-3">
                      <Filter className="h-4 w-4 text-app-text-muted" />
                      <span className="whitespace-nowrap">
                        {statusFilter === 'Todos os Status' ? 'Todos os status' : statusFilter}
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-app-text-muted" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[200px] rounded-integrallys-lg border-app-border bg-app-card p-2 dark:border-app-border-dark dark:bg-app-card-dark">
                  <DropdownMenuItem onClick={() => setStatusFilter('Todos os Status')}>Todos os status</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('Em Andamento')}>Em andamento</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('Finalizado')}>Finalizado</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex h-12 min-w-[180px] justify-between gap-3 rounded-[12px] border-app-border px-5 font-normal text-app-text-secondary transition-all hover:bg-app-bg-secondary dark:border-app-border-dark dark:text-white/80 dark:hover:bg-app-hover"
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
                <DropdownMenuContent className="w-[220px] rounded-integrallys-lg border-app-border bg-app-card p-2 dark:border-app-border-dark dark:bg-app-card-dark">
                  <DropdownMenuItem onClick={() => setTypeFilter('Todos os Tipos')}>Todos os tipos</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTypeFilter('Consultas')}>Consultas</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTypeFilter('Avaliações')}>Avaliações</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="px-8 pb-8 text-sm text-app-text-muted">Carregando prontuários...</div>
        ) : filteredData.length === 0 ? (
          <div className="px-8 pb-8">
            <EmptyState
              icon={ClipboardList}
              title="Nenhum prontuário encontrado."
              description="Ajuste os filtros ou cadastre um novo prontuário para preencher esta listagem."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-app-border hover:bg-transparent dark:border-app-border-dark">
                  <TableHead className="px-6 py-4 font-normal text-app-text-muted">Paciente</TableHead>
                  <TableHead className="py-4 font-normal text-app-text-muted">Data</TableHead>
                  <TableHead className="py-4 font-normal text-app-text-muted">Tipo de consulta</TableHead>
                  <TableHead className="py-4 text-center font-normal text-app-text-muted">Status</TableHead>
                  <TableHead className="py-4 text-center font-normal text-app-text-muted">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((item) => (
                  <TableRow
                    key={item.id}
                    className="border-b border-app-border transition-colors hover:bg-app-bg-secondary dark:border-app-border-dark dark:hover:bg-app-bg-dark/50"
                  >
                    <TableCell className="px-6 font-normal text-app-text-primary dark:text-white">{item.paciente}</TableCell>
                    <TableCell className="text-app-text-secondary dark:text-white/80">{item.data}</TableCell>
                    <TableCell className="text-app-text-muted dark:text-app-text-muted">{item.tipo}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        className={`rounded-lg border-0 px-2.5 py-1 text-xs font-normal tracking-wider shadow-sm ${
                          item.status === 'Finalizado'
                            ? 'bg-[var(--app-success-text)] text-white dark:bg-transparent dark:text-[var(--app-success-text)]'
                            : 'bg-app-primary text-white dark:bg-blue-900/40 dark:text-[var(--app-info-text)]'
                        }`}
                      >
                        {item.status}
                      </Badge>
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
                          <Button className="mx-auto flex h-9 w-9 items-center justify-center border-none bg-transparent p-0 shadow-none hover:bg-transparent">
                            <MoreHorizontal className="h-5 w-5 shrink-0 text-app-text-primary dark:text-white" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[200px] rounded-integrallys-lg border-app-border bg-app-card p-2 shadow-xl dark:border-app-border-dark dark:bg-app-card-dark">
                          <DropdownMenuItem
                            className="flex cursor-pointer items-center gap-3 rounded-integrallys py-3 text-app-text-primary transition-colors hover:bg-app-bg-secondary dark:text-white dark:hover:bg-app-hover"
                            onClick={() => openView(item)}
                          >
                            <Eye className="h-4 w-4 shrink-0 text-app-text-muted" />
                            <span className="font-normal whitespace-nowrap">Visualizar</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="flex cursor-pointer items-center gap-3 rounded-integrallys py-3 text-app-text-primary transition-colors hover:bg-app-bg-secondary dark:text-white dark:hover:bg-app-hover"
                            onClick={() => openEdit(item)}
                          >
                            <Edit3 className="h-4 w-4 shrink-0 text-app-text-muted" />
                            <span className="font-normal whitespace-nowrap">Editar</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="flex cursor-pointer items-center gap-3 rounded-integrallys py-3 text-[var(--app-danger-text)] transition-colors hover:bg-red-900/10 focus:text-[var(--app-danger-text)]"
                            onClick={() => openDelete(item)}
                          >
                            <Trash2 className="h-4 w-4 shrink-0" />
                            <span className="font-normal whitespace-nowrap">Excluir</span>
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

      <NovoProntuarioModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        pacientes={pacientes}
        isLoadingPacientes={isLoadingPacientes}
        onSave={async (payload) => {
          await createProntuario(payload)
          setIsCreateOpen(false)
        }}
      />

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent size="lg" className="w-[95vw] rounded-[24px] border-none p-0 shadow-2xl custom-scrollbar">
          {selectedItem && (
            <div className="bg-app-card dark:bg-app-card-dark">
              {/* Patient Header */}
              <div className="p-8 space-y-6 border-b border-app-border dark:border-app-border-dark">
                <div className="flex flex-col gap-4">
                  <div className="min-w-0 space-y-3">
                    <PacienteCadastroCard
                      pacienteId={selectedItem.pacienteId}
                      nomeFallback={selectedItem.paciente}
                    />
                    <div className="flex items-center gap-2 text-app-text-muted">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm">Atendimento em {selectedItem.data}</span>
                    </div>
                  </div>
                  <Badge
                    className={`order-first w-fit shrink-0 rounded-lg border-none px-3 py-1.5 text-xs font-normal tracking-wider shadow-sm ${
                      selectedItem.status === 'Finalizado'
                        ? 'bg-[var(--app-success-text)] text-white dark:bg-transparent dark:text-[var(--app-success-text)]'
                        : 'app-status-info text-white'
                    }`}
                  >
                    {selectedItem.status}
                  </Badge>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => { setIsViewOpen(false); openEdit(selectedItem) }}
                    className="h-10 px-4 rounded-integrallys border-app-border dark:border-app-border-dark text-app-text-primary dark:text-white font-normal hover:bg-app-bg-secondary dark:hover:bg-app-hover flex items-center gap-2 bg-app-card dark:bg-app-card-dark shadow-sm"
                  >
                    <Edit3 className="h-4 w-4 text-app-text-muted shrink-0" />
                    Editar prontuário
                  </Button>
                  <Button
                    className="h-10 px-4 rounded-integrallys bg-app-primary hover:bg-app-primary-hover text-white font-normal flex items-center gap-2 shadow-sm"
                  >
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    Finalizar atendimento
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setIsViewOpen(false); openDelete(selectedItem) }}
                    className="h-10 px-4 rounded-integrallys border-app-border dark:border-app-border-dark text-app-text-muted dark:text-app-text-muted font-normal hover:bg-app-hover dark:hover:bg-app-hover flex items-center gap-2 bg-app-card dark:bg-app-card-dark shadow-sm"
                  >
                    <Trash2 className="h-4 w-4 shrink-0" />
                    Excluir
                  </Button>
                </div>
              </div>

              {/* Details */}
              <div className="p-8 space-y-6">
                {/* Info grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-app-bg-secondary dark:bg-app-surface-muted rounded-integrallys-lg p-5 border border-app-border dark:border-app-border-dark space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-app-primary" />
                      <p className="text-xs uppercase tracking-widest text-app-text-muted">Tipo de consulta</p>
                    </div>
                    <p className="text-base font-normal text-app-text-primary dark:text-white">{selectedItem.tipo}</p>
                  </div>
                  <div className="bg-app-bg-secondary dark:bg-app-surface-muted rounded-integrallys-lg p-5 border border-app-border dark:border-app-border-dark space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-app-primary" />
                      <p className="text-xs uppercase tracking-widest text-app-text-muted">Paciente</p>
                    </div>
                    <p className="text-base font-normal text-app-text-primary dark:text-white">{selectedItem.paciente}</p>
                  </div>
                </div>

                {/* Queixa Principal */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-app-bg-secondary dark:bg-app-table-header-dark p-1.5 rounded-lg">
                      <MessageSquare className="h-4 w-4 text-app-primary dark:text-white" />
                    </div>
                    <h3 className="text-base font-normal text-app-text-primary dark:text-white">Queixa principal</h3>
                  </div>
                  <div className="bg-app-bg-secondary/50 dark:bg-app-table-header-dark rounded-integrallys-lg p-5 border border-app-border/50 dark:border-app-border-dark">
                    <p className="text-sm text-app-text-muted italic font-normal">Sem registro de queixa principal.</p>
                  </div>
                </div>

                {/* Diagnóstico */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-app-bg-secondary dark:bg-app-table-header-dark p-1.5 rounded-lg">
                      <Stethoscope className="h-4 w-4 text-app-primary dark:text-white" />
                    </div>
                    <h3 className="text-base font-normal text-app-text-primary dark:text-white">Diagnóstico</h3>
                  </div>
                  <div className="bg-app-bg-secondary/50 dark:bg-app-table-header-dark rounded-integrallys-lg p-5 border border-app-border/50 dark:border-app-border-dark">
                    <p className="text-sm text-app-text-muted italic font-normal">Em avaliação.</p>
                  </div>
                </div>

                {/* Observações e conduta */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-app-bg-secondary dark:bg-app-table-header-dark p-1.5 rounded-lg">
                      <ClipboardList className="h-4 w-4 text-app-primary dark:text-white" />
                    </div>
                    <h3 className="text-base font-normal text-app-text-primary dark:text-white">Observações e conduta</h3>
                  </div>
                  <div className="bg-app-bg-secondary/50 dark:bg-app-table-header-dark rounded-integrallys-lg p-5 border border-app-border/50 dark:border-app-border-dark">
                    <p className="text-sm text-app-text-muted italic font-normal">Sem observações registradas.</p>
                  </div>
                </div>

                {selectedItem.pacienteId && <HistoricoConsultas pacienteId={selectedItem.pacienteId} />}

                {selectedItem.pacienteId && (
                  <DocumentosDoPacienteCard
                    pacienteId={selectedItem.pacienteId}
                    limit={5}
                    titulo="Documentos do paciente"
                  />
                )}

                {/* Footer */}
                <div className="flex justify-end pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsViewOpen(false)}
                    className="h-10 px-6 rounded-integrallys font-normal"
                  >
                    Fechar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <EditarProntuarioModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        prontuario={selectedItem}
        pacientes={pacientes}
        onSave={async (payload) => {
          await updateProntuario(payload)
          setIsEditOpen(false)
          setSelectedItem(null)
        }}
      />

      <ExcluirProntuarioModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        pacienteNome={selectedItem?.paciente}
        onConfirm={async () => {
          await handleDelete()
        }}
      />
    </div>
  )
}
