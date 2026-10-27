'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoeda } from '@/features/relatorios/format'
import type { LinhaRelatorio } from '@/features/relatorios/hooks/use-relatorio-tabela'

interface ItemVenda {
  descricao: string
  quantidade: number
  valorUnitario: number
  total: number
}

/** Produtos da Prescrição/Venda que gerou a comissão. */
export function ComissaoItensDialog({ linha, onClose }: { linha: LinhaRelatorio | null; onClose: () => void }) {
  const itens = (linha?.itens as ItemVenda[] | undefined) ?? []
  return (
    <Dialog open={Boolean(linha)} onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent size="lg" className="rounded-[24px]">
        <DialogHeader>
          <DialogTitle>Produtos da {String(linha?.numero ?? 'venda')}</DialogTitle>
          <DialogDescription>
            Cliente {String(linha?.cliente ?? '')} · comissão de {formatMoeda(linha?.comissao)} sobre {formatMoeda(linha?.bruto)}
          </DialogDescription>
        </DialogHeader>
        <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Unitário</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-app-text-muted">
                    Esta venda não tem itens registrados.
                  </TableCell>
                </TableRow>
              )}
              {itens.map((item) => (
                <TableRow key={`${item.descricao}-${item.quantidade}-${item.valorUnitario}`}>
                  <TableCell>{item.descricao}</TableCell>
                  <TableCell className="text-right">{item.quantidade}</TableCell>
                  <TableCell className="text-right">{formatMoeda(item.valorUnitario)}</TableCell>
                  <TableCell className="text-right">{formatMoeda(item.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  )
}
