'use client'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export interface LabelData {
  patientName: string
  productName: string
  composition?: string
  usage?: string
  validity?: string
}

interface LabelEditorModalProps {
  isOpen: boolean
  onClose: () => void
  data?: LabelData
  dataList?: LabelData[]
}

export function LabelEditorModal({ isOpen, onClose, data, dataList = [] }: LabelEditorModalProps) {
  const items = data ? [data] : dataList

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="lg" className="rounded-[24px] border-none p-0 overflow-hidden">
        <div className="bg-app-card dark:bg-app-card-dark p-8 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-app-text-primary dark:text-white">Editor de rótulos</h2>
            <p className="text-app-text-secondary dark:text-white/60">Revise a composição visual das etiquetas antes de imprimir.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-app-border p-10 text-center text-app-text-secondary dark:border-app-border-dark dark:text-white/60 md:col-span-2">
                Nenhum rotulo disponivel.
              </div>
            ) : (
              items.map((item, index) => (
                <div key={`${item.patientName}-${item.productName}-${index}`} className="rounded-2xl border border-app-border p-5 dark:border-app-border-dark">
                  <p className="text-xs uppercase tracking-wide text-app-text-muted">Paciente</p>
                  <p className="text-lg text-app-text-primary dark:text-white">{item.patientName}</p>
                  <p className="mt-4 text-xs uppercase tracking-wide text-app-text-muted">Produto</p>
                  <p className="text-base text-app-text-primary dark:text-white">{item.productName}</p>
                  <p className="mt-4 text-sm text-app-text-secondary dark:text-white/70">{item.composition || 'Composição não informada'}</p>
                  <p className="text-sm text-app-text-secondary dark:text-white/70">{item.usage || 'Modo de uso não informado'}</p>
                </div>
              ))
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose} className="bg-app-primary hover:bg-app-primary-hover text-white">Fechar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
