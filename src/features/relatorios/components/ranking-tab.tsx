'use client'

import { useRankingProcedimentos, useRankingProdutos } from '@/features/relatorios/hooks/use-ranking-comparativo'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatarMargemPct } from '@/lib/relatorios/margem'
import { formatMoeda as formatMoney } from '@/features/relatorios/format'

export function RankingTab() {
  const ranking = useRankingProdutos(90)
  const rankingProcedimentos = useRankingProcedimentos(90)

  return (
    <>
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
                      {ranking.valoresVisiveis && <TableHead className="text-right">Margem R$</TableHead>}
                      {ranking.valoresVisiveis && <TableHead className="text-right">Margem %</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranking.lucrativos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-app-text-muted">
                          Sem margem calculável no período.
                        </TableCell>
                      </TableRow>
                    ) : (
                      ranking.lucrativos.map((row) => (
                        <TableRow key={`l-${row.produtoId ?? row.nome}`}>
                          <TableCell>{row.nome}</TableCell>
                          <TableCell className="text-right">{row.quantidade}</TableCell>
                          {ranking.valoresVisiveis && (
                            <>
                              <TableCell className="text-right">{formatMoney(row.margem)}</TableCell>
                              <TableCell className="text-right">{formatarMargemPct(row.margemPct)}</TableCell>
                            </>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                {ranking.valoresVisiveis && ranking.totais && (
                  <p className="text-sm text-app-text-secondary dark:text-white/70">
                    Margem total: {formatMoney(ranking.totais.margem)} ({formatarMargemPct(ranking.totais.margemPct)} sobre{' '}
                    {formatMoney(ranking.totais.receita)} vendidos)
                  </p>
                )}
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
    </>
  )
}
