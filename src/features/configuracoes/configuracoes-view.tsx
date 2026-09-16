'use client'

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Bell,
  Calendar,
  Camera,
  Clock,
  Cpu,
  Mail,
  Monitor,
  Moon,
  Save,
  Shield,
  Stethoscope,
  User,
  Video,
  Volume2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { SegmentedControl } from '@/components/shared/segmented-control'
import { useConfiguracoes } from '@/features/configuracoes/hooks/use-configuracoes'
import { useAuth } from '@/hooks/use-auth'
import { useDarkMode } from '@/hooks/use-dark-mode'
import { HardwareView } from '@/components/global/hardware-view'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useAlertaPortal } from '@/hooks/use-alerta-portal'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const tabs = [
  { name: 'Perfil', icon: User },
  { name: 'Notificações', icon: Bell },
  { name: 'Agenda', icon: Calendar },
  { name: 'Segurança', icon: Shield },
  { name: 'Atendimento', icon: Stethoscope },
  { name: 'Hardware', icon: Cpu },
]

const notificationItems: Array<{ title: string; subtitle: string; icon?: LucideIcon }> = [
  { title: 'Notificações do sistema', subtitle: 'Receba alertas sobre consultas, pacientes e lembretes' },
  { title: 'Som das notificações', subtitle: 'Reproduzir som ao receber novas notificações', icon: Volume2 },
  { title: 'Notificação por email', subtitle: 'Receber resumo diário de consultas e eventos', icon: Mail },
]

const notificationTopics = [
  'Novas consultas agendadas',
  'Check-in de pacientes',
  'Consultas próximas (15 min antes)',
  'Pacientes em atraso',
  'Cancelamentos',
  'Pagamentos',
  'Confirmações pendentes',
  'Pacientes aguardando',
  'Retornos',
]

export function ConfiguracoesView() {
  const { data, error, isLoading, saveConfiguracoes } = useConfiguracoes()
  const user = useAuth((state) => state.user)
  const refreshAuth = useAuth((state) => state.initialize)
  const { isDarkMode, toggleDarkMode } = useDarkMode()
  const perfilClinico = useAuth((state) => state.capabilities.perfilClinico)
  const isEspecialista = perfilClinico
  const {
    data: patientPortalAlert,
    setData: setPatientPortalAlert,
    save: savePatientPortalAlert,
  } = useAlertaPortal()
  const [activeTab, setActiveTab] = useState('Perfil')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [profileForm, setProfileForm] = useState({
    nome: '',
    cargo: '',
    cpf: '',
    telefone: '',
    email: '',
    crm: '',
    assinatura: '',
  })
  const [notifToggles, setNotifToggles] = useState({
    sistema: true,
    som: true,
    email: true,
  })
  const [toastDuration, setToastDuration] = useState('3')
  const [exigirAssinaturaDocumentos, setExigirAssinaturaDocumentos] = useState(false)
  const [isSavingAssinaturaConfig, setIsSavingAssinaturaConfig] = useState(false)
  const [agendaPrefs, setAgendaPrefs] = useState({
    visualizacao: 'semana',
    horarioInicio: '08:00',
    duracaoPadrao: '30',
    intervalo: '0',
  })
  const [atendimentoPrefs, setAtendimentoPrefs] = useState({
    imprimirAuto: false,
    enviarSms: true,
    enviarEmail: true,
    lembreteHoras: '24',
    metodo: 'presencial',
    plataforma: 'google_meet',
  })

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = '' // permite reescolher o mesmo arquivo depois
    if (!file) return

    setIsUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/usuarios/avatar', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error ?? 'Falha ao enviar a foto.')
      }
      await refreshAuth(true)
      toast.success('Foto de perfil atualizada.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao enviar a foto.')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const updatePasswordField = (field: 'currentPassword' | 'newPassword' | 'confirmPassword', value: string) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }))
  }

  const profile = useMemo(() => {
    const nome = profileForm.nome
    return {
      ...profileForm,
      initials: nome ? nome.split(' ').map((part) => part[0]).slice(0, 2).join('') : '??',
    }
  }, [profileForm])

  // Política da clínica (admin) — `documentos.exigir_assinatura` continua vindo
  // de /api/configuracoes. NÃO é dado pessoal.
  useEffect(() => {
    if (!data.length) return
    const byKey = new Map(data.map((item) => [item.chave.toLowerCase(), item.valor]))
    setExigirAssinaturaDocumentos(byKey.get('documentos.exigir_assinatura') === 'true')
  }, [data])

  // Identidade + preferências do PRÓPRIO usuário — /api/perfil (só autenticado,
  // gravado por usuário). `email` e `cargo` voltam como read-only.
  useEffect(() => {
    let mounted = true
    const loadPerfil = async () => {
      try {
        const response = await fetch('/api/perfil', { credentials: 'include', cache: 'no-store' })
        if (!response.ok) return
        const payload = (await response.json()) as {
          data?: {
            identity?: {
              nome?: string
              email?: string
              telefone?: string
              cpf?: string
              crm?: string
              cargo?: string
            }
            prefs?: Array<{ chave: string; valor: string }>
          }
        }
        if (!mounted || !payload.data) return

        const identity = payload.data.identity ?? {}
        const byKey = new Map((payload.data.prefs ?? []).map((item) => [item.chave, item.valor]))

        setProfileForm({
          nome: identity.nome ?? '',
          cargo: identity.cargo ?? '',
          cpf: identity.cpf ?? '',
          telefone: identity.telefone ?? '',
          email: identity.email ?? '',
          crm: identity.crm ?? '',
          assinatura: byKey.get('assinatura') ?? '',
        })

        setToastDuration(byKey.get('toast_duration') ?? '3')
        setNotifToggles({
          sistema: byKey.get('notif_sistema') !== 'false',
          som: byKey.get('notif_som') !== 'false',
          email: byKey.get('notif_email') !== 'false',
        })

        setAgendaPrefs({
          visualizacao: byKey.get('agenda_visualizacao') ?? 'semana',
          horarioInicio: byKey.get('agenda_horario_inicio') ?? '08:00',
          duracaoPadrao: byKey.get('agenda_duracao') ?? '30',
          intervalo: byKey.get('agenda_intervalo') ?? '0',
        })

        setAtendimentoPrefs({
          imprimirAuto: byKey.get('atend_imprimir') === 'true',
          enviarSms: byKey.get('atend_sms') !== 'false',
          enviarEmail: byKey.get('atend_email') !== 'false',
          lembreteHoras: byKey.get('atend_lembrete_h') ?? '24',
          metodo: byKey.get('atend_metodo') ?? 'presencial',
          plataforma: byKey.get('atend_plataforma') ?? 'google_meet',
        })
      } catch {
        // silencioso — mantém os defaults locais
      }
    }

    void loadPerfil()
    return () => {
      mounted = false
    }
  }, [])

  // Dados pessoais (identidade + 15 prefs da lista fechada) vão para /api/perfil,
  // gated só por autenticação e preso a session.userId. NUNCA email/cargo (read-only)
  // nem perfil. `documentos.exigir_assinatura` (política da clínica) e a troca de
  // senha continuam nos seus próprios endpoints.
  const savePerfil = async () => {
    const response = await fetch('/api/perfil', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        identity: {
          nome: profileForm.nome,
          telefone: profileForm.telefone,
          cpf: profileForm.cpf,
          crm: profileForm.crm,
        },
        prefs: [
          { chave: 'assinatura', valor: profileForm.assinatura },
          { chave: 'notif_sistema', valor: String(notifToggles.sistema) },
          { chave: 'notif_som', valor: String(notifToggles.som) },
          { chave: 'notif_email', valor: String(notifToggles.email) },
          { chave: 'toast_duration', valor: toastDuration },
          { chave: 'agenda_visualizacao', valor: agendaPrefs.visualizacao },
          { chave: 'agenda_horario_inicio', valor: agendaPrefs.horarioInicio },
          { chave: 'agenda_duracao', valor: agendaPrefs.duracaoPadrao },
          { chave: 'agenda_intervalo', valor: agendaPrefs.intervalo },
          { chave: 'atend_imprimir', valor: String(atendimentoPrefs.imprimirAuto) },
          { chave: 'atend_sms', valor: String(atendimentoPrefs.enviarSms) },
          { chave: 'atend_email', valor: String(atendimentoPrefs.enviarEmail) },
          { chave: 'atend_lembrete_h', valor: atendimentoPrefs.lembreteHoras },
          { chave: 'atend_metodo', valor: atendimentoPrefs.metodo },
          { chave: 'atend_plataforma', valor: atendimentoPrefs.plataforma },
        ],
      }),
    })

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      throw new Error(payload?.error ?? 'Não foi possível salvar.')
    }
  }

  const handleSaveSettings = async () => {
    try {
      if (activeTab === 'Atendimento') {
        await savePatientPortalAlert(patientPortalAlert)
        await savePerfil()
        toast.success('Preferências de atendimento salvas.')
        return
      }

      if (activeTab === 'Perfil') {
        await savePerfil()
        toast.success('Perfil salvo.')
        return
      }

      if (activeTab === 'Notificações') {
        await savePerfil()
        toast.success('Notificações salvas.')
        return
      }

      if (activeTab === 'Agenda') {
        await savePerfil()
        toast.success('Preferências de agenda salvas.')
        return
      }

      toast.info('Use os botões específicos desta aba para salvar.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.')
    }
  }

  return (
    <div className="app-page app-page-loose pb-10">
      <PageHeader
        title="Configurações"
        description="Gerencie suas preferências e configurações do sistema"
      />

      <div className="rounded-[24px] border border-app-border bg-app-card p-5 shadow-sm dark:border-app-border-dark dark:bg-app-card-dark md:p-6">
        <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
          <SegmentedControl
            options={tabs.map((tab) => ({ value: tab.name, label: tab.name }))}
            value={activeTab}
            onChange={setActiveTab}
          />
        </div>
      </div>

      <div className="bg-app-card dark:bg-app-card-dark rounded-[24px] border border-app-border dark:border-app-border-dark shadow-sm overflow-hidden">
        <div className="p-8">
          {error && <p className="mb-4 text-sm text-[var(--app-danger-text)]">{error}</p>}
          {isLoading && <p className="mb-4 text-sm text-app-text-secondary dark:text-white/60">Carregando configurações...</p>}

          {activeTab === 'Perfil' && (
            <div className="space-y-8">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-app-text-primary dark:text-white">
                  <User size={20} />
                  <h3 className="text-xl font-normal">Perfil do usuário</h3>
                </div>
                <p className="text-app-text-secondary dark:text-white/60 font-normal">Informações pessoais e profissionais</p>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="h-24 w-24 md:h-28 md:w-28 rounded-full overflow-hidden bg-app-primary flex items-center justify-center text-white text-3xl font-normal">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name ?? 'Foto de perfil'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    profile.initials
                  )}
                </div>
                <div className="space-y-3 text-center md:text-left">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploadingAvatar} className="h-10 px-6 rounded-xl border-app-border dark:border-app-border-dark font-normal flex items-center gap-2 hover:bg-app-bg-secondary dark:hover:bg-app-hover transition-all">
                    <Camera size={18} />
                    {isUploadingAvatar ? 'Enviando...' : 'Alterar foto'}
                  </Button>
                  <p className="text-xs text-app-text-muted font-normal uppercase tracking-wider">
                    JPG, PNG ou WEBP. Máx. 2MB
                  </p>
                </div>
              </div>

              <div className="h-px bg-app-bg-secondary dark:bg-app-hover w-full" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {(
                  [
                    { label: 'Nome completo *', field: 'nome', placeholder: 'Nome completo' },
                    // Cargo é derivado da role (perfil) — read-only, não vai no PUT.
                    { label: 'Cargo', field: 'cargo', placeholder: 'Cargo', readOnly: true },
                    { label: 'Cpf', field: 'cpf', placeholder: 'CPF' },
                    { label: 'Telefone', field: 'telefone', placeholder: 'Telefone' },
                  ] as Array<{
                    label: string
                    field: 'nome' | 'cargo' | 'cpf' | 'telefone'
                    placeholder: string
                    readOnly?: boolean
                  }>
                ).map(({ label, field, placeholder, readOnly }) => (
                  <div key={field} className="space-y-2">
                    <label className="text-sm font-normal text-[var(--app-text-primary)] dark:text-white/70 ml-1">
                      {label}
                    </label>
                    <Input
                      value={profileForm[field]}
                      disabled={readOnly}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          [field]: event.target.value,
                        }))
                      }
                      placeholder={placeholder}
                      className="h-12 md:h-14 px-6 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl focus:ring-2 focus:ring-[var(--app-primary)] transition-all font-normal disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                ))}
                {isEspecialista && (
                  <div className="space-y-2">
                    <label className="text-sm font-normal text-[var(--app-text-primary)] dark:text-white/70 ml-1">
                      CRM *
                    </label>
                    <Input
                      value={profileForm.crm}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, crm: event.target.value }))
                      }
                      placeholder="00000-UF"
                      className="h-12 md:h-14 px-6 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl focus:ring-2 focus:ring-[var(--app-primary)] transition-all font-normal"
                    />
                  </div>
                )}
                <div className="col-span-1 md:col-span-2 space-y-2">
                  <label className="text-sm font-normal text-[var(--app-text-primary)] dark:text-white/70 ml-1">
                    E-mail
                  </label>
                  {/* E-mail é o login — read-only; a troca é fluxo à parte. */}
                  <Input
                    value={profileForm.email}
                    disabled
                    readOnly
                    className="h-12 md:h-14 px-6 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl focus:ring-2 focus:ring-[var(--app-primary)] transition-all font-normal disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {isEspecialista && (
                <>
                  <div className="h-px bg-app-bg-secondary dark:bg-app-hover w-full" />
                  <div className="space-y-2">
                    <label className="text-sm font-normal text-[var(--app-text-primary)] dark:text-white/70 ml-1">
                      Assinatura digital
                    </label>
                    <Textarea
                      value={profileForm.assinatura}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, assinatura: event.target.value }))
                      }
                      placeholder={`Dr(a). ${profile.nome} - CRM ${profile.crm ?? ''}\nEspecialista em Medicina Integrativa`}
                      className="min-h-[100px] bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl focus:ring-2 focus:ring-[var(--app-primary)] transition-all font-normal resize-none"
                    />
                  </div>
                </>
              )}

              <div className="h-px bg-app-bg-secondary dark:bg-app-hover w-full" />

              <div className="space-y-4">
                <h3 className="text-xl font-normal text-app-text-primary dark:text-white">Preferências de tema</h3>
                <div className="flex items-center justify-between p-4 rounded-2xl hover:bg-app-bg-secondary dark:hover:bg-app-hover transition-all">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-normal text-app-text-primary dark:text-white">
                      <Moon size={18} />
                      Modo escuro
                    </div>
                    <p className="text-sm text-app-text-secondary dark:text-white/60 font-normal">Alterna entre tema claro e escuro</p>
                  </div>
                  <Switch checked={isDarkMode} onCheckedChange={toggleDarkMode} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Notificações' && (
            <div className="space-y-8">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-app-text-primary dark:text-white">
                  <Bell size={20} />
                  <h3 className="text-xl font-normal">Notificações</h3>
                </div>
                <p className="text-app-text-secondary dark:text-white/60 font-normal">Configure como deseja receber alertas e notificações</p>
              </div>

              <div className="space-y-6">
                {notificationItems.map(({ title, subtitle, icon: Icon }) => {
                  const checked =
                    title === 'Notificações do sistema'
                      ? notifToggles.sistema
                      : title === 'Som das notificações'
                        ? notifToggles.som
                        : notifToggles.email

                  return (
                  <div key={title} className="flex items-center justify-between p-4 border-b border-app-border dark:border-app-border-dark pb-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-normal text-app-text-primary dark:text-white">
                        {Icon ? <Icon size={18} /> : null}
                        {title}
                      </div>
                      <p className="text-sm text-app-text-secondary dark:text-white/60 font-normal">{subtitle}</p>
                    </div>
                    <Switch
                      checked={checked}
                      onCheckedChange={(value) =>
                        setNotifToggles((current) => ({
                          ...current,
                          sistema: title === 'Notificações do sistema' ? value : current.sistema,
                          som: title === 'Som das notificações' ? value : current.som,
                          email: title === 'Notificação por email' ? value : current.email,
                        }))
                      }
                    />
                  </div>
                  )
                })}

                <div className="space-y-4 pt-4">
                  <label className="text-sm font-normal text-app-text-primary dark:text-white/80">Tempo de exibição do toast</label>
                  <Select value={toastDuration} onValueChange={setToastDuration}>
                    <SelectTrigger className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal">
                      <SelectValue preferPlaceholder placeholder="Selecione o tempo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 segundos</SelectItem>
                      <SelectItem value="5">5 segundos</SelectItem>
                      <SelectItem value="8">8 segundos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4 pt-6">
                  <p className="font-normal text-app-text-primary dark:text-white">Notificar sobre:</p>
                  <div className="grid grid-cols-1 gap-4">
                    {notificationTopics.map((item) => (
                      <div key={item} className="flex items-center justify-between p-1">
                        <span className="text-sm font-normal text-app-text-secondary dark:text-white/60">{item}</span>
                        <Switch defaultChecked />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Agenda' && (
            <div className="space-y-8">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-app-text-primary dark:text-white">
                  <Calendar size={20} />
                  <h3 className="text-xl font-normal">Preferências de agenda</h3>
                </div>
                <p className="text-app-text-secondary dark:text-white/60 font-normal">Configure como deseja visualizar e gerenciar a agenda</p>
              </div>

              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="text-sm font-normal text-[var(--app-text-primary)] dark:text-white/70">Visualização padrão</label>
                  <Select
                    value={agendaPrefs.visualizacao}
                    onValueChange={(value) =>
                      setAgendaPrefs((current) => ({ ...current, visualizacao: value }))
                    }
                  >
                    <SelectTrigger className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal">
                      <SelectValue preferPlaceholder placeholder="Selecione a visualização" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dia">Dia</SelectItem>
                      <SelectItem value="semana">Semana</SelectItem>
                      <SelectItem value="mes">Mês</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-normal text-[var(--app-text-primary)] dark:text-white/70">Horário de início</label>
                  <div className="relative">
                    <Input
                      value={agendaPrefs.horarioInicio}
                      onChange={(event) =>
                        setAgendaPrefs((current) => ({ ...current, horarioInicio: event.target.value }))
                      }
                      className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal pr-10"
                    />
                    <Clock size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-app-text-muted" />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-normal text-[var(--app-text-primary)] dark:text-white/70">Duração padrão (min)</label>
                  <Input
                    value={agendaPrefs.duracaoPadrao}
                    onChange={(event) =>
                      setAgendaPrefs((current) => ({ ...current, duracaoPadrao: event.target.value }))
                    }
                    className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-normal text-[var(--app-text-primary)] dark:text-white/70">Intervalo entre consultas (min)</label>
                  <Input
                    value={agendaPrefs.intervalo}
                    onChange={(event) =>
                      setAgendaPrefs((current) => ({ ...current, intervalo: event.target.value }))
                    }
                    className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Segurança' && (
            <div className="space-y-8">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-app-text-primary dark:text-white">
                  <Shield size={20} />
                  <h3 className="text-xl font-normal">Privacidade e segurança</h3>
                </div>
                <p className="text-app-text-secondary dark:text-white/60 font-normal">Gerencie suas configurações de segurança</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <p className="font-normal text-app-text-primary dark:text-white">Alterar senha</p>
                  <div className="max-w-3xl space-y-4">
                    <Input type="password" placeholder="Senha atual" value={passwordForm.currentPassword} onChange={(event) => updatePasswordField('currentPassword', event.target.value)} className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal" />
                    <Input type="password" placeholder="Nova senha" value={passwordForm.newPassword} onChange={(event) => updatePasswordField('newPassword', event.target.value)} className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal" />
                    <Input type="password" placeholder="Confirmar nova senha" value={passwordForm.confirmPassword} onChange={(event) => updatePasswordField('confirmPassword', event.target.value)} className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal" />
                    {passwordFeedback && (
                      <p
                        className={`text-sm ${
                          passwordFeedback.type === 'success'
                            ? 'text-[var(--app-success-text)]'
                            : 'text-[var(--app-danger-text)]'
                        }`}
                      >
                        {passwordFeedback.message}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      className="h-10 px-6 rounded-xl border-app-border dark:border-app-border-dark font-normal hover:bg-app-bg-secondary dark:hover:bg-app-hover"
                      onClick={async () => {
                        setIsChangingPassword(true)
                        setPasswordFeedback(null)
                        try {
                          const response = await fetch('/api/auth/password', {
                            method: 'PUT',
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            cache: 'no-store',
                            body: JSON.stringify(passwordForm),
                          })

                          if (!response.ok) {
                            const payload = (await response.json().catch(() => null)) as { error?: string } | null
                            throw new Error(payload?.error ?? 'Não foi possível atualizar a senha.')
                          }

                          setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
                          setPasswordFeedback({ type: 'success', message: 'Senha alterada com sucesso.' })
                          toast.success('Senha alterada com sucesso.')
                        } catch (err) {
                          const message = err instanceof Error ? err.message : 'Não foi possível atualizar a senha.'
                          setPasswordFeedback({ type: 'error', message })
                          toast.error(message)
                        } finally {
                          setIsChangingPassword(false)
                        }
                      }}
                      disabled={isChangingPassword}
                    >
                      {isChangingPassword ? 'Atualizando...' : 'Atualizar senha'}
                    </Button>
                  </div>
                </div>

                <div className="h-px bg-app-bg-secondary dark:bg-app-bg-dark/50 w-full" />

                <div className="space-y-4">
                  <p className="font-normal text-app-text-primary dark:text-white">Assinatura de documentos clínicos</p>
                  <p className="text-sm text-app-text-secondary dark:text-white/60 font-normal">
                    Quando ativo, o profissional precisa desenhar a assinatura no SignaturePad antes
                    de gerar o PDF do documento. PIN/certificado digital com validade jurídica é
                    decisão de produto e fica fora deste toggle.
                  </p>
                  <div className="flex items-center justify-between max-w-3xl rounded-2xl border border-app-border dark:border-app-border-dark p-4">
                    <div>
                      <p className="text-sm font-medium text-app-text-primary dark:text-white">
                        Exigir assinatura para documentos clínicos
                      </p>
                      <p className="text-xs text-app-text-muted">
                        Aplica-se aos documentos gerados no atendimento (laudos, declarações,
                        encaminhamentos, dietas etc).
                      </p>
                    </div>
                    <Switch
                      checked={exigirAssinaturaDocumentos}
                      disabled={isSavingAssinaturaConfig}
                      onCheckedChange={async (next) => {
                        setExigirAssinaturaDocumentos(next)
                        setIsSavingAssinaturaConfig(true)
                        try {
                          await saveConfiguracoes([
                            {
                              chave: 'documentos.exigir_assinatura',
                              valor: String(next),
                              categoria: 'documentos',
                            },
                          ])
                          toast.success(next ? 'Assinatura passou a ser exigida.' : 'Exigência desativada.')
                        } catch (err) {
                          setExigirAssinaturaDocumentos(!next)
                          toast.error(err instanceof Error ? err.message : 'Falha ao salvar configuração')
                        } finally {
                          setIsSavingAssinaturaConfig(false)
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Atendimento' && (
            <div className="space-y-8">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-app-text-primary dark:text-white">
                  <Stethoscope size={20} />
                  <h3 className="text-xl font-normal">Preferências de atendimento</h3>
                </div>
                <p className="text-app-text-secondary dark:text-white/60 font-normal">Configure como deseja gerenciar o atendimento</p>
              </div>

              <div className="space-y-6">
                {[
                  ['Imprimir automaticamente', 'Imprimir comprovantes e recibos automaticamente'],
                  ['Enviar SMS de confirmação', 'Enviar mensagem SMS após agendar consultas'],
                  ['Enviar email de lembrete', 'Enviar email de lembrete antes das consultas'],
                ].map(([title, subtitle]) => (
                  <div key={title} className="flex items-center justify-between p-4 border-b border-app-border dark:border-app-border-dark pb-6">
                    <div className="space-y-1">
                      <div className="font-normal text-app-text-primary dark:text-white">{title}</div>
                      <p className="text-sm text-app-text-secondary dark:text-white/60 font-normal">{subtitle}</p>
                    </div>
                    <Switch
                      checked={
                        title === 'Imprimir automaticamente'
                          ? atendimentoPrefs.imprimirAuto
                          : title === 'Enviar SMS de confirmação'
                            ? atendimentoPrefs.enviarSms
                            : atendimentoPrefs.enviarEmail
                      }
                      onCheckedChange={(value) =>
                        setAtendimentoPrefs((current) => ({
                          ...current,
                          imprimirAuto: title === 'Imprimir automaticamente' ? value : current.imprimirAuto,
                          enviarSms: title === 'Enviar SMS de confirmação' ? value : current.enviarSms,
                          enviarEmail: title === 'Enviar email de lembrete' ? value : current.enviarEmail,
                        }))
                      }
                    />
                  </div>
                ))}

                <div className="space-y-4 pt-4">
                  <div className="flex items-center gap-2 font-normal text-app-text-primary dark:text-white">
                    <Clock size={18} />
                    Lembrete com antecedência (horas)
                  </div>
                  <Input
                    value={atendimentoPrefs.lembreteHoras}
                    onChange={(event) =>
                      setAtendimentoPrefs((current) => ({ ...current, lembreteHoras: event.target.value }))
                    }
                    className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                  />
                </div>

                {isEspecialista && (
                  <>
                    <div className="h-px bg-app-bg-secondary dark:bg-app-bg-dark/50 w-full" />

                    <div className="space-y-4">
                      <div className="flex items-center gap-2 font-normal text-app-text-primary dark:text-white">
                        <Video size={18} />
                        Método de atendimento
                      </div>
                      <Select
                        value={atendimentoPrefs.metodo}
                        onValueChange={(value) =>
                          setAtendimentoPrefs((current) => ({ ...current, metodo: value }))
                        }
                      >
                        <SelectTrigger className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal">
                          <SelectValue placeholder="Selecione o método" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="presencial">Presencial</SelectItem>
                          <SelectItem value="online">Online</SelectItem>
                          <SelectItem value="hibrido">Híbrido</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-2 font-normal text-app-text-primary dark:text-white">
                        <Monitor size={18} />
                        Plataforma de videoconferência
                      </div>
                      <Select
                        value={atendimentoPrefs.plataforma}
                        onValueChange={(value) =>
                          setAtendimentoPrefs((current) => ({ ...current, plataforma: value }))
                        }
                      >
                        <SelectTrigger className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal">
                          <SelectValue placeholder="Selecione a plataforma" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="google_meet">Google Meet</SelectItem>
                          <SelectItem value="zoom">Zoom</SelectItem>
                          <SelectItem value="teams">Microsoft Teams</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <div className="h-px bg-app-bg-secondary dark:bg-app-bg-dark/50 w-full" />

                <div className="space-y-4">
                  <div className="flex items-center gap-2 font-normal text-app-text-primary dark:text-white">
                    <Bell size={18} />
                    Mensagem do portal do paciente
                  </div>
                  <p className="text-sm text-app-text-secondary dark:text-white/60 font-normal">
                    Esta frase aparece no alerta da home do paciente.
                  </p>

                  <div className="space-y-2">
                    <label className="text-sm font-normal text-[var(--app-text-primary)] dark:text-white/70 ml-1">
                      Título
                    </label>
                    <Input
                      value={patientPortalAlert.title}
                      onChange={(event) =>
                        setPatientPortalAlert((current) => ({ ...current, title: event.target.value }))
                      }
                      className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-normal text-[var(--app-text-primary)] dark:text-white/70 ml-1">
                      Mensagem
                    </label>
                    <Textarea
                      value={patientPortalAlert.message}
                      onChange={(event) =>
                        setPatientPortalAlert((current) => ({ ...current, message: event.target.value }))
                      }
                      className="min-h-[120px] bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Hardware' && (
            <HardwareView />
          )}

          <div className="flex justify-end pt-10">
            <Button
              className="w-full md:w-auto h-12 md:h-14 px-10 bg-app-primary hover:bg-app-primary-hover text-white font-normal rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[var(--app-primary)]/20 transition-all active:scale-[0.98]"
              onClick={() => void handleSaveSettings()}
            >
              <Save size={20} />
              Salvar alterações
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
