'use client'

import { useEffect, useState } from 'react'
import { FileText, MessageCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DocumentoEmitidoAcoes } from './documento-emitido-acoes'
import { useApi } from '@/hooks/use-api'

interface DocumentoEmitido {
  id: string
  template_id: string
  paciente_id: string | null
  profissional_id: string | null
  gerado_em: string
  disponivel_no_portal: boolean
  pdf_url: string | null
  conteudo_preenchido?: { cabecalho?: { titulo?: string } }
}

interface Response {
  data: DocumentoEmitido[]
}

interface Props {
  agendamentoId: string
  pacienteTelefone?: string | null
}

function formatarDataHora(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function sanitizarTelefoneWhatsapp(telefone: string): string {
  return telefone.replace(/\D/g, '')
}

export function DocumentosEmitidosPanel({ agendamentoId, pacienteTelefone }: Props) {
  const api = useApi()
  const [documentos, setDocumentos] = useState<DocumentoEmitido[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setIsLoading(true)
      try {
        const res = await api.get<Response>(`/api/documentos/gerados/${agendamentoId}`)
        if (!mounted) return
        setDocumentos(res.data)
      } catch {
        if (!mounted) return
        setDocumentos([])
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [api, agendamentoId, refreshKey])

  const enviarWhatsapp = (doc: DocumentoEmitido) => {
    const telefone = pacienteTelefone ? sanitizarTelefoneWhatsapp(pacienteTelefone) : ''
    const titulo = doc.conteudo_preenchido?.cabecalho?.titulo ?? 'seu documento'
    const mensagem = doc.pdf_url
      ? `Olá! Segue o link do ${titulo}: ${doc.pdf_url}`
      : `Olá! Seu documento (${titulo}) está disponível no portal do paciente.`
    const url = telefone
      ? `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`
      : `https://wa.me/?text=${encodeURIComponent(mensagem)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="rounded-2xl border border-app-border dark:border-app-border-dark p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-app-text-secondary dark:text-white/70" />
          <h4 className="text-sm font-medium dark:text-white">Documentos emitidos neste atendimento</h4>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 sm:h-8 sm:w-8"
          onClick={() => setRefreshKey((k) => k + 1)}
          title="Atualizar"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-app-text-muted">Carregando...</p>
      ) : documentos.length === 0 ? (
        <p className="text-xs text-app-text-muted">
          Nenhum documento emitido. Use o botão &quot;Usar modelo da clínica&quot; para gerar.
        </p>
      ) : (
        <ul className="divide-y divide-app-border dark:divide-app-border-dark">
          {documentos.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 py-3">
              <div className="h-9 w-9 rounded-lg bg-app-bg-secondary dark:bg-app-hover flex items-center justify-center">
                <FileText className="h-4 w-4 text-app-text-secondary dark:text-white/70" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium dark:text-white truncate">
                  {doc.conteudo_preenchido?.cabecalho?.titulo ?? 'Documento'}
                </div>
                <div className="text-xs text-app-text-muted">
                  {formatarDataHora(doc.gerado_em)}
                  {doc.disponivel_no_portal && ' · no portal do paciente'}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <DocumentoEmitidoAcoes documentoId={doc.id} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 sm:h-8 sm:w-8"
                  title="Enviar por WhatsApp"
                  aria-label="Enviar por WhatsApp"
                  onClick={() => enviarWhatsapp(doc)}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
