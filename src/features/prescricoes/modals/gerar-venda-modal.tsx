'use client'

import { useState } from 'react'
import { ShoppingCart, Package, CheckCircle2, Printer } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { LabelEditorModal, LabelData } from './label-editor-modal'

interface PrescriptionItem {
  product: string
  dosage?: string
  frequency?: string
  stockStatus?: 'available' | 'unavailable'
}

interface GerarVendaModalProps {
  isOpen: boolean
  onClose: () => void
  prescription?: {
    id: string
    number: string
    patientName: string
    specialistName?: string
    createdAt?: string
    type?: string
    status?: string
  } | null
  items?: PrescriptionItem[]
  onConfirm?: (id: string) => void
}

export function GerarVendaModal({ isOpen, onClose, prescription, items = [], onConfirm }: GerarVendaModalProps) {
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false)
  const [labelsList, setLabelsList] = useState<LabelData[]>([])
  const [isConverting, setIsConverting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  if (!prescription) return null

  const handleConfirmVenda = async () => {
    setIsConverting(true)
    await new Promise((resolve) => setTimeout(resolve, 800))
    setIsConverting(false)
    setIsSuccess(true)
    onConfirm?.(prescription.id)
  }

  const handlePrintAllLabels = () => {
    const labels: LabelData[] = items.map((item) => ({
      patientName: prescription.patientName,
      productName: item.product,
      composition: item.dosage,
      usage: item.frequency,
      validity: '',
    }))
    setLabelsList(labels)
    setIsLabelModalOpen(true)
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent size="xl" className="w-[95%] bg-app-card dark:bg-app-card-dark p-0 overflow-hidden border-none rounded-[24px]">
          {isSuccess ? (
            <div className="p-12 text-center space-y-6">
              <div className="mx-auto w-20 h-20 app-status-success rounded-full flex items-center justify-center"><CheckCircle2 size={48} /></div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-app-text-primary dark:text-white">Prescrição/Vendas gerada com sucesso!</h2>
                <p className="text-app-text-secondary dark:text-white/60 font-medium">A Prescrição/Vendas foi convertida e o layout final da tela foi preservado.</p>
              </div>
              <Button onClick={() => { setIsSuccess(false); onClose() }} className="h-12 px-8 rounded-xl font-bold bg-app-primary hover:bg-app-primary-hover text-white">Fechar</Button>
            </div>
          ) : (
            <div className="p-6 md:p-8 space-y-8">
              <div className="space-y-1 pr-8">
                <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-app-text-primary dark:text-white"><ShoppingCart className="h-6 w-6 text-[var(--app-primary)]" />Gerar Prescrição/Vendas</h2>
                <p className="text-app-text-secondary dark:text-white/60 text-sm font-medium">Registre a Prescrição/Vendas dos itens</p>
              </div>

              <div className="bg-app-bg-secondary/50 dark:bg-app-hover rounded-[20px] p-6 space-y-6 border border-app-border dark:border-app-border-dark">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-[var(--app-text-secondary)] dark:text-white/50 uppercase tracking-wider">Prescrição/Vendas</p>
                    <p className="text-xl font-bold text-app-text-primary dark:text-white">{prescription.number}</p>
                  </div>
                  <Badge className="app-status-success border-none font-bold px-3 py-1 rounded-lg">{prescription.status || 'Ativa'}</Badge>
                </div>
                <div className="h-px bg-app-border dark:bg-app-border-dark" />
                <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                  <div className="space-y-1"><p className="text-xs font-bold text-[var(--app-text-secondary)] dark:text-white/50 uppercase tracking-wider">Paciente</p><p className="font-bold text-app-text-primary dark:text-white">{prescription.patientName}</p></div>
                  <div className="space-y-1"><p className="text-xs font-bold text-[var(--app-text-secondary)] dark:text-white/50 uppercase tracking-wider">Especialista</p><p className="font-bold text-app-text-primary dark:text-white">{prescription.specialistName || '-'}</p></div>
                  <div className="space-y-1"><p className="text-xs font-bold text-[var(--app-text-secondary)] dark:text-white/50 uppercase tracking-wider">Data Criação</p><p className="font-bold text-app-text-primary dark:text-white">{prescription.createdAt || '-'}</p></div>
                  <div className="space-y-1"><p className="text-xs font-bold text-[var(--app-text-secondary)] dark:text-white/50 uppercase tracking-wider">Tipo</p><p className="font-bold text-app-text-primary dark:text-white">{prescription.type || '-'}</p></div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-md font-bold flex items-center gap-2 text-app-text-primary dark:text-white"><Package className="h-5 w-5 text-[var(--app-text-secondary)]" />Itens da Prescrição/Vendas</h3>
                <div className="border border-app-border dark:border-app-border-dark rounded-[16px] overflow-hidden">
                  <Table>
                    <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-hover">
                      <TableRow className="border-b border-app-border dark:border-app-border-dark">
                        <TableHead className="font-bold">Produto</TableHead>
                        <TableHead className="font-bold">Dosagem</TableHead>
                        <TableHead className="font-bold">Frequencia</TableHead>
                        <TableHead className="font-bold text-center">Estoque</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="font-medium">
                      {items.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="py-8 text-center text-app-text-secondary dark:text-white/60">Nenhum item retornado pela API.</TableCell></TableRow>
                      ) : items.map((item, idx) => (
                        <TableRow key={idx} className="border-b border-app-border/50 dark:border-app-border-dark/50">
                          <TableCell className="font-bold text-app-text-primary dark:text-white">{item.product}</TableCell>
                          <TableCell className="text-[var(--app-text-secondary)] dark:text-white/70 font-medium">{item.dosage || '-'}</TableCell>
                          <TableCell className="text-[var(--app-text-secondary)] dark:text-white/70 font-medium">{item.frequency || '-'}</TableCell>
                          <TableCell className="text-center"><Badge className="app-status-success border-none font-bold flex items-center gap-1.5 px-3 py-1 rounded-lg w-fit mx-auto"><CheckCircle2 size={14} />Disponivel</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-center pt-2">
                  <Button onClick={handlePrintAllLabels} variant="outline" className="h-10 px-4 border-[var(--app-primary)] text-[var(--app-primary)] hover:bg-app-primary/5 dark:border-[#4da885] dark:text-[#4da885] dark:hover:bg-[#4da885]/10 font-normal rounded-integrallys flex items-center gap-2 active:scale-95 transition-all text-sm"><Printer className="h-4 w-4" />Imprimir todos os rótulos ({items.length})</Button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={onClose} className="h-12 px-6 rounded-xl font-bold border-app-border dark:border-app-border-dark text-app-text-secondary dark:text-white/60" disabled={isConverting}>Cancelar</Button>
                <Button onClick={handleConfirmVenda} disabled={isConverting} className="h-12 px-8 rounded-xl font-bold bg-app-primary hover:bg-app-primary-hover text-white shadow-lg shadow-[var(--app-primary)]/10">{isConverting ? 'Processando...' : 'Confirmar Inclusão'}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <LabelEditorModal isOpen={isLabelModalOpen} onClose={() => setIsLabelModalOpen(false)} dataList={labelsList} />
    </>
  )
}
