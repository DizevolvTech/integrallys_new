'use client'

import { Banknote } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { CaixaItem, CaixaSessionState } from '@/hooks/use-caixa'
import { formatarDataHoraClinica } from '@/lib/fuso-clinica'
import { diaDoMovimento, formaDetalheTexto } from '../caixa-format'
import { diaParaExibicao } from '../periodo-caixa'
import { vinculoTexto } from '../resumo-caixa'

export type ResumoCard = 'saldo_inicial' | 'entradas' | 'saidas' | 'saldo_atual'

interface ResumoCardModalProps {
  card: ResumoCard | null
  onClose: () => void
  items: CaixaItem[]
  session: CaixaSessionState
}

function brl(value: number) {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function descricaoPeriodo(session: CaixaSessionState) {
  if (!session.de || !session.ate) return 'hoje'
  return session.multiplo ? `${diaParaExibicao(session.de)} a ${diaParaExibicao(session.ate)}` : diaParaExibicao(session.de)
}

const TITULOS: Record<ResumoCard, string> = {
  saldo_inicial: 'Saldo inicial — abertura do caixa',
  entradas: 'Entradas',
  saidas: 'Saídas',
  saldo_atual: 'Saldo atual',
}

export function ResumoCardModal({ card, onClose, items, session }: ResumoCardModalProps) {
  const tipo = card === 'entradas' ? 'entrada' : card === 'saidas' ? 'saida' : null
  const linhas = useMemo(() => (tipo ? items.filter((item) => item.tipo === tipo) : []), [items, tipo])
  const totalLista = linhas.reduce((sum, item) => sum + item.valor, 0)
  const periodo = descricaoPeriodo(session)
  const titulo = card === 'saldo_atual' && session.multiplo ? 'Saldo do período' : card ? TITULOS[card] : ''

  return (
    <Dialog open={card !== null} onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent size={tipo ? 'xl' : 'md'} className="gap-0 overflow-hidden rounded-[24px] border border-app-border p-0 dark:border-app-border-dark">
        <div className="bg-app-card p-6 dark:bg-app-card-dark sm:p-8">
          <DialogHeader className="space-y-2">
            <DialogTitle className="flex items-center gap-2 text-xl font-normal text-app-text-primary dark:text-white">
              <Banknote className="h-5 w-5 text-[var(--app-primary)]" />
              {titulo}
            </DialogTitle>
            <DialogDescription className="text-sm text-app-text-muted">Caixa de {periodo}.</DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-4" data-testid={`resumo-${card ?? 'vazio'}`}>
            {tipo && (
              <>
                <div className="max-h-[420px] overflow-auto rounded-integrallys-lg border border-app-border dark:border-app-border-dark">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-none bg-app-bg-secondary/50 dark:bg-app-hover/20">
                        <TableHead className="text-xs font-normal">Data</TableHead>
                        <TableHead className="text-xs font-normal">Hora</TableHead>
                        <TableHead className="text-xs font-normal">Descrição</TableHead>
                        <TableHead className="text-xs font-normal">Forma</TableHead>
                        <TableHead className="text-right text-xs font-normal">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linhas.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-10 text-center text-sm text-app-text-secondary dark:text-white/60">
                            Nenhuma {tipo === 'entrada' ? 'entrada' : 'saída'} neste período.
                          </TableCell>
                        </TableRow>
                      ) : (
                        linhas.map((item) => {
                          const vinculo = vinculoTexto(item)
                          return (
                            <TableRow key={item.id} className="border-app-border dark:border-app-border-dark">
                              <TableCell className="whitespace-nowrap text-app-text-secondary dark:text-white/70">{diaDoMovimento(item)}</TableCell>
                              <TableCell className="whitespace-nowrap text-app-text-secondary dark:text-white/70">{item.hora || '--:--'}</TableCell>
                              <TableCell className="text-app-text-primary dark:text-white">
                                <div className="flex flex-col">
                                  <span>{item.descricao}</span>
                                  {vinculo && <span className="text-xs text-app-text-secondary dark:text-white/60">{vinculo}</span>}
                                </div>
                              </TableCell>
                              <TableCell className="text-app-text-secondary dark:text-white/70">{formaDetalheTexto(item)}</TableCell>
                              <TableCell
                                className={`whitespace-nowrap text-right ${tipo === 'entrada' ? 'text-[var(--app-success-text)]' : 'text-[var(--app-danger-text)]'}`}
                              >
                                {brl(item.valor)}
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-col gap-1 rounded-[12px] border border-app-border bg-app-bg-secondary/40 px-4 py-3 dark:border-app-border-dark dark:bg-app-hover/20 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-app-text-secondary dark:text-white/60">
                    {linhas.length} {linhas.length === 1 ? 'lançamento' : 'lançamentos'}
                  </span>
                  <span className="text-base font-medium text-app-text-primary dark:text-white">
                    Total: {brl(session.listaCortada ? (tipo === 'entrada' ? session.entradas : session.saidas) : totalLista)}
                  </span>
                </div>
                {session.listaCortada && (
                  <p className="text-xs text-app-text-secondary dark:text-white/60">
                    Lista limitada aos lançamentos mais recentes; o total considera todo o período.
                  </p>
                )}
              </>
            )}

            {card === 'saldo_atual' && (
              <div className="space-y-2 rounded-xl border border-app-border p-4 text-sm dark:border-app-border-dark">
                {!session.multiplo && (
                  <div className="flex justify-between">
                    <span>Saldo inicial</span>
                    <strong>{brl(session.saldoInicial)}</strong>
                  </div>
                )}
                <div className="flex justify-between text-[var(--app-success-text)]">
                  <span>+ Entradas</span>
                  <strong>{brl(session.entradas)}</strong>
                </div>
                <div className="flex justify-between text-[var(--app-danger-text)]">
                  <span>− Saídas</span>
                  <strong>{brl(session.saidas)}</strong>
                </div>
                <div className="flex justify-between border-t border-app-border pt-2 text-base dark:border-app-border-dark">
                  <span>= {session.multiplo ? 'Saldo do período' : 'Saldo atual'}</span>
                  <strong data-testid="saldo-demonstrativo">{brl(session.saldoAtual)}</strong>
                </div>
              </div>
            )}

            {card === 'saldo_inicial' &&
              (session.multiplo ? (
                <p className="text-sm text-app-text-secondary dark:text-white/70">
                  Em um intervalo de datas cada dia tem a sua abertura. Escolha um dia só para ver hora, operador e valor da abertura.
                </p>
              ) : session.temSessao ? (
                <div className="space-y-2 rounded-xl border border-app-border p-4 text-sm dark:border-app-border-dark">
                  <div className="flex justify-between gap-4">
                    <span>Aberto em</span>
                    <strong>{formatarDataHoraClinica(session.openedAt)}</strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Operador</span>
                    <strong>{session.openedByName || '—'}</strong>
                  </div>
                  <div className="flex justify-between border-t border-app-border pt-2 text-base dark:border-app-border-dark">
                    <span>Valor de abertura</span>
                    <strong>{brl(session.saldoInicial)}</strong>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-app-text-secondary dark:text-white/70">O caixa não foi aberto neste dia.</p>
              ))}
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" className="h-11 rounded-xl border-app-border dark:border-app-border-dark" onClick={onClose}>
              Fechar
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
