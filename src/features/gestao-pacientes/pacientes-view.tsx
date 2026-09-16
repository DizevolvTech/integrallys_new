'use client'

import Image from 'next/image'
import { ClipboardList, Edit, Eye, FileText, Mail, MoreVertical, Phone, Pill, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useRef, useState, useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { NovoPacienteModal } from '@/features/gestao-pacientes/modals'
import { EditarPacienteModal } from '@/features/gestao-pacientes/modals'
import { ExcluirPacienteModal } from '@/features/gestao-pacientes/modals'
import type { ImpactoPaciente } from '@/features/gestao-pacientes/modals/excluir-paciente-modal'
import { ManualServicosModal } from '@/features/gestao-pacientes/modals'
import { VisualizarPacienteModal } from '@/features/gestao-pacientes/modals'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CRM_ESTAGIOS, type PacienteCrm } from '@/features/gestao-pacientes/modals/visualizar-paciente-modal'
import { toast } from 'sonner'
import { DocumentoCadastro } from '@/features/gestao-pacientes/components/documento-cadastro'
import { gerarCadastroPdf } from '@/features/gestao-pacientes/utils/documento-pdf'
import { DataTable } from '@/components/shared/data-table'
import { RegistrarEvolucaoModal } from '@/features/gestao-pacientes/modals'
import { AjustePosologiaModal } from '@/features/gestao-pacientes/modals'
import { PrescricaoComplementarModal } from '@/features/gestao-pacientes/modals'
import type { PrescricaoAtiva } from '@/services/especialistaPrescricoes.service'
import type { Patient } from '@/types/patient'
import { usePacientes, type PacienteItem } from '@/hooks/use-pacientes'
import { useApi } from '@/hooks/use-api'
import { isClientePaciente } from './pacientes.utils'

function calculateAgeFromDate(dateStr: string): string {
  const birth = new Date(dateStr)
  if (Number.isNaN(birth.getTime())) return '-'
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return `${age} anos`
}

const MANUAL_SERVICOS_TEXTO_PADRAO = 'Sem descricao de servicos registrada.'

function getFallbackPrescricao(paciente: string): PrescricaoAtiva {
  return {
    id: `prescricao-${paciente}`,
    paciente,
    data: new Date().toISOString().slice(0, 10),
    tipo: 'normal',
    observacao: '',
    produtos: [
      {
        id: 'produto-padrao',
        nome: 'Produto sem estoque integrado',
        quantidade: 1,
        posologia: '',
      },
    ],
  }
}

function isPacienteCompleto(item: PacienteItem): boolean {
  // Core (tabela pacientes): nome, CPF, data de nascimento, telefone
  const hasCore = !!(
    item.nome &&
    item.cpf &&
    item.birthDate &&
    item.telefone
  )
  // Clínico essencial (perfil estendido): sexo definido
  const hasSexo = !!item.gender
  // Endereço mínimo viável: CEP OU (cidade + estado)
  const addr = item.addressDetails ?? {}
  const hasEndereco = !!(
    addr.zipCode || (addr.city && addr.state)
  )
  return hasCore && hasSexo && hasEndereco
}

function mapPacienteToPatient(item: PacienteItem): Patient {
  return {
    id: String(item.id ?? ''),
    usuarioId: item.usuarioId ? String(item.usuarioId) : undefined,
    unidadeId: item.unidadeId ? String(item.unidadeId) : undefined,
    unidadeName: item.unidadeName ? String(item.unidadeName) : undefined,
    name: String(item.nome ?? ''),
    nome: String(item.nome ?? ''),
    cpf: item.cpf ? String(item.cpf) : '',
    rg: item.rg ? String(item.rg) : undefined,
    inscricaoEstadual: item.inscricaoEstadual ? String(item.inscricaoEstadual) : undefined,
    phone: String(item.telefone ?? ''),
    telefone: String(item.telefone ?? ''),
    email: String(item.email ?? ''),
    birthDate: item.birthDate ? String(item.birthDate) : undefined,
    gender: item.gender ? String(item.gender) : undefined,
    status: isPacienteCompleto(item) ? 'complete' : 'incomplete',
    activeStatus: String(item.status ?? 'Ativo'),
    plan: 'Particular',
    age: item.birthDate ? calculateAgeFromDate(String(item.birthDate)) : '-',
    vinculoTipos: item.vinculoTipos && item.vinculoTipos.length > 0 ? item.vinculoTipos : ['cliente'],
    source: item.source ? String(item.source) : 'Nao informado',
    origemDetalhe: item.origemDetalhe ? String(item.origemDetalhe) : '',
    precisaNf: item.precisaNf === true,
    photoUrl: item.photoUrl ? String(item.photoUrl) : undefined,
    addressDetails: item.addressDetails as Patient['addressDetails'],
    specialNeeds: item.specialNeeds as Patient['specialNeeds'],
    responsible: item.responsible as Patient['responsible'],
    financial: item.financial as Patient['financial'],
    supplierData: item.supplierData as Patient['supplierData'],
  }
}

// PacienteItem (do hook) não tipa o JOIN com crm_paciente_estagios — adicionamos
// a tipagem aqui localmente, evitando alterar o hook compartilhado fora do escopo.
type PacienteWithCrm = PacienteItem & { crm?: PacienteCrm | null }

export function PacientesView() {
  const api = useApi()
  const { data, units, error, isLoading, load, createPaciente, updatePaciente, deletePaciente } = usePacientes()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [unitFilter, setUnitFilter] = useState('todos')
  const [mainTab, setMainTab] = useState<'lista' | 'crm' | 'inadimplencia'>('lista')
  const [inadimplencia, setInadimplencia] = useState<
    Array<{
      id: string
      descricao: string
      valor: number
      vencimento: string | null
      status: string
      pacienteId: string | null
      pacienteNome: string
      situacao?: 'vencido' | 'a_vencer' | 'pendente'
      linkFinanceiro: string
    }>
  >([])
  const [inadimplenciaLoading, setInadimplenciaLoading] = useState(false)
  const [inadimplenciaError, setInadimplenciaError] = useState<string | null>(null)
  const [viewInitialTab, setViewInitialTab] = useState<'dados' | 'crm'>('dados')

  useEffect(() => {
    if (mainTab !== 'inadimplencia') return
    setInadimplenciaLoading(true)
    setInadimplenciaError(null)
    void api
      .get<{
        data: Array<{
          id: string
          descricao: string
          valor: number
          vencimento: string | null
          status: string
          pacienteId: string | null
          pacienteNome: string
          situacao?: 'vencido' | 'a_vencer' | 'pendente'
          linkFinanceiro: string
        }>
      }>('/api/crm/inadimplencia')
      .then((res) => setInadimplencia(res.data ?? []))
      .catch((err) =>
        setInadimplenciaError(err instanceof Error ? err.message : 'Falha ao carregar inadimplência'),
      )
      .finally(() => setInadimplenciaLoading(false))
  }, [mainTab, api])
  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isManualOpen, setIsManualOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [isEvolucaoModalOpen, setIsEvolucaoModalOpen] = useState(false)
  const [isAjustePosologiaOpen, setIsAjustePosologiaOpen] = useState(false)
  const [isComplementarOpen, setIsComplementarOpen] = useState(false)
  const [prescricaoSelecionada, setPrescricaoSelecionada] = useState<PrescricaoAtiva | null>(null)
  const [selectedPaciente, setSelectedPaciente] = useState<Patient | null>(null)
  const [impactoExclusao, setImpactoExclusao] = useState<ImpactoPaciente | null>(null)
  const [isLoadingImpacto, setIsLoadingImpacto] = useState(false)
  const [patientForDocument, setPatientForDocument] = useState<Patient | null>(null)
  const documentoRef = useRef<HTMLDivElement | null>(null)

  const patients = useMemo(() => data.map(mapPacienteToPatient), [data])

  // Mapa id → CRM, extraído do payload JOIN do /api/pacientes (cast local).
  const crmByPatientId = useMemo(() => {
    const map = new Map<string, PacienteCrm>()
    for (const raw of data as PacienteWithCrm[]) {
      if (raw.crm) map.set(String(raw.id), raw.crm)
    }
    return map
  }, [data])

  const selectedCrm = selectedPaciente ? crmByPatientId.get(String(selectedPaciente.id)) ?? null : null

  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      // Fornecedor/prestador são linhas de `pacientes` com vínculo próprio e têm
      // tela dedicada — não devem vazar na lista de Pacientes (null-safe).
      const isCliente = isClientePaciente(p.vinculoTipos)

      const matchesSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.cpf || '').includes(searchTerm) ||
        (p.email || '').toLowerCase().includes(searchTerm.toLowerCase())

      const activeStatus = String(p.activeStatus || 'Ativo').toLowerCase()
      const matchesStatus = statusFilter === 'todos' ||
        (statusFilter === 'ativo' && activeStatus === 'ativo') ||
        (statusFilter === 'inativo' && activeStatus === 'inativo') ||
        (statusFilter === 'obito' && activeStatus.includes('obito'))

      const matchesUnit = unitFilter === 'todos' || p.unidadeId === unitFilter
      return isCliente && matchesSearch && matchesStatus && matchesUnit
    })
  }, [patients, searchTerm, statusFilter, unitFilter])

  // Agrupa pacientes por estágio do funil. Quem não tem crm cai em 'lead'.
  const patientsByEstagio = useMemo(() => {
    const grouped = new Map<string, Patient[]>()
    for (const opt of CRM_ESTAGIOS) grouped.set(opt.value, [])
    for (const p of filteredPatients) {
      const crm = crmByPatientId.get(String(p.id))
      const estagio = crm?.estagio && grouped.has(crm.estagio) ? crm.estagio : 'lead'
      grouped.get(estagio)!.push(p)
    }
    return grouped
  }, [filteredPatients, crmByPatientId])

  const openCrmForPatient = (patient: Patient) => {
    setSelectedPaciente(patient)
    setViewInitialTab('crm')
    setIsViewOpen(true)
  }

  const handleCreatePatient = async (patient: Patient) => {
    return createPaciente({
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
      vinculoTipos: patient.vinculoTipos && patient.vinculoTipos.length > 0 ? patient.vinculoTipos : ['cliente'],
      precisaNf: patient.precisaNf === true,
      unidadeId: patient.unidadeId ? String(patient.unidadeId) : '',
      photoUrl: patient.photoUrl || undefined,
      addressDetails: patient.addressDetails,
      specialNeeds: patient.specialNeeds as Record<string, unknown> | undefined,
      responsible: patient.responsible as Record<string, unknown> | undefined,
      supplierData: patient.supplierData as Record<string, unknown> | undefined,
      criarAcessoPortal: patient.criarAcessoPortal === true,
    })
  }

  const handleUpdatePatient = async (patient: Patient) => {
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
      vinculoTipos: patient.vinculoTipos && patient.vinculoTipos.length > 0 ? patient.vinculoTipos : ['cliente'],
      precisaNf: patient.precisaNf === true,
      unidadeId: patient.unidadeId ? String(patient.unidadeId) : '',
      photoUrl: patient.photoUrl || undefined,
      addressDetails: patient.addressDetails,
      specialNeeds: patient.specialNeeds as Record<string, unknown> | undefined,
      responsible: patient.responsible as Record<string, unknown> | undefined,
      supplierData: patient.supplierData as Record<string, unknown> | undefined,
      criarAcessoPortal: patient.criarAcessoPortal === true,
    })
    setSelectedPaciente(patient)
    setIsEditOpen(false)
    toast.success('Paciente atualizado com sucesso.')
  }

  const handleSoftDeletePatient = async () => {
    if (!selectedPaciente) return
    await deletePaciente(String(selectedPaciente.id))
    setSelectedPaciente(null)
    setImpactoExclusao(null)
    setIsDeleteOpen(false)
    toast.success('Paciente inativado com sucesso.')
  }

  const handleOpenExcluir = async (patient: Patient) => {
    setSelectedPaciente(patient)
    setImpactoExclusao(null)
    setIsDeleteOpen(true)
    setIsLoadingImpacto(true)
    try {
      const res = await fetch(`/api/pacientes?impacto=${encodeURIComponent(String(patient.id))}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('impacto unavailable')
      const payload = (await res.json()) as { data: ImpactoPaciente }
      setImpactoExclusao(payload.data)
    } catch {
      // Fallback silencioso: modal cai no texto genérico (sem contagens)
      setImpactoExclusao(null)
    } finally {
      setIsLoadingImpacto(false)
    }
  }

  const handleCloseExcluir = () => {
    setIsDeleteOpen(false)
    setImpactoExclusao(null)
  }

  const handleGenerateDocumento = (patient: Patient) => {
    setPatientForDocument(patient)
    window.requestAnimationFrame(() => {
      if (!documentoRef.current) return
      void gerarCadastroPdf(documentoRef.current, patient.name || 'Paciente')
    })
  }

  const handleRegistrarEvolucao = (patient: Patient) => {
    setSelectedPaciente(patient)
    setIsEvolucaoModalOpen(true)
  }

  const handleAjustePosologia = (patient: Patient) => {
    const prescricao = getFallbackPrescricao(patient.name || 'Paciente')
    setPrescricaoSelecionada(prescricao)
    setSelectedPaciente(patient)
    setIsAjustePosologiaOpen(true)
  }

  const handlePrescricaoComplementar = (patient: Patient) => {
    setSelectedPaciente(patient)
    setIsComplementarOpen(true)
  }

  return (
    <div className="app-page">
      <NovoPacienteModal isOpen={isNewPatientOpen} onClose={() => setIsNewPatientOpen(false)} unitOptions={units} onSave={handleCreatePatient} />
      <EditarPacienteModal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} paciente={selectedPaciente} unitOptions={units} onSave={handleUpdatePatient} />
      <ExcluirPacienteModal isOpen={isDeleteOpen} onClose={handleCloseExcluir} onConfirm={() => { void handleSoftDeletePatient() }} paciente={selectedPaciente} impacto={impactoExclusao} isLoadingImpacto={isLoadingImpacto} />
      <ManualServicosModal isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} paciente={selectedPaciente} />
      <VisualizarPacienteModal
        isOpen={isViewOpen}
        onClose={() => setIsViewOpen(false)}
        paciente={selectedPaciente}
        crm={selectedCrm}
        initialTab={viewInitialTab}
        onCrmSaved={() => { void load() }}
      />

      <Tabs value={mainTab} onValueChange={(value) => setMainTab(value as 'lista' | 'crm' | 'inadimplencia')} className="space-y-4">
        <TabsList>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="crm">CRM / Relacionamento</TabsTrigger>
          <TabsTrigger value="inadimplencia">Inadimplência</TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row justify-between items-stretch lg:items-center">
        <div className="flex flex-col sm:flex-row items-center gap-4 flex-1">
          <div className="relative w-full sm:max-w-xs lg:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-app-text-primary/70 dark:text-white/40" />
            <Input placeholder="Buscar por nome ou CPF..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-10 pl-9 bg-app-card dark:bg-app-card-dark border-app-border dark:border-app-border-dark rounded-lg text-sm" />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40 h-10 text-xs">
                <SelectValue preferPlaceholder placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
                <SelectItem value="obito">Óbito</SelectItem>
              </SelectContent>
            </Select>

            <Select value={unitFilter} onValueChange={setUnitFilter}>
              <SelectTrigger className="w-full sm:w-40 h-10 text-xs">
                <SelectValue preferPlaceholder placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as unidades</SelectItem>
                {units.map((unit) => <SelectItem key={unit.id} value={unit.id}>{unit.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={() => setIsNewPatientOpen(true)} className="h-10 px-4 bg-app-primary hover:bg-app-primary-hover text-white rounded-lg flex items-center justify-center gap-2 shadow-sm shrink-0 whitespace-nowrap font-normal">
          <Plus className="h-4 w-4" />
          <span>Novo paciente</span>
        </Button>
      </div>

      <Card className="rounded-[16px] border-app-border dark:border-app-border-dark overflow-hidden">
        <CardContent className="p-0">
          {error && <div className="px-8 pt-6 text-sm text-[var(--app-danger-text)]">{error}</div>}
          <div className="px-8 pt-8 pb-4">
            <h2 className="text-lg font-normal text-app-text-primary dark:text-white">Lista de pacientes ({filteredPatients.length})</h2>
          </div>
          {isLoading ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px] pl-8 font-normal">Nome</TableHead>
                      <TableHead className="min-w-[200px] font-normal">Contato</TableHead>
                      <TableHead className="min-w-[150px] font-normal">Plano de saúde</TableHead>
                      <TableHead className="min-w-[200px] font-normal">Status</TableHead>
                      <TableHead className="min-w-[150px] font-normal">Última consulta</TableHead>
                      <TableHead className="text-center min-w-[100px] font-normal">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow><TableCell colSpan={6} className="py-12 text-center text-app-text-secondary dark:text-white/60">Carregando pacientes...</TableCell></TableRow>
                </TableBody>
              </Table>
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px] pl-8 font-normal">Nome</TableHead>
                    <TableHead className="min-w-[200px] font-normal">Contato</TableHead>
                    <TableHead className="min-w-[150px] font-normal">Plano de saúde</TableHead>
                    <TableHead className="min-w-[200px] font-normal">Status</TableHead>
                    <TableHead className="min-w-[150px] font-normal">Última consulta</TableHead>
                    <TableHead className="text-center min-w-[100px] font-normal">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow><TableCell colSpan={6} className="py-12 text-center text-app-text-secondary dark:text-white/60">Nenhum paciente encontrado com os filtros aplicados.</TableCell></TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <DataTable data={filteredPatients}>
              {(pageData) => (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px] pl-8 font-normal">Nome</TableHead>
                        <TableHead className="min-w-[200px] font-normal">Contato</TableHead>
                        <TableHead className="min-w-[150px] font-normal">Plano de saúde</TableHead>
                        <TableHead className="min-w-[200px] font-normal">Status</TableHead>
                        <TableHead className="min-w-[150px] font-normal">Última consulta</TableHead>
                        <TableHead className="text-center min-w-[100px] font-normal">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageData.map((p) => (
                        <TableRow key={String(p.id)}>
                    <TableCell className="pl-8">
                      <div className="py-1 flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full overflow-hidden border border-app-border dark:border-app-border-dark bg-app-bg-secondary dark:bg-app-hover shrink-0 relative">
                          {p.photoUrl ? <Image src={p.photoUrl} alt={p.name || 'Paciente'} fill unoptimized className="object-cover" /> : <div className="h-full w-full flex items-center justify-center text-xs text-app-text-muted font-semibold">{(p.name || 'Paciente').split(' ').map((part) => part[0]).slice(0, 2).join('')}</div>}
                        </div>
                        <div className="space-y-0.5">
                          <p className="font-normal text-app-text-primary dark:text-white text-sm">{p.name}</p>
                          <p className="text-xs text-app-text-muted font-normal">{String(p.age || '-')} • {(p.vinculoTipos && p.vinculoTipos.length > 0 ? p.vinculoTipos : ['cliente']).join(', ')}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1.5 py-1">
                        <div className="flex items-center gap-2 text-app-text-secondary dark:text-white/60"><Phone size={14} className="text-app-text-muted/80" /><span className="text-sm font-normal tracking-tight">{p.phone || '-'}</span></div>
                        <div className="flex items-center gap-2 text-app-text-secondary dark:text-white/60"><Mail size={14} className="text-app-text-muted/80" /><span className="text-sm font-normal tracking-tight">{p.email || '-'}</span></div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="px-4 py-1.5 rounded-[12px] border-app-border dark:border-app-border-dark text-xs text-app-text-secondary dark:text-white/80 font-normal bg-app-card dark:bg-transparent shadow-sm">{String(p.plan || 'Particular')}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5 py-1">
                        <Badge className={`w-fit text-xs tracking-wider font-normal px-4 py-1 rounded-full border-none shadow-sm text-white ${p.status === 'complete' ? 'bg-app-primary dark:bg-blue-900/60 dark:text-[var(--app-info-text)]' : 'bg-[var(--app-warning-text)] dark:bg-amber-900/60 dark:text-[var(--app-warning-text)]'}`}>{p.status === 'complete' ? 'Cadastro completo' : 'Cadastro incompleto'}</Badge>
                        <Badge className={`w-fit text-xs tracking-wider font-normal px-4 py-1 rounded-full border-none transition-all shadow-sm text-white ${['Obito', 'Óbito'].includes(String(p.activeStatus || 'Ativo')) ? 'bg-purple-800 dark:bg-purple-900 dark:text-purple-100' : String(p.activeStatus || 'Ativo') === 'Inativo' ? 'bg-slate-500 dark:bg-slate-800 dark:text-slate-300' : 'bg-[var(--app-success-text)] dark:bg-emerald-900/60 dark:text-[var(--app-success-text)]'}`}>{String(p.activeStatus || 'Ativo')}</Badge>
                      </div>
                    </TableCell>
                    <TableCell><span className="text-sm text-app-text-secondary dark:text-white/60 font-normal">---</span></TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Visualizar cadastro"
                          title="Visualizar cadastro"
                          onClick={() => { setSelectedPaciente(p); setViewInitialTab('dados'); setIsViewOpen(true) }}
                        >
                          <Eye className="h-4 w-4 text-app-text-secondary dark:text-white/60" />
                        </Button>
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Mais ações" className="h-8 w-8"><MoreVertical className="h-4 w-4 text-app-text-secondary dark:text-white/60" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-[12px]">
                          <DropdownMenuItem onClick={() => { setSelectedPaciente(p); setViewInitialTab('dados'); setIsViewOpen(true) }} className="gap-2 focus:bg-app-bg-secondary dark:focus:bg-app-hover cursor-pointer py-2.5 font-normal"><FileText size={14} className="text-app-text-muted" />Visualizar cadastro</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setSelectedPaciente(p); setIsEditOpen(true) }} className="gap-2 focus:bg-app-bg-secondary dark:focus:bg-app-hover cursor-pointer py-2.5 font-normal"><Edit size={14} className="text-app-text-muted" />Editar cadastro</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setSelectedPaciente(p); setIsManualOpen(true) }} className="gap-2 focus:bg-app-bg-secondary dark:focus:bg-app-hover cursor-pointer py-2.5 font-normal"><FileText size={14} className="text-[var(--app-primary)]" />Manual de Serviços</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleGenerateDocumento(p)} className="gap-2 focus:bg-app-bg-secondary dark:focus:bg-app-hover cursor-pointer py-2.5 font-normal"><FileText size={14} className="text-[var(--app-success-text)]" />📄 Gerar Documento</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRegistrarEvolucao(p)} className="gap-2 focus:bg-app-bg-secondary dark:focus:bg-app-hover cursor-pointer py-2.5 font-normal"><ClipboardList size={14} className="text-app-text-muted" />Registrar evolução</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAjustePosologia(p)} className="gap-2 focus:bg-app-bg-secondary dark:focus:bg-app-hover cursor-pointer py-2.5 font-normal"><Pill size={14} className="text-app-text-muted" />Ajuste de posologia</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handlePrescricaoComplementar(p)} className="gap-2 focus:bg-app-bg-secondary dark:focus:bg-app-hover cursor-pointer py-2.5 font-normal"><Plus size={14} className="text-app-text-muted" />Prescrição complementar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { void handleOpenExcluir(p) }} className="gap-2 focus:bg-[var(--app-danger-bg)] dark:focus:bg-red-900/10 text-[var(--app-danger-text)] dark:text-[var(--app-danger-text)] cursor-pointer py-2.5 font-normal"><Trash2 size={14} />Excluir paciente</DropdownMenuItem>
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
            </DataTable>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="crm">
          <div className="overflow-x-auto">
            <div className="grid min-w-[1100px] grid-cols-6 gap-4">
              {CRM_ESTAGIOS.map((col) => {
                const cardsCol = patientsByEstagio.get(col.value) ?? []
                return (
                  <div
                    key={col.value}
                    className="rounded-2xl border border-app-border bg-app-bg-secondary/40 p-4 dark:border-app-border-dark dark:bg-app-surface-muted"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-medium text-app-text-primary dark:text-white">{col.label}</h3>
                      <Badge variant="outline" className="rounded-full border-app-border px-2 py-0.5 text-xs dark:border-app-border-dark">
                        {cardsCol.length}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      {cardsCol.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-app-border p-3 text-center text-xs text-app-text-muted dark:border-app-border-dark">
                          Sem pacientes
                        </div>
                      ) : (
                        cardsCol.map((p) => {
                          const crm = crmByPatientId.get(String(p.id))
                          const proximaAcao = crm?.proxima_acao
                          const dataProxima = crm?.data_proxima_acao
                          const dataProximaFmt = dataProxima
                            ? new Date(`${dataProxima}T00:00:00`).toLocaleDateString('pt-BR')
                            : null
                          return (
                            <div
                              key={String(p.id)}
                              role="button"
                              tabIndex={0}
                              onClick={() => openCrmForPatient(p)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault()
                                  openCrmForPatient(p)
                                }
                              }}
                              className="cursor-pointer rounded-xl border border-app-border bg-app-card p-3 text-left transition hover:border-app-primary focus:border-app-primary focus:outline-none dark:border-app-border-dark dark:bg-app-card-dark"
                            >
                              <p className="truncate text-sm font-medium text-app-text-primary dark:text-white">{p.name}</p>
                              <p className="mt-1 text-xs text-app-text-muted">Último atendimento: —</p>
                              {(proximaAcao || dataProximaFmt) && (
                                <p className="mt-1 text-xs text-[var(--app-primary)]">
                                  Próxima: {proximaAcao || '(sem descrição)'}
                                  {dataProximaFmt ? ` · ${dataProximaFmt}` : ''}
                                </p>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-2 h-7 px-2 text-xs text-[var(--app-primary)] hover:bg-app-bg-secondary"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  openCrmForPatient(p)
                                }}
                              >
                                Mover estágio →
                              </Button>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="inadimplencia" className="space-y-4">
          <Card className="rounded-2xl border-app-border dark:border-app-border-dark">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-medium text-app-text-primary dark:text-white">Inadimplência</h3>
                  <p className="text-sm text-app-text-muted">
                    Receitas em aberto: vencidas e a vencer (visão CRM).
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    window.location.href = '/financeiro?status=pendente&vencido=true'
                  }}
                >
                  Abrir financeiro
                </Button>
              </div>
              {inadimplenciaError && (
                <p className="text-sm text-[var(--app-danger-text)]">{inadimplenciaError}</p>
              )}
              {inadimplenciaLoading ? (
                <p className="text-sm text-app-text-muted">Carregando…</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paciente / beneficiário</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inadimplencia.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-app-text-muted">
                          Nenhum lançamento pendente ou vencido encontrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      inadimplencia.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.pacienteNome}</TableCell>
                          <TableCell>{row.descricao}</TableCell>
                          <TableCell>
                            {row.vencimento
                              ? new Date(`${row.vencimento}T00:00:00`).toLocaleDateString('pt-BR')
                              : '—'}
                          </TableCell>
                          <TableCell>
                            {row.situacao === 'vencido'
                              ? 'Vencido'
                              : row.situacao === 'a_vencer'
                                ? 'A vencer'
                                : 'Pendente'}
                          </TableCell>
                          <TableCell>{row.status}</TableCell>
                          <TableCell className="text-right">
                            {row.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="fixed -left-[9999px] -top-[9999px] pointer-events-none opacity-0">{patientForDocument && <DocumentoCadastro ref={documentoRef} data={patientForDocument} manualText={MANUAL_SERVICOS_TEXTO_PADRAO} />}</div>

      <RegistrarEvolucaoModal isOpen={isEvolucaoModalOpen} onClose={() => setIsEvolucaoModalOpen(false)} paciente={selectedPaciente ? { id: 0, nome: selectedPaciente.name || 'Paciente' } : null} />
      <AjustePosologiaModal isOpen={isAjustePosologiaOpen} onClose={() => setIsAjustePosologiaOpen(false)} prescricao={prescricaoSelecionada} />
      <PrescricaoComplementarModal isOpen={isComplementarOpen} onClose={() => setIsComplementarOpen(false)} paciente={selectedPaciente?.name || ''} />
    </div>
  )
}
