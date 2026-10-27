'use client'

import { AlertCircle, CheckCircle2, Search } from 'lucide-react'
import { usePrescricoesRelatorio, type PrescricaoSituacaoFilter } from '@/features/relatorios/hooks/use-prescricoes-relatorio'
import { useUnidades } from '@/hooks/use-unidades'
import { useUsuarios } from '@/hooks/use-usuarios'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CartaoMobile, ListaCartoesMobile } from '@/components/shared/mobile-card'
import { formatData, formatMoeda as formatMoney } from '@/features/relatorios/format'

const BADGE_SEM_VALIDADE =
  'border-app-border bg-app-bg-secondary/40 text-app-text-secondary dark:border-app-border-dark dark:bg-app-hover/40 dark:text-white/70'

function badgeSituacao(situacao: string) {
  if (situacao === 'no_prazo') {
    return {
      tone: 'border-emerald-300/70 bg-emerald-100/60 text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/30 dark:text-emerald-200',
      label: 'No prazo',
    }
  }
  if (situacao === 'limite_prazo') {
    return {
      tone: 'border-amber-300/70 bg-amber-100/70 text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/30 dark:text-amber-200',
      label: '⚠ Vence em breve',
    }
  }
  if (situacao === 'vencido') {
    return {
      tone: 'border-red-300/70 bg-red-100/70 text-red-700 dark:border-red-700/40 dark:bg-red-900/30 dark:text-red-200',
      label: 'Vencido',
    }
  }
  return { tone: BADGE_SEM_VALIDADE, label: 'Sem validade' }
}

export function PrescricoesTab() {
  const prescricoesRelatorio = usePrescricoesRelatorio()
  const { data: usuarios } = useUsuarios()
  const { data: unidades } = useUnidades()

  return (
    <>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
        {prescricoesRelatorio.error && (
          <p className="text-sm text-[var(--app-danger-text)]">{prescricoesRelatorio.error}</p>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              key: 'ativa' as PrescricaoSituacaoFilter,
              label: 'Ativas',
              count: prescricoesRelatorio.meta.ativas,
              valor: prescricoesRelatorio.meta.valorAtivas,
              border: 'border-emerald-300/60 dark:border-emerald-800/40',
              bg: 'bg-emerald-50/60 dark:bg-emerald-950/20',
              icon: CheckCircle2,
              iconTone: 'text-[var(--app-success-text)]',
              descricao: 'Prescrições ativas dentro da validade',
            },
            {
              key: 'limite_prazo' as PrescricaoSituacaoFilter,
              label: 'Limite de prazo',
              count: prescricoesRelatorio.meta.ativasLimitePrazo,
              valor: prescricoesRelatorio.meta.valorAtivasLimitePrazo,
              border: 'border-amber-300/70 dark:border-amber-800/50',
              bg: 'bg-amber-50/70 dark:bg-amber-950/20',
              icon: AlertCircle,
              iconTone: 'text-[var(--app-warning-text)]',
              descricao: 'Ativas que vencem em até 10 dias',
            },
            {
              key: 'vencido' as PrescricaoSituacaoFilter,
              label: 'Vencidas',
              count: prescricoesRelatorio.meta.vencidas,
              valor: prescricoesRelatorio.meta.valorVencidas,
              border: 'border-red-300/70 dark:border-red-800/50',
              bg: 'bg-red-50/70 dark:bg-red-950/20',
              icon: AlertCircle,
              iconTone: 'text-[var(--app-danger-text)]',
              descricao: 'Vencidas por status ou validade',
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

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
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
            value={prescricoesRelatorio.filtros.unidadeId}
            onValueChange={(value) =>
              prescricoesRelatorio.setFiltros((prev) => ({ ...prev, unidadeId: value }))
            }
          >
            <SelectTrigger className="h-10 rounded-xl border-app-border bg-app-bg-secondary/30">
              <SelectValue preferPlaceholder placeholder="Todas as unidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as unidades</SelectItem>
              {unidades.map((u) => (
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
              <SelectItem value="ativa">Ativas</SelectItem>
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

        <div className="md:hidden">
          {prescricoesRelatorio.isLoading && <p className="py-6 text-center text-sm text-app-text-secondary">Carregando prescrições...</p>}
          {!prescricoesRelatorio.isLoading && prescricoesRelatorio.data.length === 0 && (
            <p className="py-6 text-center text-sm text-app-text-secondary">Nenhuma prescrição encontrada para os filtros selecionados.</p>
          )}
          <ListaCartoesMobile className="p-0">
            {prescricoesRelatorio.data.map((item) => {
              const situacaoBadge = badgeSituacao(item.situacao)
              return (
                <CartaoMobile
                  key={item.id}
                  titulo={item.pacienteNome || '—'}
                  subtitulo={item.numero ? `Nº ${item.numero}` : undefined}
                  valor={formatMoney(item.valorTotal)}
                  selo={
                    <Badge variant="outline" className={`font-normal text-xs ${situacaoBadge.tone}`}>
                      {situacaoBadge.label}
                    </Badge>
                  }
                  campos={[
                    { rotulo: 'Profissional', valor: item.profissionalNome || '—' },
                    { rotulo: 'Tipo', valor: item.tipo || '—' },
                    { rotulo: 'Data', valor: formatData(item.dataPrescricao) },
                    { rotulo: 'Validade', valor: formatData(item.validade) },
                    { rotulo: 'Status', valor: item.status || '—' },
                  ]}
                />
              )
            })}
          </ListaCartoesMobile>
        </div>

        <div className="hidden overflow-hidden rounded-xl border border-app-border dark:border-app-border-dark md:block">
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
                    const situacaoBadge = badgeSituacao(item.situacao)
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
                          {formatData(item.dataPrescricao)}
                        </TableCell>
                        <TableCell className="py-4 text-app-text-secondary dark:text-white/70">
                          {formatData(item.validade)}
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
            Total ativo:{' '}
            <span className="font-medium text-app-text-primary dark:text-white">
              {formatMoney(prescricoesRelatorio.meta.valorAtivas)}
            </span>
          </p>
          <p className="text-sm text-[var(--app-danger-text)]">
            Vencidas: {formatMoney(prescricoesRelatorio.meta.valorVencidas)}
          </p>
        </div>
      </div>
    </>
  )
}
