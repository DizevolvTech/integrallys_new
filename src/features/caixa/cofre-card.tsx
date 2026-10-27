'use client'

import { Landmark } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CartaoMobile, ListaCartoesMobile } from '@/components/shared/mobile-card'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useApi } from '@/hooks/use-api'

type CofreMovimento = {
  id: string
  tipo: 'entrada' | 'saida'
  valor: number
  descricao: string
  operador: string
  dataMovimento: string
}

type CofreResponse = { data: CofreMovimento[]; meta: { saldo: number } }

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataHora = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { dia: '—', hora: '' }
  const tz = { timeZone: 'America/Sao_Paulo' } as const
  return {
    dia: d.toLocaleDateString('pt-BR', tz),
    hora: d.toLocaleTimeString('pt-BR', { ...tz, hour: '2-digit', minute: '2-digit' }),
  }
}

/**
 * Vídeo de 26/10: no caixa do gestor deve aparecer o dinheiro transferido do
 * caixa para o cofre no fechamento. Mostra o saldo do cofre e as últimas
 * transferências com data, hora, valor e quem fechou o caixa.
 */
export function CofreCard({ atualizarQuando }: { atualizarQuando?: string }) {
  const api = useApi()
  const [estado, setEstado] = useState<{ carregando: boolean; erro: string | null; saldo: number; itens: CofreMovimento[] }>({
    carregando: true,
    erro: null,
    saldo: 0,
    itens: [],
  })

  // biome-ignore lint/correctness/useExhaustiveDependencies: recarrega quando o caixa abre/fecha/movimenta
  useEffect(() => {
    let ativo = true
    api
      .get<CofreResponse>('/api/caixa/cofre')
      .then((res) => {
        if (ativo) setEstado({ carregando: false, erro: null, saldo: res.meta?.saldo ?? 0, itens: res.data ?? [] })
      })
      .catch((err) => {
        if (ativo) setEstado((prev) => ({ ...prev, carregando: false, erro: err instanceof Error ? err.message : 'Falha ao carregar o cofre' }))
      })
    return () => {
      ativo = false
    }
  }, [api, atualizarQuando])

  return (
    <Card className="overflow-hidden rounded-[16px] border border-app-border bg-app-card p-0 shadow-sm dark:border-app-border-dark dark:bg-app-card-dark" data-testid="cofre-card">
      <div className="flex flex-col gap-2 border-b border-app-border p-6 sm:flex-row sm:items-center sm:justify-between dark:border-app-border-dark">
        <div className="flex items-center gap-3">
          <Landmark className="h-5 w-5 text-[var(--app-primary)]" aria-hidden="true" />
          <div>
            <h3 className="text-lg font-normal text-app-text-primary dark:text-white">Cofre</h3>
            <p className="text-xs text-app-text-secondary dark:text-white/60">Dinheiro transferido do caixa no fechamento</p>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs text-app-text-secondary dark:text-white/60">Saldo do cofre</p>
          <p className="text-2xl font-normal text-app-text-primary dark:text-white">{brl(estado.saldo)}</p>
        </div>
      </div>
      <ListaCartoesMobile>
        {estado.carregando && <p className="py-6 text-center text-sm text-app-text-secondary">Carregando cofre...</p>}
        {!estado.carregando && estado.erro && <p className="py-6 text-center text-sm text-[var(--app-danger-text)]">{estado.erro}</p>}
        {!estado.carregando && !estado.erro && estado.itens.length === 0 && (
          <p className="py-6 text-center text-sm text-app-text-secondary">Nenhuma transferência ao cofre ainda.</p>
        )}
        {estado.itens.map((item) => {
          const { dia, hora } = dataHora(item.dataMovimento)
          return (
            <CartaoMobile
              key={item.id}
              titulo={item.descricao}
              subtitulo={`${dia} · ${hora}`}
              valor={
                <span className={item.tipo === 'entrada' ? 'text-[var(--app-success-text)]' : 'text-[var(--app-danger-text)]'}>
                  {item.tipo === 'saida' ? '-' : ''}
                  {brl(item.valor)}
                </span>
              }
              campos={[{ rotulo: 'Quem fechou', valor: item.operador || '—' }]}
            />
          )
        })}
      </ListaCartoesMobile>
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-none bg-app-bg-secondary/50 dark:bg-app-card/[0.02]">
              <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary dark:text-white/60">Data</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary dark:text-white/60">Hora</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary dark:text-white/60">Descrição</TableHead>
              <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-app-text-secondary dark:text-white/60">Valor</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary dark:text-white/60">Quem fechou</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {estado.carregando && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-app-text-secondary">Carregando cofre...</TableCell>
              </TableRow>
            )}
            {!estado.carregando && estado.erro && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-[var(--app-danger-text)]">{estado.erro}</TableCell>
              </TableRow>
            )}
            {!estado.carregando && !estado.erro && estado.itens.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-app-text-secondary dark:text-white/60">
                  Nenhuma transferência ao cofre ainda.
                </TableCell>
              </TableRow>
            )}
            {estado.itens.map((item) => {
              const { dia, hora } = dataHora(item.dataMovimento)
              return (
                <TableRow key={item.id} className="border-app-border dark:border-app-border-dark">
                  <TableCell className="font-normal text-app-text-secondary">{dia}</TableCell>
                  <TableCell className="font-normal text-app-text-secondary">{hora}</TableCell>
                  <TableCell className="font-normal text-app-text-primary dark:text-white">{item.descricao}</TableCell>
                  <TableCell className={`text-right font-normal ${item.tipo === 'entrada' ? 'text-[var(--app-success-text)]' : 'text-[var(--app-danger-text)]'}`}>
                    {item.tipo === 'saida' ? '-' : ''}
                    {brl(item.valor)}
                  </TableCell>
                  <TableCell className="font-normal text-app-text-secondary dark:text-white/60">{item.operador || '—'}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}
