'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FileDown, Printer, Receipt } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useApi } from '@/hooks/use-api'
import type { ReciboDados, ReciboTipo } from '@/lib/recibo'
import { ReciboDocumento } from './recibo-documento'
import { baixarReciboPdf, imprimirRecibo } from './recibo-pdf'

interface ReciboModalProps {
  isOpen: boolean
  onClose: () => void
  tipo: ReciboTipo
  /** Id da venda (prescrição) ou do agendamento. */
  origemId: string | null
}

/** Emissão de recibo (imprimir/PDF) ou pedido de NF — usado na venda convertida e nos 3 pontinhos da agenda. */
export function ReciboModal({ isOpen, onClose, tipo, origemId }: ReciboModalProps) {
  const api = useApi()
  const folhaRef = useRef<HTMLDivElement | null>(null)
  const [dados, setDados] = useState<ReciboDados | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [enviandoNf, setEnviandoNf] = useState(false)

  const carregar = useCallback(async () => {
    if (!origemId) return
    setCarregando(true)
    setErro(null)
    try {
      const res = await api.get<{ data: ReciboDados }>(`/api/recibos?tipo=${tipo}&id=${encodeURIComponent(origemId)}`)
      setDados(res.data)
    } catch (err) {
      setDados(null)
      setErro(err instanceof Error ? err.message : 'Não foi possível carregar o recibo.')
    } finally {
      setCarregando(false)
    }
  }, [api, origemId, tipo])

  useEffect(() => {
    if (isOpen) void carregar()
    else setDados(null)
  }, [isOpen, carregar])

  const pedirNf = async () => {
    if (!origemId) return
    setEnviandoNf(true)
    try {
      await api.post('/api/recibos/pedido-nf', { tipo, id: origemId })
      toast.success('Pedido de nota fiscal registrado.')
      await carregar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível registrar o pedido de NF.')
    } finally {
      setEnviandoNf(false)
    }
  }

  const acao = async (fn: () => Promise<void>) => {
    try {
      await fn()
    } catch {
      toast.error('Não foi possível gerar o documento.')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="xl" className="w-[95vw] max-h-[92vh] overflow-y-auto rounded-[24px] bg-app-card dark:bg-app-card-dark p-0 border border-app-border dark:border-app-border-dark">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-app-border dark:border-app-border-dark">
          <div className="h-10 w-10 app-status-info rounded-xl flex items-center justify-center"><Receipt className="h-5 w-5" /></div>
          <div>
            <DialogTitle className="text-lg font-semibold text-app-text-primary dark:text-white">Recibo ou nota fiscal</DialogTitle>
            <DialogDescription className="text-sm text-app-text-secondary">Imprima o recibo, baixe em PDF ou registre o pedido de NF.</DialogDescription>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-4">
          {carregando && <p className="text-sm text-app-text-muted">Carregando recibo...</p>}
          {erro && <p className="text-sm text-[var(--app-danger-text)]" role="alert">{erro}</p>}
          {dados && (
            <div className="overflow-x-auto rounded-xl border border-app-border dark:border-app-border-dark">
              <div ref={folhaRef} className="min-w-[560px]"><ReciboDocumento dados={dados} /></div>
            </div>
          )}
        </div>

        {dados && (
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end px-6 py-4 border-t border-app-border dark:border-app-border-dark">
            {dados.nf.pedidoStatus ? (
              <span className="self-center text-sm text-app-text-secondary">
                {dados.nf.pedidoStatus === 'emitida' ? 'Nota fiscal emitida.' : 'Pedido de NF registrado — aguardando emissão.'}
              </span>
            ) : (
              <Button variant="outline" className="h-11 rounded-xl" onClick={() => void pedirNf()} disabled={enviandoNf}>
                {enviandoNf ? 'Registrando...' : dados.nf.precisa ? 'Registrar pedido de NF (cliente pediu NF)' : 'Registrar pedido de NF'}
              </Button>
            )}
            <Button variant="outline" className="h-11 rounded-xl gap-2" onClick={() => folhaRef.current && void acao(() => baixarReciboPdf(folhaRef.current as HTMLElement, dados.numero))}>
              <FileDown className="h-4 w-4" />Baixar PDF
            </Button>
            <Button className="h-11 rounded-xl gap-2 bg-app-primary hover:bg-app-primary-hover text-white" onClick={() => folhaRef.current && void acao(() => imprimirRecibo(folhaRef.current as HTMLElement))}>
              <Printer className="h-4 w-4" />Imprimir recibo
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
