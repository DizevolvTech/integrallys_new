'use client'

import { Activity, CalendarCheck, CalendarX, FileCheck2, Repeat2, UserX, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardPerformance } from '@/features/home/hooks/use-dashboard'
import { AtalhoCard } from './atalho-card'

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBr = (iso: string) => iso.split('-').reverse().join('/')

const COR = { verde: '#10B981', vermelho: '#EF4444', ambar: '#F59E0B', azul: '#3B82F6', roxo: '#8B5CF6', rosa: '#EC4899', cinza: '#E5E7EB' }

interface Kpi {
  id: string
  label: string
  value: string
  sub: string
  icon: LucideIcon
  cor: string
  href?: string
}

/** Links dos atalhos por perfil (o especialista não tem financeiro). */
export interface PerformanceLinks {
  agenda?: string
  retornos?: string
  receita?: string
  prescricoes?: string
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  const Icon = kpi.icon
  return (
    <AtalhoCard href={kpi.href}>
      <div className="flex h-full flex-col gap-2 rounded-integrallys-lg border border-app-border bg-app-card p-4 dark:border-app-border-dark dark:bg-app-card-dark" style={{ borderTop: `4px solid ${kpi.cor}` }}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-app-text-muted">{kpi.label}</p>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ backgroundColor: kpi.cor }}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        </div>
        <p className="text-2xl font-medium tabular-nums text-app-text-primary dark:text-white">{kpi.value}</p>
        <p className="text-xs text-app-text-muted">{kpi.sub}</p>
      </div>
    </AtalhoCard>
  )
}

function Donut({ dados }: { dados: Array<{ nome: string; total: number; cor: string }> }) {
  const soma = dados.reduce((acc, d) => acc + d.total, 0)
  if (soma === 0) return <div className="flex h-full items-center justify-center text-sm text-app-text-muted">Sem dados no período</div>
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={dados} dataKey="total" nameKey="nome" innerRadius={50} outerRadius={80} paddingAngle={2}>
          {dados.map((d) => (
            <Cell key={d.nome} fill={d.cor} />
          ))}
        </Pie>
        <Tooltip />
        <Legend verticalAlign="bottom" iconType="circle" />
      </PieChart>
    </ResponsiveContainer>
  )
}

function ChartCard({ titulo, sub, children }: { titulo: string; sub: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-integrallys-lg border border-app-border shadow-sm dark:border-app-border-dark dark:bg-app-card-dark">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-normal text-app-text-primary dark:text-white">{titulo}</CardTitle>
        <p className="text-xs text-app-text-muted">{sub}</p>
      </CardHeader>
      <CardContent className="pb-6">
        <div className="h-[240px] w-full">{children}</div>
      </CardContent>
    </Card>
  )
}

export function PerformancePanel({ performance, titulo, links }: { performance: DashboardPerformance; titulo: string; links: PerformanceLinks }) {
  const p = performance
  const periodo = `${dataBr(p.periodo.de)} a ${dataBr(p.periodo.ate)}`
  const retornosPendentes = p.retornos.limitePrazo + p.retornos.vencidos
  const kpis: Kpi[] = [
    { id: 'realizados', label: 'Atendimentos realizados', value: String(p.realizados), sub: 'concluídos no período', icon: CalendarCheck, cor: COR.verde, href: links.agenda },
    { id: 'faltas', label: 'Faltas', value: String(p.faltas), sub: 'não comparecimentos', icon: UserX, cor: COR.vermelho, href: links.agenda },
    { id: 'cancelamentos', label: 'Cancelamentos', value: String(p.cancelamentos), sub: 'consultas canceladas', icon: CalendarX, cor: COR.ambar, href: links.agenda },
    { id: 'retornos', label: 'Retornos', value: String(p.retornosAgendados), sub: `agendados · ${p.retornos.limitePrazo} no limite, ${p.retornos.vencidos} vencidos`, icon: Repeat2, cor: COR.roxo, href: retornosPendentes > 0 ? links.retornos : undefined },
    { id: 'receita', label: 'Receita gerada', value: brl(p.receita.total), sub: `atendimentos ${brl(p.receita.atendimentos)} · prescrições ${brl(p.receita.prescricoes)}`, icon: Wallet, cor: COR.azul, href: links.receita },
    { id: 'ocupacao', label: 'Ocupação da agenda', value: `${p.ocupacao.percentual.toLocaleString('pt-BR')}%`, sub: `${p.ocupacao.ocupados} ocupados · ${p.ocupacao.disponiveis} horários livres`, icon: Activity, cor: COR.rosa, href: links.agenda },
    { id: 'conversao', label: 'Prescrições convertidas', value: `${p.prescricoes.convertidas} de ${p.prescricoes.total}`, sub: `${p.prescricoes.taxaConversao.toLocaleString('pt-BR')}% viraram venda`, icon: FileCheck2, cor: COR.verde, href: links.prescricoes },
  ]
  const corStatus = { realizados: COR.verde, faltas: COR.vermelho, cancelamentos: COR.ambar }

  return (
    <section className="space-y-4" aria-label={titulo}>
      <div>
        <h3 className="text-lg font-normal text-app-text-primary dark:text-white">{titulo}</h3>
        <p className="text-xs text-app-text-muted">Período: {periodo}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard titulo="Atendimentos, faltas e cancelamentos" sub={periodo}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={p.porStatus} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="nome" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'rgba(59, 130, 246, 0.08)' }} />
              <Bar dataKey="total" name="Quantidade" radius={[6, 6, 0, 0]}>
                {p.porStatus.map((d) => (
                  <Cell key={d.chave} fill={corStatus[d.chave]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard titulo="Ocupação da agenda" sub="Horários ocupados x livres">
          <Donut dados={[{ nome: 'Ocupados', total: p.ocupacao.ocupados, cor: COR.rosa }, { nome: 'Livres', total: p.ocupacao.disponiveis, cor: COR.cinza }]} />
        </ChartCard>
        <ChartCard titulo="Prescrições convertidas" sub="Prescrições e vendas que viraram venda">
          <Donut dados={[{ nome: 'Convertidas', total: p.prescricoes.convertidas, cor: COR.verde }, { nome: 'Não convertidas', total: p.prescricoes.total - p.prescricoes.convertidas, cor: COR.cinza }]} />
        </ChartCard>
      </div>
    </section>
  )
}
