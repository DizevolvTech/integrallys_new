'use client'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { EtiquetaAcoes } from '@/components/shared/etiqueta-acoes'
import { useClinicaConfig } from '@/features/configuracoes/hooks/use-clinica-config'

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
  const { data: clinicaConfig } = useClinicaConfig()
  const nomeClinica = clinicaConfig?.nome ?? 'Clínica'

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="lg" className="rounded-[24px] border-none p-0">
        <div className="space-y-6 bg-app-card p-6 dark:bg-app-card-dark sm:p-8">
          <div>
            <h2 className="text-2xl font-bold text-app-text-primary dark:text-white">Editor de rótulos</h2>
            <p className="text-app-text-secondary dark:text-white/60">
              Uma etiqueta por item, no tamanho da impressora (Configurações &gt; Hardware). No celular, use Baixar etiqueta e abra no aplicativo da impressora.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-app-border p-10 text-center text-app-text-secondary dark:border-app-border-dark dark:text-white/60 md:col-span-2">
                Nenhum rótulo disponível.
              </div>
            ) : (
              items.map((item, index) => (
                <div key={`${item.patientName}-${item.productName}-${index}`} className="rounded-2xl border border-app-border p-5 dark:border-app-border-dark">
                  <p className="text-xs uppercase tracking-wide text-app-text-muted">Paciente</p>
                  <p className="text-lg text-app-text-primary dark:text-white">{item.patientName}</p>
                  <p className="mt-4 text-xs uppercase tracking-wide text-app-text-muted">Produto</p>
                  <p className="text-base text-app-text-primary dark:text-white">{item.productName}</p>
                  <p className="mt-4 text-xs uppercase tracking-wide text-app-text-muted">Modo de uso</p>
                  <p className="whitespace-pre-line text-sm text-app-text-secondary dark:text-white/70">{item.usage || 'Conforme orientação médica'}</p>
                </div>
              ))
            )}
          </div>
          <div className="space-y-3">
            <EtiquetaAcoes
              marca={nomeClinica}
              itens={items.map((i) => ({ paciente: i.patientName, produto: i.productName, modoDeUso: i.usage || 'Conforme orientação médica' }))}
            />
            <Button variant="ghost" onClick={onClose} className="h-auto min-h-11 w-full whitespace-normal font-normal">
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
