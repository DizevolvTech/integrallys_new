'use client'

import {
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Edit,
  Eye,
  FileText,
  MoreVertical,
  RotateCcw,
  Wallet,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DataTable } from '@/components/shared/data-table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { CaixaItem, CaixaSessionState } from '@/hooks/use-caixa'
import { diaDoMovimento, formaCaixaLabel } from '@/features/caixa/caixa-format'
import { CofreCard } from '@/features/caixa/cofre-card'
import type { FinanceiroItem } from '@/hooks/use-financeiro'
import {
  formatCurrency,
  getFinanceStatusBadgeClass,
  getFinanceStatusLabel,
  isLiquidado,
} from '../financeiro.utils'
import type { useFinanceiroStats } from '../hooks/use-financeiro-stats'
import { CardClicavel } from '../contas/card-clicavel'
import type { TipoDetalheCaixa, TipoDetalheFinanceiro } from '../contas/detalhes-cards'

interface Props {
  tab: string
  filteredData: FinanceiroItem[]
  isLoading: boolean
  isLoadingCaixa: boolean
  data: FinanceiroItem[]
  stats: ReturnType<typeof useFinanceiroStats>
  caixaData: CaixaItem[]
  caixaSession: CaixaSessionState
  onLancamentoView: (item: FinanceiroItem) => void
  onLancamentoEdit: (item: FinanceiroItem) => void
  onLancamentoDelete: (item: FinanceiroItem) => void
  onLancamentoComprovante: (item: FinanceiroItem) => void
  onLancamentoRecebimento: (item: FinanceiroItem) => void
  onCaixaView: (item: CaixaItem) => void
  onCaixaEdit: (item: CaixaItem) => void
  onCaixaDelete: (item: CaixaItem) => void
  onCaixaAction: (action: 'abrir' | 'suprimento' | 'sangria' | 'fechar') => void
  onDetalheCaixa: (tipo: TipoDetalheCaixa) => void
  onDetalheLancamentos: (tipo: TipoDetalheFinanceiro) => void
}

export function FinanceiroTabContent({
  tab,
  filteredData,
  isLoading,
  isLoadingCaixa,
  data,
  stats,
  onLancamentoView,
  onLancamentoEdit,
  onLancamentoDelete,
  onLancamentoComprovante,
  onLancamentoRecebimento,
  onCaixaView,
  onCaixaEdit,
  onCaixaDelete,
  onCaixaAction,
  onDetalheCaixa,
  onDetalheLancamentos,
}: Props) {
  const {
    lancamentosSummary,
    caixaTodayData,
    caixaStatus,
    resumoForma,
  } = stats

  return (
    <>
      {tab === 'caixa' && (
        <div className="space-y-4">
          <Card className="rounded-[16px] border border-app-border bg-app-card p-8 shadow-sm dark:border-app-border-dark dark:bg-app-card-dark">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <h3 className="text-lg font-normal text-app-text-primary dark:text-white">
                Saldos por conta/caixa
              </h3>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" className="rounded-xl">
                  Unidade principal
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="group cursor-pointer rounded-2xl border border-[var(--app-primary)] bg-app-card p-5 shadow-sm transition-all hover:shadow-md dark:bg-app-card-dark">
                <div className="mb-3 flex items-start justify-between">
                  <p className="text-sm font-normal text-app-text-secondary dark:text-white/60">
                    Caixa principal
                  </p>
                  <Wallet
                    size={18}
                    className="text-gray-300 transition-colors group-hover:text-[var(--app-primary)] dark:text-app-text-secondary"
                  />
                </div>
                <p className="mb-3 text-2xl font-normal text-app-text-primary dark:text-white">
                  {formatCurrency(caixaStatus.saldo)}
                </p>
                <Badge
                  variant="outline"
                  className="rounded-lg border-app-border bg-app-bg-secondary/50 text-app-text-secondary dark:border-app-border-dark dark:bg-app-card/5 dark:text-white/60"
                >
                  Caixa
                </Badge>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <Card className="flex flex-col items-center justify-center rounded-[16px] border border-app-border bg-app-card p-6 text-center shadow-sm dark:border-app-border-dark dark:bg-app-card-dark">
              <p className="mb-4 text-sm font-normal text-app-text-primary dark:text-white">
                Status do caixa
              </p>
              <Badge
                className={`${caixaStatus.aberto ? 'app-status-success' : 'app-status-danger'} mb-2 rounded-lg px-4 py-1.5`}
              >
                {caixaStatus.aberto ? 'ABERTO' : 'FECHADO'}
              </Badge>
              <p className="text-xs text-app-text-secondary dark:text-white/60">
                Unidade principal
              </p>
            </Card>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-4">
              {[
                {
                  label: 'Saldo Inicial',
                  tipo: 'saldo-inicial' as const,
                  value: formatCurrency(caixaStatus.saldoInicial),
                  color: 'text-app-text-primary',
                },
                {
                  label: 'Entradas',
                  tipo: 'entradas' as const,
                  value: formatCurrency(caixaStatus.entradas),
                  color: 'text-[var(--app-success-text)]',
                },
                {
                  label: 'Saídas',
                  tipo: 'saidas' as const,
                  value: formatCurrency(caixaStatus.saidas),
                  color: 'text-[var(--app-danger-text)]',
                },
                {
                  label: 'Saldo Atual',
                  tipo: 'saldo-atual' as const,
                  value: formatCurrency(caixaStatus.saldo),
                  color: 'text-app-text-primary',
                },
              ].map((stat) => (
                <CardClicavel
                  key={stat.label}
                  rotulo={`${stat.label}: ${stat.value}`}
                  onOpen={() => onDetalheCaixa(stat.tipo)}
                  className="flex flex-col justify-center rounded-[16px] border border-app-border bg-app-card p-6 shadow-sm dark:border-app-border-dark dark:bg-app-card-dark"
                >
                  <p className="mb-4 text-sm font-normal text-app-text-secondary dark:text-white/60">
                    {stat.label}
                  </p>
                  <p className={`text-2xl font-normal ${stat.color} dark:text-white`}>
                    {stat.value}
                  </p>
                </CardClicavel>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:flex lg:flex-wrap lg:items-center">
            <Button
              disabled={caixaStatus.aberto}
              onClick={() => onCaixaAction('abrir')}
              variant="outline"
              className="h-14 w-full justify-center gap-3 rounded-xl border-app-border px-6 font-normal text-app-text-primary shadow-sm dark:border-app-border-dark dark:text-white/80 lg:h-12 lg:w-auto"
            >
              <Wallet size={18} />{' '}
              <span>{caixaStatus.aberto ? 'Caixa aberto' : 'Abrir caixa'}</span>
            </Button>
            <Button
              disabled={!caixaStatus.aberto}
              onClick={() => onCaixaAction('suprimento')}
              variant="outline"
              className="h-14 w-full justify-center gap-3 rounded-xl border-app-border px-6 font-normal text-app-text-primary shadow-sm dark:border-app-border-dark dark:text-white/80 lg:h-12 lg:w-auto"
            >
              <ArrowUpRight size={18} /> <span>Recebimento</span>
            </Button>
            <Button
              disabled={!caixaStatus.aberto}
              onClick={() => onCaixaAction('sangria')}
              variant="outline"
              className="h-14 w-full justify-center gap-3 rounded-xl border-app-border px-6 font-normal text-app-text-primary shadow-sm dark:border-app-border-dark dark:text-white/80 lg:h-12 lg:w-auto"
            >
              <ArrowDownRight size={18} /> <span>Pagamento</span>
            </Button>
            <Button
              disabled={!caixaStatus.aberto}
              onClick={() => onCaixaAction('fechar')}
              variant="outline"
              className="h-14 w-full justify-center gap-3 rounded-xl border-app-border px-6 font-normal text-app-text-primary shadow-sm dark:border-app-border-dark dark:text-white/80 lg:h-12 lg:w-auto"
            >
              <DollarSign size={18} /> <span>Fechar caixa</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
            <Card className="xl:col-span-2 overflow-hidden rounded-[16px] border border-app-border bg-app-card p-0 shadow-sm dark:border-app-border-dark dark:bg-app-card-dark">
              <div className="border-b border-app-border p-6 dark:border-app-border-dark">
                <h3 className="text-lg font-normal text-app-text-primary dark:text-white">
                  Movimentações da sessão
                </h3>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-none bg-app-bg-secondary/50 dark:bg-app-card/[0.02]">
                      <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary dark:text-white/60">
                        Data
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary dark:text-white/60">
                        Hora
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary dark:text-white/60">
                        Tipo
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary dark:text-white/60">
                        Descrição
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary dark:text-white/60">
                        Forma
                      </TableHead>
                      <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-app-text-secondary dark:text-white/60">
                        Valor
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary dark:text-white/60">
                        Operador
                      </TableHead>
                      <TableHead className="text-center text-xs font-medium uppercase tracking-wider text-app-text-secondary dark:text-white/60">
                        Ações
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {caixaTodayData.map((move) => (
                      <TableRow
                        key={move.id}
                        className="border-app-border transition-colors hover:bg-app-bg-secondary/50 dark:border-app-border-dark dark:hover:bg-app-card/[0.02]"
                      >
                        <TableCell className="font-normal text-app-text-secondary">
                          {diaDoMovimento(move)}
                        </TableCell>
                        <TableCell className="font-normal text-app-text-secondary">
                          {move.hora || move.data.split(' ')[1] || '--:--'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`${move.tipo === 'entrada' ? 'app-status-success' : 'app-status-danger'} border-none font-normal`}
                          >
                            {move.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-normal text-app-text-primary dark:text-white">
                          {move.descricao}
                        </TableCell>
                        <TableCell className="font-normal text-app-text-secondary dark:text-white/60">
                          {formaCaixaLabel(move.forma)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-normal ${move.tipo === 'entrada' ? 'text-[var(--app-success-text)]' : 'text-[var(--app-danger-text)]'}`}
                        >
                          {formatCurrency(move.valor)}
                        </TableCell>
                        <TableCell className="font-normal text-app-text-secondary dark:text-white/60">
                          {move.operador || '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                aria-label="Ações"
                                className="mx-auto h-9 w-9 rounded-xl border-app-border dark:border-app-border-dark"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onCaixaView(move)}>
                                <Eye className="mr-2 h-4 w-4 text-app-text-secondary" />
                                <span>Visualizar</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onCaixaEdit(move)}>
                                <Edit className="mr-2 h-4 w-4 text-app-text-secondary" />
                                <span>Editar</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onCaixaView(move)}>
                                <FileText className="mr-2 h-4 w-4 text-app-text-secondary" />
                                <span>Comprovante</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-[var(--app-danger-text)]"
                                onClick={() => onCaixaDelete(move)}
                              >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                <span>Estornar</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {caixaTodayData.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="py-10 text-center text-app-text-secondary dark:text-white/60"
                        >
                          Nenhuma movimentação registrada na sessão de hoje.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>

            <Card className="sticky top-8 h-fit rounded-[16px] border border-app-border bg-app-card p-8 text-app-text-primary shadow-sm dark:border-app-border-dark dark:bg-app-card-dark dark:text-white">
              <h3 className="mb-8 text-lg font-normal">Resumo</h3>
              <div className="space-y-6">
                <div>
                  <p className="mb-4 text-sm font-normal">Por forma de pagamento</p>
                  <div className="space-y-3">
                    {resumoForma.map((item) => (
                      <div key={item.label} className="flex items-center justify-between text-sm">
                        <span className="text-app-text-secondary dark:text-white/60">
                          {item.label}
                        </span>
                        <span className="font-normal">{formatCurrency(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="h-px bg-app-bg-secondary dark:bg-app-card/5" />
                <div>
                  <p className="mb-4 text-sm font-normal">Por tipo</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-app-text-secondary dark:text-white/60">
                        Total de entradas
                      </span>
                      <span className="font-normal text-[var(--app-success-text)]">
                        {formatCurrency(caixaStatus.entradas)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-app-text-secondary dark:text-white/60">
                        Total de saídas
                      </span>
                      <span className="font-normal text-[var(--app-danger-text)]">
                        {formatCurrency(caixaStatus.saidas)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="h-px bg-app-bg-secondary dark:bg-app-card/5" />
                <div className="flex items-center justify-between pt-2">
                  <span className="text-base font-normal">Saldo final</span>
                  <span className="text-xl font-normal">{formatCurrency(caixaStatus.saldo)}</span>
                </div>
              </div>
            </Card>
          </div>

          <CofreCard atualizarQuando={`${caixaStatus.aberto}-${caixaStatus.movimentos}`} />
        </div>
      )}

      {tab === 'lancamentos' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <CardClicavel onOpen={() => onDetalheLancamentos('entradas')} className="rounded-[16px] border border-app-border bg-app-card p-6 dark:border-app-border-dark dark:bg-app-card-dark">
            <p className="text-sm text-app-text-muted">Entradas no período</p>
            <p className="mt-2 text-2xl font-normal text-[var(--app-success-text)]">
              {formatCurrency(lancamentosSummary.entradas)}
            </p>
            <p className="mt-1 text-xs text-app-text-muted">
              {data.filter((item) => item.tipo === 'receita').length} lançamentos
            </p>
          </CardClicavel>
          <CardClicavel onOpen={() => onDetalheLancamentos('saidas')} className="rounded-[16px] border border-app-border bg-app-card p-6 dark:border-app-border-dark dark:bg-app-card-dark">
            <p className="text-sm text-app-text-muted">Saídas no período</p>
            <p className="mt-2 text-2xl font-normal text-[var(--app-danger-text)]">
              {formatCurrency(lancamentosSummary.saidas)}
            </p>
            <p className="mt-1 text-xs text-app-text-muted">
              {data.filter((item) => item.tipo === 'despesa').length} lançamentos
            </p>
          </CardClicavel>
          <CardClicavel onOpen={() => onDetalheLancamentos('saldo')} className="rounded-[16px] border border-app-border bg-app-card p-6 dark:border-app-border-dark dark:bg-app-card-dark">
            <p className="text-sm text-app-text-muted">Saldo do período</p>
            <p className="mt-2 text-2xl font-normal text-app-text-primary dark:text-white">
              {formatCurrency(lancamentosSummary.saldo)}
            </p>
            <p className="mt-1 text-xs text-app-text-muted">Resultado filtrado</p>
          </CardClicavel>
          <CardClicavel onOpen={() => onDetalheLancamentos('a-vencer')} className="rounded-[16px] border border-app-border bg-app-card p-6 dark:border-app-border-dark dark:bg-app-card-dark">
            <p className="text-sm text-app-text-muted">Recebimentos a vencer</p>
            <p className="mt-2 text-2xl font-normal text-[var(--app-warning-text)]">
              {formatCurrency(lancamentosSummary.pendente)}
            </p>
            <p className="mt-1 text-xs text-app-text-muted">Pendências em aberto</p>
          </CardClicavel>
        </div>
      )}

      <div className="overflow-hidden rounded-[16px] border border-app-border bg-app-card shadow-sm dark:border-app-border-dark dark:bg-app-card-dark">
        <div className="flex flex-col gap-4 border-b border-app-border px-8 py-6 dark:border-app-border-dark lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-normal tracking-tight text-app-text-primary dark:text-white">
              {tab === 'caixa'
                ? 'Movimentações de caixa'
                : 'Consolidado financeiro'}
            </h2>
            <p className="text-sm text-app-text-muted">
              {tab === 'caixa'
                ? 'Acompanhe entradas e saídas que compõem o saldo operacional disponível.'
                : 'Dados financeiros retornados pela API administrativa, organizados por aba.'}
            </p>
          </div>
          <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-xs font-medium">
            {filteredData.length} registros
          </Badge>
        </div>

        {isLoading || (tab === 'caixa' && isLoadingCaixa) ? (
          <div className="divide-y divide-app-border dark:divide-app-border-dark">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between gap-4 px-8 py-4">
                <div className="h-3 w-28 animate-pulse rounded bg-app-bg-secondary dark:bg-white/10" />
                <div className="h-3 flex-1 animate-pulse rounded bg-app-bg-secondary dark:bg-white/10" />
                <div className="h-3 w-24 animate-pulse rounded bg-app-bg-secondary dark:bg-white/10" />
                <div className="h-8 w-9 animate-pulse rounded-xl bg-app-bg-secondary dark:bg-white/10" />
              </div>
            ))}
          </div>
        ) : filteredData.length === 0 ? (
          <div className="px-8 py-10">
            <div className="rounded-integrallys-lg border border-dashed border-app-border bg-app-bg-secondary/40 p-10 text-center dark:border-app-border-dark dark:bg-app-card-dark">
              <p className="text-base text-app-text-primary dark:text-white">
                Nenhuma movimentação encontrada.
              </p>
              <p className="mt-2 text-sm text-app-text-muted">
                Ajuste a busca, reveja a categoria selecionada ou cadastre um novo lançamento.
              </p>
            </div>
          </div>
        ) : (
          <DataTable data={filteredData}>
            {(pageData) => (
              <div className="overflow-x-auto">
                {tab === 'lancamentos' && (
                  <Table>
                    <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-hover">
                      <TableRow>
                        <TableHead className="min-w-[150px] px-6 text-xs font-medium uppercase tracking-wider text-app-text-secondary">
                          Data/hora
                        </TableHead>
                        <TableHead className="min-w-[100px] px-6 text-xs font-medium uppercase tracking-wider text-app-text-secondary">
                          Tipo
                        </TableHead>
                        <TableHead className="min-w-[220px] px-6 text-xs font-medium uppercase tracking-wider text-app-text-secondary">
                          Descrição
                        </TableHead>
                        <TableHead className="min-w-[120px] px-6 text-xs font-medium uppercase tracking-wider text-app-text-secondary">
                          Categoria
                        </TableHead>
                        <TableHead className="min-w-[120px] px-6 text-right text-xs font-medium uppercase tracking-wider text-app-text-secondary">
                          Valor total
                        </TableHead>
                        <TableHead className="min-w-[120px] px-6 text-right text-xs font-medium uppercase tracking-wider text-app-text-secondary">
                          Valor pago
                        </TableHead>
                        <TableHead className="min-w-[120px] px-6 text-right text-xs font-medium uppercase tracking-wider text-app-text-secondary">
                          Saldo
                        </TableHead>
                        <TableHead className="min-w-[120px] px-6 text-xs font-medium uppercase tracking-wider text-app-text-secondary">
                          Forma
                        </TableHead>
                        <TableHead className="min-w-[100px] px-6 text-xs font-medium uppercase tracking-wider text-app-text-secondary">
                          Status
                        </TableHead>
                        <TableHead className="min-w-[100px] px-6 text-center text-xs font-medium uppercase tracking-wider text-app-text-secondary">
                          Ações
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageData.map((item) => {
                        const status = item.status || 'Pendente'
                        const liquidado = isLiquidado(status)
                        const valorPago = liquidado ? item.valor : 0
                        const saldo = liquidado ? 0 : item.valor
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="px-6 py-4 text-app-text-secondary dark:text-white/70">
                              {item.data || '-'}
                            </TableCell>
                            <TableCell className="px-6 py-4">
                              <Badge
                                className={`rounded-full px-3 py-1 text-xs font-medium ${item.tipo === 'receita' ? 'app-status-success text-white' : 'app-status-danger text-white'}`}
                              >
                                {item.tipo === 'receita' ? 'Entrada' : 'Saída'}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-6 py-4 font-normal text-app-text-primary dark:text-white">
                              {item.descricao}
                            </TableCell>
                            <TableCell className="px-6 py-4 text-app-text-secondary dark:text-white/70">
                              {item.categoria}
                            </TableCell>
                            <TableCell className="px-6 py-4 text-right font-normal text-app-text-primary dark:text-white">
                              {formatCurrency(item.valor)}
                            </TableCell>
                            <TableCell className="px-6 py-4 text-right font-normal text-app-text-secondary dark:text-white/70">
                              {formatCurrency(valorPago)}
                            </TableCell>
                            <TableCell
                              className={`px-6 py-4 text-right font-normal ${saldo > 0 ? 'text-[var(--app-warning-text)]' : 'text-app-text-muted'}`}
                            >
                              {formatCurrency(saldo)}
                            </TableCell>
                            <TableCell className="px-6 py-4 text-app-text-secondary dark:text-white/70">
                              {item.metodo || '-'}
                            </TableCell>
                            <TableCell className="px-6 py-4">
                              <Badge
                                className={`font-normal ${getFinanceStatusBadgeClass(status)}`}
                              >
                                {getFinanceStatusLabel(status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-6 py-4 text-center">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    aria-label="Ações"
                                    className="mx-auto h-9 w-9 rounded-xl border-app-border dark:border-app-border-dark"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => onLancamentoView(item)}>
                                    <Eye className="mr-2 h-4 w-4 text-app-text-secondary" />
                                    <span>Visualizar</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onLancamentoEdit(item)}>
                                    <Edit className="mr-2 h-4 w-4 text-app-text-secondary" />
                                    <span>Editar</span>
                                  </DropdownMenuItem>
                                  {!liquidado && item.tipo === 'receita' && (
                                    <DropdownMenuItem onClick={() => onLancamentoRecebimento(item)}>
                                      <DollarSign className="mr-2 h-4 w-4 text-app-text-secondary" />
                                      <span>Registrar recebimento</span>
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => onLancamentoComprovante(item)}>
                                    <FileText className="mr-2 h-4 w-4 text-app-text-secondary" />
                                    <span>Comprovante</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-[var(--app-danger-text)]"
                                    onClick={() => onLancamentoDelete(item)}
                                  >
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    <span>Excluir</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}

                {tab !== 'lancamentos' && (
                  <Table>
                    <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-hover">
                      <TableRow>
                        <TableHead className="px-6 text-xs font-medium uppercase tracking-wider text-app-text-secondary">
                          Descrição
                        </TableHead>
                        <TableHead className="px-6 text-xs font-medium uppercase tracking-wider text-app-text-secondary">
                          Categoria
                        </TableHead>
                        <TableHead className="px-6 text-xs font-medium uppercase tracking-wider text-app-text-secondary">
                          Tipo
                        </TableHead>
                        <TableHead className="px-6 text-right text-xs font-medium uppercase tracking-wider text-app-text-secondary">
                          Valor
                        </TableHead>
                        <TableHead className="px-6 text-center text-xs font-medium uppercase tracking-wider text-app-text-secondary">
                          Ações
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageData.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="px-6 py-4 font-normal text-app-text-primary dark:text-white">
                            <div className="space-y-1">
                              <p>{item.descricao}</p>
                              <p className="text-xs text-app-text-muted">
                                {item.tipo === 'receita'
                                  ? 'Entrada financeira'
                                  : 'Saída financeira'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="px-6 py-4 text-app-text-secondary dark:text-white/70">
                            {item.categoria}
                          </TableCell>
                          <TableCell className="px-6 py-4">
                            <Badge
                              className={`rounded-full px-3 py-1 text-xs font-medium ${item.tipo === 'receita' ? 'app-status-success text-white' : 'app-status-danger text-white'}`}
                            >
                              {item.tipo === 'receita' ? 'Receita' : 'Despesa'}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-6 py-4 text-right font-normal text-app-text-primary dark:text-white">
                            {formatCurrency(item.valor)}
                          </TableCell>
                          <TableCell className="px-6 py-4 text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  aria-label="Ações"
                                  className="mx-auto h-9 w-9 rounded-xl border-app-border dark:border-app-border-dark"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onLancamentoView(item)}>
                                  <Eye className="mr-2 h-4 w-4 text-app-text-secondary" />
                                  <span>Visualizar</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onLancamentoEdit(item)}>
                                  <Edit className="mr-2 h-4 w-4 text-app-text-secondary" />
                                  <span>Editar</span>
                                </DropdownMenuItem>
                                {item.tipo === 'receita' && !isLiquidado(item.status) && (
                                  <DropdownMenuItem onClick={() => onLancamentoRecebimento(item)}>
                                    <DollarSign className="mr-2 h-4 w-4 text-app-text-secondary" />
                                    <span>Registrar recebimento</span>
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => onLancamentoComprovante(item)}>
                                  <FileText className="mr-2 h-4 w-4 text-app-text-secondary" />
                                  <span>Comprovante</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-[var(--app-danger-text)]"
                                  onClick={() => onLancamentoDelete(item)}
                                >
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  <span>Excluir</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </DataTable>
        )}
      </div>
    </>
  )
}
