'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useApi } from '@/hooks/use-api'
import type { ResumoCard, ResumoColuna, ResumoLinha } from '@/app/api/dashboard/resumo'

interface ResumoResposta {
  titulo: string
  vazio: string
  periodo: { de: string; ate: string }
  colunas: ResumoColuna[]
  linhas: ResumoLinha[]
  total: number
  page: number
  pageSize: number
  rodape?: string
}

const dataBr = (iso: string) => iso.split('-').reverse().join('/')

/** Janela de resumo de um card do início do especialista: busca só ao abrir (1 consulta por card). */
export function ResumoModal({ card, onClose }: { card: ResumoCard | null; onClose: () => void }) {
  const api = useApi()
  const [page, setPage] = useState(1)
  const [dados, setDados] = useState<ResumoResposta | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    setPage(1)
    setDados(null)
  }, [card])

  useEffect(() => {
    if (!card) return
    let ativo = true
    setErro(null)
    api
      .get<ResumoResposta>(`/api/dashboard/resumo?card=${card}&page=${page}`)
      .then((resposta) => ativo && setDados(resposta))
      .catch((e: unknown) => ativo && setErro(e instanceof Error ? e.message : 'Não foi possível carregar o resumo.'))
    return () => {
      ativo = false
    }
  }, [api, card, page])

  const paginas = dados ? Math.max(1, Math.ceil(dados.total / dados.pageSize)) : 1
  const periodo = dados ? (dados.periodo.de === dados.periodo.ate ? dataBr(dados.periodo.de) : `${dataBr(dados.periodo.de)} a ${dataBr(dados.periodo.ate)}`) : ''

  return (
    <Dialog open={card !== null} onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent size="xl" allowOutsideClose srTitle="Resumo do card" className="gap-3 p-4 sm:p-6" data-testid="resumo-modal">
        <DialogHeader className="pr-8">
          <DialogTitle>{dados?.titulo ?? 'Carregando…'}</DialogTitle>
          <DialogDescription>{dados ? `${periodo} · ${dados.total} ${dados.total === 1 ? 'registro' : 'registros'}` : ' '}</DialogDescription>
        </DialogHeader>

        {erro ? (
          <p role="alert" className="py-8 text-center text-sm text-[var(--app-danger-text)]">{erro}</p>
        ) : !dados ? (
          <p className="py-8 text-center text-sm text-app-text-muted">Carregando…</p>
        ) : dados.linhas.length === 0 ? (
          <p className="py-8 text-center text-sm text-app-text-muted">{dados.vazio}</p>
        ) : (
          <div className="max-h-[60vh] overflow-auto rounded-md border border-app-border dark:border-app-border-dark">
            <ul className="divide-y divide-app-border dark:divide-app-border-dark sm:hidden" aria-label={dados.titulo}>
              {dados.linhas.map((linha) => (
                <li key={linha.id} className="space-y-1 px-3 py-2.5 text-sm">
                  <p className="font-medium text-app-text-primary dark:text-white">{linha.cliente}</p>
                  {dados.colunas.filter((coluna) => coluna.key !== 'cliente').map((coluna) => (
                    <p key={coluna.key} className="flex justify-between gap-3">
                      <span className="text-app-text-muted">{coluna.label}</span>
                      <span className="text-right">{linha[coluna.key]}</span>
                    </p>
                  ))}
                </li>
              ))}
            </ul>
            <Table className="hidden sm:table">
              <TableHeader>
                <TableRow>
                  {dados.colunas.map((coluna) => (
                    <TableHead key={coluna.key} className={`h-10 px-2 py-2 leading-tight ${coluna.align === 'right' ? 'text-right' : ''}`}>{coluna.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {dados.linhas.map((linha) => (
                  <TableRow key={linha.id}>
                    {dados.colunas.map((coluna) => (
                      <TableCell key={coluna.key} className={`px-2 py-2 ${coluna.key === 'justificativa' ? 'min-w-[160px]' : 'whitespace-nowrap'} ${coluna.align === 'right' ? 'text-right tabular-nums' : ''}`}>
                        {linha[coluna.key]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {dados?.rodape && <p className="text-right text-sm font-medium text-app-text-primary dark:text-white">{dados.rodape}</p>}

        {dados && paginas > 1 && (
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <span className="text-xs text-app-text-muted">Página {page} de {paginas}</span>
            <Button variant="outline" size="sm" disabled={page >= paginas} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
