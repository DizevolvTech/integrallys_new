'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RelatorioCartoesMobile } from '@/features/relatorios/components/relatorio-cartoes-mobile'
import { RelatorioCelula } from '@/features/relatorios/components/relatorio-celula'
import { useRelatorioTabela } from '@/features/relatorios/hooks/use-relatorio-tabela'
import { descricaoDoPeriodo, type DetalheCartao } from '@/features/relatorios/relatorio-detalhes'
import type { CartaoTotal, ConfigRelatorio } from '@/features/relatorios/relatorio-config'

const POR_PAGINA = 10

interface Props {
  detalhe: DetalheCartao
  cartao: CartaoTotal
  /** Config do relatório de origem (colunas e destaque no celular). */
  config: ConfigRelatorio
  /** Mesmos filtros da tela (período, unidade, profissional...). */
  filtros: Record<string, string>
  /** Totais do relatório de origem (para a "conta" do indicador). */
  totais: Record<string, unknown>
  onClose: () => void
}

/** Janela com a lista dos registros que formam o número de um cartão clicável dos Relatórios. */
export function RelatorioDetalheDialog({ detalhe, cartao, config, filtros, totais, onClose }: Props) {
  const indicador = cartao.detalhe ?? ''
  const filtrosLista = detalhe.filtros(filtros, indicador)
  const colunas = detalhe.colunas(config, indicador)
  const conta = detalhe.conta?.(totais)

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent size="xl" className="rounded-[24px]">
        <DialogHeader>
          <DialogTitle>{detalhe.titulo(cartao)}</DialogTitle>
          <DialogDescription>
            {detalhe.explicacao(indicador)} {descricaoDoPeriodo(filtros)}
          </DialogDescription>
        </DialogHeader>
        {conta && (
          <p className="rounded-xl border border-app-border bg-app-bg-secondary/30 p-3 text-sm dark:border-app-border-dark dark:bg-app-hover">
            {conta}
          </p>
        )}
        <ListaDoDetalhe tipo={detalhe.tipo} filtros={filtrosLista} colunas={colunas} config={{ ...config, colunas, mobile: detalhe.mobile ?? config.mobile }} />
      </DialogContent>
    </Dialog>
  )
}

interface ListaProps {
  tipo: string
  filtros: Record<string, string> | null
  colunas: ConfigRelatorio['colunas']
  config: ConfigRelatorio
}

function ListaDoDetalhe({ tipo, filtros, colunas, config }: ListaProps) {
  const [pagina, setPagina] = useState(1)
  const { linhas, meta, isLoading, error } = useRelatorioTabela(tipo, filtros ?? {}, pagina, POR_PAGINA, filtros !== null)
  const total = filtros ? (meta?.total ?? 0) : 0
  const de = total === 0 ? 0 : (pagina - 1) * POR_PAGINA + 1
  const ate = Math.min(pagina * POR_PAGINA, total)
  const lista = filtros ? linhas : []
  const carregando = filtros !== null && isLoading && lista.length === 0

  return (
    <>
      {error && <p className="text-sm text-[var(--app-danger-text)]">{error}</p>}

      <div className="md:hidden">
        {carregando && <p className="py-6 text-center text-sm text-app-text-secondary">Carregando registros...</p>}
        {!carregando && lista.length === 0 && <p className="py-6 text-center text-sm text-app-text-secondary">Nenhum registro neste indicador.</p>}
        <RelatorioCartoesMobile config={config} linhas={lista} />
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
            {(carregando || lista.length === 0) && (
              <TableRow>
                <TableCell colSpan={colunas.length} className="h-20 text-center text-app-text-secondary">
                  {carregando ? 'Carregando registros...' : 'Nenhum registro neste indicador.'}
                </TableCell>
              </TableRow>
            )}
            {lista.map((linha) => (
              <TableRow key={linha.id}>
                {colunas.map((c) => (
                  <TableCell key={c.key} className={`py-2.5 text-sm ${c.direita ? 'whitespace-nowrap text-right' : ''}`}>
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
    </>
  )
}
