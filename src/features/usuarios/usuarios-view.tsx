'use client'

import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  KeyRound,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Settings,
  Shield,
  Trash2,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { DataTable } from '@/components/shared/data-table'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { usePermissoes } from '@/hooks/use-permissoes'
import { useUnidades } from '@/hooks/use-unidades'
import { type UsuarioItem, useUsuarios } from '@/hooks/use-usuarios'

type FormState = {
  nome: string
  email: string
  perfil: string
  status: string
  senha: string
  unidadeId: string
  isVendedor: boolean
  comissao: string
}

const initialFormState: FormState = {
  nome: '',
  email: '',
  perfil: '',
  status: 'Ativo',
  senha: '',
  unidadeId: '',
  isVendedor: false,
  comissao: '',
}

// Perfis escopados por unidade. master/admin veem todas as unidades e paciente
// não é escopado — para esses o campo nem aparece, e a API grava null.
const PERFIS_COM_UNIDADE = new Set(['gestor', 'recepcao', 'especialista'])

const PROFILE_OPTIONS = [
  { value: 'todos', label: 'Todos os perfis' },
  { value: 'master', label: 'Master' },
  { value: 'admin', label: 'Administrador' },
  { value: 'gestor', label: 'Gestor' },
  { value: 'recepcao', label: 'Recepção' },
  { value: 'especialista', label: 'Especialista' },
  { value: 'paciente', label: 'Paciente' },
]

const PROFILE_LABELS = PROFILE_OPTIONS.reduce<Record<string, string>>((acc, option) => {
  acc[option.value] = option.label
  return acc
}, {})

const RESOURCE_LABELS: Record<string, string> = {
  agenda: 'Agenda',
  auditoria: 'Auditoria',
  caixa: 'Caixa',
  configuracoes: 'Configurações',
  dashboard: 'Dashboard',
  documentacao: 'Documentação',
  estoque: 'Estoque',
  evolucoes: 'Evoluções',
  financeiro: 'Financeiro',
  lista_espera: 'Lista de espera',
  pacientes: 'Pacientes',
  permissoes: 'Permissões',
  portal: 'Portal',
  prescricoes: 'Prescrições',
  prontuarios: 'Prontuários',
  relatorios: 'Relatórios',
  repasse: 'Repasse',
  tarefas: 'Tarefas',
  unidades: 'Unidades',
  usuarios: 'Usuários',
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Criar',
  read: 'Visualizar',
  update: 'Editar',
  delete: 'Excluir',
  export: 'Exportar',
  approve: 'Aprovar',
  manage: 'Gerenciar',
}

const PERMISSION_SECTIONS = [
  {
    id: 'operacional',
    title: 'Operacional',
    resources: ['agenda', 'pacientes', 'lista_espera', 'caixa', 'estoque', 'tarefas'],
    icon: Users,
  },
  {
    id: 'administrativo',
    title: 'Administrativo',
    resources: ['usuarios', 'permissoes', 'unidades', 'auditoria', 'dashboard', 'configuracoes'],
    icon: Settings,
  },
  {
    id: 'financeiro',
    title: 'Financeiro',
    resources: ['financeiro', 'repasse', 'relatorios'],
    icon: Shield,
  },
  {
    id: 'clinico',
    title: 'Clínico',
    resources: ['documentacao', 'evolucoes', 'prontuarios', 'prescricoes'],
    icon: Shield,
  },
] as const

export function UsuariosView() {
  const { data, isLoading, error, createUsuario, updateUsuario, deleteUsuario } = useUsuarios()
  const { data: permissoes, isLoading: isLoadingPermissoes } = usePermissoes()
  const [searchTerm, setSearchTerm] = useState('')
  const [profileFilter, setProfileFilter] = useState('todos')
  const [selectedUser, setSelectedUser] = useState<UsuarioItem | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createMode, setCreateMode] = useState<'add' | 'edit'>('add')
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [form, setForm] = useState<FormState>(initialFormState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { data: unidades } = useUnidades()

  const exigeUnidade = PERFIS_COM_UNIDADE.has(form.perfil.toLowerCase())

  const filteredUsers = useMemo(() => {
    return data.filter((item) => {
      const normalizedSearch = searchTerm.toLowerCase()
      const matchesSearch =
        searchTerm === '' ||
        item.nome.toLowerCase().includes(normalizedSearch) ||
        item.email.toLowerCase().includes(normalizedSearch)

      const perfil = (item.perfil ?? '').toLowerCase()
      const matchesProfile = profileFilter === 'todos' || perfil === profileFilter.toLowerCase()

      return matchesSearch && matchesProfile
    })
  }, [data, profileFilter, searchTerm])

  const clearFilters = () => {
    setSearchTerm('')
    setProfileFilter('todos')
  }

  useEffect(() => {
    if (!isCreateOpen) return

    if (createMode === 'edit' && selectedUser) {
      setForm({
        nome: selectedUser.nome,
        email: selectedUser.email,
        perfil: selectedUser.perfil ?? '',
        status: selectedUser.status,
        senha: '',
        unidadeId: selectedUser.unidadeId ?? '',
        isVendedor: Boolean(selectedUser.isVendedor),
        comissao: selectedUser.comissao != null ? String(selectedUser.comissao) : '',
      })
      return
    }

    setForm(initialFormState)
  }, [createMode, isCreateOpen, selectedUser])

  const handleSave = async () => {
    if (!form.nome || !form.email || !form.perfil) {
      toast.error('Preencha nome, e-mail e perfil para continuar.')
      return
    }

    if (createMode === 'add' && form.senha.trim().length < 4) {
      toast.error('Informe uma senha com pelo menos 4 caracteres.')
      return
    }

    if (exigeUnidade && !form.unidadeId) {
      toast.error('Selecione a unidade para gestor, recepção e especialista.')
      return
    }

    // Só perfis escopados carregam unidade; para os demais a API grava null.
    const unidadeId = exigeUnidade ? form.unidadeId : null
    const comissaoPayload = {
      isVendedor: form.perfil === 'especialista' && form.isVendedor,
      comissao: form.comissao.trim() === '' ? undefined : Number(form.comissao.replace(',', '.')),
    }

    setIsSubmitting(true)
    try {
      if (createMode === 'edit' && selectedUser) {
        await updateUsuario({
          id: selectedUser.id,
          nome: form.nome,
          email: form.email,
          perfil: form.perfil,
          status: form.status,
          senha: form.senha || undefined,
          unidadeId,
          ...comissaoPayload,
        })
        toast.success('Usuário atualizado com sucesso.')
      } else {
        await createUsuario({
          nome: form.nome,
          email: form.email,
          perfil: form.perfil,
          status: form.status,
          senha: form.senha,
          unidadeId,
          ...comissaoPayload,
        })
        toast.success('Usuário criado com sucesso.')
      }

      setIsCreateOpen(false)
      setSelectedUser(null)
      setForm(initialFormState)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar o usuário.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedUser) return

    setIsSubmitting(true)
    try {
      await deleteUsuario(selectedUser.id)
      toast.success('Usuário excluído com sucesso.')
      setIsDeleteOpen(false)
      setSelectedUser(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível excluir o usuário.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedUserPermissions = useMemo(() => {
    if (!selectedUser?.perfil) return []
    const selectedPerfil = selectedUser.perfil.toLowerCase()

    return permissoes
      .filter((item) => item.perfil.toLowerCase() === selectedPerfil)
      .map((item) => ({
        ...item,
        acoes: [...item.acoes].sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => a.recurso.localeCompare(b.recurso))
  }, [permissoes, selectedUser])

  const selectedUserProfileLabel = selectedUser?.perfil
    ? (PROFILE_LABELS[selectedUser.perfil.toLowerCase()] ?? selectedUser.perfil)
    : '--'

  const groupedPermissions = useMemo(() => {
    return PERMISSION_SECTIONS.map((section) => ({
      ...section,
      items: selectedUserPermissions.filter((item) =>
        section.resources.includes(item.recurso as never),
      ),
    })).filter((section) => section.items.length > 0)
  }, [selectedUserPermissions])

  return (
    <div className="app-page app-page-loose">
      <PageHeader
        title="Usuários"
        description="Controle cadastros, status e permissões herdadas pelos perfis administrativos."
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex w-full flex-col items-center gap-3 lg:w-auto lg:flex-row">
          <div className="relative w-full lg:w-[480px]">
            <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-app-text-muted dark:text-white/60" />
            <Input
              placeholder="Buscar usuário por nome ou e-mail..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-11 w-full rounded-xl border-app-border bg-app-card pl-11 text-sm font-normal shadow-sm transition-all focus:border-[var(--app-primary)] focus:ring-[var(--app-primary)]/20 dark:bg-app-card-dark dark:text-white dark:placeholder:text-app-text-muted"
            />
          </div>

          <Select value={profileFilter} onValueChange={setProfileFilter}>
            <SelectTrigger className="w-full sm:w-60 lg:w-72">
              <SelectValue preferPlaceholder placeholder="Filtrar por perfil">
                {PROFILE_OPTIONS.find((option) => option.value === profileFilter)?.label ??
                  'Filtrar por perfil'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-app-border dark:border-app-border-dark">
              {PROFILE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={clearFilters}
            className="h-11 w-full rounded-xl px-4 font-normal whitespace-nowrap sm:w-auto"
          >
            Limpar filtros
          </Button>
        </div>

        <Button
          onClick={() => {
            setSelectedUser(null)
            setCreateMode('add')
            setIsCreateOpen(true)
          }}
          className="h-11 shrink-0 rounded-xl bg-app-primary px-6 font-normal text-white shadow-sm"
        >
          <Plus className="h-5 w-5" />
          <span>Adicionar usuário</span>
        </Button>
      </div>

      {error && (
        <p className="text-sm text-[var(--app-danger-text)] dark:text-[var(--app-danger-text)]">
          {error}
        </p>
      )}

      <Card className="overflow-hidden rounded-[24px] border-app-border/60 shadow-sm dark:border-app-border-dark">
        {isLoading ? (
          <div className="py-12 text-center">
            <p className="text-app-text-muted dark:text-white/40">Carregando usuários...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-app-text-muted dark:text-white/40">
              Nenhum usuário encontrado com os filtros aplicados.
            </p>
          </div>
        ) : (
          <DataTable data={filteredUsers}>
            {(pageData) => (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-hover">
                    <TableRow>
                      <TableHead className="min-w-[220px] text-xs font-medium uppercase tracking-wider text-app-text-secondary">
                        Nome
                      </TableHead>
                      <TableHead className="min-w-[260px] text-xs font-medium uppercase tracking-wider text-app-text-secondary">
                        E-mail
                      </TableHead>
                      <TableHead className="min-w-[140px] text-xs font-medium uppercase tracking-wider text-app-text-secondary">
                        Perfil
                      </TableHead>
                      <TableHead className="min-w-[180px] text-xs font-medium uppercase tracking-wider text-app-text-secondary">
                        Unidade
                      </TableHead>
                      <TableHead className="min-w-[120px] text-xs font-medium uppercase tracking-wider text-app-text-secondary">
                        Status
                      </TableHead>
                      <TableHead className="min-w-[110px] text-center text-xs font-medium uppercase tracking-wider text-app-text-secondary">
                        Ações
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageData.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-normal text-app-text-primary dark:text-white">
                          {item.nome}
                        </TableCell>
                        <TableCell className="text-app-text-secondary dark:text-white/70">
                          {item.email}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="rounded-full px-3 py-1 text-xs font-medium"
                          >
                            {item.perfil ?? '--'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-app-text-secondary dark:text-white/70">
                          --
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              item.status === 'Ativo'
                                ? 'app-status-success text-white'
                                : 'app-status-neutral text-white'
                            }`}
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="mx-auto h-8 w-8">
                                <MoreVertical className="h-4 w-4 text-app-text-secondary dark:text-white/60" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-56 rounded-xl border-app-border p-2 shadow-lg dark:border-app-border-dark dark:bg-app-card-dark"
                            >
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedUser(item)
                                  setIsViewOpen(true)
                                }}
                                className="rounded-lg px-3 py-2.5 font-medium"
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                Visualizar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedUser(item)
                                  setCreateMode('edit')
                                  setIsCreateOpen(true)
                                }}
                                className="rounded-lg px-3 py-2.5 font-medium"
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedUser(item)
                                  setIsPermissionsOpen(true)
                                }}
                                className="rounded-lg px-3 py-2.5 font-medium"
                              >
                                <KeyRound className="mr-2 h-4 w-4" />
                                Alterar permissões
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedUser(item)
                                  setIsDeleteOpen(true)
                                }}
                                className="rounded-lg px-3 py-2.5 font-medium text-[var(--app-danger-text)] dark:text-[var(--app-danger-text)]"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Inativar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </DataTable>
        )}
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent
          size="lg"
          className="gap-0 overflow-hidden rounded-[24px] border border-app-border p-0 dark:border-app-border-dark"
        >
          <div className="bg-app-card dark:bg-app-card-dark">
            <DialogHeader className="space-y-2 px-6 pb-4 pt-6">
              <DialogTitle className="text-2xl font-normal text-app-text-primary dark:text-white">
                {createMode === 'edit' ? 'Editar usuário' : 'Adicionar usuário'}
              </DialogTitle>
              <DialogDescription className="text-sm text-app-text-muted">
                {createMode === 'edit'
                  ? 'Revise os dados do cadastro selecionado antes de salvar as alterações.'
                  : 'Preencha os dados principais do novo usuário para seguir com o cadastro administrativo.'}
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 py-4">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <Label>Nome</Label>
                  <Input
                    value={form.nome}
                    onChange={(e) => setForm((c) => ({ ...c, nome: e.target.value }))}
                    placeholder="Nome completo"
                    className="h-12 rounded-[12px]"
                  />
                </div>
                <div className="space-y-3">
                  <Label>E-mail</Label>
                  <Input
                    value={form.email}
                    onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
                    placeholder="usuario@empresa.com"
                    className="h-12 rounded-[12px]"
                  />
                </div>
                <div className="space-y-3">
                  <Label>Perfil</Label>
                  <Select
                    value={form.perfil}
                    onValueChange={(value) => setForm((c) => ({ ...c, perfil: value }))}
                  >
                    <SelectTrigger className="h-12 rounded-[12px]">
                      <SelectValue placeholder="Selecione um perfil" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROFILE_OPTIONS.filter((option) => option.value !== 'todos').map(
                        (option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(value) => setForm((c) => ({ ...c, status: value }))}
                  >
                    <SelectTrigger className="h-12 rounded-[12px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ativo">Ativo</SelectItem>
                      <SelectItem value="Inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {exigeUnidade && (
                  <div className="space-y-3 md:col-span-2">
                    <Label>
                      Unidade <span className="text-[var(--app-danger-text)]">*</span>
                    </Label>
                    <Select
                      value={form.unidadeId}
                      onValueChange={(value) => setForm((c) => ({ ...c, unidadeId: value }))}
                    >
                      <SelectTrigger className="h-12 rounded-[12px]">
                        <SelectValue placeholder="Selecione a unidade" />
                      </SelectTrigger>
                      <SelectContent>
                        {unidades.map((unidade) => (
                          <SelectItem key={unidade.id} value={unidade.id}>
                            {unidade.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {form.perfil.toLowerCase() === 'especialista' && (
                  <div className="space-y-3 md:col-span-2">
                    <div className="flex items-center justify-between rounded-[12px] border border-app-border p-3 dark:border-app-border-dark">
                      <div>
                        <Label>Vendedor (recebe comissão)</Label>
                        <p className="text-xs text-app-text-muted">Comissão sobre as Prescrições/Vendas que realizar.</p>
                      </div>
                      <Switch
                        checked={form.isVendedor}
                        onCheckedChange={(checked) => setForm((c) => ({ ...c, isVendedor: checked }))}
                      />
                    </div>
                    {form.isVendedor && (
                      <div className="space-y-3">
                        <Label>Percentual de comissão (%)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={form.comissao}
                          onChange={(e) => setForm((c) => ({ ...c, comissao: e.target.value }))}
                          placeholder="Ex.: 10"
                          className="h-12 rounded-[12px]"
                        />
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-3 md:col-span-2">
                  <Label>{createMode === 'edit' ? 'Nova senha (opcional)' : 'Senha inicial'}</Label>
                  <Input
                    type="password"
                    value={form.senha}
                    onChange={(e) => setForm((c) => ({ ...c, senha: e.target.value }))}
                    placeholder={
                      createMode === 'edit'
                        ? 'Preencha apenas se quiser alterar'
                        : 'Mínimo de 4 caracteres'
                    }
                    className="h-12 rounded-[12px]"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="px-6 py-6 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="h-11 rounded-[12px] px-6"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSubmitting}
                className="h-11 rounded-[12px] px-6 text-white"
              >
                {isSubmitting
                  ? 'Salvando...'
                  : createMode === 'edit'
                    ? 'Salvar alterações'
                    : 'Salvar cadastro'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent
          size="lg"
          className="gap-0 overflow-hidden rounded-[24px] border border-app-border p-0 dark:border-app-border-dark"
        >
          <div className="bg-app-card dark:bg-app-card-dark">
            <DialogHeader className="space-y-2 px-6 pb-4 pt-6">
              <DialogTitle className="text-xl font-normal text-app-text-primary dark:text-white">
                Visualizar usuário
              </DialogTitle>
              <DialogDescription className="text-sm text-app-text-muted">
                Detalhes completos do usuário selecionado.
              </DialogDescription>
            </DialogHeader>

            {selectedUser && (
              <div className="grid grid-cols-1 gap-4 px-6 py-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-sm font-normal text-app-text-primary dark:text-white">
                    Nome completo
                  </Label>
                  <div className="flex h-11 items-center rounded-lg border border-app-border bg-app-bg-secondary px-3 text-sm font-normal text-app-text-primary dark:border-app-border-dark dark:bg-app-card/5 dark:text-white/80">
                    {selectedUser.nome}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-normal text-app-text-primary dark:text-white">
                    E-mail
                  </Label>
                  <div className="flex h-11 items-center rounded-lg border border-app-border bg-app-bg-secondary px-3 text-sm font-normal text-app-text-primary dark:border-app-border-dark dark:bg-app-card/5 dark:text-white/80">
                    {selectedUser.email}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-normal text-app-text-primary dark:text-white">
                    Perfil
                  </Label>
                  <div className="flex h-11 items-center rounded-lg border border-app-border bg-app-bg-secondary px-3 text-sm font-normal text-app-text-primary dark:border-app-border-dark dark:bg-app-card/5 dark:text-white/80">
                    {selectedUser.perfil ?? '--'}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-normal text-app-text-primary dark:text-white">
                    Unidade
                  </Label>
                  <div className="flex h-11 items-center rounded-lg border border-app-border bg-app-bg-secondary px-3 text-sm font-normal text-app-text-primary dark:border-app-border-dark dark:bg-app-card/5 dark:text-white/80">
                    --
                  </div>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-sm font-normal text-app-text-primary dark:text-white">
                    Status
                  </Label>
                  <div className="flex h-11 items-center rounded-lg border border-app-border bg-app-bg-secondary px-3 text-sm dark:border-app-border-dark dark:bg-app-card/5">
                    <Badge
                      className={
                        selectedUser.status === 'Ativo'
                          ? 'bg-app-primary text-white shadow-sm font-normal'
                          : 'border border-[#D0D5DD] bg-[#F2F4F7] text-[#3b414e] font-normal dark:border-app-border-dark dark:bg-app-card-dark dark:text-white/70'
                      }
                    >
                      {selectedUser.status}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="px-6 py-6 pt-4">
              <Button
                onClick={() => setIsViewOpen(false)}
                className="h-10 rounded-integrallys px-5 text-white"
              >
                Fechar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPermissionsOpen} onOpenChange={setIsPermissionsOpen}>
        <DialogContent
          size="lg"
          className="gap-0 overflow-hidden rounded-[24px] border border-app-border p-0 dark:border-app-border-dark"
        >
          <div className="bg-app-card dark:bg-app-card-dark">
            <DialogHeader className="space-y-2 px-6 pb-4 pt-6">
              <DialogTitle className="text-xl font-normal text-app-text-primary dark:text-white">
                Permissões do usuário
              </DialogTitle>
              <DialogDescription className="text-sm text-app-text-muted">
                Resumo das permissões herdadas pelo perfil atual do usuário selecionado.
              </DialogDescription>
            </DialogHeader>

            {selectedUser && (
              <div className="space-y-6 px-6 py-4">
                <div className="flex flex-col gap-4 rounded-[18px] border border-app-border bg-app-bg-secondary/40 p-5 dark:border-app-border-dark dark:bg-app-bg-dark/40 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--app-info-bg)] text-[var(--app-info-text)]">
                      <Shield className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-base font-normal text-app-text-primary dark:text-white">
                        {selectedUser.nome}
                      </p>
                      <p className="text-sm text-app-text-muted">{selectedUser.email}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="rounded-full border-app-border px-3 py-1 text-xs font-normal text-app-text-secondary dark:border-app-border-dark dark:text-white/75"
                    >
                      Perfil: {selectedUserProfileLabel}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="rounded-full border-app-border px-3 py-1 text-xs font-normal text-app-text-secondary dark:border-app-border-dark dark:text-white/75"
                    >
                      {selectedUserPermissions.reduce((acc, item) => acc + item.acoes.length, 0)}{' '}
                      acessos
                    </Badge>
                  </div>
                </div>

                {isLoadingPermissoes ? (
                  <div className="rounded-[16px] border border-app-border p-6 text-sm text-app-text-muted dark:border-app-border-dark dark:text-white/50">
                    Carregando permissões do perfil...
                  </div>
                ) : selectedUserPermissions.length === 0 ? (
                  <div className="rounded-[16px] border border-dashed border-app-border p-6 text-sm text-app-text-secondary dark:border-app-border-dark dark:text-white/70">
                    Nenhuma permissão foi retornada para o perfil atual deste usuário.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {groupedPermissions.map((section) => {
                      const SectionIcon = section.icon
                      const totalActions = section.items.reduce(
                        (acc, item) => acc + item.acoes.length,
                        0,
                      )

                      return (
                        <Card
                          key={section.id}
                          className="rounded-[18px] border border-app-border/80 p-5 shadow-sm dark:border-app-border-dark/80"
                        >
                          <div className="mb-4 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                              <SectionIcon className="h-4.5 w-4.5 text-[var(--app-primary)] dark:text-[#4ADE80]" />
                              <h5 className="font-normal text-app-text-primary dark:text-white">
                                {section.title}
                              </h5>
                            </div>
                            <Badge
                              variant="secondary"
                              className="rounded-md bg-app-bg-secondary px-3 py-1 text-xs font-normal text-app-text-secondary dark:bg-app-card/10 dark:text-white"
                            >
                              {totalActions} ações
                            </Badge>
                          </div>

                          <div className="grid gap-2">
                            {section.items.map((grupo) =>
                              grupo.acoes.map((acao) => (
                                <div
                                  key={`${section.id}-${grupo.recurso}-${acao}`}
                                  className="flex items-center justify-between gap-3 rounded-[12px] p-3 transition-colors hover:bg-app-bg-secondary dark:hover:bg-app-hover"
                                >
                                  <div className="flex items-center gap-3">
                                    <CheckCircle2 className="h-5 w-5 fill-[var(--app-info-bg)] text-[var(--app-primary)] dark:fill-[var(--app-primary)]/20 dark:text-[#4ADE80]" />
                                    <div className="flex flex-col">
                                      <span className="text-sm font-normal text-app-text-primary dark:text-gray-200">
                                        {RESOURCE_LABELS[grupo.recurso] ??
                                          grupo.recurso ??
                                          'Sem recurso identificado'}
                                      </span>
                                      <span className="text-xs text-app-text-muted dark:text-white/50">
                                        {ACTION_LABELS[acao] ?? acao}
                                      </span>
                                    </div>
                                  </div>
                                  <Switch checked disabled aria-label={`Permissão ${acao}`} />
                                </div>
                              )),
                            )}
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="px-6 py-6 pt-4">
              <Button
                onClick={() => setIsPermissionsOpen(false)}
                className="h-10 rounded-integrallys px-5 text-white"
              >
                Fechar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent
          size="sm"
          className="gap-0 overflow-hidden rounded-[24px] border border-app-border p-0 dark:border-app-border-dark"
        >
          <div className="bg-app-card dark:bg-app-card-dark">
            <DialogHeader className="items-center space-y-2 px-6 pb-4 pt-8 text-center">
              <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full app-status-danger dark:app-status-danger0/10">
                <AlertTriangle className="h-7 w-7 text-[var(--app-danger-text)]" />
              </div>
              <DialogTitle className="text-xl font-bold text-app-text-primary dark:text-white">
                Confirmar Inativação
              </DialogTitle>
              <DialogDescription className="max-w-xs text-app-text-muted">
                Deseja realmente inativar este usuário? O registro continuará no banco, mas o acesso
                ficará bloqueado até nova ativação.
              </DialogDescription>
            </DialogHeader>

            {selectedUser && (
              <div className="mx-6 mt-6 rounded-xl border border-transparent app-status-danger dark:app-status-danger0/10 p-4 text-center">
                <p className="text-sm font-bold text-[var(--app-danger-text)]">
                  Usuário: <span className="font-extrabold">{selectedUser.nome}</span>
                </p>
              </div>
            )}

            <DialogFooter className="px-6 pb-8 pt-2 sm:justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeleteOpen(false)}
                className="h-11 rounded-[12px] px-6"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void handleDelete()}
                disabled={isSubmitting}
                className="h-11 rounded-[12px] bg-[var(--app-danger-text)] px-6 text-white"
              >
                Inativar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
