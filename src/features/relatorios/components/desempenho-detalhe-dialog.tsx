'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RelatorioCartoesMobile } from '@/features/relatorios/components/relatorio-cartoes-mobile'
import { RelatorioCelula } from '@/features/relatorios/components/relatorio-celula'
import { useRelatorioTabela } from '@/features/relatorios/hooks/use-relatorio-tabela'
import { COLUNAS_DESEMPENHO_DETALHE, DETALHES_DESEMPENHO, type ColunaRelatorio } from '@/features/relatorios/relatorio-config'
import { formatData } from '@/features/relatorios/format'

const POR_PAGINA = 10

const EXPLICACAO: Record<string, string> = {
  agendamentos: 'Todos os agendamentos de pacientes no período e com os filtros escolhidos.',
  realizados: 'Atendimentos concluídos (concluído ou check-out) no período.',
  cancelados: 'Agendamentos cancelados no período.',
  faltas: 'Pacientes que não compareceram no período.',
  pacientes: 'Cada paciente atendido no período aparece uma vez, com o último atendimento e o total de atendimentos.',
  taxa: 'Taxa de conclusão = realizados ÷ agendamentos. A lista mostra todos os agendamentos que entram na conta.',
}

const COLUNA_ATENDIMENTOS: ColunaRelatorio = { key: 'atendimentos', label: 'Atendimentos', tipo: 'numero', direita: true }

interface Props {
  /** Indicador aberto (agendamentos, realizados, cancelados, faltas, pacientes ou taxa). */
  metrica: string
  /** Mesmos filtros da tela (período, unidade, profissional). */
  filtros: Record<string, string>
  onClose: () => void
}

/** Resumo com a lista dos registros que formam o número de um cartão do Desempenho geral. */
export function DesempenhoDetalheDialog({ metrica, filtros, onClose }: Props) {
  const [pagina, setPagina] = useState(1)
  const { linhas, meta, isLoading, error } = useRelatorioTabela('desempenho-detalhe', { ...filtros, metrica }, pagina, POR_PAGINA)
  const colunas = metrica === 'pacientes' ? [...COLUNAS_DESEMPENHO_DETALHE, COLUNA_ATENDIMENTOS] : COLUNAS_DESEMPENHO_DETALHE
  const total = meta?.total ?? 0
  const totais = meta?.totais ?? {}
  const de = total === 0 ? 0 : (pagina - 1) * POR_PAGINA + 1
  const ate = Math.min(pagina * POR_PAGINA, total)
  const periodo = filtros.inicio || filtros.fim ? `${formatData(filtros.inicio)} a ${formatData(filtros.fim)}` : ''
  const numero = (valor: unknown) => Number(valor ?? 0).toLocaleString('pt-BR')
  const pct = Number(totais.taxaConclusaoPct ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent size="xl" className="rounded-[24px]">
        <DialogHeader>
          <DialogTitle>{DETALHES_DESEMPENHO[metrica] ?? 'Registros'}</DialogTitle>
          <DialogDescription>
            {EXPLICACAO[metrica]} {periodo && `Período: ${periodo}.`}
          </DialogDescription>
        </DialogHeader>

        {metrica === 'taxa' && meta && (
          <p className="rounded-xl border border-app-border bg-app-bg-secondary/30 p-3 text-sm dark:border-app-border-dark dark:bg-app-hover">
            Conta: {numero(totais.realizados)} realizados ÷ {numero(totais.agendamentos)} agendamentos = <strong>{pct}%</strong>
          </p>
        )}
        {error && <p className="text-sm text-[var(--app-danger-text)]">{error}</p>}

        <div className="md:hidden">
          {isLoading && linhas.length === 0 && <p className="py-6 text-center text-sm text-app-text-secondary">Carregando registros...</p>}
          {!isLoading && linhas.length === 0 && (
            <p className="py-6 text-center text-sm text-app-text-secondary">Nenhum registro neste indicador.</p>
          )}
          <RelatorioCartoesMobile config={{ descricao: '', filtros: [], colunas, mobile: { titulo: 'paciente', selo: 'status' } }} linhas={linhas} />
        </div>

        <div className="hidden max-h-[55vh] overflow-auto rounded-xl border border-app-border dark:border-app-border-dark md:block">
          <Table>
            <TableHeader>
              <TableRow>
                {colunas.map((c) => (
                  <TableHead key={c.key} className={`whitespace-nowrap text-xs font-normal uppercase ${c.direita ? 'text-right' : ''}`}>
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && linhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={colunas.length} className="h-20 text-center text-app-text-secondary">
                    Carregando registros...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && linhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={colunas.length} className="h-20 text-center text-app-text-secondary">
                    Nenhum registro neste indicador.
                  </TableCell>
                </TableRow>
              )}
              {linhas.map((linha) => (
                <TableRow key={linha.id}>
                  {colunas.map((c) => (
                    <TableCell key={c.key} className={`py-2.5 text-sm ${c.direita ? 'text-right' : ''}`}>
                      <RelatorioCelula coluna={c} valor={linha[c.key]} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-app-text-secondary">
            {de}–{ate} de {total}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-lg" aria-label="Página anterior" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {pagina} / {meta?.totalPaginas ?? 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              aria-label="Próxima página"
              disabled={pagina >= (meta?.totalPaginas ?? 1)}
              onClick={() => setPagina((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
