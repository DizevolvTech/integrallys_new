'use client'

import { useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { downloadBlob } from '@/features/documentacao-gerar/generate-pdf'
import { lerConfigEtiqueta, type EtiquetaDados } from '@/lib/etiqueta/etiqueta-config'
import { gerarEtiquetasPdf, imprimirEtiquetas } from '@/lib/etiqueta/gerar-etiqueta'

interface EtiquetaAcoesProps {
  itens: EtiquetaDados[]
  marca: string
}

/** Botões das duas telas de rótulo: PDF no tamanho da etiqueta (celular → app da impressora) e impressão do navegador. */
export function EtiquetaAcoes({ itens, marca }: EtiquetaAcoesProps) {
  const [gerando, setGerando] = useState(false)
  const plural = itens.length > 1

  const baixar = async () => {
    setGerando(true)
    try {
      const { blob, filename } = await gerarEtiquetasPdf(itens, marca, lerConfigEtiqueta())
      const arquivo = new File([blob], filename, { type: 'application/pdf' })
      const celular = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
      if (celular && navigator.canShare?.({ files: [arquivo] })) {
        try {
          await navigator.share({ files: [arquivo], title: 'Etiqueta' })
          return
        } catch (erro) {
          if ((erro as Error).name === 'AbortError') return
        }
      }
      downloadBlob(blob, filename)
    } catch {
      toast.error('Não foi possível gerar a etiqueta. Tente novamente.')
    } finally {
      setGerando(false)
    }
  }

  const imprimir = () => {
    if (!imprimirEtiquetas(itens, marca, lerConfigEtiqueta())) toast.error('O navegador não abriu a impressão. Use Baixar etiqueta (PDF).')
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button type="button" variant="outline" onClick={() => void baixar()} disabled={gerando || itens.length === 0} className="h-auto min-h-11 flex-1 whitespace-normal rounded-xl border-app-border font-normal dark:border-app-border-dark">
        <Download className="h-4 w-4 shrink-0" />
        {plural ? 'Baixar etiquetas (PDF)' : 'Baixar etiqueta (PDF)'}
      </Button>
      <Button type="button" onClick={imprimir} disabled={itens.length === 0} className="h-auto min-h-11 flex-1 whitespace-normal rounded-xl bg-app-primary font-normal text-white hover:bg-app-primary-hover">
        <Printer className="h-4 w-4 shrink-0" />
        Imprimir
      </Button>
    </div>
  )
}
