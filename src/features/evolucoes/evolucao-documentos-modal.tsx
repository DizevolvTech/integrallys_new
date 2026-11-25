'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, FileText, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useApi } from '@/hooks/use-api'
import { formatarDataHoraClinica } from '@/lib/fuso-clinica'

interface DocumentoEvolucao {
  id: string
  nome: string
  tipo: string | null
  meio: string | null
  dataEnvio: string | null
  recebido: boolean
  observacoes: string | null
  criadoEm: string
  url: string | null
  disponivel: boolean
}

interface Props {
  isOpen: boolean
  onClose: () => void
  evolucaoId: string
  titulo: string
  onAdicionar: () => void
  /** Muda quando um documento é salvo, para recarregar a lista. */
  versao: number
}

function dataBr(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split('-')
  return a && m && d ? `${d}/${m}/${a}` : iso
}

/** Lista dos documentos da evolução (nome, data, abrir/baixar); registro antigo sem arquivo aparece como indisponível. */
export function EvolucaoDocumentosModal({
  isOpen,
  onClose,
  evolucaoId,
  titulo,
  onAdicionar,
  versao,
}: Props) {
  const api = useApi()
  const [docs, setDocs] = useState<DocumentoEvolucao[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !evolucaoId) return
    let ativo = true
    setDocs(null)
    setErro(null)
    api
      .get<{ data: DocumentoEvolucao[] }>(`/api/evolucoes/${evolucaoId}/documentos`)
      .then((r) => ativo && setDocs(r.data))
      .catch(
        (e) =>
          ativo &&
          setErro(e instanceof Error ? e.message : 'Não foi possível carregar os documentos.'),
      )
    return () => {
      ativo = false
    }
  }, [api, isOpen, evolucaoId, versao])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="block max-h-[90vh] w-[95vw] overflow-y-auto rounded-[24px] border border-app-border bg-app-card p-6 shadow-lg custom-scrollbar dark:border-app-border-dark dark:bg-app-card-dark sm:max-w-[600px] md:p-8">
        <div className="mb-5 space-y-1">
          <DialogTitle className="flex items-center gap-2 text-xl font-normal text-app-text-primary dark:text-white">
            <FileText className="h-5 w-5" /> Documentos da evolução ({docs?.length ?? '…'})
          </DialogTitle>
          <p className="text-sm text-app-text-muted">{titulo}</p>
        </div>

        {erro && <p className="text-sm text-[var(--app-danger-text)]">{erro}</p>}
        {!erro && docs === null && (
          <p className="text-sm text-app-text-muted">Carregando documentos…</p>
        )}
        {docs?.length === 0 && (
          <p className="rounded-integrallys-lg border border-dashed border-app-border p-4 text-center text-sm text-app-text-muted dark:border-app-border-dark">
            Nenhum documento nesta evolução.
          </p>
        )}
        <ul className="space-y-3">
          {docs?.map((d) => (
            <li
              key={d.id}
              className="flex flex-col gap-3 rounded-[12px] border border-app-border p-4 dark:border-app-border-dark sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="break-words text-sm text-app-text-primary dark:text-white">
                  {d.nome}
                </p>
                <p className="text-xs text-app-text-muted">
                  {[d.tipo, d.dataEnvio ? dataBr(d.dataEnvio) : formatarDataHoraClinica(d.criadoEm)]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {d.observacoes && (
                  <p className="break-words text-xs text-app-text-muted">{d.observacoes}</p>
                )}
              </div>
              {d.disponivel && d.url ? (
                <Button
                  asChild
                  variant="outline"
                  className="h-auto min-h-11 whitespace-normal rounded-integrallys px-4 font-normal"
                >
                  <a href={d.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" /> Abrir
                  </a>
                </Button>
              ) : (
                <span className="text-xs italic text-app-text-muted">Arquivo não disponível</span>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-app-border pt-4 dark:border-app-border-dark sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-auto min-h-11 whitespace-normal rounded-integrallys px-6 font-normal"
          >
            Fechar
          </Button>
          <Button
            onClick={onAdicionar}
            className="h-auto min-h-11 gap-2 whitespace-normal rounded-integrallys bg-app-primary px-6 font-normal text-white hover:bg-app-primary-hover"
          >
            <Plus className="h-4 w-4" /> Adicionar documento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
