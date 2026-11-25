'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EtiquetaAcoes } from '@/components/shared/etiqueta-acoes'
import { useClinicaConfig } from '@/features/configuracoes/hooks/use-clinica-config'

export interface LabelData {
  patientName: string
  productName: string
  composition: string
  usage: string
  validity: string
}

interface LabelEditorModalProps {
  isOpen: boolean
  onClose: () => void
  data?: LabelData
  dataList?: LabelData[]
}

export function LabelEditorModal({ isOpen, onClose, data, dataList }: LabelEditorModalProps) {
  const { data: clinicaConfig } = useClinicaConfig()
  const nomeClinica = clinicaConfig?.nome ?? 'Clínica'
  const [lista, setLista] = useState<LabelData[]>([])
  const [indice, setIndice] = useState(0)
  const emLote = lista.length > 1

  useEffect(() => {
    setLista(dataList && dataList.length > 0 ? dataList : data ? [data] : [])
    setIndice(0)
  }, [data, dataList, isOpen])

  const atual = lista[indice]
  const editarUso = (usage: string) => setLista((l) => l.map((item, i) => (i === indice ? { ...item, usage } : item)))

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full rounded-[24px] border-app-border bg-app-card p-0 text-app-text-primary shadow-xl dark:border-app-border-dark dark:bg-app-bg-dark dark:text-white">
        <div className="w-full space-y-5 p-6">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <div>
                <DialogTitle className="text-xl font-normal">
                  Editor de rótulos {emLote && `(${indice + 1}/${lista.length})`}
                </DialogTitle>
                <p className="mt-1 text-sm font-normal text-app-text-secondary dark:text-white/60">Etiqueta com paciente, produto e modo de uso</p>
              </div>
              {emLote && (
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" aria-label="Etiqueta anterior" onClick={() => setIndice((i) => i - 1)} disabled={indice === 0} className="h-8 w-8">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" aria-label="Próxima etiqueta" onClick={() => setIndice((i) => i + 1)} disabled={indice === lista.length - 1} className="h-8 w-8">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          {atual && (
            <div className="space-y-2">
              <p className="text-sm text-app-text-secondary dark:text-white/60">
                <span className="font-medium">{atual.patientName}</span> · {atual.productName}
              </p>
              <Label className="text-sm font-bold uppercase tracking-wider">Modo de uso (texto do rótulo)</Label>
              <Textarea
                value={atual.usage}
                onChange={(e) => editarUso(e.target.value)}
                className="min-h-[140px] resize-none rounded-2xl p-5 text-base font-normal leading-relaxed"
                placeholder="Descreva aqui o modo de uso que aparecerá no rótulo..."
              />
              <p className="text-xs italic text-app-text-secondary dark:text-white/60">
                A etiqueta sai no tamanho da impressora de Configurações &gt; Hardware (padrão 60x40 mm), uma por página, com a marca {nomeClinica}. No celular, use Baixar etiqueta e abra no aplicativo da impressora.
              </p>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <EtiquetaAcoes
              marca={nomeClinica}
              itens={lista.map((l) => ({ paciente: l.patientName, produto: l.productName, modoDeUso: l.usage }))}
            />
            <Button variant="ghost" onClick={onClose} className="h-auto min-h-11 w-full whitespace-normal font-normal">
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
