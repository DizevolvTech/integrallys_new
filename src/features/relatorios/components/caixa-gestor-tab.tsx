'use client'

import { useCaixaGestor } from '@/features/relatorios/hooks/use-ranking-comparativo'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoeda as formatMoney } from '@/features/relatorios/format'

export function CaixaGestorTab() {
  const caixaGestor = useCaixaGestor()

  return (
    <>
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
    </>
  )
}
