'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bell, Lock, Upload, User } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePerfilPaciente, type PatientPerfilData } from './hooks/use-perfil-paciente'
import { AlterarFotoModal } from './modals/alterar-foto-modal'
import { useAuth } from '@/hooks/use-auth'
import { OrigemNfFields } from '@/features/gestao-pacientes/components/origem-nf-fields'
import { ResponsavelFields } from '@/features/gestao-pacientes/components/responsavel-fields'
import { NecessidadeEspecialFields, NECESSIDADE_ESPECIAL_VAZIA } from '@/features/gestao-pacientes/components/necessidade-especial-fields'
import { camposFaltandoCadastro, mensagemCamposFaltando } from '@/features/gestao-pacientes/utils/cadastro-validacao'
import { calcularIdade } from '@/features/gestao-pacientes/utils/idade'
import { NOTA_FISCAL_VAZIA } from '@/features/gestao-pacientes/utils/nota-fiscal'
import { RESPONSAVEL_VAZIO } from '@/features/gestao-pacientes/components/responsavel-fields'

const EMPTY_PROFILE: PatientPerfilData = {
  nome: '',
  cpf: '',
  rg: '',
  inscricaoEstadual: '',
  dataNascimento: '',
  sexo: '',
  status: 'Ativo',
  telefone: '',
  email: '',
  zipCode: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  notificacoesEmail: false,
  notificacoesSms: false,
  lembretesConsultas: true,
  avisosPagamento: true,
  promocoesNovidades: false,
  indicacao: '',
  origemDetalhe: '',
  convenio: '',
  precisaNf: false,
  notaFiscal: { ...NOTA_FISCAL_VAZIA },
  specialNeeds: { ...NECESSIDADE_ESPECIAL_VAZIA },
  responsible: { ...RESPONSAVEL_VAZIO },
}

function isValidAppEmail(value: string) {
  return /^[^\s@]+@[^\s@]+$/.test(value)
}

export function ConfiguracoesView() {
  const { data, isLoading, error, savePerfil, changePassword } = usePerfilPaciente()
  const user = useAuth((s) => s.user)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null)
  const [formData, setFormData] = useState<PatientPerfilData>(EMPTY_PROFILE)
  const [profileErrors, setProfileErrors] = useState<Partial<Record<keyof PatientPerfilData, string>>>({})
  const [isLoadingCep, setIsLoadingCep] = useState(false)
  const [isAlterarFotoModalOpen, setIsAlterarFotoModalOpen] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  useEffect(() => {
    if (data) setFormData(data)
  }, [data])

  useEffect(() => {
    if (user?.avatarUrl) setAvatarUrl(user.avatarUrl)
  }, [user?.avatarUrl])

  const resetProfileForm = () => {
    setFormData(data ?? EMPTY_PROFILE)
    setProfileErrors({})
  }

  const initials = useMemo(() => {
    return formData.nome
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'PA'
  }, [formData.nome])

  const updateField = <K extends keyof PatientPerfilData>(field: K, value: PatientPerfilData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setProfileErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const updatePasswordField = (field: 'currentPassword' | 'newPassword' | 'confirmPassword', value: string) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleCepBlur = async () => {
    const cep = formData.zipCode.replace(/\D/g, '')
    if (cep.length !== 8) return

    setIsLoadingCep(true)
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const result = await response.json()

      if (result?.erro) {
        toast.error('CEP não encontrado.')
        return
      }

      setFormData((prev) => ({
        ...prev,
        zipCode: prev.zipCode || result.cep || '',
        street: prev.street || result.logradouro || '',
        neighborhood: prev.neighborhood || result.bairro || '',
        city: prev.city || result.localidade || '',
        state: prev.state || result.uf || '',
        complement: prev.complement || result.complemento || '',
      }))
    } catch {
      toast.error('Não foi possível consultar o CEP.')
    } finally {
      setIsLoadingCep(false)
    }
  }

  const validateProfile = () => {
    const nextErrors: Partial<Record<keyof PatientPerfilData, string>> = {}
    const requiredFields: Array<keyof PatientPerfilData> = [
      'nome',
      'cpf',
      'dataNascimento',
      'sexo',
      'telefone',
      'email',
      'zipCode',
      'street',
      'number',
      'neighborhood',
      'city',
      'state',
    ]

    for (const field of requiredFields) {
      if (!String(formData[field] ?? '').trim()) {
        nextErrors[field] = 'Campo obrigatório'
      }
    }

    if (formData.email && !isValidAppEmail(formData.email)) {
      nextErrors.email = 'Informe um email válido'
    }

    if (formData.zipCode && formData.zipCode.replace(/\D/g, '').length !== 8) {
      nextErrors.zipCode = 'Informe um CEP válido'
    }

    setProfileErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  // Mesmas exigências do cadastro da recepção (menor de idade exige responsável; NF com outros dados exige endereço).
  const idade = calcularIdade(formData.dataNascimento)
  const menorDeIdade = idade !== null && idade < 18
  const avisoCadastro = () =>
    mensagemCamposFaltando(
      camposFaltandoCadastro({
        nome: formData.nome,
        cpf: formData.cpf,
        dataNascimento: formData.dataNascimento,
        cep: formData.zipCode,
        telefone: formData.telefone,
        precisaNf: formData.precisaNf,
        notaFiscal: formData.notaFiscal,
        menorDeIdade,
        responsavelNome: formData.responsible.name,
        responsavelParentesco: formData.responsible.relationship,
      }),
    )

  const handleSaveProfile = async () => {
    if (!validateProfile()) {
      toast.error('Preencha os campos obrigatórios do perfil.')
      return
    }

    const faltando = avisoCadastro()
    if (faltando) {
      toast.error(faltando)
      return
    }

    try {
      await savePerfil(formData)
      setProfileErrors({})
      toast.success('Perfil atualizado com sucesso.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível atualizar o perfil.')
    }
  }

  return (
    <div className="app-page">
      <PageHeader title="Configurações Pessoais" />

      {error && <p className="text-sm text-[var(--app-danger-text)]">{error}</p>}
      {isLoading && <p className="text-app-text-secondary">Carregando perfil...</p>}

      {!isLoading && (
        <Tabs defaultValue="perfil" className="w-full">
          <TabsList className="mb-8 flex h-12 w-full flex-wrap justify-start gap-1 overflow-x-auto rounded-integrallys-lg bg-app-bg-secondary p-1 scrollbar-hide dark:bg-app-card-dark sm:flex-nowrap">
            <TabsTrigger value="perfil" className="h-full min-w-[80px] flex-1 rounded-[12px] px-4 py-2 text-sm font-normal text-app-text-secondary transition-all data-[state=active]:bg-app-primary data-[state=active]:text-white data-[state=active]:shadow-md dark:text-white/60">
              Perfil
            </TabsTrigger>
            <TabsTrigger value="notificacoes" className="h-full min-w-[80px] flex-1 rounded-[12px] px-4 py-2 text-sm font-normal text-app-text-secondary transition-all data-[state=active]:bg-app-primary data-[state=active]:text-white data-[state=active]:shadow-md dark:text-white/60">
              Notificações
            </TabsTrigger>
            <TabsTrigger value="seguranca" className="h-full min-w-[80px] flex-1 rounded-[12px] px-4 py-2 text-sm font-normal text-app-text-secondary transition-all data-[state=active]:bg-app-primary data-[state=active]:text-white data-[state=active]:shadow-md dark:text-white/60">
              Segurança
            </TabsTrigger>
          </TabsList>

          <TabsContent value="perfil" className="app-page">
            <div className="rounded-integrallys-lg border border-app-border bg-app-card p-6 shadow-sm dark:border-app-border-dark dark:bg-app-card-dark sm:p-8">
              <div className="mb-8 flex flex-col gap-6">
                <div className="flex items-center gap-2 text-app-primary dark:text-white">
                  <User className="h-5 w-5" />
                  <h3 className="text-lg font-semibold text-app-text-primary dark:text-white">Perfil do Paciente</h3>
                </div>

                <div className="flex items-center gap-6">
                  {avatarUrl || user?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl || user?.avatarUrl || ''}
                      alt="Foto do perfil"
                      className="h-20 w-20 rounded-full object-cover border border-app-border dark:border-app-border-dark"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-app-primary text-2xl font-bold text-white">
                      {initials}
                    </div>
                  )}
                  <div>
                    <Button
                      variant="outline"
                      className="h-10 rounded-integrallys border-app-border px-4 dark:border-app-border-dark"
                      onClick={() => setIsAlterarFotoModalOpen(true)}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Alterar Foto
                    </Button>
                    <p className="mt-2 text-xs text-app-text-muted">JPG, PNG ou WEBP. Máx. 2MB</p>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="rounded-[12px] border border-app-border p-5 dark:border-app-border-dark">
                  <h4 className="mb-4 text-sm font-semibold text-app-text-primary dark:text-white">Dados pessoais</h4>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-sm font-medium text-app-text-secondary dark:text-white/70">Nome completo *</Label>
                      <Input value={formData.nome} onChange={(e) => updateField('nome', e.target.value)} className="h-11 rounded-integrallys" required />
                      {profileErrors.nome && <p className="text-xs text-[var(--app-danger-text)]">{profileErrors.nome}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-app-text-secondary dark:text-white/70">CPF *</Label>
                      <Input value={formData.cpf} onChange={(e) => updateField('cpf', e.target.value)} className="h-11 rounded-integrallys" required />
                      {profileErrors.cpf && <p className="text-xs text-[var(--app-danger-text)]">{profileErrors.cpf}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-app-text-secondary dark:text-white/70">RG</Label>
                      <Input value={formData.rg} onChange={(e) => updateField('rg', e.target.value)} className="h-11 rounded-integrallys" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-app-text-secondary dark:text-white/70">Inscrição estadual</Label>
                      <Input value={formData.inscricaoEstadual} onChange={(e) => updateField('inscricaoEstadual', e.target.value)} className="h-11 rounded-integrallys" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-app-text-secondary dark:text-white/70">Data de nascimento *</Label>
                      <Input type="date" value={formData.dataNascimento} onChange={(e) => updateField('dataNascimento', e.target.value)} className="h-11 rounded-integrallys" required />
                      {profileErrors.dataNascimento && <p className="text-xs text-[var(--app-danger-text)]">{profileErrors.dataNascimento}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-app-text-secondary dark:text-white/70">Sexo *</Label>
                      <Select value={formData.sexo || 'nao_informado'} onValueChange={(value) => updateField('sexo', value === 'nao_informado' ? '' : value)}>
                        <SelectTrigger className="h-11 rounded-integrallys">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nao_informado">Selecione</SelectItem>
                          <SelectItem value="masculino">Masculino</SelectItem>
                          <SelectItem value="feminino">Feminino</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                      {profileErrors.sexo && <p className="text-xs text-[var(--app-danger-text)]">{profileErrors.sexo}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-app-text-secondary dark:text-white/70">Status</Label>
                      <Select value={formData.status || 'Ativo'} onValueChange={(value) => updateField('status', value)}>
                        <SelectTrigger className="h-11 rounded-integrallys">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Ativo">Ativo</SelectItem>
                          <SelectItem value="Inativo">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-app-text-secondary dark:text-white/70">Telefone *</Label>
                      <Input value={formData.telefone} onChange={(e) => updateField('telefone', e.target.value)} className="h-11 rounded-integrallys" required />
                      {profileErrors.telefone && <p className="text-xs text-[var(--app-danger-text)]">{profileErrors.telefone}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-app-text-secondary dark:text-white/70">Email *</Label>
                      <Input type="email" value={formData.email} onChange={(e) => updateField('email', e.target.value)} className="h-11 rounded-integrallys" required />
                      {profileErrors.email && <p className="text-xs text-[var(--app-danger-text)]">{profileErrors.email}</p>}
                    </div>
                  </div>
                </div>

                <div className="rounded-[12px] border border-app-border p-5 dark:border-app-border-dark">
                  <h4 className="mb-4 text-sm font-semibold text-app-text-primary dark:text-white">Endereço</h4>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-app-text-secondary dark:text-white/70">CEP *</Label>
                      <div className="relative">
                        <Input
                          value={formData.zipCode}
                          onChange={(e) => updateField('zipCode', e.target.value)}
                          onBlur={() => void handleCepBlur()}
                          className="h-11 rounded-integrallys pr-10"
                          placeholder="00000-000"
                          required
                        />
                        {isLoadingCep && (
                          <div className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-app-primary border-t-transparent" />
                        )}
                      </div>
                      {profileErrors.zipCode && <p className="text-xs text-[var(--app-danger-text)]">{profileErrors.zipCode}</p>}
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-sm font-medium text-app-text-secondary dark:text-white/70">Endereço *</Label>
                      <Input value={formData.street} onChange={(e) => updateField('street', e.target.value)} className="h-11 rounded-integrallys" required />
                      {profileErrors.street && <p className="text-xs text-[var(--app-danger-text)]">{profileErrors.street}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-app-text-secondary dark:text-white/70">Número *</Label>
                      <Input value={formData.number} onChange={(e) => updateField('number', e.target.value)} className="h-11 rounded-integrallys" required />
                      {profileErrors.number && <p className="text-xs text-[var(--app-danger-text)]">{profileErrors.number}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-app-text-secondary dark:text-white/70">Complemento</Label>
                      <Input value={formData.complement} onChange={(e) => updateField('complement', e.target.value)} className="h-11 rounded-integrallys" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-app-text-secondary dark:text-white/70">Bairro *</Label>
                      <Input value={formData.neighborhood} onChange={(e) => updateField('neighborhood', e.target.value)} className="h-11 rounded-integrallys" required />
                      {profileErrors.neighborhood && <p className="text-xs text-[var(--app-danger-text)]">{profileErrors.neighborhood}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-app-text-secondary dark:text-white/70">Cidade *</Label>
                      <Input value={formData.city} onChange={(e) => updateField('city', e.target.value)} className="h-11 rounded-integrallys" required />
                      {profileErrors.city && <p className="text-xs text-[var(--app-danger-text)]">{profileErrors.city}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-app-text-secondary dark:text-white/70">Estado *</Label>
                      <Input value={formData.state} onChange={(e) => updateField('state', e.target.value)} className="h-11 rounded-integrallys" required />
                      {profileErrors.state && <p className="text-xs text-[var(--app-danger-text)]">{profileErrors.state}</p>}
                    </div>
                  </div>
                </div>

                <div className="rounded-[12px] border border-app-border p-5 dark:border-app-border-dark">
                  <h4 className="mb-4 text-sm font-semibold text-app-text-primary dark:text-white">Origem e nota fiscal</h4>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-6">
                    <OrigemNfFields
                      value={{ indicacao: formData.indicacao, origemDetalhe: formData.origemDetalhe, convenio: formData.convenio, indicadoPorId: null, precisaNf: formData.precisaNf, notaFiscal: formData.notaFiscal }}
                      onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
                      buscarIndicador={false}
                    />
                  </div>
                </div>

                <div className="rounded-[12px] border border-app-border p-5 dark:border-app-border-dark">
                  <h4 className="mb-4 text-sm font-semibold text-app-text-primary dark:text-white">Responsável legal</h4>
                  {!menorDeIdade && !formData.responsible.name && (
                    <p className="text-sm text-app-text-muted">Obrigatório para menores de 18 anos; opcional acima de 70.</p>
                  )}
                  <ResponsavelFields
                    value={formData.responsible}
                    onChange={(responsible) => updateField('responsible', responsible)}
                    obrigatorio={menorDeIdade}
                    opcional={idade !== null && idade > 70}
                  />
                </div>

                <div className="rounded-[12px] border border-app-border p-5 dark:border-app-border-dark">
                  <h4 className="mb-4 text-sm font-semibold text-app-text-primary dark:text-white">Necessidades especiais</h4>
                  <NecessidadeEspecialFields value={formData.specialNeeds} onChange={(specialNeeds) => updateField('specialNeeds', specialNeeds)} />
                </div>

                <div className="flex flex-col-reverse justify-end gap-3 pt-2 sm:flex-row">
                  <Button variant="outline" className="h-11 rounded-integrallys px-6" onClick={resetProfileForm}>Cancelar</Button>
                  <Button onClick={() => void handleSaveProfile()} className="h-11 rounded-integrallys bg-app-primary px-6 text-white hover:bg-app-primary-hover">
                    Salvar Alterações
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notificacoes" className="space-y-6">
            <div className="rounded-integrallys-lg border border-app-border bg-app-card p-6 shadow-sm dark:border-app-border-dark dark:bg-app-card-dark sm:p-8">
              <div className="mb-8 flex items-center gap-2 text-app-primary dark:text-app-primary">
                <Bell className="h-5 w-5" />
                <h3 className="text-lg font-semibold text-app-text-primary dark:text-white">Preferências de Notificações</h3>
              </div>
              <div className="space-y-8">
                <div>
                  <h4 className="mb-4 text-sm font-semibold text-app-text-primary dark:text-white">Canais de Comunicação</h4>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between"><div><p className="font-medium text-app-text-primary dark:text-white">Notificações por Email</p><p className="text-sm text-app-text-muted">Receba notificações no seu email cadastrado</p></div><Switch checked={formData.notificacoesEmail} onCheckedChange={(checked) => updateField('notificacoesEmail', checked)} className="data-[state=checked]:bg-app-primary" /></div>
                    <div className="flex items-center justify-between"><div><p className="font-medium text-app-text-primary dark:text-white">Notificações por SMS</p><p className="text-sm text-app-text-muted">Receba SMS com lembretes importantes</p></div><Switch checked={formData.notificacoesSms} onCheckedChange={(checked) => updateField('notificacoesSms', checked)} className="data-[state=checked]:bg-app-primary" /></div>
                  </div>
                </div>
                <div className="border-t border-app-border pt-6 dark:border-app-border-dark">
                  <h4 className="mb-4 text-sm font-semibold text-app-text-primary dark:text-white">Tipos de Notificação</h4>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between"><div><p className="font-medium text-app-text-primary dark:text-white">Lembretes de Consultas</p><p className="text-sm text-app-text-muted">Receba lembretes 24h antes das consultas</p></div><Switch checked={formData.lembretesConsultas} onCheckedChange={(checked) => updateField('lembretesConsultas', checked)} className="data-[state=checked]:bg-app-primary" /></div>
                    <div className="flex items-center justify-between"><div><p className="font-medium text-app-text-primary dark:text-white">Avisos de Pagamento</p><p className="text-sm text-app-text-muted">Notificações sobre pagamentos pendentes</p></div><Switch checked={formData.avisosPagamento} onCheckedChange={(checked) => updateField('avisosPagamento', checked)} className="data-[state=checked]:bg-app-primary" /></div>
                    <div className="flex items-center justify-between"><div><p className="font-medium text-app-text-primary dark:text-white">Promoções e Novidades</p><p className="text-sm text-app-text-muted">Receba ofertas e atualizações da clínica</p></div><Switch checked={formData.promocoesNovidades} onCheckedChange={(checked) => updateField('promocoesNovidades', checked)} className="data-[state=checked]:bg-app-primary" /></div>
                  </div>
                </div>
              </div>
              <div className="mt-8 flex flex-col-reverse justify-end gap-3 sm:flex-row">
                <Button variant="outline" className="h-11 rounded-integrallys px-6" onClick={resetProfileForm}>Cancelar</Button>
                <Button onClick={async () => {
                  await savePerfil(formData)
                  toast.success('Preferências atualizadas com sucesso.')
                }} className="h-11 rounded-integrallys bg-app-primary px-6 text-white hover:bg-app-primary-hover">Salvar Preferências</Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="seguranca" className="space-y-6">
            <div className="rounded-integrallys-lg border border-app-border bg-app-card p-6 shadow-sm dark:border-app-border-dark dark:bg-app-card-dark sm:p-8">
              <div className="mb-2 flex items-center gap-2 text-app-primary dark:text-white">
                <Lock className="h-5 w-5" />
                <h3 className="text-lg font-semibold text-app-text-primary dark:text-white">Segurança da Conta</h3>
              </div>
              <p className="mb-8 text-sm text-app-text-muted">Altere sua senha de acesso</p>
              <div className="max-w-2xl space-y-6">
                <div className="space-y-2"><label className="text-sm font-medium text-app-text-secondary dark:text-white/70">Senha Atual</label><Input type="password" value={passwordForm.currentPassword} onChange={(e) => updatePasswordField('currentPassword', e.target.value)} className="h-11 rounded-integrallys" /></div>
                <div className="space-y-2"><label className="text-sm font-medium text-app-text-secondary dark:text-white/70">Nova Senha</label><Input type="password" value={passwordForm.newPassword} onChange={(e) => updatePasswordField('newPassword', e.target.value)} className="h-11 rounded-integrallys" /></div>
                <div className="space-y-2"><label className="text-sm font-medium text-app-text-secondary dark:text-white/70">Confirmar Nova Senha</label><Input type="password" value={passwordForm.confirmPassword} onChange={(e) => updatePasswordField('confirmPassword', e.target.value)} className="h-11 rounded-integrallys" /></div>
              </div>
              {passwordFeedback && (
                <p
                  className={`mt-4 text-sm ${
                    passwordFeedback.type === 'success'
                      ? 'text-[var(--app-success-text)]'
                      : 'text-[var(--app-danger-text)]'
                  }`}
                >
                  {passwordFeedback.message}
                </p>
              )}
              <div className="mt-8 flex flex-col-reverse justify-end gap-3 sm:flex-row">
                <Button
                  variant="outline"
                  className="h-11 rounded-integrallys px-6"
                  onClick={() => {
                    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
                    setPasswordFeedback(null)
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  className="h-11 rounded-integrallys bg-app-primary px-6 text-white hover:bg-app-primary-hover"
                  disabled={isChangingPassword}
                  onClick={async () => {
                    setIsChangingPassword(true)
                    setPasswordFeedback(null)
                    try {
                      await changePassword(passwordForm)
                      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
                      setPasswordFeedback({ type: 'success', message: 'Senha alterada com sucesso.' })
                      toast.success('Senha alterada com sucesso.')
                    } catch (err) {
                      const message = err instanceof Error ? err.message : 'Não foi possível alterar a senha.'
                      setPasswordFeedback({ type: 'error', message })
                      toast.error(message)
                    } finally {
                      setIsChangingPassword(false)
                    }
                  }}
                >
                  {isChangingPassword ? 'Alterando...' : 'Alterar Senha'}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}

      <AlterarFotoModal
        isOpen={isAlterarFotoModalOpen}
        onClose={() => setIsAlterarFotoModalOpen(false)}
        onUploaded={(url) => setAvatarUrl(url)}
      />
    </div>
  )
}
