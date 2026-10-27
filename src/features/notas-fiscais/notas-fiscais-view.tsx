'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CartaoMobile, ListaCartoesMobile } from '@/components/shared/mobile-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useApi } from '@/hooks/use-api'
import { formatarDataHoraClinica } from '@/lib/fuso-clinica'
import { descreverPedidosNf, ROTULO_STATUS_PEDIDO_NF, type ResumoPedidosNf, type StatusPedidoNf } from '@/lib/pedidos-nf'

interface Pedido {
  id: string
  origem: 'prescricao' | 'agendamento'
  paciente: string
  solicitante: string
  valor: number
  observacao: string | null
  status: StatusPedidoNf
  criadoEm: string
}

interface Resposta {
  data: Pedido[]
  meta: { total: number; pagina: number; totalPaginas: number; resumo: ResumoPedidosNf }
}

const ORIGEM = { prescricao: 'Venda', agendamento: 'Consulta' }
const COR: Record<StatusPedidoNf, string> = {
  pendente: 'app-status-warning',
  emitida: 'app-status-success',
  cancelada: 'app-status-neutral',
}
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Lista dos pedidos de nota fiscal (card "Notas fiscais" do início do admin). */
export function NotasFiscaisView() {
  const api = useApi()
  const [status, setStatus] = useState('todos')
  const [pagina, setPagina] = useState(1)
  const [resposta, setResposta] = useState<Resposta | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const query = new URLSearchParams({ pagina: String(pagina) })
      if (status !== 'todos') query.set('status', status)
      setResposta(await api.get<Resposta>(`/api/pedidos-nf?${query}`))
      setErro(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar os pedidos de NF.')
    } finally {
      setCarregando(false)
    }
  }, [api, pagina, status])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const linhas = resposta?.data ?? []
  const meta = resposta?.meta

  return (
    <div className="space-y-4">
      {meta && <p className="text-sm text-app-text-secondary">{descreverPedidosNf(meta.resumo)}</p>}
      <div className="max-w-xs">
        <Select
          value={status}
          onValueChange={(valor) => {
            setStatus(valor)
            setPagina(1)
          }}
        >
          <SelectTrigger aria-label="Situação do pedido">
            <SelectValue placeholder="Situação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as situações</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="emitida">Emitidas</SelectItem>
            <SelectItem value="cancelada">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {erro && <p className="text-sm text-[var(--app-danger-text)]">{erro}</p>}
      {!carregando && linhas.length === 0 && !erro && (
        <p className="py-6 text-center text-sm text-app-text-secondary">Nenhum pedido de nota fiscal encontrado.</p>
      )}

      <div className="rounded-xl border border-app-border md:hidden dark:border-app-border-dark">
        <ListaCartoesMobile>
          {linhas.map((p) => (
            <CartaoMobile
              key={p.id}
              titulo={p.paciente}
              subtitulo={formatarDataHoraClinica(p.criadoEm)}
              valor={brl(p.valor)}
              selo={<Badge className={`font-normal ${COR[p.status]}`}>{ROTULO_STATUS_PEDIDO_NF[p.status]}</Badge>}
              campos={[
                { rotulo: 'Origem', valor: ORIGEM[p.origem] },
                { rotulo: 'Solicitado por', valor: p.solicitante },
                ...(p.observacao ? [{ rotulo: 'Observação', valor: p.observacao }] : []),
              ]}
            />
          ))}
        </ListaCartoesMobile>
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-app-border md:block dark:border-app-border-dark">
        <Table>
          <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-hover">
            <TableRow>
              {['Data', 'Cliente', 'Origem', 'Valor', 'Situação', 'Solicitado por', 'Observação'].map((titulo) => (
                <TableHead key={titulo} className="whitespace-nowrap text-xs font-normal uppercase text-app-text-secondary">
                  {titulo}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="whitespace-nowrap">{formatarDataHoraClinica(p.criadoEm)}</TableCell>
                <TableCell>{p.paciente}</TableCell>
                <TableCell>{ORIGEM[p.origem]}</TableCell>
                <TableCell className="tabular-nums">{brl(p.valor)}</TableCell>
                <TableCell>
                  <Badge className={`font-normal ${COR[p.status]}`}>{ROTULO_STATUS_PEDIDO_NF[p.status]}</Badge>
                </TableCell>
                <TableCell>{p.solicitante}</TableCell>
                <TableCell>{p.observacao ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {meta && meta.totalPaginas > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} aria-label="Página anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            {pagina} / {meta.totalPaginas}
          </span>
          <Button variant="outline" size="sm" disabled={pagina >= meta.totalPaginas} onClick={() => setPagina((p) => p + 1)} aria-label="Próxima página">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
