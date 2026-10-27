'use client'

import { Download } from 'lucide-react'
import { CartaoMobile, ListaCartoesMobile } from '@/components/shared/mobile-card'
import { useComparativoUnidades } from '@/features/relatorios/hooks/use-ranking-comparativo'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatarMargemPct } from '@/lib/relatorios/margem'
import { formatMoeda as formatMoney } from '@/features/relatorios/format'

export function ComparativoTab() {
  const comparativo = useComparativoUnidades(30)

  const exportComparativoCsv = () => {
    const header = 'unidade,agendamentos,receita,despesa,ticket_medio,margem,margem_pct'
    const lines = comparativo.data.map(
      (r) =>
        `"${r.unidadeNome}",${r.agendamentos},${r.receita},${r.despesa},${r.ticketMedio.toFixed(2)},${r.margem.toFixed(2)},${r.margemPct ?? ''}`,
    )
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `comparativo-unidades-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
  }

  return (
    <>
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
          <>
          <ListaCartoesMobile className="p-0">
            {comparativo.data.length === 0 && <p className="py-6 text-center text-sm text-app-text-muted">Nenhuma unidade com dados no período.</p>}
            {comparativo.data.map((row) => (
              <CartaoMobile
                key={row.unidadeId}
                titulo={row.unidadeNome}
                valor={comparativo.valoresVisiveis ? formatMoney(row.receita) : undefined}
                campos={[
                  { rotulo: 'Agendamentos', valor: row.agendamentos },
                  ...(comparativo.valoresVisiveis
                    ? [
                        { rotulo: 'Despesa', valor: formatMoney(row.despesa) },
                        { rotulo: 'Ticket médio', valor: formatMoney(row.ticketMedio) },
                        { rotulo: 'Margem R$', valor: formatMoney(row.margem) },
                        { rotulo: 'Margem (% sobre o custo)', valor: formatarMargemPct(row.margemPct) },
                      ]
                    : []),
                ]}
              />
            ))}
          </ListaCartoesMobile>
          <div className="hidden md:block">
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
                    <TableHead className="text-right">Margem R$</TableHead>
                    <TableHead className="text-right">Margem (% sobre o custo)</TableHead>
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
                        <TableCell className="text-right">{formatMoney(row.margem)}</TableCell>
                        <TableCell className="text-right">{formatarMargemPct(row.margemPct)}</TableCell>
                      </>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
          </>
        )}
      </div>
    </>
  )
}
