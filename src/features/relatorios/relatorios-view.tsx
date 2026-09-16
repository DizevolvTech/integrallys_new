'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle2,
  DollarSign,
  Download,
  FileText,
  Printer,
  Search,
} from 'lucide-react'
import { useRelatorios } from '@/features/relatorios/hooks/use-relatorios'
import { useCurvaAbc, useRelatorioEstoque } from '@/features/relatorios/hooks/use-relatorio-estoque'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  usePrescricoesRelatorio,
  type PrescricaoSituacaoFilter,
} from '@/features/relatorios/hooks/use-prescricoes-relatorio'
import {
  useCaixaGestor,
  useComparativoUnidades,
  useRankingProcedimentos,
  useRankingProdutos,
} from '@/features/relatorios/hooks/use-ranking-comparativo'
import { useUsuarios } from '@/hooks/use-usuarios'
import { useUnidades } from '@/hooks/use-unidades'
import { DataTable } from '@/components/shared/data-table'
import { PageHeader } from '@/components/shared/page-header'
import { SegmentedControl } from '@/components/shared/segmented-control'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function RelatoriosView() {
  const { data, tabs, error, isLoading } = useRelatorios()
  const { data: usuarios } = useUsuarios()
  const { data: unidades } = useUnidades()
  const [activeTab, setActiveTab] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const period = 'Últimos 30 dias'
  const [specialistFilter, setSpecialistFilter] = useState('todos')
  const [planFilter, setPlanFilter] = useState('todos')
  const [unitFilter, setUnitFilter] = useState('todos')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('todos')
  const [estoqueFilters, setEstoqueFilters] = useState<{
    tipo: 'todos' | 'entrada' | 'saida' | 'consumo_interno'
    inicio: string
    fim: string
    busca: string
    categoria: string
  }>({ tipo: 'todos', inicio: '', fim: '', busca: '', categoria: 'todas' })
  const estoqueRelatorioFilters = useMemo(
    () => ({
      tipo: 'todos' as const,
      tipoMovimentacao:
        estoqueFilters.tipo === 'todos'
          ? ('todos' as const)
          : (estoqueFilters.tipo as 'entrada' | 'saida' | 'consumo_interno'),
      inicio: estoqueFilters.inicio,
      fim: estoqueFilters.fim,
      busca: estoqueFilters.busca,
    }),
    [estoqueFilters],
  )
  const estoqueRelatorio = useRelatorioEstoque(estoqueRelatorioFilters)
  const prescricoesRelatorio = usePrescricoesRelatorio()
  const [estoqueSubTab, setEstoqueSubTab] = useState<'movimentacoes' | 'curva-abc'>('movimentacoes')
  const [curvaAbcDias, setCurvaAbcDias] = useState<number>(90)
  const curvaAbc = useCurvaAbc(curvaAbcDias)
  const ranking = useRankingProdutos(90)
  const rankingProcedimentos = useRankingProcedimentos(90)
  const caixaGestor = useCaixaGestor()
  const comparativo = useComparativoUnidades(30)

  const formatMoney = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const exportComparativoCsv = () => {
    const header = 'unidade,agendamentos,receita,despesa,ticket_medio'
    const lines = comparativo.data.map(
      (r) =>
        `"${r.unidadeNome}",${r.agendamentos},${r.receita},${r.despesa},${r.ticketMedio.toFixed(2)}`,
    )
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `comparativo-unidades-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
  }

  const availableTabs = useMemo(() => {
    if (tabs.length > 0) return tabs
    return ['Consultas']
  }, [tabs])

  useEffect(() => {
    if (!activeTab || !availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0] ?? 'Consultas')
    }
  }, [activeTab, availableTabs])

  const filteredReports = useMemo(() => {
    return data.filter((item) =>
      [item.nome, item.descricao, item.atualizadoEm].join(' ').toLowerCase().includes(searchTerm.toLowerCase()),
    )
  }, [data, searchTerm])

  const currentTabReports = useMemo(() => {
    return filteredReports.filter((item) => item.categoria === activeTab)
  }, [activeTab, filteredReports])

  return (
    <div className="app-page app-page-loose pb-10">
      <PageHeader
        title="Relatórios"
        description="Visualize métricas, indicadores e consolidados operacionais no mesmo fluxo visual do projeto original."
        actions={
          <>
            <Badge variant="outline" className="rounded-full border-app-border px-3 py-1 text-xs font-normal text-app-text-secondary dark:border-app-border-dark dark:text-white/75">
              Período: {period}
            </Badge>
            <Button variant="outline" className="rounded-xl border-app-border dark:border-app-border-dark" onClick={() => setPreviewOpen(true)}>
              <Printer className="mr-2 h-4 w-4" />
              Preview
            </Button>
            <Button
              variant="outline"
              className="rounded-xl border-app-border dark:border-app-border-dark"
              onClick={() => setExportDialogOpen(true)}
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </>
        }
      />

      <div className="rounded-[24px] border border-app-border bg-app-card p-5 shadow-sm dark:border-app-border-dark dark:bg-app-card-dark md:p-6">
        <SegmentedControl
          options={availableTabs.map((tab) => ({ value: tab, label: tab }))}
          value={activeTab}
          onChange={setActiveTab}
        />
      </div>

      <div className="bg-app-card dark:bg-app-card-dark rounded-[24px] border border-app-border dark:border-app-border-dark shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xl font-normal text-app-text-primary dark:text-white">{activeTab}</h2>
              <p className="text-sm text-app-text-secondary dark:text-white/60">
                Acompanhe filtros, totalizadores e disponibilidade dos relatórios desta categoria.
              </p>
            </div>
            <Badge variant="outline" className="w-fit rounded-full border-app-border px-3 py-1 text-xs font-normal text-app-text-secondary dark:border-app-border-dark dark:text-white/75">
              {currentTabReports.length} itens
            </Badge>
          </div>

          {activeTab === 'Consultas' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="bg-app-bg-secondary/30 dark:bg-app-hover rounded-xl p-6 border border-app-border dark:border-app-border-dark">
                <div className="flex flex-col md:flex-row md:items-center justify-end gap-8">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full app-status-success text-[var(--app-success-text)]">
                      <DollarSign size={20} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-app-text-secondary uppercase tracking-wider">Total Recebido</span>
                      <span className="text-2xl font-normal text-[var(--app-success-text)]">R$ 0,00</span>
                    </div>
                  </div>
                  <div className="w-px h-12 bg-app-border dark:bg-app-border-dark hidden md:block" />
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full app-status-warning">
                      <AlertCircle size={20} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-app-text-secondary uppercase tracking-wider">Total em Aberto</span>
                      <span className="text-2xl font-normal text-[var(--app-warning-text)]">R$ 0,00</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-app-text-muted" />
                  <Input
                    placeholder="Buscar paciente..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="pl-9 h-10 rounded-xl border-app-border dark:border-app-border-dark bg-app-bg-secondary/30 dark:bg-app-hover"
                  />
                </div>
                <Select value={specialistFilter} onValueChange={setSpecialistFilter}>
                  <SelectTrigger className="h-10 rounded-xl border-app-border bg-app-bg-secondary/30">
                    <SelectValue preferPlaceholder placeholder="Todos os Especialistas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Especialistas</SelectItem>
                    {usuarios
                      .filter((u) => u.perfil?.toLowerCase() === 'especialista')
                      .map((u) => (
                        <SelectItem key={u.id} value={u.nome}>{u.nome}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger className="h-10 rounded-xl border-app-border bg-app-bg-secondary/30">
                    <SelectValue preferPlaceholder placeholder="Todos os Convênios" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Convênios</SelectItem>
                    <SelectItem value="particular">Particular</SelectItem>
                    <SelectItem value="convenio">Convênio</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={unitFilter} onValueChange={setUnitFilter}>
                  <SelectTrigger className="h-10 rounded-xl border-app-border bg-app-bg-secondary/30">
                    <SelectValue preferPlaceholder placeholder="Todas as Unidades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as Unidades</SelectItem>
                    {unidades.map((u) => (
                      <SelectItem key={u.id} value={u.nome}>{u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10 rounded-xl border-app-border bg-app-bg-secondary/30">
                    <SelectValue preferPlaceholder placeholder="Todos os Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Status</SelectItem>
                    <SelectItem value="agendado">Agendado</SelectItem>
                    <SelectItem value="confirmado">Confirmado</SelectItem>
                    <SelectItem value="em-atendimento">Em atendimento</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                    <SelectItem value="faltou">Faltou</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                  <SelectTrigger className="h-10 rounded-xl border-app-border bg-app-bg-secondary/30">
                    <SelectValue preferPlaceholder placeholder="Status Pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Pagamentos</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="nao-pago">Não pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {error && <p className="text-sm text-[var(--app-danger-text)]">{error}</p>}

              <div className="rounded-xl border border-app-border dark:border-app-border-dark overflow-hidden flex-1">
                {isLoading ? (
                  <div className="w-full overflow-x-auto">
                    <Table className="min-w-[1120px] xl:min-w-full">
                      <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-hover">
                        <TableRow className="hover:bg-transparent border-b border-app-border dark:border-app-border-dark">
                          <TableHead className="min-w-[118px] font-normal text-xs uppercase text-app-text-secondary">Data/Hora</TableHead>
                          <TableHead className="min-w-[160px] font-normal text-xs uppercase text-app-text-secondary">Paciente</TableHead>
                          <TableHead className="min-w-[168px] font-normal text-xs uppercase text-app-text-secondary">Procedimento</TableHead>
                          <TableHead className="min-w-[182px] font-normal text-xs uppercase text-app-text-secondary">Profissional/Unid.</TableHead>
                          <TableHead className="min-w-[112px] font-normal text-xs uppercase text-app-text-secondary">Plano</TableHead>
                          <TableHead className="hidden xl:table-cell min-w-[138px] font-normal text-xs uppercase text-app-text-secondary">Recorrência</TableHead>
                          <TableHead className="min-w-[144px] font-normal text-xs uppercase text-app-text-secondary">Status Pagamento</TableHead>
                          <TableHead className="hidden 2xl:table-cell min-w-[170px] font-normal text-xs uppercase text-app-text-secondary">Forma de Pagamento</TableHead>
                          <TableHead className="min-w-[154px] font-normal text-xs uppercase text-app-text-secondary">Status</TableHead>
                          <TableHead className="min-w-[108px] font-normal text-xs uppercase text-app-text-secondary text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell colSpan={10} className="h-32 text-center text-app-text-secondary">
                            Carregando relatórios...
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                ) : currentTabReports.length > 0 ? (
                  <DataTable data={currentTabReports}>
                    {(pageData) => (
                      <div className="w-full overflow-x-auto">
                        <Table className="min-w-[1120px] xl:min-w-full">
                          <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-hover">
                            <TableRow className="hover:bg-transparent border-b border-app-border dark:border-app-border-dark">
                              <TableHead className="min-w-[118px] font-normal text-xs uppercase text-app-text-secondary">Data/Hora</TableHead>
                              <TableHead className="min-w-[160px] font-normal text-xs uppercase text-app-text-secondary">Paciente</TableHead>
                              <TableHead className="min-w-[168px] font-normal text-xs uppercase text-app-text-secondary">Procedimento</TableHead>
                              <TableHead className="min-w-[182px] font-normal text-xs uppercase text-app-text-secondary">Profissional/Unid.</TableHead>
                              <TableHead className="min-w-[112px] font-normal text-xs uppercase text-app-text-secondary">Plano</TableHead>
                              <TableHead className="hidden xl:table-cell min-w-[138px] font-normal text-xs uppercase text-app-text-secondary">Recorrência</TableHead>
                              <TableHead className="min-w-[144px] font-normal text-xs uppercase text-app-text-secondary">Status Pagamento</TableHead>
                              <TableHead className="hidden 2xl:table-cell min-w-[170px] font-normal text-xs uppercase text-app-text-secondary">Forma de Pagamento</TableHead>
                              <TableHead className="min-w-[154px] font-normal text-xs uppercase text-app-text-secondary">Status</TableHead>
                              <TableHead className="min-w-[108px] font-normal text-xs uppercase text-app-text-secondary text-right">Valor</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pageData.map((item) => (
                          <TableRow key={item.id} className="hover:bg-app-bg-secondary/30 dark:hover:bg-app-hover transition-colors border-b border-app-border/50">
                            <TableCell className="py-4">
                              <div className="flex flex-col">
                                <span className="text-app-text-primary dark:text-white font-medium">{item.atualizadoEm || '-'}</span>
                                <span className="text-xs text-app-text-secondary dark:text-white/60">--:--</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-4"><span className="text-app-text-primary dark:text-white font-normal">{item.nome}</span></TableCell>
                            <TableCell className="py-4"><span className="text-app-text-secondary dark:text-white/80">{item.descricao}</span></TableCell>
                            <TableCell className="py-4">
                              <div className="flex flex-col">
                                <span className="text-app-text-primary dark:text-white text-sm">Sem unidade vinculada</span>
                                <span className="text-xs text-app-text-secondary dark:text-white/60">Unidade</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <Badge variant="outline" className="font-normal text-xs border-app-border text-app-text-secondary">-</Badge>
                            </TableCell>
                            <TableCell className="hidden xl:table-cell py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-app-bg-secondary dark:bg-app-hover rounded-full overflow-hidden">
                                  <div className="h-full bg-app-primary rounded-full" style={{ width: '0%' }} />
                                </div>
                                <span className="text-xs text-app-text-secondary">0%</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-4"><Badge variant="outline" className="w-fit font-normal text-xs border-none px-2 app-status-danger">Em aberto</Badge></TableCell>
                            <TableCell className="hidden 2xl:table-cell py-4"><span className="text-xs text-app-text-muted px-1">-</span></TableCell>
                            <TableCell className="py-4">
                              <div className="flex items-center gap-1.5">
                                <Calendar size={14} className="text-[var(--app-info-text)]" />
                                <span className="text-sm text-app-text-primary dark:text-white">Agendado</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-4 text-right"><span className="font-medium text-app-text-primary dark:text-white">R$ 0,00</span></TableCell>
                          </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </DataTable>
                ) : (
                  <div className="w-full overflow-x-auto">
                    <Table className="min-w-[1120px] xl:min-w-full">
                      <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-hover">
                        <TableRow className="hover:bg-transparent border-b border-app-border dark:border-app-border-dark">
                          <TableHead className="min-w-[118px] font-normal text-xs uppercase text-app-text-secondary">Data/Hora</TableHead>
                          <TableHead className="min-w-[160px] font-normal text-xs uppercase text-app-text-secondary">Paciente</TableHead>
                          <TableHead className="min-w-[168px] font-normal text-xs uppercase text-app-text-secondary">Procedimento</TableHead>
                          <TableHead className="min-w-[182px] font-normal text-xs uppercase text-app-text-secondary">Profissional/Unid.</TableHead>
                          <TableHead className="min-w-[112px] font-normal text-xs uppercase text-app-text-secondary">Plano</TableHead>
                          <TableHead className="hidden xl:table-cell min-w-[138px] font-normal text-xs uppercase text-app-text-secondary">Recorrência</TableHead>
                          <TableHead className="min-w-[144px] font-normal text-xs uppercase text-app-text-secondary">Status Pagamento</TableHead>
                          <TableHead className="hidden 2xl:table-cell min-w-[170px] font-normal text-xs uppercase text-app-text-secondary">Forma de Pagamento</TableHead>
                          <TableHead className="min-w-[154px] font-normal text-xs uppercase text-app-text-secondary">Status</TableHead>
                          <TableHead className="min-w-[108px] font-normal text-xs uppercase text-app-text-secondary text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell colSpan={10} className="h-32 text-center text-app-text-secondary">
                            Nenhum registro encontrado para os filtros selecionados.
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-end gap-3 px-2">
                <p className="text-sm text-[var(--app-success-text)]">Total Recebido: R$ 0,00</p>
                <p className="text-sm text-[var(--app-danger-text)]">Total em Aberto: R$ 0,00</p>
              </div>
            </div>
          )}

          {activeTab === 'Ranking' && (
            <div className="space-y-6">
              {ranking.error && <p className="text-sm text-[var(--app-danger-text)]">{ranking.error}</p>}
              {ranking.isLoading ? (
                <p className="text-sm text-app-text-muted">Carregando ranking…</p>
              ) : (
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card className="rounded-2xl border-app-border dark:border-app-border-dark">
                    <CardContent className="p-5 space-y-3">
                      <h3 className="text-base font-medium text-app-text-primary dark:text-white">Mais vendidos</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead className="text-right">Qtd</TableHead>
                            {ranking.valoresVisiveis && <TableHead className="text-right">Receita</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ranking.vendidos.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-app-text-muted">
                                Sem vendas convertidas no período.
                              </TableCell>
                            </TableRow>
                          ) : (
                            ranking.vendidos.map((row) => (
                              <TableRow key={`v-${row.produtoId ?? row.nome}`}>
                                <TableCell>{row.nome}</TableCell>
                                <TableCell className="text-right">{row.quantidade}</TableCell>
                                {ranking.valoresVisiveis && (
                                  <TableCell className="text-right">{formatMoney(row.receita)}</TableCell>
                                )}
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl border-app-border dark:border-app-border-dark">
                    <CardContent className="p-5 space-y-3">
                      <h3 className="text-base font-medium text-app-text-primary dark:text-white">Mais lucrativos</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead className="text-right">Qtd</TableHead>
                            {ranking.valoresVisiveis && <TableHead className="text-right">Margem</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ranking.lucrativos.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-app-text-muted">
                                Sem margem calculável no período.
                              </TableCell>
                            </TableRow>
                          ) : (
                            ranking.lucrativos.map((row) => (
                              <TableRow key={`l-${row.produtoId ?? row.nome}`}>
                                <TableCell>{row.nome}</TableCell>
                                <TableCell className="text-right">{row.quantidade}</TableCell>
                                {ranking.valoresVisiveis && (
                                  <TableCell className="text-right">{formatMoney(row.margem)}</TableCell>
                                )}
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="rounded-2xl border-app-border dark:border-app-border-dark">
                  <CardContent className="p-5 space-y-3">
                    <h3 className="text-base font-medium text-app-text-primary dark:text-white">
                      Procedimentos mais realizados
                    </h3>
                    {rankingProcedimentos.error && (
                      <p className="text-sm text-[var(--app-danger-text)]">{rankingProcedimentos.error}</p>
                    )}
                    {rankingProcedimentos.isLoading ? (
                      <p className="text-sm text-app-text-muted">Carregando…</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Procedimento</TableHead>
                            <TableHead className="text-right">Qtd</TableHead>
                            {rankingProcedimentos.valoresVisiveis && (
                              <TableHead className="text-right">Receita</TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rankingProcedimentos.realizados.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-app-text-muted">
                                Sem procedimentos no período.
                              </TableCell>
                            </TableRow>
                          ) : (
                            rankingProcedimentos.realizados.map((row) => (
                              <TableRow key={`pr-${row.procedimentoId ?? row.nome}`}>
                                <TableCell>{row.nome}</TableCell>
                                <TableCell className="text-right">{row.quantidade}</TableCell>
                                {rankingProcedimentos.valoresVisiveis && (
                                  <TableCell className="text-right">{formatMoney(row.receita)}</TableCell>
                                )}
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
                <Card className="rounded-2xl border-app-border dark:border-app-border-dark">
                  <CardContent className="p-5 space-y-3">
                    <h3 className="text-base font-medium text-app-text-primary dark:text-white">
                      Procedimentos por receita
                    </h3>
                    {rankingProcedimentos.isLoading ? (
                      <p className="text-sm text-app-text-muted">Carregando…</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Procedimento</TableHead>
                            <TableHead className="text-right">Qtd</TableHead>
                            {rankingProcedimentos.valoresVisiveis && (
                              <TableHead className="text-right">Receita</TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rankingProcedimentos.receita.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-app-text-muted">
                                Sem receita de procedimentos no período.
                              </TableCell>
                            </TableRow>
                          ) : (
                            rankingProcedimentos.receita.map((row) => (
                              <TableRow key={`prec-${row.procedimentoId ?? row.nome}`}>
                                <TableCell>{row.nome}</TableCell>
                                <TableCell className="text-right">{row.quantidade}</TableCell>
                                {rankingProcedimentos.valoresVisiveis && (
                                  <TableCell className="text-right">{formatMoney(row.receita)}</TableCell>
                                )}
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'Caixa Gestor' && (
            <div className="space-y-6">
              {caixaGestor.error && (
                <p className="text-sm text-[var(--app-danger-text)]">{caixaGestor.error}</p>
              )}
              {caixaGestor.isLoading || !caixaGestor.data ? (
                <p className="text-sm text-app-text-muted">Carregando caixa do gestor…</p>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card className="rounded-2xl border-app-border dark:border-app-border-dark">
                      <CardContent className="p-4">
                        <p className="text-xs text-app-text-muted">Entradas do dia</p>
                        <p className="text-lg font-medium">
                          {caixaGestor.valoresVisiveis
                            ? formatMoney(caixaGestor.data.totais.entradas)
                            : '—'}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-app-border dark:border-app-border-dark">
                      <CardContent className="p-4">
                        <p className="text-xs text-app-text-muted">Saídas do dia</p>
                        <p className="text-lg font-medium">
                          {caixaGestor.valoresVisiveis
                            ? formatMoney(caixaGestor.data.totais.saidas)
                            : '—'}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-app-border dark:border-app-border-dark">
                      <CardContent className="p-4">
                        <p className="text-xs text-app-text-muted">Saldos bancos</p>
                        <p className="text-lg font-medium">
                          {caixaGestor.valoresVisiveis
                            ? formatMoney(caixaGestor.data.saldoBancos)
                            : '—'}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-app-border dark:border-app-border-dark">
                      <CardContent className="p-4">
                        <p className="text-xs text-app-text-muted">Cofres</p>
                        <p className="text-lg font-medium">
                          {caixaGestor.valoresVisiveis
                            ? formatMoney(caixaGestor.data.saldoCofres)
                            : '—'}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <Card className="rounded-2xl border-app-border dark:border-app-border-dark">
                      <CardContent className="p-5 space-y-3">
                        <h3 className="text-base font-medium">Bancos</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Conta</TableHead>
                              <TableHead className="text-right">Saldo</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {caixaGestor.data.bancos.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={2} className="text-app-text-muted">
                                  Nenhuma conta bancária.
                                </TableCell>
                              </TableRow>
                            ) : (
                              caixaGestor.data.bancos.map((conta) => (
                                <TableRow key={conta.id}>
                                  <TableCell>
                                    {conta.nome}
                                    {conta.banco ? ` · ${conta.banco}` : ''}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {caixaGestor.valoresVisiveis
                                      ? formatMoney(conta.saldoAtual)
                                      : '—'}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-app-border dark:border-app-border-dark">
                      <CardContent className="p-5 space-y-3">
                        <h3 className="text-base font-medium">Cofres / dinheiro</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Conta</TableHead>
                              <TableHead className="text-right">Saldo</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {caixaGestor.data.cofres.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={2} className="text-app-text-muted">
                                  Nenhum cofre cadastrado.
                                </TableCell>
                              </TableRow>
                            ) : (
                              caixaGestor.data.cofres.map((conta) => (
                                <TableRow key={conta.id}>
                                  <TableCell>{conta.nome}</TableCell>
                                  <TableCell className="text-right">
                                    {caixaGestor.valoresVisiveis
                                      ? formatMoney(conta.saldoAtual)
                                      : '—'}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="rounded-2xl border-app-border dark:border-app-border-dark">
                    <CardContent className="p-5 space-y-3">
                      <h3 className="text-base font-medium">
                        Movimentos do dia ({caixaGestor.data.data})
                      </h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Forma</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {caixaGestor.data.movimentos.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-app-text-muted">
                                Sem movimentos de caixa hoje.
                              </TableCell>
                            </TableRow>
                          ) : (
                            caixaGestor.data.movimentos.map((mov) => (
                              <TableRow key={mov.id}>
                                <TableCell>{mov.descricao || '—'}</TableCell>
                                <TableCell>{mov.tipo}</TableCell>
                                <TableCell>{mov.forma || '—'}</TableCell>
                                <TableCell className="text-right">
                                  {caixaGestor.valoresVisiveis ? formatMoney(mov.valor) : '—'}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          )}

          {activeTab === 'Comparativo' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" className="rounded-xl" onClick={exportComparativoCsv}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar CSV
                </Button>
              </div>
              {comparativo.error && (
                <p className="text-sm text-[var(--app-danger-text)]">{comparativo.error}</p>
              )}
              {comparativo.isLoading ? (
                <p className="text-sm text-app-text-muted">Carregando comparativo…</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-right">Agendamentos</TableHead>
                      {comparativo.valoresVisiveis && (
                        <>
                          <TableHead className="text-right">Receita</TableHead>
                          <TableHead className="text-right">Despesa</TableHead>
                          <TableHead className="text-right">Ticket médio</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparativo.data.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-app-text-muted">
                          Nenhuma unidade com dados no período.
                        </TableCell>
                      </TableRow>
                    ) : (
                      comparativo.data.map((row) => (
                        <TableRow key={row.unidadeId}>
                          <TableCell>{row.unidadeNome}</TableCell>
                          <TableCell className="text-right">{row.agendamentos}</TableCell>
                          {comparativo.valoresVisiveis && (
                            <>
                              <TableCell className="text-right">{formatMoney(row.receita)}</TableCell>
                              <TableCell className="text-right">{formatMoney(row.despesa)}</TableCell>
                              <TableCell className="text-right">{formatMoney(row.ticketMedio)}</TableCell>
                            </>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          {activeTab === 'Estoque' && (
            <div className="space-y-6">
              <SegmentedControl
                options={[
                  { value: 'movimentacoes', label: 'Movimentações' },
                  { value: 'curva-abc', label: 'Curva ABC' },
                ]}
                value={estoqueSubTab}
                onChange={(value) => setEstoqueSubTab(value as 'movimentacoes' | 'curva-abc')}
                fullWidth={false}
                size="sm"
              />

              {estoqueSubTab === 'movimentacoes' && (
                <>
                  {estoqueRelatorio.error && (
                    <p className="text-sm text-[var(--app-danger-text)]">{estoqueRelatorio.error}</p>
                  )}
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:flex-wrap">
                <div className="space-y-1.5 min-w-[140px]">
                  <label className="text-xs font-normal text-app-text-secondary dark:text-white/60">Tipo</label>
                  <Select
                    value={estoqueFilters.tipo}
                    onValueChange={(value) =>
                      setEstoqueFilters((prev) => ({
                        ...prev,
                        tipo: value as 'todos' | 'entrada' | 'saida' | 'consumo_interno',
                      }))
                    }
                  >
                    <SelectTrigger className="h-11 rounded-xl border-app-border bg-app-bg-secondary text-sm dark:border-app-border-dark dark:bg-app-card-dark">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="entrada">Entrada</SelectItem>
                      <SelectItem value="saida">Saída</SelectItem>
                      <SelectItem value="consumo_interno">Consumo interno</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 min-w-[160px]">
                  <label className="text-xs font-normal text-app-text-secondary dark:text-white/60">Início</label>
                  <Input
                    type="date"
                    className="h-11 rounded-xl border-app-border bg-app-bg-secondary text-sm dark:border-app-border-dark dark:bg-app-card-dark"
                    value={estoqueFilters.inicio}
                    onChange={(e) => setEstoqueFilters((prev) => ({ ...prev, inicio: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5 min-w-[160px]">
                  <label className="text-xs font-normal text-app-text-secondary dark:text-white/60">Fim</label>
                  <Input
                    type="date"
                    className="h-11 rounded-xl border-app-border bg-app-bg-secondary text-sm dark:border-app-border-dark dark:bg-app-card-dark"
                    value={estoqueFilters.fim}
                    onChange={(e) => setEstoqueFilters((prev) => ({ ...prev, fim: e.target.value }))}
                  />
                </div>
                <div className="flex-1 space-y-1.5 min-w-[220px]">
                  <label className="text-xs font-normal text-app-text-secondary dark:text-white/60">Buscar produto/vínculo</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-muted" />
                    <Input
                      placeholder="Produto ou nome do vínculo"
                      className="h-11 rounded-xl border-app-border bg-app-bg-secondary pl-10 text-sm dark:border-app-border-dark dark:bg-app-card-dark"
                      value={estoqueFilters.busca}
                      onChange={(e) => setEstoqueFilters((prev) => ({ ...prev, busca: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {[
                  { label: 'Entradas (unidades)', value: estoqueRelatorio.totalEntradas, tone: 'text-[var(--app-success-text)]' },
                  { label: 'Saídas (unidades)', value: estoqueRelatorio.totalSaidas, tone: 'text-[var(--app-danger-text)]' },
                  { label: 'Saldo (unidades)', value: estoqueRelatorio.totalEntradas - estoqueRelatorio.totalSaidas, tone: 'text-app-primary' },
                ].map((stat) => (
                  <Card key={stat.label} className="rounded-[24px] border-app-border shadow-sm dark:border-app-border-dark">
                    <CardContent className="p-6">
                      <p className="text-sm font-normal text-app-text-secondary dark:text-white/60">{stat.label}</p>
                      <h2 className={`text-2xl font-normal ${stat.tone} mt-2`}>{stat.value.toLocaleString('pt-BR')}</h2>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="overflow-hidden rounded-xl border border-app-border dark:border-app-border-dark">
                <Table>
                  <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-hover">
                    <TableRow className="border-app-border dark:border-app-border-dark">
                      <TableHead className="font-normal text-app-text-secondary dark:text-white/80">Data</TableHead>
                      <TableHead className="font-normal text-app-text-secondary dark:text-white/80">Tipo</TableHead>
                      <TableHead className="font-normal text-app-text-secondary dark:text-white/80">Produto</TableHead>
                      <TableHead className="font-normal text-app-text-secondary dark:text-white/80 text-right">Qtd</TableHead>
                      <TableHead className="font-normal text-app-text-secondary dark:text-white/80">Operador</TableHead>
                      <TableHead className="font-normal text-app-text-secondary dark:text-white/80">Vínculo</TableHead>
                      <TableHead className="font-normal text-app-text-secondary dark:text-white/80">Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {estoqueRelatorio.isLoading && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-12 text-center text-app-text-secondary dark:text-white/60">
                          Carregando movimentações...
                        </TableCell>
                      </TableRow>
                    )}
                    {!estoqueRelatorio.isLoading && estoqueRelatorio.data.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-12 text-center text-app-text-secondary dark:text-white/60">
                          Nenhuma movimentação encontrada para os filtros selecionados.
                        </TableCell>
                      </TableRow>
                    )}
                    {!estoqueRelatorio.isLoading &&
                      estoqueRelatorio.data.map((item) => (
                        <TableRow key={item.id} className="border-app-border/50 dark:border-app-border-dark">
                          <TableCell className="text-app-text-secondary dark:text-white/70">
                            {item.data ? new Date(item.data).toLocaleString('pt-BR') : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`${item.tipo === 'entrada' ? 'app-status-success' : 'app-status-danger'} font-normal border-none`}
                            >
                              {item.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-normal text-app-text-primary dark:text-white">{item.produto}</TableCell>
                          <TableCell className="text-right text-app-text-primary dark:text-white">{item.quantidade}</TableCell>
                          <TableCell className="text-app-text-secondary dark:text-white/70">{item.operador ?? '—'}</TableCell>
                          <TableCell className="text-app-text-secondary dark:text-white/70">
                            {item.vinculoTipo
                              ? `${item.vinculoTipo}: ${item.vinculoNome ?? '—'}`
                              : '—'}
                          </TableCell>
                          <TableCell className="text-app-text-secondary dark:text-white/70 text-xs">
                            {item.observacao ?? '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
                </>
              )}

              {estoqueSubTab === 'curva-abc' && (
                <CurvaAbcSection
                  dias={curvaAbcDias}
                  onDiasChange={setCurvaAbcDias}
                  data={curvaAbc.data}
                  isLoading={curvaAbc.isLoading}
                  error={curvaAbc.error}
                />
              )}
            </div>
          )}

          {activeTab === 'Prescrição/Vendas' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
              {prescricoesRelatorio.error && (
                <p className="text-sm text-[var(--app-danger-text)]">{prescricoesRelatorio.error}</p>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {[
                  {
                    key: 'todos' as PrescricaoSituacaoFilter,
                    label: 'Ativas',
                    count:
                      prescricoesRelatorio.meta.noPrazo +
                      prescricoesRelatorio.meta.semValidade,
                    valor: prescricoesRelatorio.meta.valorNoPrazo,
                    border: 'border-emerald-300/60 dark:border-emerald-800/40',
                    bg: 'bg-emerald-50/60 dark:bg-emerald-950/20',
                    icon: CheckCircle2,
                    iconTone: 'text-[var(--app-success-text)]',
                    descricao: 'Total em aberto e dentro do prazo',
                  },
                  {
                    key: 'limite_prazo' as PrescricaoSituacaoFilter,
                    label: 'Limite de prazo',
                    count: prescricoesRelatorio.meta.limitePrazo,
                    valor: prescricoesRelatorio.meta.valorLimitePrazo,
                    border: 'border-amber-300/70 dark:border-amber-800/50',
                    bg: 'bg-amber-50/70 dark:bg-amber-950/20',
                    icon: AlertCircle,
                    iconTone: 'text-[var(--app-warning-text)]',
                    descricao: 'Vencem em até 10 dias',
                  },
                  {
                    key: 'vencido' as PrescricaoSituacaoFilter,
                    label: 'Vencidas',
                    count: prescricoesRelatorio.meta.vencido,
                    valor: prescricoesRelatorio.meta.valorVencido,
                    border: 'border-red-300/70 dark:border-red-800/50',
                    bg: 'bg-red-50/70 dark:bg-red-950/20',
                    icon: AlertCircle,
                    iconTone: 'text-[var(--app-danger-text)]',
                    descricao: 'Validade já vencida',
                  },
                ].map((card) => {
                  const isActive = prescricoesRelatorio.filtros.situacao === card.key
                  return (
                    <button
                      key={card.label}
                      type="button"
                      onClick={() =>
                        prescricoesRelatorio.setFiltros((prev) => ({
                          ...prev,
                          situacao: card.key,
                        }))
                      }
                      title="Clique para filtrar por esta situação"
                      className={`text-left rounded-[20px] border ${card.border} ${card.bg} p-5 transition-all hover:shadow-sm ${
                        isActive ? 'ring-2 ring-app-primary/50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-wider text-app-text-secondary dark:text-white/60">
                          {card.label}
                        </span>
                        <card.icon className={`h-5 w-5 ${card.iconTone}`} />
                      </div>
                      <p className="mt-3 text-3xl font-normal text-app-text-primary dark:text-white">
                        {card.count.toLocaleString('pt-BR')}
                      </p>
                      <p className="mt-1 text-sm text-app-text-secondary dark:text-white/70">
                        R$ {card.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="mt-2 text-xs text-app-text-muted">{card.descricao}</p>
                    </button>
                  )
                })}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="relative xl:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-app-text-muted" />
                  <Input
                    placeholder="Buscar cliente..."
                    value={prescricoesRelatorio.filtros.clienteNome}
                    onChange={(event) =>
                      prescricoesRelatorio.setFiltros((prev) => ({
                        ...prev,
                        clienteNome: event.target.value,
                      }))
                    }
                    className="pl-9 h-10 rounded-xl border-app-border dark:border-app-border-dark bg-app-bg-secondary/30 dark:bg-app-hover"
                  />
                </div>
                <Select
                  value={prescricoesRelatorio.filtros.profissionalId}
                  onValueChange={(value) =>
                    prescricoesRelatorio.setFiltros((prev) => ({
                      ...prev,
                      profissionalId: value,
                    }))
                  }
                >
                  <SelectTrigger className="h-10 rounded-xl border-app-border bg-app-bg-secondary/30">
                    <SelectValue preferPlaceholder placeholder="Todos os profissionais" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os profissionais</SelectItem>
                    {usuarios
                      .filter((u) => u.perfil?.toLowerCase() === 'especialista')
                      .map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Select
                  value={prescricoesRelatorio.filtros.situacao}
                  onValueChange={(value) =>
                    prescricoesRelatorio.setFiltros((prev) => ({
                      ...prev,
                      situacao: value as PrescricaoSituacaoFilter,
                    }))
                  }
                >
                  <SelectTrigger className="h-10 rounded-xl border-app-border bg-app-bg-secondary/30">
                    <SelectValue preferPlaceholder placeholder="Situação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as situações</SelectItem>
                    <SelectItem value="no_prazo">No prazo</SelectItem>
                    <SelectItem value="limite_prazo">Limite de prazo (≤10 dias)</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    title="Desde"
                    value={prescricoesRelatorio.filtros.desde}
                    onChange={(event) =>
                      prescricoesRelatorio.setFiltros((prev) => ({
                        ...prev,
                        desde: event.target.value,
                      }))
                    }
                    className="h-10 rounded-xl border-app-border dark:border-app-border-dark bg-app-bg-secondary/30 dark:bg-app-hover"
                  />
                  <Input
                    type="date"
                    title="Até"
                    value={prescricoesRelatorio.filtros.ate}
                    onChange={(event) =>
                      prescricoesRelatorio.setFiltros((prev) => ({
                        ...prev,
                        ate: event.target.value,
                      }))
                    }
                    className="h-10 rounded-xl border-app-border dark:border-app-border-dark bg-app-bg-secondary/30 dark:bg-app-hover"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-app-border dark:border-app-border-dark overflow-hidden">
                <div className="w-full overflow-x-auto">
                  <Table className="min-w-[1100px] xl:min-w-full">
                    <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-hover">
                      <TableRow className="hover:bg-transparent border-b border-app-border dark:border-app-border-dark">
                        <TableHead className="font-normal text-xs uppercase text-app-text-secondary">Nº</TableHead>
                        <TableHead className="font-normal text-xs uppercase text-app-text-secondary">Cliente</TableHead>
                        <TableHead className="font-normal text-xs uppercase text-app-text-secondary">Profissional</TableHead>
                        <TableHead className="font-normal text-xs uppercase text-app-text-secondary">Data</TableHead>
                        <TableHead className="font-normal text-xs uppercase text-app-text-secondary">Validade</TableHead>
                        <TableHead className="font-normal text-xs uppercase text-app-text-secondary">Tipo</TableHead>
                        <TableHead className="text-right font-normal text-xs uppercase text-app-text-secondary">Valor</TableHead>
                        <TableHead className="font-normal text-xs uppercase text-app-text-secondary">Situação</TableHead>
                        <TableHead className="font-normal text-xs uppercase text-app-text-secondary">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {prescricoesRelatorio.isLoading && (
                        <TableRow>
                          <TableCell colSpan={9} className="h-32 text-center text-app-text-secondary">
                            Carregando prescrições...
                          </TableCell>
                        </TableRow>
                      )}
                      {!prescricoesRelatorio.isLoading && prescricoesRelatorio.data.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="h-32 text-center text-app-text-secondary">
                            Nenhuma prescrição encontrada para os filtros selecionados.
                          </TableCell>
                        </TableRow>
                      )}
                      {!prescricoesRelatorio.isLoading &&
                        prescricoesRelatorio.data.map((item) => {
                          const situacaoBadge = (() => {
                            if (item.situacao === 'no_prazo') {
                              return {
                                tone: 'border-emerald-300/70 bg-emerald-100/60 text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/30 dark:text-emerald-200',
                                label: 'No prazo',
                              }
                            }
                            if (item.situacao === 'limite_prazo') {
                              return {
                                tone: 'border-amber-300/70 bg-amber-100/70 text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/30 dark:text-amber-200',
                                label: '⚠ Vence em breve',
                              }
                            }
                            if (item.situacao === 'vencido') {
                              return {
                                tone: 'border-red-300/70 bg-red-100/70 text-red-700 dark:border-red-700/40 dark:bg-red-900/30 dark:text-red-200',
                                label: 'Vencido',
                              }
                            }
                            return {
                              tone: 'border-app-border bg-app-bg-secondary/40 text-app-text-secondary dark:border-app-border-dark dark:bg-app-hover/40 dark:text-white/70',
                              label: 'Sem validade',
                            }
                          })()
                          return (
                            <TableRow
                              key={item.id}
                              className="hover:bg-app-bg-secondary/30 dark:hover:bg-app-hover transition-colors border-b border-app-border/50"
                            >
                              <TableCell className="py-4 text-app-text-primary dark:text-white">
                                {item.numero || '—'}
                              </TableCell>
                              <TableCell className="py-4 text-app-text-primary dark:text-white">
                                {item.pacienteNome || '—'}
                              </TableCell>
                              <TableCell className="py-4 text-app-text-secondary dark:text-white/70">
                                {item.profissionalNome || '—'}
                              </TableCell>
                              <TableCell className="py-4 text-app-text-secondary dark:text-white/70">
                                {item.dataPrescricao
                                  ? new Date(item.dataPrescricao).toLocaleDateString('pt-BR')
                                  : '—'}
                              </TableCell>
                              <TableCell className="py-4 text-app-text-secondary dark:text-white/70">
                                {item.validade
                                  ? new Date(item.validade).toLocaleDateString('pt-BR')
                                  : '—'}
                              </TableCell>
                              <TableCell className="py-4 text-app-text-secondary dark:text-white/70">
                                {item.tipo || '—'}
                              </TableCell>
                              <TableCell className="py-4 text-right text-app-text-primary dark:text-white">
                                R${' '}
                                {item.valorTotal.toLocaleString('pt-BR', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </TableCell>
                              <TableCell className="py-4">
                                <Badge variant="outline" className={`font-normal text-xs ${situacaoBadge.tone}`}>
                                  {situacaoBadge.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-4 text-app-text-secondary dark:text-white/70">
                                {item.status || '—'}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-end gap-3 px-2">
                <p className="text-sm text-app-text-secondary dark:text-white/70">
                  Total em aberto:{' '}
                  <span className="font-medium text-app-text-primary dark:text-white">
                    R$ {prescricoesRelatorio.meta.valorNoPrazo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </p>
                <p className="text-sm text-[var(--app-danger-text)]">
                  Vencidos: R$ {prescricoesRelatorio.meta.valorVencido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          )}

          {activeTab !== 'Consultas' && activeTab !== 'Estoque' && activeTab !== 'Prescrição/Vendas' && (
            <div className="space-y-6">
              {error && <p className="text-sm text-[var(--app-danger-text)]">{error}</p>}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {[
                { label: 'Registros', value: currentTabReports.length, icon: FileText, tone: 'text-app-primary' },
                { label: 'Concluídos', value: 0, icon: CheckCircle2, tone: 'text-[var(--app-success-text)]' },
                { label: 'Em revisão', value: 0, icon: Activity, tone: 'text-[var(--app-warning-text)]' },
                { label: 'Última atualização', value: currentTabReports[0]?.atualizadoEm || '-', icon: Calendar, tone: 'text-[var(--app-info-text)]' },
                ].map((item) => (
                  <Card key={item.label} className="rounded-[24px] border-app-border shadow-sm dark:border-app-border-dark">
                    <CardContent className="flex items-center justify-between p-6">
                      <div className="space-y-1">
                        <p className="text-sm font-normal text-app-text-secondary dark:text-white/60">{item.label}</p>
                        <h2 className="text-2xl font-normal text-app-text-primary dark:text-white">{String(item.value)}</h2>
                      </div>
                      <item.icon className={`h-6 w-6 ${item.tone}`} />
                    </CardContent>
                  </Card>
                ))}
              </div>

              {isLoading ? (
                <div className="overflow-hidden rounded-xl border border-app-border dark:border-app-border-dark">
                  <Table>
                    <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-hover">
                      <TableRow className="border-app-border dark:border-app-border-dark">
                        <TableHead className="font-normal text-app-text-secondary dark:text-white/80">Relatório</TableHead>
                        <TableHead className="font-normal text-app-text-secondary dark:text-white/80">Descrição</TableHead>
                        <TableHead className="font-normal text-app-text-secondary dark:text-white/80">Atualizado em</TableHead>
                        <TableHead className="text-right font-normal text-app-text-secondary dark:text-white/80">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell colSpan={4} className="py-12 text-center text-app-text-secondary dark:text-white/60">Carregando relatórios...</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ) : currentTabReports.length === 0 ? (
                <div className="overflow-hidden rounded-xl border border-app-border dark:border-app-border-dark">
                  <Table>
                    <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-hover">
                      <TableRow className="border-app-border dark:border-app-border-dark">
                        <TableHead className="font-normal text-app-text-secondary dark:text-white/80">Relatório</TableHead>
                        <TableHead className="font-normal text-app-text-secondary dark:text-white/80">Descrição</TableHead>
                        <TableHead className="font-normal text-app-text-secondary dark:text-white/80">Atualizado em</TableHead>
                        <TableHead className="text-right font-normal text-app-text-secondary dark:text-white/80">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell colSpan={4} className="py-12 text-center text-app-text-secondary dark:text-white/60">Nenhum relatório disponível para esta aba.</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <DataTable data={currentTabReports}>
                  {(pageData) => (
                    <div className="overflow-hidden rounded-xl border border-app-border dark:border-app-border-dark">
                      <Table>
                        <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-hover">
                          <TableRow className="border-app-border dark:border-app-border-dark">
                            <TableHead className="font-normal text-app-text-secondary dark:text-white/80">Relatório</TableHead>
                            <TableHead className="font-normal text-app-text-secondary dark:text-white/80">Descrição</TableHead>
                            <TableHead className="font-normal text-app-text-secondary dark:text-white/80">Atualizado em</TableHead>
                            <TableHead className="text-right font-normal text-app-text-secondary dark:text-white/80">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pageData.map((item) => (
                            <TableRow key={item.id} className="border-app-border/50 transition-colors hover:bg-app-bg-secondary/30 dark:border-app-border-dark dark:hover:bg-app-hover">
                              <TableCell className="font-normal text-app-text-primary dark:text-white">{item.nome}</TableCell>
                              <TableCell className="text-app-text-secondary dark:text-white/70">{item.descricao}</TableCell>
                              <TableCell className="text-app-text-secondary dark:text-white/70">{item.atualizadoEm}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant="outline" className="rounded-full border-app-border text-app-text-secondary dark:border-app-border-dark dark:text-white/80">
                                  Disponível
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </DataTable>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent size="lg" className="rounded-[24px]">
          <DialogHeader>
            <DialogTitle>Preview de relatório</DialogTitle>
            <DialogDescription>Confira o resumo do relatório antes de seguir com as próximas ações desta tela.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-xl border border-app-border p-4 dark:border-app-border-dark">
            <p className="text-sm"><strong>Aba:</strong> {activeTab}</p>
            <p className="text-sm"><strong>Período:</strong> {period}</p>
            <p className="text-sm"><strong>Itens filtrados:</strong> {currentTabReports.length}</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="rounded-[24px]">
          <DialogHeader>
            <DialogTitle>Exportar relatório</DialogTitle>
            <DialogDescription>
              Revise os dados filtrados antes de seguir com a exportação do relatório.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              className="rounded-xl bg-app-primary text-white hover:bg-app-primary-hover"
              onClick={() => setExportDialogOpen(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface CurvaAbcSectionProps {
  dias: number
  onDiasChange: (value: number) => void
  data: ReturnType<typeof useCurvaAbc>['data']
  isLoading: boolean
  error: string | null
}

const CLASSE_COLOR: Record<'A' | 'B' | 'C', string> = {
  A: 'var(--app-success-text)',
  B: '#d97706',
  C: '#64748b',
}

function classeBadgeClass(classe: 'A' | 'B' | 'C') {
  if (classe === 'A') return 'app-status-success text-[var(--app-success-text)] border-none'
  if (classe === 'B') return 'app-status-warning text-amber-800 dark:text-amber-300 border-none'
  return 'bg-app-bg-secondary text-app-text-secondary border-none'
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function CurvaAbcSection({ dias, onDiasChange, data, isLoading, error }: CurvaAbcSectionProps) {
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas')
  const categorias = useMemo(
    () =>
      Array.from(new Set(data.curvaAbc.map((row) => row.categoria).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [data.curvaAbc],
  )
  const dataFiltrada = useMemo(() => {
    if (categoriaFiltro === 'todas') return data
    return {
      ...data,
      curvaAbc: data.curvaAbc.filter((row) => row.categoria === categoriaFiltro),
    }
  }, [categoriaFiltro, data])
  const top10 = dataFiltrada.curvaAbc.slice(0, 10)

  const exportarCsv = () => {
    const header = ['Produto', 'Categoria', 'Classe', 'Qtd saídas', 'Valor consumido', '% Acumulado', 'Taxa giro', 'Estoque atual']
    const linhas = dataFiltrada.curvaAbc.map((row) => [
      `"${row.produtoNome.replace(/"/g, '""')}"`,
      `"${row.categoria.replace(/"/g, '""')}"`,
      row.classe,
      row.quantidadeSaida,
      row.valorConsumido.toFixed(2),
      row.percentualAcumulado.toFixed(2),
      row.taxaGiro.toFixed(2),
      row.estoqueAtual,
    ])
    const csv = [header, ...linhas].map((line) => line.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `curva-abc-${dias}d.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-[var(--app-danger-text)]">{error}</p>}

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="space-y-1.5 min-w-[160px]">
            <label className="text-xs font-normal text-app-text-secondary dark:text-white/60">Período</label>
            <Select value={String(dias)} onValueChange={(value) => onDiasChange(Number(value))}>
              <SelectTrigger className="h-11 rounded-xl border-app-border bg-app-bg-secondary text-sm dark:border-app-border-dark dark:bg-app-card-dark">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="60">Últimos 60 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="180">Últimos 180 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-[180px]">
            <label className="text-xs font-normal text-app-text-secondary dark:text-white/60">Categoria</label>
            <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
              <SelectTrigger className="h-11 rounded-xl border-app-border bg-app-bg-secondary text-sm dark:border-app-border-dark dark:bg-app-card-dark">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {categorias.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button variant="outline" onClick={exportarCsv} disabled={dataFiltrada.curvaAbc.length === 0} className="h-11 rounded-xl">
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="rounded-[24px] border-app-border shadow-sm dark:border-app-border-dark">
          <CardContent className="p-6">
            <p className="text-sm text-app-text-secondary dark:text-white/60">Valor em estoque</p>
            <h2 className="mt-2 text-2xl font-normal text-app-text-primary dark:text-white">
              {formatCurrency(data.valorTotalEstoque)}
            </h2>
            <p className="mt-1 text-xs text-app-text-muted">Soma de estoque × preço de custo</p>
          </CardContent>
        </Card>
        <Card className="rounded-[24px] border-app-border shadow-sm dark:border-app-border-dark">
          <CardContent className="p-6">
            <p className="text-sm text-app-text-secondary dark:text-white/60">Produtos classificados</p>
            <h2 className="mt-2 text-2xl font-normal text-app-text-primary dark:text-white">{dataFiltrada.curvaAbc.length}</h2>
            <p className="mt-1 text-xs text-app-text-muted">
              A: {dataFiltrada.curvaAbc.filter((r) => r.classe === 'A').length} ·
              B: {dataFiltrada.curvaAbc.filter((r) => r.classe === 'B').length} ·
              C: {dataFiltrada.curvaAbc.filter((r) => r.classe === 'C').length}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-[24px] border-app-border shadow-sm dark:border-app-border-dark">
          <CardContent className="p-6">
            <p className="text-sm text-app-text-secondary dark:text-white/60">Sem movimentação</p>
            <h2 className="mt-2 text-2xl font-normal text-app-text-primary dark:text-white">{data.semMovimentacao.length}</h2>
            <p className="mt-1 text-xs text-app-text-muted">Produtos sem saída em {data.diasAnalisados} dias</p>
          </CardContent>
        </Card>
      </div>

      {!isLoading && top10.length > 0 && (
        <Card className="rounded-[24px] border-app-border shadow-sm dark:border-app-border-dark">
          <CardContent className="p-6">
            <h3 className="mb-4 text-base font-medium text-app-text-primary dark:text-white">
              Top 10 produtos por valor consumido
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top10} layout="vertical" margin={{ left: 80, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `R$ ${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`} />
                  <YAxis type="category" dataKey="produtoNome" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="valorConsumido" radius={[0, 8, 8, 0]}>
                    {top10.map((row) => (
                      <Cell key={row.produtoId} fill={CLASSE_COLOR[row.classe]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="overflow-hidden rounded-xl border border-app-border dark:border-app-border-dark">
        <Table>
          <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-hover">
            <TableRow className="border-app-border dark:border-app-border-dark">
              <TableHead className="font-normal text-app-text-secondary dark:text-white/80">Produto</TableHead>
              <TableHead className="font-normal text-app-text-secondary dark:text-white/80">Categoria</TableHead>
              <TableHead className="font-normal text-app-text-secondary dark:text-white/80">Classe</TableHead>
              <TableHead className="font-normal text-app-text-secondary dark:text-white/80 text-right">Qtd saídas</TableHead>
              <TableHead className="font-normal text-app-text-secondary dark:text-white/80 text-right">Valor consumido</TableHead>
              <TableHead className="font-normal text-app-text-secondary dark:text-white/80 text-right">% Acumulado</TableHead>
              <TableHead className="font-normal text-app-text-secondary dark:text-white/80 text-right">Taxa de giro</TableHead>
              <TableHead className="font-normal text-app-text-secondary dark:text-white/80 text-right">Estoque atual</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-app-text-secondary dark:text-white/60">
                  Calculando Curva ABC...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && dataFiltrada.curvaAbc.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-app-text-secondary dark:text-white/60">
                  Sem movimentações de saída nos últimos {data.diasAnalisados} dias.
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              dataFiltrada.curvaAbc.map((row) => (
                <TableRow key={row.produtoId} className="border-app-border/50 dark:border-app-border-dark">
                  <TableCell className="font-normal text-app-text-primary dark:text-white">{row.produtoNome}</TableCell>
                  <TableCell className="text-app-text-secondary dark:text-white/70">{row.categoria || '—'}</TableCell>
                  <TableCell>
                    <Badge className={`font-medium ${classeBadgeClass(row.classe)}`}>{row.classe}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-app-text-primary dark:text-white">{row.quantidadeSaida}</TableCell>
                  <TableCell className="text-right tabular-nums text-app-text-primary dark:text-white">{formatCurrency(row.valorConsumido)}</TableCell>
                  <TableCell className="text-right tabular-nums text-app-text-secondary dark:text-white/70">{row.percentualAcumulado.toFixed(1)}%</TableCell>
                  <TableCell className="text-right tabular-nums text-app-text-secondary dark:text-white/70">{row.taxaGiro.toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums text-app-text-primary dark:text-white">{row.estoqueAtual}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {data.semMovimentacao.length > 0 && (
        <Card className="rounded-[24px] border-app-border shadow-sm dark:border-app-border-dark">
          <CardContent className="p-6">
            <h3 className="mb-4 text-base font-medium text-app-text-primary dark:text-white">
              Produtos sem movimentação ({data.semMovimentacao.length})
            </h3>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {data.semMovimentacao.map((item) => (
                <div
                  key={item.produtoId}
                  className="flex items-center justify-between rounded-[12px] border border-app-border bg-app-bg-secondary/40 px-3 py-2 dark:border-app-border-dark dark:bg-app-hover/30"
                >
                  <span className="text-sm text-app-text-primary dark:text-white">{item.produtoNome}</span>
                  <span className="text-xs text-app-text-muted">{item.diasSemMovimento} dias</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
