'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Download, Loader2, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApi } from '@/hooks/use-api'
import { nomeArquivoDocumento, type TemplateConteudo } from '@/lib/documentos'
import { DocumentPreview } from './document-preview'
import { downloadBlob, gerarPdfDoElemento, imprimirElemento } from './generate-pdf'
import type { PreenchimentoContexto, ValoresForm } from './types'

interface DocumentoPronto {
  titulo: string
  pacienteNome: string
  geradoEm: string
  conteudo: TemplateConteudo
  valores: ValoresForm
  contexto: PreenchimentoContexto
  assinaturaUrl: string | null
}

type Acao = 'pdf' | 'imprimir'

async function aguardarImagens(raiz: HTMLElement) {
  const pendentes = Array.from(raiz.querySelectorAll('img')).filter((img) => !img.complete)
  await Promise.all(pendentes.map((img) => new Promise((ok) => { img.onload = img.onerror = ok })))
}

/** Botões Baixar PDF e Imprimir de um documento emitido: busca o conteúdo, desenha o documento fora da tela e gera. */
export function DocumentoEmitidoAcoes({ documentoId }: { documentoId: string }) {
  const api = useApi()
  const ref = useRef<HTMLDivElement | null>(null)
  const [acao, setAcao] = useState<Acao | null>(null)
  const [pronto, setPronto] = useState<DocumentoPronto | null>(null)

  const iniciar = async (nova: Acao) => {
    if (acao) return
    setAcao(nova)
    try {
      const res = await api.get<{ data: DocumentoPronto }>(`/api/documentos/emitidos/${documentoId}`)
      setPronto(res.data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível abrir o documento')
      setAcao(null)
    }
  }

  useEffect(() => {
    if (!pronto || !acao || !ref.current) return
    const alvo = ref.current
    let ativo = true
    const gerar = async () => {
      try {
        await aguardarImagens(alvo)
        if (!ativo) return
        if (acao === 'imprimir') {
          if (!imprimirElemento(alvo)) toast.error('Não foi possível abrir a impressão')
        } else {
          const nome = nomeArquivoDocumento(pronto.titulo, pronto.pacienteNome, pronto.geradoEm)
          const { blob, filename } = await gerarPdfDoElemento(alvo, nome)
          downloadBlob(blob, filename)
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Falha ao gerar o PDF')
      } finally {
        if (ativo) {
          setPronto(null)
          setAcao(null)
        }
      }
    }
    void gerar()
    return () => {
      ativo = false
    }
  }, [pronto, acao])

  const botao = 'h-11 w-11 sm:h-8 sm:w-8'
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={botao}
        title="Baixar PDF"
        aria-label="Baixar PDF"
        disabled={acao !== null}
        onClick={() => void iniciar('pdf')}
      >
        {acao === 'pdf' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={botao}
        title="Imprimir"
        aria-label="Imprimir"
        disabled={acao !== null}
        onClick={() => void iniciar('imprimir')}
      >
        {acao === 'imprimir' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
      </Button>
      {pronto && (
        <div aria-hidden className="pointer-events-none fixed top-0" style={{ left: -10000 }}>
          <DocumentPreview
            ref={ref}
            template={{ conteudo: pronto.conteudo }}
            valores={pronto.valores}
            contexto={pronto.contexto}
            assinaturaUrl={pronto.assinaturaUrl}
          />
        </div>
      )}
    </>
  )
}
