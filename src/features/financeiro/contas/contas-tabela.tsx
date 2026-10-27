'use client'

import Link from 'next/link'
import { CalendarDays, CheckCircle2, Edit, Eye, MoreVertical, Paperclip, RotateCcw } from 'lucide-react'
import { DataTable } from '@/components/shared/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { SituacaoFinanceira } from '@/lib/financeiro-situacao'
import { formatCurrency } from '../financeiro.utils'
import type { ContaItem } from './use-contas'

const COR_SITUACAO: Record<SituacaoFinanceira, string> = {
  liquidado: 'app-status-success',
  a_vencer: 'app-status-warning',
  atrasado: 'app-status-danger',
  cancelado: 'app-status-neutral',
}

function formatarData(iso: string | null) {
  if (!iso) return '—'
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

interface Props {
  tipo: 'receita' | 'despesa'
  itens: ContaItem[]
  onVisualizar: (item: ContaItem) => void
  onEditar: (item: ContaItem) => void
  onLiquidar: (item: ContaItem) => void
  onAnexos: (item: ContaItem) => void
  onExcluir: (item: ContaItem) => void
}

const CABECALHO = 'px-3 text-xs font-medium uppercase tracking-wider text-app-text-secondary whitespace-nowrap'

export function ContasTabela({ tipo, itens, onVisualizar, onEditar, onLiquidar, onAnexos, onExcluir }: Props) {
  const receita = tipo === 'receita'
  return (
    <DataTable data={itens}>
      {(pagina) => (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-hover">
              <TableRow>
                <TableHead className={CABECALHO}>Vencimento</TableHead>
                <TableHead className={CABECALHO}>Emissão</TableHead>
                <TableHead className={CABECALHO}>Nº doc.</TableHead>
                <TableHead className={`${CABECALHO} min-w-[180px]`}>{receita ? 'Descrição / cliente' : 'Descrição / fornecedor'}</TableHead>
                <TableHead className={CABECALHO}>Parcela</TableHead>
                <TableHead className={CABECALHO}>Forma</TableHead>
                <TableHead className={`${CABECALHO} text-right`}>Valor</TableHead>
                <TableHead className={CABECALHO}>Situação</TableHead>
                <TableHead className={`${CABECALHO} text-center`}>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagina.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="px-3 py-3 text-app-text-secondary">{formatarData(item.vencimento ?? item.dataReferencia)}</TableCell>
                  <TableCell className="px-3 py-3 text-app-text-secondary">{formatarData(item.emissao)}</TableCell>
                  <TableCell className="px-3 py-3 text-app-text-secondary">{item.numeroDocumento ?? '—'}</TableCell>
                  <TableCell className="px-3 py-3 text-app-text-primary dark:text-white">
                    <span className="block">{item.descricao}</span>
                    {(item.pessoa || item.categoria) && (
                      <span className="block text-xs text-app-text-muted">{[item.pessoa, item.categoria].filter(Boolean).join(' · ')}</span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-3 text-app-text-secondary">{item.parcela ?? '—'}</TableCell>
                  <TableCell className="px-3 py-3 text-app-text-secondary">{item.forma}</TableCell>
                  <TableCell className="px-3 py-3 text-right tabular-nums text-app-text-primary dark:text-white">{formatCurrency(item.valor)}</TableCell>
                  <TableCell className="px-3 py-3">
                    <Badge className={`font-normal ${COR_SITUACAO[item.situacao]}`}>{item.situacaoLabel}</Badge>
                    {item.anexos > 0 && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-app-text-muted" title={`${item.anexos} documento(s) anexado(s)`}>
                        <Paperclip className="h-3 w-3" />
                        {item.anexos}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-3 text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" aria-label="Ações" className="mx-auto h-9 w-9 rounded-xl">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {item.somenteLeitura ? (
                          <DropdownMenuItem asChild>
                            <Link href="/agenda"><CalendarDays className="mr-2 h-4 w-4" />Receber na agenda</Link>
                          </DropdownMenuItem>
                        ) : (
                          <>
                            <DropdownMenuItem onClick={() => onVisualizar(item)}><Eye className="mr-2 h-4 w-4" />Visualizar</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEditar(item)}><Edit className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                            {item.situacao !== 'liquidado' && item.situacao !== 'cancelado' && (
                              <DropdownMenuItem onClick={() => onLiquidar(item)}>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                {receita ? 'Registrar recebimento' : 'Marcar como pago'}
                              </DropdownMenuItem>
                            )}
                            {!receita && (
                              <DropdownMenuItem onClick={() => onAnexos(item)}><Paperclip className="mr-2 h-4 w-4" />Documentos (nota, cupom, recibo)</DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-[var(--app-danger-text)]" onClick={() => onExcluir(item)}>
                              <RotateCcw className="mr-2 h-4 w-4" />Excluir
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </DataTable>
  )
}
