'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useClinicaConfig } from '@/features/configuracoes/hooks/use-clinica-config'

export interface LabelData {
  patientName: string
  productName: string
  composition: string
  usage: string
  validity: string
  batch?: string
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
  const inicialClinica = (nomeClinica.trim().charAt(0) || 'C').toUpperCase()
  const dominioClinica =
    nomeClinica
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, '') || 'clinica'
  const logoUrlClinica = clinicaConfig?.logo_url ?? ''
  const [currentData, setCurrentData] = useState<LabelData>({
    patientName: '', productName: '', composition: '', usage: '', validity: '', batch: '',
  })
  const [currentIndex, setCurrentIndex] = useState(0)
  const [mode, setMode] = useState<'single' | 'batch'>('single')
  const [localList, setLocalList] = useState<LabelData[]>([])

  useEffect(() => {
    if (dataList && dataList.length > 0) {
      setMode('batch')
      const withBatches = dataList.map((item) => ({
        ...item,
        batch: item.batch ?? Math.floor(10000 + Math.random() * 90000).toString(),
      }))
      setLocalList(withBatches)
      setCurrentData(withBatches[0])
      setCurrentIndex(0)
    } else if (data) {
      setMode('single')
      const withBatch = { ...data, batch: data.batch ?? Math.floor(10000 + Math.random() * 90000).toString() }
      setCurrentData(withBatch)
      setLocalList([withBatch])
    }
  }, [data, dataList, isOpen])

  const handleNext = () => {
    if (currentIndex < localList.length - 1) {
      const nextIndex = currentIndex + 1
      setCurrentIndex(nextIndex)
      setCurrentData(localList[nextIndex])
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1
      setCurrentIndex(prevIndex)
      setCurrentData(localList[prevIndex])
    }
  }

  const handleUpdateField = (field: keyof LabelData, value: string) => {
    const updated = { ...currentData, [field]: value }
    setCurrentData(updated)
    const newList = [...localList]
    newList[currentIndex] = updated
    setLocalList(newList)
  }

  const handlePrint = () => {
    const itemsToPrint = mode === 'batch' ? localList : [currentData]

    const marginTop = '0'
    const marginLeft = '0'

    const escapeHtml = (value: string) =>
      value.replace(/[&<>"']/g, (ch) => {
        switch (ch) {
          case '&': return '&amp;'
          case '<': return '&lt;'
          case '>': return '&gt;'
          case '"': return '&quot;'
          default: return '&#39;'
        }
      })

    const safeNomeClinica = escapeHtml(nomeClinica)
    const safeInicial = escapeHtml(inicialClinica)
    const safeDominio = escapeHtml(`${dominioClinica}.com`)
    const safeLogoUrl = logoUrlClinica ? escapeHtml(logoUrlClinica) : ''
    const brandHtml = safeLogoUrl
      ? `<img src="${safeLogoUrl}" alt="${safeNomeClinica}" style="height: 6mm; width: auto; margin-right: 2.5mm; object-fit: contain;" />`
      : `<div style="background-color: #3b82f6; color: white; width: 6mm; height: 6mm; display: flex; align-items: center; justify-content: center; border-radius: 1mm; font-weight: bold; font-size: 9pt; margin-right: 2.5mm;">${safeInicial}</div>`

    const printContentHTML = itemsToPrint
      .map(
        (item) => `
      <div class="label-container" style="page-break-after: always; padding: 4mm; padding-top: calc(3mm + ${marginTop}mm); padding-left: calc(4mm + ${marginLeft}mm); width: 60mm; height: 40mm; display: flex; flex-direction: column; box-sizing: border-box; font-family: 'Inter', -apple-system, sans-serif; overflow: hidden; background: white; color: black;">
        <div style="display: flex; align-items: center; margin-bottom: 4mm; border-bottom: 1px solid #3b82f6; padding-bottom: 2mm; width: 100%;">
          ${brandHtml}
          <span style="font-weight: bold; font-size: 11pt; color: #111;">${safeNomeClinica}</span>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; margin-bottom: 2mm;">
          <p style="font-size: 8pt; font-weight: bold; margin: 0 0 1.5mm 0; color: #3b82f6; text-transform: lowercase; letter-spacing: 0.5px;">modo de uso</p>
          <p style="font-size: ${item.usage.split('\n').length > 4 ? '8.5pt' : '10.5pt'}; margin: 0; line-height: 1.4; color: #111; white-space: pre-line; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 7; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(item.usage)}</p>
        </div>
        <div style="margin-top: auto; border-top: 0.2mm solid #f2f4f7; padding-top: 1.5mm; display: flex; justify-content: center;">
          <p style="font-size: 6pt; margin: 0; color: #9ca3af; letter-spacing: 1px;">${safeDominio}</p>
        </div>
      </div>
    `,
      )
      .join('')

    const iframe = document.createElement('iframe')
    iframe.style.position = 'absolute'
    iframe.style.top = '-9999px'
    iframe.style.width = '0'
    iframe.style.height = '0'
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (doc) {
      doc.open()
      doc.write(`
        <html><head><title>Etiqueta</title>
        <style>
          @page { size: 60mm 40mm; margin: 0; }
          @media print {
            html, body { width: 60mm; height: 40mm; margin: 0; padding: 0; }
            .label-container { width: 60mm; height: 40mm; page-break-after: always; overflow: hidden; }
          }
          body { margin: 0; padding: 0; font-family: 'Inter', -apple-system, sans-serif; background: white; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
        </style></head>
        <body>${printContentHTML}</body></html>
      `)
      doc.close()
      iframe.contentWindow?.focus()
      setTimeout(() => {
        iframe.contentWindow?.print()
        document.body.removeChild(iframe)
      }, 500)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full bg-app-card dark:bg-app-bg-dark border-app-border dark:border-app-border-dark text-app-text-primary dark:text-white rounded-[24px] p-0 overflow-hidden shadow-xl">
        <div className="w-full p-6 space-y-5">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-normal text-app-text-primary dark:text-white">
                  Editor de rótulos {mode === 'batch' && `(${currentIndex + 1}/${localList.length})`}
                </DialogTitle>
                <p className="text-sm text-app-text-secondary dark:text-white/60 font-normal mt-1">
                  Dados da etiqueta (60x40mm)
                </p>
              </div>
              {mode === 'batch' && (
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    className="h-8 w-8 border-app-border dark:border-app-border-dark"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleNext}
                    disabled={currentIndex === localList.length - 1}
                    className="h-8 w-8 border-app-border dark:border-app-border-dark"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-app-text-primary dark:text-white/70 font-bold text-sm uppercase tracking-wider">
                Modo de uso (Texto do Rótulo)
              </Label>
              <Textarea
                value={currentData.usage}
                onChange={(e) => handleUpdateField('usage', e.target.value)}
                className="bg-white dark:bg-app-card-dark border-app-border dark:border-app-border-dark text-app-text-primary dark:text-white rounded-2xl min-h-[160px] font-normal resize-none p-5 text-base leading-relaxed shadow-sm"
                placeholder="Descreva aqui o modo de uso que aparecerá no rótulo..."
              />
              <p className="text-xs text-app-text-secondary dark:text-white/60 italic">
                Nota: Apenas o texto acima e a marca {nomeClinica} serão incluídos na impressão final.
              </p>
            </div>

            <div className="pt-4 flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 h-11 border-app-border dark:border-app-border-dark font-normal rounded-xl"
              >
                cancelar
              </Button>
              <Button
                onClick={handlePrint}
                className="flex-1 h-11 bg-app-primary hover:bg-app-primary-hover text-white font-normal rounded-xl flex items-center justify-center gap-2"
              >
                <Printer className="h-4 w-4 shrink-0" />
                {mode === 'batch' ? 'imprimir todos' : 'imprimir rótulo'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
