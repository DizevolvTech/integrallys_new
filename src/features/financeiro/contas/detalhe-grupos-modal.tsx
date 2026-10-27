'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatCurrency } from '../financeiro.utils'

export type LinhaDetalhe = { id: string; titulo: string; subtitulo?: string | null; valor: number }
export type GrupoDetalhe = { chave: string; rotulo: string; total: number; linhas: LinhaDetalhe[] }

interface Props {
  open: boolean
  onClose: () => void
  titulo: string
  descricao?: string
  total: number
  grupos: GrupoDetalhe[]
  carregando?: boolean
  erro?: string | null
  /** Rótulo dos grupos no cabeçalho (ex.: "Por forma de pagamento"). */
  agrupadoPor?: string
}

/** Detalhamento de um card: o valor aberto por grupo (forma de pagamento) e, dentro, cada lançamento. */
export function DetalheGruposModal({ open, onClose, titulo, descricao, total, grupos, carregando, erro, agrupadoPor = 'Por forma de pagamento' }: Props) {
  const [aberto, setAberto] = useState<string | null>(null)

  return (
    <Dialog open={open} onOpenChange={(proximo) => !proximo && onClose()}>
      <DialogContent className="max-h-[90vh] w-[95%] overflow-y-auto rounded-[24px] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <div className="flex items-baseline justify-between rounded-2xl bg-app-bg-secondary/50 px-4 py-3 dark:bg-app-hover/40">
          <span className="text-sm text-app-text-secondary">Total</span>
          <span className="text-xl tabular-nums text-app-text-primary dark:text-white">{formatCurrency(total)}</span>
        </div>
        <p className="text-xs uppercase tracking-wider text-app-text-muted">{agrupadoPor}</p>
        {carregando ? (
          <p className="py-6 text-center text-sm text-app-text-muted">Carregando detalhamento...</p>
        ) : erro ? (
          <p className="py-6 text-center text-sm text-[var(--app-danger-text)]">{erro}</p>
        ) : grupos.length === 0 ? (
          <p className="py-6 text-center text-sm text-app-text-muted">Nenhum lançamento compõe este valor.</p>
        ) : (
          <ul className="divide-y divide-app-border rounded-2xl border border-app-border dark:divide-app-border-dark dark:border-app-border-dark">
            {grupos.map((grupo) => {
              const expandido = aberto === grupo.chave
              return (
                <li key={grupo.chave}>
                  <button
                    type="button"
                    aria-expanded={expandido}
                    onClick={() => setAberto(expandido ? null : grupo.chave)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-app-bg-secondary/40"
                  >
                    <span className="flex items-center gap-2 text-sm text-app-text-primary dark:text-white">
                      {expandido ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      {grupo.rotulo}
                      <span className="text-xs text-app-text-muted">({grupo.linhas.length})</span>
                    </span>
                    <span className="tabular-nums text-sm">{formatCurrency(grupo.total)}</span>
                  </button>
                  {expandido && (
                    <ul className="space-y-2 bg-app-bg-secondary/30 px-4 py-3 text-sm dark:bg-app-hover/30">
                      {grupo.linhas.map((linha) => (
                        <li key={linha.id} className="flex items-start justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block truncate text-app-text-primary dark:text-white">{linha.titulo}</span>
                            {linha.subtitulo && <span className="block truncate text-xs text-app-text-muted">{linha.subtitulo}</span>}
                          </span>
                          <span className="shrink-0 tabular-nums">{formatCurrency(linha.valor)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
