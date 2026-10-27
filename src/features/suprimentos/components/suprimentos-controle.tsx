'use client'

import { useState } from 'react'
import { DateInput } from '@/components/shared/date-input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useControleSuprimentos, type SuprimentoItem } from '../hooks/use-suprimentos'
import { formatarDataHoraClinica } from '@/lib/fuso-clinica'

const PAGE = 20
const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const ORIGENS: Record<string, string> = { manual: 'Manual', ajuste: 'Ajuste', procedimento: 'Baixa de procedimento' }

/** Relatório de controle de suprimentos (recepção e gestor). */
export function SuprimentosControle({ suprimentos }: { suprimentos: SuprimentoItem[] }) {
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [suprimentoId, setSuprimentoId] = useState('todos')
  const [origem, setOrigem] = useState('todas')
  const [pagina, setPagina] = useState(0)
  const { data, isLoading, error } = useControleSuprimentos({
    de: de || undefined,
    ate: ate || undefined,
    suprimentoId: suprimentoId === 'todos' ? undefined : suprimentoId,
    origem: origem === 'todas' ? undefined : origem,
    limit: PAGE,
    offset: pagina * PAGE,
  })
  const totalPaginas = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE))
  const filtrar = (fn: () => void) => {
    fn()
    setPagina(0)
  }

  return (
    <div className="space-y-6" data-testid="suprimentos-controle">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="space-y-1.5"><Label>De</Label><DateInput value={de} onChange={(v) => filtrar(() => setDe(v))} /></div>
        <div className="space-y-1.5"><Label>Até</Label><DateInput value={ate} onChange={(v) => filtrar(() => setAte(v))} /></div>
        <div className="space-y-1.5">
          <Label>Suprimento</Label>
          <Select value={suprimentoId} onValueChange={(v) => filtrar(() => setSuprimentoId(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {suprimentos.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Origem</Label>
          <Select value={origem} onValueChange={(v) => filtrar(() => setOrigem(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="procedimento">Baixa de procedimento</SelectItem>
              <SelectItem value="ajuste">Ajuste</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button variant="outline" className="w-full" onClick={() => { setDe(''); setAte(''); setSuprimentoId('todos'); setOrigem('todas'); setPagina(0) }}>Limpar filtros</Button>
        </div>
      </div>

      {error && <p className="text-sm text-[var(--app-danger-text)]">{error}</p>}
      {isLoading && !data && <p className="text-sm text-app-text-muted">Carregando relatório...</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {[
              ['Entradas', String(data.totais.entradas)],
              ['Saídas', String(data.totais.saidas)],
              ['Baixas por procedimento', String(data.totais.baixasProcedimento)],
              ['Custo consumido', reais(data.totais.custoConsumido)],
              ['Abaixo do mínimo', String(data.totais.abaixoMinimo)],
              ['Vencem em 30 dias', String(data.totais.vencendo)],
            ].map(([rotulo, valor]) => (
              <Card key={rotulo} className="rounded-[16px] p-4">
                <p className="text-xs uppercase tracking-wider text-app-text-muted">{rotulo}</p>
                <p className="mt-1 text-xl text-app-text-primary dark:text-white">{valor}</p>
              </Card>
            ))}
          </div>
          {data.totais.truncado && <p className="text-xs text-[var(--app-warning-text)]">Período muito grande: os totais consideram as 10.000 movimentações mais recentes. Reduza o período.</p>}

          <div className="overflow-x-auto rounded-xl border border-app-border dark:border-app-border-dark">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Suprimento</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead className="text-right">Entradas</TableHead>
                  <TableHead className="text-right">Saídas</TableHead>
                  <TableHead className="text-right">Procedimentos</TableHead>
                  <TableHead className="text-right">Custo consumido</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.resumo.map((r) => (
                  <TableRow key={r.suprimentoId}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell className="text-right">{r.quantidade}</TableCell>
                    <TableCell className="text-right">{r.estoqueMinimo}</TableCell>
                    <TableCell className="text-right">{r.entradas}</TableCell>
                    <TableCell className="text-right">{r.saidas}</TableCell>
                    <TableCell className="text-right">{r.consumoProcedimentos}</TableCell>
                    <TableCell className="text-right">{reais(r.custoConsumo)}</TableCell>
                    <TableCell className="space-x-1 whitespace-nowrap">
                      {r.abaixoMinimo && <span className="app-status-danger rounded-md px-2 py-0.5 text-xs text-[var(--app-danger-text)]">Abaixo do mínimo</span>}
                      {r.vencido ? <span className="app-status-danger rounded-md px-2 py-0.5 text-xs text-[var(--app-danger-text)]">Vencido</span> : r.vencendo && <span className="app-status-warning rounded-md px-2 py-0.5 text-xs">Vence em breve</span>}
                      {!r.abaixoMinimo && !r.vencendo && <span className="text-xs text-app-text-muted">Normal</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <h3 className="text-base text-app-text-primary dark:text-white">Movimentações ({data.total})</h3>
          <div className="overflow-x-auto rounded-xl border border-app-border dark:border-app-border-dark">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Suprimento</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Saldo após</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Quem / motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.movimentos.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-app-text-secondary">Nenhuma movimentação no período.</TableCell></TableRow>
                ) : (
                  data.movimentos.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap">{formatarDataHoraClinica(m.criadoEm)}</TableCell>
                      <TableCell>{m.suprimento}</TableCell>
                      <TableCell>{m.tipo === 'entrada' ? 'Entrada' : 'Saída'}</TableCell>
                      <TableCell className="text-right">{m.quantidade}</TableCell>
                      <TableCell className="text-right">{m.saldoApos}</TableCell>
                      <TableCell>{ORIGENS[m.origem] ?? m.origem}</TableCell>
                      <TableCell className="text-xs text-app-text-secondary">{[m.automatico ? 'Automático' : m.operador, m.motivo].filter(Boolean).join(' — ') || '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
            <span className="text-sm text-app-text-secondary">Página {pagina + 1} de {totalPaginas}</span>
            <Button variant="outline" size="sm" disabled={pagina + 1 >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>Próxima</Button>
          </div>
        </>
      )}
    </div>
  )
}
