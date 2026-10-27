'use client'

import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { useCurvaAbc } from '@/features/relatorios/hooks/use-relatorio-estoque'

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

export function CurvaAbcSection({ dias, onDiasChange, data, isLoading, error }: CurvaAbcSectionProps) {
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
            <p className="text-xs font-normal text-app-text-secondary dark:text-white/60">Período</p>
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
            <p className="text-xs font-normal text-app-text-secondary dark:text-white/60">Categoria</p>
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
