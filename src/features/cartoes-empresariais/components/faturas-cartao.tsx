'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { FaturaCartao } from '../hooks/use-cartoes-empresariais'
import { formatCurrency, formatDate } from '../formato'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

function nomeMes(mes: string): string {
  const [ano, numero] = mes.split('-')
  const nome = MESES[Number(numero) - 1]
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${ano}`
}

export function FaturasCartao({ faturas }: { faturas: FaturaCartao[] }) {
  const [aberta, setAberta] = useState<string | null>(null)
  const emAberto = faturas.filter((fatura) => fatura.status !== 'paga')

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-medium text-app-text-primary dark:text-white">Faturas em aberto, mês a mês</h3>
        <p className="text-xs text-app-text-muted">
          Cada fatura mostra o total do mês; compras parceladas aparecem parcela a parcela em cada fatura futura.
        </p>
      </div>
      {emAberto.length === 0 ? (
        <p className="rounded-[18px] border border-app-border py-6 text-center text-sm text-app-text-muted dark:border-app-border-dark">
          Nenhuma fatura futura em aberto.
        </p>
      ) : (
        <ul className="divide-y divide-app-border overflow-hidden rounded-[18px] border border-app-border dark:divide-app-border-dark dark:border-app-border-dark">
          {emAberto.map((fatura) => {
            const expandida = aberta === fatura.mes
            return (
              <li key={fatura.mes}>
                <button
                  type="button"
                  onClick={() => setAberta(expandida ? null : fatura.mes)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-app-bg-secondary/40"
                  aria-expanded={expandida}
                >
                  <span className="flex items-center gap-2 text-sm text-app-text-primary dark:text-white">
                    {expandida ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span>{nomeMes(fatura.mes)}</span>
                    <Badge variant="outline" className="rounded-full text-[10px]">{fatura.status === 'fechada' ? 'Fechada' : 'Aberta'}</Badge>
                    <span className="hidden text-xs text-app-text-muted sm:inline">vence {formatDate(fatura.vencimento)}</span>
                  </span>
                  <span className="tabular-nums text-sm font-medium text-app-text-primary dark:text-white">
                    {formatCurrency(fatura.total)}
                  </span>
                </button>
                {expandida && (
                  <ul className="space-y-1 bg-app-bg-secondary/30 px-4 py-3 text-sm dark:bg-app-hover/30">
                    {fatura.itens.map((item) => (
                      <li key={`${item.movimentoId}-${item.numero}`} className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-app-text-secondary dark:text-white/70">
                          {item.descricao}
                          {item.beneficiario ? ` · ${item.beneficiario}` : ''} · parcela {item.numero}/{item.total}
                        </span>
                        <span className="shrink-0 tabular-nums">{formatCurrency(item.valor)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
