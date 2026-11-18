'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Download, Loader2, Printer } from 'lucide-react'
import type { TemplateConteudo } from '@/lib/documentos'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { DocumentPreview } from './document-preview'
import { downloadBlob, gerarPdfDoElemento, imprimirElemento } from './generate-pdf'
import type { PreenchimentoContexto, ValoresForm } from './types'

const A4_LARGURA_PX = 794

interface Props {
  open: boolean
  onClose: () => void
  titulo: string
  pacienteNome: string
  conteudo: TemplateConteudo | null
  valores: ValoresForm
  contexto: PreenchimentoContexto
  assinaturaUrl?: string | null
}

/** Pré-visualização do documento do atendimento, com o mesmo renderizador do cadastro de modelos, PDF e impressão. */
export function DocumentoAtendimentoPreviewModal({
  open,
  onClose,
  titulo,
  pacienteNome,
  conteudo,
  valores,
  contexto,
  assinaturaUrl,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [gerando, setGerando] = useState(false)
  const [areaEl, setAreaEl] = useState<HTMLDivElement | null>(null)
  const [zoom, setZoom] = useState(1)

  // A folha A4 tem largura fixa (210mm); no celular a tela mostra ela reduzida para caber, sem cortar.
  useEffect(() => {
    if (!areaEl) return
    const ajustar = () => setZoom(Math.min(1, (areaEl.clientWidth - 24) / A4_LARGURA_PX))
    ajustar()
    const obs = new ResizeObserver(ajustar)
    obs.observe(areaEl)
    return () => obs.disconnect()
  }, [areaEl])

  const baixarPdf = async () => {
    if (!ref.current || gerando) return
    setGerando(true)
    try {
      const nome = `${pacienteNome}-${titulo}`.normalize('NFD').replace(/[^\w]+/g, '-').toLowerCase()
      const { blob, filename } = await gerarPdfDoElemento(ref.current, `${nome}.pdf`)
      downloadBlob(blob, filename)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao gerar o PDF')
    } finally {
      setGerando(false)
    }
  }

  const imprimir = () => {
    if (ref.current && !imprimirElemento(ref.current)) toast.error('Habilite pop-ups para imprimir')
  }

  return (
    <Dialog open={open} onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent size="xl" className="flex flex-col p-0 border-none bg-app-bg dark:bg-app-card-dark">
        <div className="bg-app-card dark:bg-app-card-dark border-b border-app-border dark:border-app-border-dark p-4 flex items-center justify-between">
          <DialogTitle className="text-lg font-normal text-app-text-primary dark:text-white">PRÉ-VISUALIZAÇÃO</DialogTitle>
          <DialogDescription className="sr-only">{titulo}</DialogDescription>
        </div>
        <div ref={setAreaEl} className="flex-1 overflow-auto bg-app-bg-secondary dark:bg-app-hover/20 p-3 sm:p-6">
          {conteudo && (
            <>
              {/* Cópia visível (reduzida no celular) e cópia em tamanho real, fora da tela, usada no PDF e na impressão. */}
              <div className="mx-auto w-fit" style={{ zoom }}>
                <DocumentPreview template={{ conteudo }} valores={valores} contexto={contexto} assinaturaUrl={assinaturaUrl} />
              </div>
              <div aria-hidden className="pointer-events-none fixed top-0" style={{ left: -10000 }}>
                <DocumentPreview
                  ref={ref}
                  template={{ conteudo }}
                  valores={valores}
                  contexto={contexto}
                  assinaturaUrl={assinaturaUrl}
                />
              </div>
            </>
          )}
        </div>
        <div className="bg-app-card dark:bg-app-card-dark border-t border-app-border dark:border-app-border-dark p-4 flex flex-wrap items-center justify-center gap-3">
          <Button variant="outline" onClick={() => void baixarPdf()} disabled={gerando} className="h-11 px-6 rounded-full font-normal">
            {gerando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Baixar PDF
          </Button>
          <Button onClick={imprimir} className="h-11 px-8 rounded-full bg-app-primary hover:bg-app-primary-hover text-white font-normal">
            <Printer className="h-4 w-4 mr-2" /> Imprimir Documento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
