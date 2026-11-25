'use client'

import { FileText, UploadCloud, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const TIPOS = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_BYTES = 10 * 1024 * 1024

interface DocumentoDropzoneProps {
  arquivo: File | null
  onChange: (arquivo: File | null) => void
  disabled?: boolean
}

function tamanho(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** Área de envio: clique abre o seletor, arrastar e soltar também; aceita PDF/JPG/PNG até 10 MB. */
export function DocumentoDropzone({ arquivo, onChange, disabled }: DocumentoDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [arrastando, setArrastando] = useState(false)

  const escolher = (file: File | null | undefined) => {
    if (!file) return
    if (!TIPOS.includes(file.type)) {
      toast.error('Envie um arquivo PDF, JPG ou PNG.')
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error('Arquivo acima de 10 MB.')
      return
    }
    onChange(file)
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setArrastando(true)
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault()
          setArrastando(false)
          escolher(e.dataTransfer.files?.[0])
        }}
        className={cn(
          'flex w-full flex-col items-center justify-center rounded-[16px] border-2 border-dashed border-app-border bg-app-bg-secondary/50 p-6 text-center transition-colors hover:bg-app-bg-secondary dark:border-app-border-dark dark:bg-app-surface-muted dark:hover:bg-app-hover',
          arrastando && 'border-[var(--app-primary)] bg-app-bg-secondary',
        )}
      >
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-app-bg-secondary dark:bg-app-hover">
          <UploadCloud className="h-6 w-6 text-app-primary dark:text-white" />
        </span>
        <span className="mb-1 text-sm font-normal text-app-text-primary dark:text-white">
          Clique para fazer upload ou arraste e solte
        </span>
        <span className="text-xs text-app-text-muted">PDF, JPG, PNG (máx. 10MB)</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        className="hidden"
        aria-label="Arquivo do documento"
        onChange={(e) => {
          escolher(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {arquivo && (
        <div className="flex items-center gap-3 rounded-[12px] border border-app-border bg-app-card px-3 py-2 dark:border-app-border-dark dark:bg-app-card-dark">
          <FileText className="h-4 w-4 shrink-0 text-app-primary" />
          <span className="min-w-0 flex-1 break-words text-sm text-app-text-primary dark:text-white">
            {arquivo.name}
          </span>
          <span className="shrink-0 text-xs text-app-text-muted">{tamanho(arquivo.size)}</span>
          <button
            type="button"
            aria-label="Remover arquivo"
            onClick={() => onChange(null)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-app-bg-secondary dark:hover:bg-app-hover"
          >
            <X className="h-4 w-4 text-app-text-muted" />
          </button>
        </div>
      )}
    </div>
  )
}
