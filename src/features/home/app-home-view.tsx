'use client'

import { useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Cake,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  Package,
  Receipt,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  User,
  UserX,
  Users,
  Wallet,
  Plus,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { DateInput } from '@/components/shared/date-input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AtalhoCard } from '@/features/home/components/atalho-card'
import { PerformancePanel } from '@/features/home/components/performance-panel'
import { RetornosCards } from '@/features/home/components/retornos-cards'
import { useDashboard, type DashboardCardItem, type DashboardEspecialistaCharts, type DashboardPerformance, type TipoFaturamento } from '@/features/home/hooks/use-dashboard'

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6']

const iconByCardId = {
  'agenda-hoje': Calendar,
  confirmados: CheckCircle2,
  'em-espera': Users,
  atrasados: Clock,
  entradas: TrendingUp,
  saidas: TrendingDown,
  saldo: DollarSign,
  unidades: Wallet,
  usuarios: User,
  especialistas: Stethoscope,
  pacientes: Users,
  receita: CreditCard,
  pendentes: Clock,
  concluidas: TrendingUp,
  notas: Receipt,
  'lista-espera': Users,
  'pendentes-retorno': Clock,
  'pendentes-presc': FileText,
} as const

const statusTone = (status: string) => {
  const normalized = status.toLowerCase()
  if (normalized.includes('confirm') || normalized.includes('check') || normalized.includes('concl')) {
    return 'app-status-success text-[var(--app-success-text)] dark:bg-transparent dark:text-[var(--app-success-text)]'
  }
  if (normalized.includes('espera') || normalized.includes('pend') || normalized.includes('aguard')) {
    return 'app-status-warning text-[var(--app-warning-text)] dark:bg-transparent dark:text-[var(--app-warning-text)]'
  }
  if (normalized.includes('cancel') || normalized.includes('atras')) {
    return 'app-status-danger text-[var(--app-danger-text)] dark:bg-transparent dark:text-[var(--app-danger-text)]'
  }
  return 'bg-app-bg-secondary text-app-text-secondary dark:bg-app-hover dark:text-white/80'
}

function DashboardCardsGrid({
  cards,
  columns = 'lg:grid-cols-4',
}: {
  cards: DashboardCardItem[]
  columns?: string
}) {
  return (
    <div className={`app-grid-stats ${columns}`}>
      {cards.map((card) => {
        const Icon = iconByCardId[card.id as keyof typeof iconByCardId] ?? DollarSign
        return (
          <AtalhoCard key={card.id} href={card.href}>
            <StatCard
              label={card.label}
              value={card.value}
              {...(card.description ? { sub: card.description } : {})}
              icon={Icon}
              className="h-full"
            />
          </AtalhoCard>
        )
      })}
    </div>
  )
}

function RecepcaoDashboard({
  cards,
  appointments,
  retornos,
}: {
  cards: DashboardCardItem[]
  appointments: Array<{ id: string; patient: string; professional: string; procedure: string; status: string; time: string }>
  retornos: { limitePrazo: number; vencidos: number }
}) {
  const todayLabel = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(new Date())

  return (
    <>
      <Card className="rounded-[28px] border-app-border bg-gradient-to-r from-app-primary to-[#2756d8] text-white shadow-lg dark:border-app-primary/20 dark:from-app-primary dark:to-[#1f4dcf]">
        <CardContent className="flex flex-col gap-6 p-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Recepção</p>
            <div className="space-y-2">
              <h2 className="text-3xl font-semibold tracking-tight">Central Operacional do Dia</h2>
              <p className="max-w-2xl text-sm text-white/80">
                Acompanhe a agenda, confirme pacientes e avance rápido para os fluxos mais usados da recepção.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:w-[420px]">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Hoje</p>
              <p className="mt-1 text-sm font-medium capitalize">{todayLabel}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Em foco</p>
              <p className="mt-1 text-sm font-medium">Recepção e agenda ativa</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <DashboardCardsGrid cards={cards} />

      <RetornosCards retornos={retornos} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {[
          {
            href: '/agenda',
            icon: Calendar,
            title: 'Abrir agenda',
            description: 'Gerencie confirmações, status e encaixes do dia.',
          },
          {
            href: '/pacientes',
            icon: Users,
            title: 'Novo paciente',
            description: 'Cadastre, edite e acompanhe o vínculo com o portal.',
          },
          {
            href: '/lista-espera',
            icon: Clock,
            title: 'Lista de espera',
            description: 'Organize encaixes e acompanhe prioridades.',
          },
          {
            href: '/caixa',
            icon: Wallet,
            title: 'Abrir caixa',
            description: 'Acesse rapidamente a operação financeira da recepção.',
          },
        ].map((shortcut) => {
          const Icon = shortcut.icon
          return (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className="group rounded-[24px] border border-app-border bg-app-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-app-primary/30 hover:shadow-md dark:border-app-border-dark dark:bg-app-card-dark"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-app-bg-secondary text-app-primary dark:bg-app-hover">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-app-text-primary dark:text-white">{shortcut.title}</h3>
                    <p className="mt-1 text-sm text-app-text-muted">{shortcut.description}</p>
                  </div>
                </div>
                <ArrowRight className="mt-1 h-5 w-5 text-app-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-app-primary" />
              </div>
            </Link>
          )
        })}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-app-text-primary dark:text-white/90">
            <Clock className="h-5 w-5" />
            <h2 className="text-lg font-normal">Próximos atendimentos</h2>
          </div>
          <Button asChild className="text-white">
            <Link href="/agenda">Ver agenda completa</Link>
          </Button>
        </div>

        <div className="space-y-3">
          {appointments.length === 0 && (
            <Card className="rounded-[22px] border-app-border bg-app-card shadow-sm dark:border-app-border-dark dark:bg-app-card-dark">
              <CardContent className="p-5 text-sm text-app-text-muted">Nenhum atendimento para hoje.</CardContent>
            </Card>
          )}
          {appointments.map((appointment) => (
            <Card key={appointment.id} className="rounded-[22px] border-app-border bg-app-card shadow-sm transition-all hover:shadow-md dark:border-app-border-dark dark:bg-app-card-dark">
              <CardContent className="flex flex-col items-center justify-between gap-4 p-5 md:flex-row">
                <div className="flex w-full items-center gap-4 md:w-auto">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-app-bg-secondary text-app-text-muted dark:bg-app-hover dark:text-white/60">
                    <User size={24} />
                  </div>
                  <div>
                    <h4 className="text-base font-normal text-app-text-primary dark:text-white">{appointment.patient}</h4>
                    <p className="text-sm font-normal text-app-text-muted dark:text-white/60">
                      {appointment.professional} • {appointment.procedure}
                    </p>
                  </div>
                </div>
                <div className="flex w-full items-center justify-between gap-6 md:w-auto md:justify-end">
                  <span className={`${statusTone(appointment.status)} inline-flex min-h-8 items-center rounded-full px-3.5 py-1 text-xs font-medium`}>
                    {appointment.status}
                  </span>
                  <span className="text-sm font-normal text-app-text-primary dark:text-white">{appointment.time}</span>
                  <button className="text-app-text-muted transition-colors hover:text-app-text-secondary dark:hover:text-white/80">
                    <Bell size={20} />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  )
}

function EspecialistaDashboard({
  cards,
  recentPatients,
  charts,
  performance,
}: {
  cards: DashboardCardItem[]
  recentPatients: Array<{ id: string; initials: string; name: string; type: string; time: string; status: string }>
  charts?: DashboardEspecialistaCharts
  performance?: DashboardPerformance
}) {
  const semanaData = charts?.atendimentosPorSemana ?? []
  const tiposData = charts?.tiposConsulta ?? []
  const totalAtendimentosUltimas4Semanas = semanaData.reduce((acc, item) => acc + item.total, 0)
  const totalTipos = tiposData.reduce((acc, item) => acc + item.total, 0)
  const hasChartData = totalAtendimentosUltimas4Semanas > 0 || totalTipos > 0
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visão geral do sistema e indicadores de desempenho"
      />

      <div className="app-grid-stats lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = iconByCardId[card.id as keyof typeof iconByCardId] ?? Calendar
          return (
            <AtalhoCard key={card.id} href={card.href}>
              <StatCard
                label={card.label.charAt(0).toUpperCase() + card.label.slice(1).toLowerCase()}
                value={card.value}
                {...(card.description ? { sub: card.description } : {})}
                icon={Icon}
                className="h-full"
              />
            </AtalhoCard>
          )
        })}
      </div>

      {performance && (
        <PerformancePanel
          performance={performance}
          titulo="Minha performance no mês"
          links={{ agenda: '/agenda', prescricoes: '/prescricoes' }}
        />
      )}

      {hasChartData && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="rounded-integrallys-lg border border-app-border shadow-sm dark:border-app-border-dark dark:bg-app-card-dark">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-normal text-app-text-primary dark:text-white">
                Atendimentos por semana
              </CardTitle>
              <p className="text-xs text-app-text-muted">Últimas 4 semanas</p>
            </CardHeader>
            <CardContent className="pb-6">
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={semanaData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="semana" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(59, 130, 246, 0.08)' }} />
                    <Bar dataKey="total" name="Atendimentos" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-integrallys-lg border border-app-border shadow-sm dark:border-app-border-dark dark:bg-app-card-dark">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-normal text-app-text-primary dark:text-white">
                Distribuição por tipo de consulta
              </CardTitle>
              <p className="text-xs text-app-text-muted">Total nas últimas 4 semanas</p>
            </CardHeader>
            <CardContent className="pb-6">
              <div className="h-[260px] w-full">
                {tiposData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-app-text-muted">
                    Sem dados de tipo de consulta
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={tiposData}
                        dataKey="total"
                        nameKey="tipo"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                      >
                        {tiposData.map((_, index) => (
                          <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-normal text-app-text-primary dark:text-white">Últimos pacientes atendidos</h3>
        <div className="flex flex-col gap-3">
          {recentPatients.length === 0 && (
            <Card className="rounded-[12px] border border-app-border dark:border-app-border-dark">
              <CardContent className="p-5 text-sm text-app-text-muted">Nenhum paciente encontrado para hoje.</CardContent>
            </Card>
          )}
          {recentPatients.map((patient) => (
            <div
              key={patient.id}
              className="flex items-center justify-between rounded-[12px] border border-app-border bg-app-card p-4 transition-all duration-300 hover:shadow-sm dark:border-app-border-dark dark:bg-app-card-dark"
            >
              <div className="flex items-center gap-3">
                <div className="app-status-success flex h-10 w-10 items-center justify-center rounded-full text-sm font-normal">
                  {patient.initials}
                </div>
                <div className="flex flex-col">
                  <p className="leading-tight text-app-text-primary dark:text-white">{patient.name}</p>
                  <p className="text-xs text-app-text-muted">{patient.type}</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-sm font-normal text-app-text-primary dark:text-white">{patient.time}</span>
                <Badge className={`rounded-full border-none px-3 py-0.5 text-xs font-normal text-white shadow-sm ${patient.status.toLowerCase().includes('concl') ? 'app-status-success' : 'app-status-info'}`}>
                  {patient.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function GestorDashboard({
  accounts,
  paymentsDue,
  receivables,
  appointments,
  retornos,
}: {
  retornos: { limitePrazo: number; vencidos: number }
  accounts: Array<{ id: string; type: string; name: string; balance: string; color: string; href?: string }>
  paymentsDue: Array<{ title: string; cat: string; date: string; value: string }>
  receivables: Array<{ title: string; cat: string; date: string; value: string }>
  appointments: Array<{ id: string; patient: string; professional: string; procedure: string; status: string; time: string }>
}) {
  return (
    <>
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div className="flex items-center gap-2 text-sm text-app-text-muted">
          <span className="font-normal text-app-text-muted">Gestão</span>
          <span>/</span>
          <span className="font-normal text-app-text-primary dark:text-white">Dashboard</span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-app-border bg-app-card px-4 py-3 shadow-sm dark:border-app-border-dark dark:bg-app-card-dark">
            <span className="text-xs font-normal uppercase tracking-widest text-app-text-muted">Período:</span>
            <span className="text-sm font-normal text-app-text-primary dark:text-white">Este mês</span>
          </div>
          <Button asChild className="h-11 rounded-xl px-6 text-white shadow-lg shadow-[var(--app-text-primary)]/10">
            <Link href="/financeiro">
              <Plus size={18} />
              Novo lançamento
            </Link>
          </Button>
        </div>
      </div>

      <div className="app-grid-stats md:grid-cols-3">
        {[
          {
            id: 'entradas',
            title: 'Entrada total no período',
            value: accounts.find((item) => item.id === 'receber')?.balance ?? 'R$ 0,00',
            tone: 'text-[var(--app-success-text)] bg-emerald-50 dark:bg-emerald-500/10',
            iconWrap: 'bg-emerald-500',
            icon: TrendingUp,
            helper: 'Receitas registradas no mês',
          },
          {
            id: 'saidas',
            title: 'Saída total no período',
            value: accounts.find((item) => item.id === 'pagar')?.balance ?? 'R$ 0,00',
            tone: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10',
            iconWrap: 'bg-rose-500',
            icon: TrendingDown,
            helper: 'Despesas registradas no mês',
          },
          {
            id: 'saldo',
            title: 'Saldo do período',
            value: accounts.find((item) => item.id === 'saldo')?.balance ?? 'R$ 0,00',
            tone: 'text-[var(--app-success-text)] app-status-success dark:bg-emerald-500/10',
            iconWrap: 'bg-app-primary',
            icon: DollarSign,
            helper: 'Resultado consolidado do mês',
          },
        ].map((metric) => {
          const Icon = metric.icon
          return (
            <AtalhoCard key={metric.id} href="/financeiro">
            <Card className="h-full rounded-integrallys-lg border border-app-border bg-app-card shadow-sm dark:border-app-border-dark dark:bg-app-card-dark">
              <CardContent className="p-8">
                <div className="flex items-start justify-between">
                  <div className="space-y-4">
                    <p className="text-sm font-normal text-app-text-muted">{metric.title}</p>
                    <h3 className="text-3xl font-normal tracking-tight text-app-text-primary dark:text-white">{metric.value}</h3>
                    <div className={`flex w-fit items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-normal ${metric.tone}`}>
                      <Icon size={14} />
                      {metric.helper}
                    </div>
                  </div>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-[12px] text-white shadow-sm ${metric.iconWrap}`}>
                    <Icon size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>
            </AtalhoCard>
          )
        })}
      </div>

      <RetornosCards retornos={retornos} />

      <div className="space-y-4">
        <h3 className="flex items-center gap-2 text-xl font-normal text-app-text-primary dark:text-white">
          <Wallet size={20} className="text-[#6a7282]" />
          Saldo de contas
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <AtalhoCard key={account.id} href={account.href}>
              <div className="h-full rounded-integrallys-lg border border-app-border bg-app-card p-6 shadow-sm transition-all hover:border-app-primary/20 dark:border-app-border-dark dark:bg-app-card-dark">
                <div className="mb-4 flex items-center gap-3">
                  <div className={`rounded-lg p-2 text-white ${account.color}`}>
                    <Wallet size={18} />
                  </div>
                  <span className="text-xs font-normal uppercase tracking-wider text-app-text-muted">{account.type}</span>
                </div>
                <h4 className="mb-1 text-sm font-normal text-app-text-muted">{account.name}</h4>
                <p className="text-xl font-normal text-app-text-primary dark:text-white">{account.balance}</p>
              </div>
            </AtalhoCard>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="overflow-hidden rounded-[24px] border border-app-border bg-app-card shadow-sm dark:border-app-border-dark dark:bg-app-card-dark">
          <div className="flex items-center justify-between border-b border-app-border p-6 dark:border-app-border-dark">
            <h3 className="text-lg font-normal text-app-text-primary dark:text-white">Pagamentos a vencer</h3>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {paymentsDue.length === 0 && <div className="p-6 text-sm text-app-text-muted">Sem saídas pendentes.</div>}
            {paymentsDue.map((item) => (
              <div key={`${item.title}-${item.date}`} className="flex items-center justify-between p-6 transition-colors hover:bg-app-bg-secondary dark:hover:bg-app-hover">
                <div className="space-y-1">
                  <h4 className="text-sm font-normal text-app-text-primary dark:text-white">{item.title}</h4>
                  <p className="flex items-center gap-1.5 text-xs text-app-text-muted">
                    <span>{item.cat}</span>
                    <span className="h-1 w-1 rounded-full bg-gray-300" />
                    <span>Vence em {item.date}</span>
                  </p>
                </div>
                <span className="text-sm font-normal text-app-text-primary dark:text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-app-border bg-app-card shadow-sm dark:border-app-border-dark dark:bg-app-card-dark">
          <div className="flex items-center justify-between border-b border-app-border p-6 dark:border-app-border-dark">
            <h3 className="text-lg font-normal text-app-text-primary dark:text-white">Entradas a receber</h3>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {receivables.length === 0 && <div className="p-6 text-sm text-app-text-muted">Sem entradas previstas.</div>}
            {receivables.map((item) => (
              <div key={`${item.title}-${item.date}`} className="flex items-center justify-between p-6 transition-colors hover:bg-app-bg-secondary dark:hover:bg-app-hover">
                <div className="space-y-1">
                  <h4 className="text-sm font-normal text-app-text-primary dark:text-white">{item.title}</h4>
                  <p className="flex items-center gap-1.5 text-xs text-app-text-muted">
                    <span>{item.cat}</span>
                    <span className="h-1 w-1 rounded-full bg-gray-300" />
                    <span>Expectativa em {item.date}</span>
                  </p>
                </div>
                <span className="text-sm font-normal text-app-text-primary dark:text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Card className="overflow-hidden rounded-[24px] border border-app-border shadow-sm dark:border-app-border-dark dark:bg-app-card-dark">
        <CardContent className="p-0">
          <div className="border-b border-app-border p-8 dark:border-app-border-dark">
            <h3 className="text-xl font-normal text-app-text-primary dark:text-white">Agenda consolidada - hoje</h3>
            <p className="mt-1 text-sm font-normal text-[#6a7282]">Agendamentos da unidade no dia atual</p>
          </div>
          <div className="space-y-3 p-6">
            {appointments.length === 0 && <p className="text-sm text-app-text-muted">Nenhum agendamento para hoje.</p>}
            {appointments.map((appointment) => (
              <div key={appointment.id} className="flex flex-col gap-3 rounded-integrallys-lg border border-app-border bg-app-bg-secondary/40 p-4 md:flex-row md:items-center md:justify-between dark:border-app-border-dark dark:bg-app-hover/30">
                <div>
                  <p className="font-normal text-app-text-primary dark:text-white">{appointment.patient}</p>
                  <p className="text-sm text-app-text-muted">{appointment.professional} • {appointment.procedure}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`${statusTone(appointment.status)} inline-flex rounded-full px-3 py-1 text-xs font-medium`}>
                    {appointment.status}
                  </span>
                  <span className="text-sm font-normal text-app-text-primary dark:text-white">{appointment.time}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  )
}

type AdminAdmin = {
  activities: Array<{ label: string; time: string; color: string }>
  unitStatus: { ativas: number; manutencao: number; agendamentosHoje: number }
  birthdays: Array<{ id: string; name: string; date: string }>
  saldoCaixas: Array<{ id: string; unidadeId: string; unidade: string; status: string; saldo: number; troco: number; cofre: number }>
  saldoBancos: Array<{ id: string; unidade: string; nome: string; banco: string; tipo: string; saldo: number }>
  financeiroPorUnidade: Array<{ unidadeId: string | null; unidade: string; entradas: number; saidas: number; saldo: number; faturamento: Record<TipoFaturamento, number> }>
  faturamentoTotal: Record<TipoFaturamento, number>
  notasEmitidas: { registrado: boolean; aviso: string; pendentes?: number; emitidas?: number; valorPendente?: number; valorEmitido?: number }
  unidadesComparativo: Array<{ unidadeId: string | null; unidadeNome: string; agendamentos: number; receita: number }>
  prescricoesPendentes: { limitePrazo: number; vencidos: number }
  retornosPendentes: { limitePrazo: number; vencidos: number }
  listaEsperaCount: number
  estoqueCritico: { count: number; itens: Array<{ id: string; nome: string; quantidade: number; estoqueMinimo: number }> }
  topProcedimentos: Array<{ nome: string; total: number }>
  inadimplencia: { totalValor: number; totalLancamentos: number; link: string }
  noShowSemanal: {
    cancelados: number
    noShow: number
    total: number
    taxaCancelamento: string
    taxaNoShow: string
  }
  aniversariantesSemana: Array<{ id: string; nome: string; dataNascimento: string; diaAniversario: string }>
}

interface AdminFiltersState {
  periodo: string
  de: string
  ate: string
  unidadeId: string
}

interface AdminFiltersControls {
  state: AdminFiltersState
  unidades: Array<{ id: string; nome: string }>
  onChange: (next: Partial<AdminFiltersState>) => void
}

const PERIODO_OPTIONS: { value: string; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: 'mes', label: 'Este mês' },
  { value: 'custom', label: 'Personalizado' },
]

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function AdminDashboard({
  cards,
  admin,
  charts,
  performance,
  filters,
}: {
  cards: DashboardCardItem[]
  admin: AdminAdmin
  charts?: DashboardEspecialistaCharts
  performance?: DashboardPerformance
  filters: AdminFiltersControls
}) {
  const {
    activities,
    unitStatus,
    birthdays,
    saldoCaixas,
    saldoBancos,
    financeiroPorUnidade,
    faturamentoTotal,
    notasEmitidas,
    unidadesComparativo,
    prescricoesPendentes,
    retornosPendentes,
    listaEsperaCount,
    estoqueCritico,
    topProcedimentos,
    inadimplencia,
    noShowSemanal,
    aniversariantesSemana,
  } = admin

  const totalCaixas = saldoCaixas.reduce((acc, item) => acc + item.saldo, 0)
  const totalBancos = saldoBancos.reduce((acc, item) => acc + item.saldo, 0)
  const totalPosicaoFinanceira = totalCaixas + totalBancos

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-app-text-muted">
        <span className="font-normal text-app-text-muted">Administrativo</span>
        <span>/</span>
        <span className="font-normal text-app-text-primary dark:text-white">Dashboard</span>
      </div>

      <div className="flex flex-col gap-3 rounded-integrallys-lg border border-app-border bg-app-card p-3 shadow-sm dark:border-app-border-dark dark:bg-app-card-dark md:flex-row md:items-center md:gap-4">
        <div className="flex flex-wrap items-center gap-1 rounded-[12px] bg-app-bg-secondary/70 p-1 dark:bg-app-hover/40">
          {PERIODO_OPTIONS.map((option) => {
            const isActive = filters.state.periodo === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => filters.onChange({ periodo: option.value })}
                className={`rounded-integrallys px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-app-primary text-white shadow-sm'
                    : 'text-app-text-secondary hover:text-app-primary dark:text-white/60'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        {filters.state.periodo === 'custom' && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wider text-app-text-muted">De</span>
              <DateInput value={filters.state.de} onChange={(value) => filters.onChange({ de: value })} />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wider text-app-text-muted">Até</span>
              <DateInput value={filters.state.ate} onChange={(value) => filters.onChange({ ate: value })} />
            </div>
          </div>
        )}

        <div className="md:ml-auto w-full md:w-auto">
          <Select
            value={filters.state.unidadeId || 'all'}
            onValueChange={(value) => filters.onChange({ unidadeId: value })}
          >
            <SelectTrigger className="h-10 rounded-xl md:w-64">
              <SelectValue placeholder="Todas as unidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as unidades</SelectItem>
              {filters.unidades.map((unidade) => (
                <SelectItem key={unidade.id} value={unidade.id}>
                  {unidade.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = iconByCardId[card.id as keyof typeof iconByCardId] ?? Wallet
          return (
            <AtalhoCard key={card.id} href={card.href}>
              <StatCard
                label={card.label}
                value={card.value}
                sub={card.description ?? 'Dados reais'}
                icon={Icon}
                className="h-full"
              />
            </AtalhoCard>
          )
        })}
      </div>

      {/* Atenção: retornos e prescrições no limite do prazo ou vencidos + lista de espera (cada card é atalho) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { href: '/retornos?situacao=vencido', titulo: 'Retornos vencidos', valor: retornosPendentes.vencidos, sub: 'Prazo expirado, sem agendamento', tom: 'red', icon: AlertTriangle },
          { href: '/retornos?situacao=limite', titulo: 'Retornos no limite', valor: retornosPendentes.limitePrazo, sub: 'Vencem nos próximos 10 dias', tom: 'amber', icon: Clock },
          { href: '/relatorios?aba=prescricoes&situacao=vencido', titulo: 'Prescrições vencidas', valor: prescricoesPendentes.vencidos, sub: 'Validade expirada', tom: 'red', icon: FileText },
          { href: '/relatorios?aba=prescricoes&situacao=limite', titulo: 'Prescrições no limite', valor: prescricoesPendentes.limitePrazo, sub: 'Vencem nos próximos 10 dias', tom: 'amber', icon: FileText },
        ].map((item) => {
          const Icon = item.icon
          const cor = item.tom === 'red'
            ? 'border-red-200 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/20'
            : 'border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20'
          const texto = item.tom === 'red' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'
          return (
            <Link key={item.titulo} href={item.href} className={`rounded-integrallys-lg border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${cor}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${texto}`}>{item.titulo}</p>
                  <h3 className={`text-2xl font-medium ${texto}`}>{item.valor}</h3>
                  <p className="text-sm text-app-text-muted">{item.sub}</p>
                </div>
                <Icon className={`h-5 w-5 ${texto}`} />
              </div>
            </Link>
          )
        })}

        <Link
          href="/lista-espera"
          className="rounded-integrallys-lg border border-app-border bg-app-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-app-border-dark dark:bg-app-card-dark"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-app-text-muted">Lista de espera</p>
              <h3 className="text-2xl font-medium text-app-text-primary dark:text-white">{listaEsperaCount}</h3>
              <p className="text-sm text-app-text-muted">Pacientes aguardando agendamento</p>
            </div>
            <Users className="h-5 w-5 text-app-primary" />
          </div>
        </Link>
      </div>

      {performance && (
        <PerformancePanel
          performance={performance}
          titulo="Performance de atendimentos"
          links={{ agenda: '/agenda', retornos: '/retornos?situacao=vencido', receita: '/financeiro', prescricoes: '/prescricoes' }}
        />
      )}

      {/* Inadimplência / no-show / aniversariantes da semana */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link
          href={inadimplencia.link}
          className="rounded-integrallys-lg border border-red-200 bg-red-50/60 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-red-900/40 dark:bg-red-950/20"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600 dark:text-red-400">Inadimplência</p>
              <h3 className="text-2xl font-medium text-red-700 dark:text-red-300">{formatCurrency(inadimplencia.totalValor)}</h3>
              <p className="text-sm text-red-600/80 dark:text-red-400/70">
                {inadimplencia.totalLancamentos === 0
                  ? 'Nenhum lançamento vencido'
                  : `${inadimplencia.totalLancamentos} lançamento(s) em atraso`}
              </p>
            </div>
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
        </Link>

        <Link
          href="/relatorios?aba=agendamentos&periodo=7d"
          className="rounded-integrallys-lg border border-amber-200 bg-amber-50/60 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-amber-900/40 dark:bg-amber-950/20"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">No-show / Cancelamentos (7 dias)</p>
              <h3 className="text-2xl font-medium text-amber-700 dark:text-amber-300">
                {noShowSemanal.taxaNoShow} <span className="text-base text-amber-600/80">no-show</span>
              </h3>
              <p className="text-sm text-amber-600/80 dark:text-amber-400/70">
                {noShowSemanal.cancelados} cancelado(s) · {noShowSemanal.noShow} faltas · {noShowSemanal.total} agendamento(s) no período
              </p>
            </div>
            <UserX className="h-5 w-5 text-amber-500" />
          </div>
        </Link>

        <Link
          href="/pacientes"
          className="rounded-integrallys-lg border border-app-border bg-app-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-app-border-dark dark:bg-app-card-dark"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-muted">Aniversariantes da semana</p>
              <h3 className="text-2xl font-medium text-app-text-primary dark:text-white">{aniversariantesSemana.length}</h3>
              <p className="text-sm text-app-text-muted">
                {aniversariantesSemana.length === 0
                  ? 'Sem aniversariantes nos próximos 7 dias'
                  : aniversariantesSemana.slice(0, 3).map((p) => `${p.nome.split(' ')[0]} (${p.diaAniversario})`).join(', ')}
              </p>
            </div>
            <Cake className="h-5 w-5 text-app-primary" />
          </div>
        </Link>
      </div>

      {/* Saldo de caixas e bancos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Saldo de caixas</CardTitle>
              <p className="mt-1 text-xs text-app-text-muted">Último caixa de cada unidade, caixinha de troco e cofre</p>
            </div>
            <Badge variant="outline" className="text-[var(--app-info-text)]">{formatCurrency(totalCaixas)}</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {saldoCaixas.length === 0 && (
                <p className="text-sm text-app-text-muted">Nenhum caixa foi aberto ainda.</p>
              )}
              {saldoCaixas.map((caixa) => (
                <Link key={caixa.id} href="/caixa" className="flex items-center justify-between rounded-sm p-1 transition-colors hover:bg-app-bg-secondary dark:hover:bg-app-hover">
                  <div className="space-y-0.5">
                    <span className="text-sm text-app-text-primary dark:text-white/90">{caixa.unidade}</span>
                    <p className="text-xs text-app-text-muted">
                      Caixa {caixa.status} · troco {formatCurrency(caixa.troco)} · cofre {formatCurrency(caixa.cofre)}
                    </p>
                  </div>
                  <span className="text-sm font-medium tabular-nums">{formatCurrency(caixa.saldo)}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Saldo de bancos</CardTitle>
              <p className="mt-1 text-xs text-app-text-muted">Contas bancárias ativas</p>
            </div>
            <Badge variant="outline" className="text-[var(--app-info-text)]">{formatCurrency(totalBancos)}</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {saldoBancos.length === 0 && (
                <p className="text-sm text-app-text-muted">Nenhuma conta bancária ativa.</p>
              )}
              {saldoBancos.map((conta) => (
                <Link key={conta.id} href="/gestao-bancaria" className="flex items-center justify-between rounded-sm p-1 transition-colors hover:bg-app-bg-secondary dark:hover:bg-app-hover">
                  <div className="space-y-0.5">
                    <span className="text-sm text-app-text-primary dark:text-white/90">{conta.nome}</span>
                    <p className="text-xs text-app-text-muted">{conta.banco || '—'} · {conta.tipo} · {conta.unidade}</p>
                  </div>
                  <span className="text-sm font-medium tabular-nums">{formatCurrency(conta.saldo)}</span>
                </Link>
              ))}
              {saldoBancos.length > 0 && (
                <p className="pt-2 text-xs text-app-text-muted">
                  Posição total (caixas + bancos): <strong className="text-app-text-primary dark:text-white">{formatCurrency(totalPosicaoFinanceira)}</strong>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Faturamento e saídas por unidade */}
      <Card>
        <CardHeader>
          <CardTitle>Faturamento e saídas por unidade</CardTitle>
          <p className="mt-1 text-xs text-app-text-muted">Faturamento separado em procedimentos, consultas e vendas de produtos, e total de saídas (período selecionado)</p>
        </CardHeader>
        <CardContent>
          {financeiroPorUnidade.length === 0 ? (
            <p className="text-sm text-app-text-muted">Sem lançamentos no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-app-border text-left text-xs uppercase tracking-wide text-app-text-muted dark:border-app-border-dark">
                    <th className="px-2 py-2 font-medium">Unidade</th>
                    <th className="px-2 py-2 text-right font-medium">Procedimentos</th>
                    <th className="px-2 py-2 text-right font-medium">Consultas</th>
                    <th className="px-2 py-2 text-right font-medium">Produtos</th>
                    <th className="px-2 py-2 text-right font-medium">Outros</th>
                    <th className="px-2 py-2 text-right font-medium">Faturamento</th>
                    <th className="px-2 py-2 text-right font-medium">Saídas</th>
                    <th className="px-2 py-2 text-right font-medium">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {financeiroPorUnidade.map((row) => (
                    <tr key={row.unidadeId ?? 'sem-unidade'} className="border-b border-app-border/40 last:border-b-0 dark:border-app-border-dark/40">
                      <td className="px-2 py-2 text-app-text-primary dark:text-white/90">{row.unidade}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(row.faturamento.procedimentos)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(row.faturamento.consultas)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(row.faturamento.produtos)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(row.faturamento.outros)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(row.entradas)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">{formatCurrency(row.saidas)}</td>
                      <td className={`px-2 py-2 text-right font-medium tabular-nums ${row.saldo < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-app-text-primary dark:text-white'}`}>
                        {formatCurrency(row.saldo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-app-border text-xs text-app-text-muted dark:border-app-border-dark">
                    <td className="px-2 py-2 font-medium">Total</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(faturamentoTotal.procedimentos)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(faturamentoTotal.consultas)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(faturamentoTotal.produtos)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(faturamentoTotal.outros)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          {notasEmitidas.registrado ? (
            <Link
              href="/notas-fiscais"
              className="mt-3 block rounded-lg bg-app-bg-secondary px-3 py-2 text-xs text-app-text-muted hover:text-app-text-primary dark:bg-app-hover/40"
            >
              <Receipt className="mr-1 inline h-3.5 w-3.5" aria-hidden /> Pedidos de nota fiscal: {notasEmitidas.pendentes ?? 0} pendentes ·{' '}
              {notasEmitidas.emitidas ?? 0} emitidas. Ver lista
            </Link>
          ) : (
            <p className="mt-3 rounded-lg bg-app-bg-secondary px-3 py-2 text-xs text-app-text-muted dark:bg-app-hover/40">
              <Receipt className="mr-1 inline h-3.5 w-3.5" aria-hidden /> {notasEmitidas.aviso}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Comparativo por unidade — barras agrupadas (agendamentos vs receita) */}
      {unidadesComparativo.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Comparativo por unidade — {filters.state.periodo === 'hoje' ? 'hoje' : filters.state.periodo === '7d' ? 'últimos 7 dias' : filters.state.periodo === 'custom' ? 'período personalizado' : 'este mês'}</CardTitle>
            <p className="mt-1 text-xs text-app-text-muted">Agendamentos no período e receita por unidade (eixos independentes)</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={unidadesComparativo} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="unidadeNome" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value: number) =>
                    value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value)
                  }
                />
                <Tooltip
                  formatter={(value, name) =>
                    name === 'Receita' ? formatCurrency(Number(value)) : String(value)
                  }
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="agendamentos" name="Agendamentos" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
                <Bar yAxisId="right" dataKey="receita" name="Receita" fill={CHART_COLORS[1]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Performance de atendimentos */}
      {charts && charts.atendimentosPorSemana.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Atendimentos por semana (4 semanas)</CardTitle>
              <p className="mt-1 text-xs text-app-text-muted">Volume consolidado de todas as unidades</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={charts.atendimentosPorSemana}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="semana" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="total" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Distribuição por tipo</CardTitle>
              <p className="mt-1 text-xs text-app-text-muted">Tipos de atendimento mais frequentes</p>
            </CardHeader>
            <CardContent>
              {charts.tiposConsulta.length === 0 ? (
                <p className="text-sm text-app-text-muted">Sem dados de tipo no período.</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={charts.tiposConsulta}
                      dataKey="total"
                      nameKey="tipo"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {charts.tiposConsulta.map((_, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Operacional: estoque crítico + top procedimentos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Estoque crítico</CardTitle>
              <p className="mt-1 text-xs text-app-text-muted">Itens iguais ou abaixo do estoque mínimo</p>
            </div>
            <Badge variant={estoqueCritico.count > 0 ? 'destructive' : 'outline'}>
              {estoqueCritico.count}
            </Badge>
          </CardHeader>
          <CardContent>
            {estoqueCritico.itens.length === 0 ? (
              <p className="text-sm text-app-text-muted">Nenhum item em estoque crítico.</p>
            ) : (
              <div className="space-y-2">
                {estoqueCritico.itens.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-sm p-1 transition-colors hover:bg-app-bg-secondary dark:hover:bg-app-hover">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-app-text-muted" />
                      <span className="text-sm text-app-text-primary dark:text-white/90">{item.nome}</span>
                    </div>
                    <span className="text-xs text-app-text-muted tabular-nums">
                      {item.quantidade} / {item.estoqueMinimo} mín.
                    </span>
                  </div>
                ))}
                {estoqueCritico.count > estoqueCritico.itens.length && (
                  <Link href="/estoque" className="block pt-2 text-xs text-app-primary hover:underline">
                    Ver todos os {estoqueCritico.count} itens →
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 procedimentos do mês</CardTitle>
            <p className="mt-1 text-xs text-app-text-muted">Procedimentos mais agendados nos últimos 28 dias</p>
          </CardHeader>
          <CardContent>
            {topProcedimentos.length === 0 ? (
              <p className="text-sm text-app-text-muted">Sem dados no período.</p>
            ) : (
              <div className="space-y-3">
                {topProcedimentos.map((item, index) => (
                  <div key={item.nome} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-app-bg-secondary text-xs font-medium text-app-text-secondary dark:bg-app-hover dark:text-white/80">
                      {index + 1}
                    </span>
                    <span className="flex-1 truncate text-sm text-app-text-primary dark:text-white/90">{item.nome}</span>
                    <Badge variant="outline" className="tabular-nums">{item.total}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Atividade, status, aniversariantes */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activities.length === 0 && <p className="text-sm text-app-text-secondary dark:text-app-text-muted">Sem atividade recente.</p>}
              {activities.map((activity) => (
                <div key={`${activity.label}-${activity.time}`} className="flex items-center space-x-4">
                  <div className={`h-2.5 w-2.5 rounded-full ${activity.color}`} />
                  <div>
                    <p className="text-sm font-medium text-app-text-primary dark:text-white">{activity.label}</p>
                    <p className="text-xs text-app-text-secondary dark:text-app-text-muted">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Status das Unidades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-sm p-1 transition-colors hover:bg-app-bg-secondary dark:hover:bg-app-hover">
                <span className="text-sm text-app-text-primary dark:text-white/80">Unidades Ativas</span>
                <Badge variant="default" className="border-none bg-[var(--app-success-text)] dark:bg-transparent dark:text-[var(--app-success-text)]">{unitStatus.ativas}</Badge>
              </div>
              <div className="flex items-center justify-between rounded-sm p-1 transition-colors hover:bg-app-bg-secondary dark:hover:bg-app-hover">
                <span className="text-sm text-app-text-primary dark:text-white/80">Em Manutenção</span>
                <Badge variant="secondary" className="app-status-warning border-none text-[var(--app-warning-text)] dark:bg-amber-900/30 dark:text-[var(--app-warning-text)]">{unitStatus.manutencao}</Badge>
              </div>
              <div className="flex items-center justify-between rounded-sm p-1 transition-colors hover:bg-app-bg-secondary dark:hover:bg-app-hover">
                <span className="text-sm text-app-text-primary dark:text-white/80">Novos Agendamentos</span>
                <Badge variant="outline" className="border-transparent text-[var(--app-info-text)] dark:border-blue-900 dark:text-[var(--app-info-text)]">{unitStatus.agendamentosHoje}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Aniversariantes do Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {birthdays.length === 0 && <p className="text-sm text-app-text-secondary dark:text-app-text-muted">Sem aniversariantes hoje.</p>}
              {birthdays.map((person) => (
                <div key={person.id} className="flex items-center justify-between rounded-sm p-1 transition-colors hover:bg-app-bg-secondary dark:hover:bg-app-hover">
                  <span className="text-sm text-app-text-primary dark:text-white/80">{person.name}</span>
                  <Badge variant="outline">{person.date}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function MasterDashboard({
  cards,
  activities,
  unitStatus,
}: {
  cards: Array<{ id: string; label: string; value: string; description?: string }>
  activities: Array<{ label: string; time: string; color: string }>
  unitStatus: { ativas: number; manutencao: number; agendamentosHoje: number }
}) {
  return (
    <>
      <div className="flex items-center gap-2 text-sm text-app-text-muted">
        <span className="font-normal text-app-text-muted">Plataforma</span>
        <span>/</span>
        <span className="font-normal text-app-text-primary dark:text-white">Dashboard</span>
      </div>

      <DashboardCardsGrid cards={cards} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {[
          {
            href: '/usuarios',
            icon: Users,
            title: 'Usuários globais',
            description: 'Gerencie contas, perfis e ativação da plataforma.',
          },
          {
            href: '/unidades',
            icon: Wallet,
            title: 'Unidades',
            description: 'Acompanhe operações ativas e status institucional.',
          },
          {
            href: '/auditoria',
            icon: Clock,
            title: 'Auditoria',
            description: 'Revise ações recentes e eventos críticos do sistema.',
          },
          {
            href: '/permissoes',
            icon: CheckCircle2,
            title: 'Permissões',
            description: 'Controle o acesso amplo da plataforma e dos perfis.',
          },
        ].map((shortcut) => {
          const Icon = shortcut.icon
          return (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className="group rounded-[24px] border border-app-border bg-app-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-app-primary/30 hover:shadow-md dark:border-app-border-dark dark:bg-app-card-dark"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-app-bg-secondary text-app-primary dark:bg-app-hover">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-app-text-primary dark:text-white">{shortcut.title}</h3>
                    <p className="mt-1 text-sm text-app-text-muted">{shortcut.description}</p>
                  </div>
                </div>
                <ArrowRight className="mt-1 h-5 w-5 text-app-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-app-primary" />
              </div>
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Atividade da plataforma</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activities.length === 0 && <p className="text-sm text-app-text-secondary dark:text-app-text-muted">Sem atividade recente.</p>}
              {activities.map((activity) => (
                <div key={`${activity.label}-${activity.time}`} className="flex items-center space-x-4">
                  <div className={`h-2.5 w-2.5 rounded-full ${activity.color}`} />
                  <div>
                    <p className="text-sm font-medium text-app-text-primary dark:text-white">{activity.label}</p>
                    <p className="text-xs text-app-text-secondary dark:text-app-text-muted">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Saúde operacional</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-sm p-1 transition-colors hover:bg-app-bg-secondary dark:hover:bg-app-hover">
                <span className="text-sm text-app-text-primary dark:text-white/80">Unidades ativas</span>
                <Badge variant="default" className="border-none bg-[var(--app-success-text)] dark:bg-transparent dark:text-[var(--app-success-text)]">{unitStatus.ativas}</Badge>
              </div>
              <div className="flex items-center justify-between rounded-sm p-1 transition-colors hover:bg-app-bg-secondary dark:hover:bg-app-hover">
                <span className="text-sm text-app-text-primary dark:text-white/80">Em manutenção</span>
                <Badge variant="secondary" className="app-status-warning border-none text-[var(--app-warning-text)] dark:bg-amber-900/30 dark:text-[var(--app-warning-text)]">{unitStatus.manutencao}</Badge>
              </div>
              <div className="flex items-center justify-between rounded-sm p-1 transition-colors hover:bg-app-bg-secondary dark:hover:bg-app-hover">
                <span className="text-sm text-app-text-primary dark:text-white/80">Agendamentos hoje</span>
                <Badge variant="outline" className="border-transparent text-[var(--app-info-text)] dark:border-blue-900 dark:text-[var(--app-info-text)]">{unitStatus.agendamentosHoje}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export function AppHomeView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const periodoParam = searchParams?.get('periodo') ?? ''
  const deParam = searchParams?.get('de') ?? ''
  const ateParam = searchParams?.get('ate') ?? ''
  const unidadeParam = searchParams?.get('unidade') ?? ''

  const { data, error, isLoading } = useDashboard({
    periodo: periodoParam,
    de: deParam,
    ate: ateParam,
    unidadeId: unidadeParam,
  })
  const shouldRenderTopHero = data.variant === 'recepcao'

  const adminFiltersState: AdminFiltersState = useMemo(
    () => ({
      periodo: periodoParam || 'mes',
      de: deParam,
      ate: ateParam,
      unidadeId: unidadeParam || 'all',
    }),
    [periodoParam, deParam, ateParam, unidadeParam],
  )

  const updateAdminFilters = useCallback(
    (next: Partial<AdminFiltersState>) => {
      const merged: AdminFiltersState = { ...adminFiltersState, ...next }
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      if (merged.periodo && merged.periodo !== 'mes') params.set('periodo', merged.periodo)
      else params.delete('periodo')
      if (merged.periodo === 'custom' && merged.de) params.set('de', merged.de)
      else params.delete('de')
      if (merged.periodo === 'custom' && merged.ate) params.set('ate', merged.ate)
      else params.delete('ate')
      if (merged.unidadeId && merged.unidadeId !== 'all') params.set('unidade', merged.unidadeId)
      else params.delete('unidade')
      const qs = params.toString()
      router.replace(qs ? `/?${qs}` : '/')
    },
    [adminFiltersState, router, searchParams],
  )

  const adminFiltersControls: AdminFiltersControls = useMemo(
    () => ({
      state: adminFiltersState,
      unidades: data.meta?.unidades ?? [],
      onChange: updateAdminFilters,
    }),
    [adminFiltersState, data.meta?.unidades, updateAdminFilters],
  )

  if (error && !isLoading) {
    return (
      <div className="app-page app-page-loose">
        <PageHeader
          title="Dashboard"
          description="Não foi possível carregar os indicadores desta visão."
        />
        <Card className="rounded-integrallys-lg border border-app-border bg-[var(--app-danger-bg)] p-4 text-sm text-[var(--app-danger-text)] dark:border-app-border-dark">
          {error}
        </Card>
      </div>
    )
  }

  const heroContent =
    data.variant === 'master'
      ? {
          title: 'Dashboard',
          description: 'Visão global da plataforma e indicadores institucionais',
          primaryHref: '',
          primaryLabel: '',
          secondaryHref: '',
          secondaryLabel: '',
        }
      : data.variant === 'admin'
      ? {
          title: 'Dashboard',
          description: 'Visão geral do sistema e indicadores de desempenho',
          primaryHref: '',
          primaryLabel: '',
          secondaryHref: '',
          secondaryLabel: '',
        }
      : data.variant === 'gestor'
        ? {
            title: 'Dashboard',
            description: 'Visão geral do sistema e indicadores de desempenho',
            primaryHref: '',
            primaryLabel: '',
            secondaryHref: '',
            secondaryLabel: '',
          }
      : data.variant === 'especialista'
          ? {
              title: 'Dashboard',
              description: 'Visão geral do sistema e indicadores de desempenho',
              primaryHref: '',
              primaryLabel: '',
              secondaryHref: '',
              secondaryLabel: '',
            }
          : {
              title: 'Início',
              description: 'Visão operacional da recepção, com agenda, atendimentos e atalhos rápidos.',
              primaryHref: '/agenda',
              primaryLabel: 'Ver agenda',
              secondaryHref: '/pacientes',
              secondaryLabel: 'Abrir pacientes',
            }

  return (
    <div className="app-page app-page-loose">
      {shouldRenderTopHero ? (
        <PageHeader
          title={heroContent.title}
          description={heroContent.description}
          actions={
            heroContent.primaryHref && heroContent.secondaryHref ? (
              <>
                <Button asChild className="text-white">
                  <Link href={heroContent.primaryHref}>{heroContent.primaryLabel}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={heroContent.secondaryHref}>{heroContent.secondaryLabel}</Link>
                </Button>
              </>
            ) : null
          }
        />
      ) : null}
      {isLoading ? (
        <DashboardCardsGrid
          cards={Array.from({ length: 4 }).map((_, index) => ({
            id: `loading-${index}`,
            label: 'Carregando',
            value: '...',
            description: 'aguarde',
          }))}
        />
      ) : data.variant === 'admin' ? (
        <AdminDashboard cards={data.cards} admin={data.admin} charts={data.adminCharts} performance={data.performance} filters={adminFiltersControls} />
      ) : data.variant === 'master' ? (
        <MasterDashboard
          cards={data.cards}
          activities={data.admin.activities}
          unitStatus={data.admin.unitStatus}
        />
      ) : data.variant === 'gestor' ? (
        <GestorDashboard
          accounts={data.gestor.accounts}
          paymentsDue={data.gestor.paymentsDue}
          receivables={data.gestor.receivables}
          appointments={data.appointments}
          retornos={data.retornos}
        />
      ) : data.variant === 'especialista' ? (
        <EspecialistaDashboard cards={data.cards} recentPatients={data.recentPatients} charts={data.especialistaCharts} performance={data.performance} />
      ) : (
        <RecepcaoDashboard cards={data.cards} appointments={data.appointments} retornos={data.retornos} />
      )}
    </div>
  )
}
