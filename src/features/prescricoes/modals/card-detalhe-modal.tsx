'use client'

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export interface CardDetalheLinha {
  id: string
  numero: string
  paciente: string
  data: string
  valorTotal: number
  /** Só gestor/admin/master. */
  margemTotal?: number
}

interface CardDetalheModalProps {
  isOpen: boolean
  onClose: () => void
  titulo: string
  linhas: CardDetalheLinha[]
  onAbrir: (id: string) => void
  onFiltrar: () => void
}

const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Detalhe do card (Ativas, Vencidas, Concluídas): lista os registros e abre cada um. */
export function CardDetalheModal({ isOpen, onClose, titulo, linhas, onAbrir, onFiltrar }: CardDetalheModalProps) {
  const total = linhas.reduce((s, l) => s + l.valorTotal, 0)
  const temMargem = linhas.some((l) => l.margemTotal !== undefined)
  const margem = linhas.reduce((s, l) => s + (l.margemTotal ?? 0), 0)
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="xl" className="w-[95vw] max-h-[90vh] overflow-y-auto rounded-[24px] bg-app-card dark:bg-app-card-dark">
        <DialogTitle className="text-xl font-semibold text-app-text-primary dark:text-white">{titulo} ({linhas.length})</DialogTitle>
        <DialogDescription className="text-sm text-app-text-secondary">
          Total {reais(total)}
          {temMargem ? ` · Margem ${reais(margem)}` : ''}
        </DialogDescription>
        <div className="overflow-x-auto rounded-xl border border-app-border dark:border-app-border-dark">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                {temMargem && <TableHead className="text-right">Margem</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.length === 0 ? (
                <TableRow><TableCell colSpan={temMargem ? 5 : 4} className="py-8 text-center text-app-text-secondary">Nenhum registro neste grupo.</TableCell></TableRow>
              ) : (
                linhas.map((l) => (
                  <TableRow key={l.id} className="cursor-pointer" onClick={() => onAbrir(l.id)}>
                    <TableCell className="font-medium text-app-primary uppercase">{l.numero}</TableCell>
                    <TableCell>{l.paciente}</TableCell>
                    <TableCell>{l.data}</TableCell>
                    <TableCell className="text-right">{reais(l.valorTotal)}</TableCell>
                    {temMargem && <TableCell className="text-right text-[var(--app-success-text)]">{l.margemTotal !== undefined ? reais(l.margemTotal) : '—'}</TableCell>}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <Button variant="outline" className="h-11 rounded-xl" onClick={onFiltrar}>Filtrar a lista por este grupo</Button>
          <Button className="h-11 rounded-xl bg-app-primary text-white" onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
