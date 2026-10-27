'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ExternalLink, FileText, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatarDataHoraClinica } from '@/lib/fuso-clinica'

export interface PacienteExame {
  id: string
  nome: string
  tipo: string | null
  url: string
  uploadedPeloPaciente: boolean
  createdAt: string
}

interface ListResponse {
  data: PacienteExame[]
}

interface UploadResponse {
  data: { id: string; nome: string; tipo: string | null; url: string }
}

interface Props {
  pacienteId: string
  /** Quando true, o card só lista (sem botões de upload/excluir). Use no atendimento. */
  readOnly?: boolean
}

export function ExamesPacienteCard({ pacienteId, readOnly = false }: Props) {
  const [exames, setExames] = useState<PacienteExame[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/pacientes/exames?pacienteId=${encodeURIComponent(pacienteId)}`, {
        credentials: 'include',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'Falha ao carregar exames')
      }
      const json = (await res.json()) as ListResponse
      setExames(
        json.data.map((row) => ({
          id: row.id,
          nome: row.nome,
          tipo: row.tipo,
          url: row.url,
          uploadedPeloPaciente: row.uploadedPeloPaciente,
          createdAt: row.createdAt,
        })),
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar exames')
    } finally {
      setIsLoading(false)
    }
  }, [pacienteId])

  useEffect(() => {
    if (!pacienteId) return
    void load()
  }, [pacienteId, load])

  const handleUpload = async (file: File | null) => {
    if (!file || isUploading) return
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('pacienteId', pacienteId)
      formData.append('nome', file.name)
      const res = await fetch('/api/pacientes/exames/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'Falha no upload')
      }
      const json = (await res.json()) as UploadResponse
      toast.success(`Exame "${json.data.nome}" enviado.`)
      if (inputRef.current) inputRef.current.value = ''
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao enviar exame')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (exame: PacienteExame) => {
    if (readOnly) return
    if (!confirm(`Excluir o exame "${exame.nome}"?`)) return
    try {
      const res = await fetch('/api/pacientes/exames', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: exame.id }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'Falha ao excluir')
      }
      toast.success('Exame removido.')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao excluir')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-app-text-primary dark:text-white">
            Exames e documentos
          </h4>
          <p className="text-xs text-app-text-muted">
            PDF, JPG ou PNG até 10 MB. {readOnly ? 'Visualização durante o atendimento.' : ''}
          </p>
        </div>
        {!readOnly && (
          <div>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/jpg,image/png"
              className="hidden"
              onChange={(e) => void handleUpload(e.target.files?.[0] ?? null)}
            />
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
            >
              <Upload className="h-3.5 w-3.5 mr-2" />
              {isUploading ? 'Enviando...' : 'Upload exame'}
            </Button>
          </div>
        )}
      </div>

      {isLoading && (
        <p className="text-xs text-app-text-muted">Carregando exames...</p>
      )}
      {!isLoading && exames.length === 0 && (
        <div className="rounded-lg border border-dashed border-app-border dark:border-app-border-dark p-4 text-center text-xs text-app-text-muted">
          Nenhum exame anexado.
        </div>
      )}
      {!isLoading && exames.length > 0 && (
        <ul className="space-y-2">
          {exames.map((exame) => (
            <li
              key={exame.id}
              className="flex items-center gap-3 rounded-lg border border-app-border dark:border-app-border-dark p-3"
            >
              <div className="h-9 w-9 rounded-lg bg-app-bg-secondary dark:bg-app-hover flex items-center justify-center">
                <FileText className="h-4 w-4 text-app-text-secondary dark:text-white/70" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-app-text-primary dark:text-white truncate">{exame.nome}</p>
                <p className="text-xs text-app-text-muted">
                  {formatarDataHoraClinica(exame.createdAt)}
                  {exame.uploadedPeloPaciente && ' · enviado pelo paciente'}
                </p>
              </div>
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Abrir"
              >
                <a href={exame.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-[var(--app-danger-text)]"
                  title="Excluir"
                  onClick={() => void handleDelete(exame)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
