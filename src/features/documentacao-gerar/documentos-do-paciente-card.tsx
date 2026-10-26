'use client'

import { useEffect, useState } from 'react'
import { Download, ExternalLink, FileText, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApi } from '@/hooks/use-api'
import { isForbiddenError } from '@/lib/api-client'

interface DocumentoEmitido {
  id: string
  template_id: string
  template_nome: string
  template_tipo: string
  gerado_em: string
  disponivel_no_portal: boolean
  pdf_url: string | null
}

interface Response {
  data: DocumentoEmitido[]
}

interface Props {
  pacienteId: string | null | undefined
  pacienteTelefone?: string | null
  /**
   * Quantidade máxima de documentos a exibir. Se ultrapassar, mostra link
   * "Ver todos" que leva para /documentacao (aba Emitidos).
   */
  limit?: number
  /**
   * Título exibido no topo do card. Default: "Documentos emitidos".
   */
  titulo?: string
  /**
   * Quando true, oculta o card se não houver documentos. Útil em telas
   * onde o espaço é escasso.
   */
  ocultarSeVazio?: boolean
  className?: string
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

export function DocumentosDoPacienteCard({
  pacienteId,
  pacienteTelefone,
  limit = 10,
  titulo = 'Documentos emitidos',
  ocultarSeVazio = false,
  className,
}: Props) {
  const api = useApi()
  const [documentos, setDocumentos] = useState<DocumentoEmitido[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Perfil sem acesso a documentos (ex.: recepção): o card some em vez de mostrar "Acesso negado".
  const [semAcesso, setSemAcesso] = useState(false)

  useEffect(() => {
    if (!pacienteId) {
      setIsLoading(false)
      setDocumentos([])
      return
    }
    let mounted = true
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await api.get<Response>(
          `/api/documentos/emitidos?paciente_id=${encodeURIComponent(pacienteId)}&limit=${limit}`,
        )
        if (!mounted) return
        setDocumentos(res.data ?? [])
      } catch (err) {
        if (!mounted) return
        if (isForbiddenError(err)) {
          setSemAcesso(true)
          return
        }
        setError(err instanceof Error ? err.message : 'Falha ao carregar documentos')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [api, pacienteId, limit])

  const enviarWhatsapp = (doc: DocumentoEmitido) => {
    const telefoneLimpo = pacienteTelefone ? pacienteTelefone.replace(/\D/g, '') : ''
    const mensagem = doc.pdf_url
      ? `Olá! Segue o link do documento "${doc.template_nome}": ${doc.pdf_url}`
      : `Olá! Seu documento "${doc.template_nome}" está disponível no portal do paciente.`
    const url = telefoneLimpo
      ? `https://wa.me/${telefoneLimpo}?text=${encodeURIComponent(mensagem)}`
      : `https://wa.me/?text=${encodeURIComponent(mensagem)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (semAcesso) return null

  if (ocultarSeVazio && !isLoading && documentos.length === 0 && !error) {
    return null
  }

  return (
    <div
      className={`rounded-2xl border border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark ${className ?? ''}`}
    >
      <div className="flex items-center justify-between p-4 border-b border-app-border dark:border-app-border-dark">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-app-text-secondary dark:text-white/70" />
          <h4 className="text-sm font-medium dark:text-white">{titulo}</h4>
          {documentos.length > 0 && (
            <span className="text-xs text-app-text-muted">({documentos.length})</span>
          )}
        </div>
        <a
          href="/documentacao"
          className="text-xs text-app-primary hover:underline"
        >
          Ver todos →
        </a>
      </div>

      <div className="p-4">
        {error && <p className="text-sm text-[var(--app-danger-text)]">{error}</p>}

        {isLoading ? (
          <p className="text-xs text-app-text-muted">Carregando...</p>
        ) : documentos.length === 0 ? (
          <p className="text-xs text-app-text-muted">
            Este paciente ainda não possui documentos emitidos.
          </p>
        ) : (
          <ul className="divide-y divide-app-border dark:divide-app-border-dark -my-2">
            {documentos.map((doc) => (
              <li key={doc.id} className="flex items-center gap-3 py-3">
                <div className="h-9 w-9 rounded-lg bg-app-bg-secondary dark:bg-app-hover flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-app-text-secondary dark:text-white/70" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium dark:text-white truncate">
                    {doc.template_nome}
                  </div>
                  <div className="text-xs text-app-text-muted">
                    {formatarDataHora(doc.gerado_em)}
                    {doc.disponivel_no_portal && ' · no portal do paciente'}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {doc.pdf_url && (
                    <>
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Baixar PDF"
                      >
                        <a href={doc.pdf_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Abrir em nova aba"
                      >
                        <a href={doc.pdf_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Enviar WhatsApp"
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
    </div>
  )
}
