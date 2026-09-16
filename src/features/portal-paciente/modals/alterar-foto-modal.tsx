'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/hooks/use-auth'

interface AlterarFotoModalProps {
  isOpen: boolean
  onClose: () => void
  onUploaded?: (avatarUrl: string) => void
}

export function AlterarFotoModal({ isOpen, onClose, onUploaded }: AlterarFotoModalProps) {
  const refreshAuth = useAuth((s) => s.initialize)
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const reset = () => {
    setPreview(null)
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleClose = () => {
    if (isSaving) return
    reset()
    onClose()
  }

  const handlePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] ?? null
    if (!next) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) {
      toast.error('Use JPG, PNG ou WEBP.')
      return
    }
    if (next.size > 2 * 1024 * 1024) {
      toast.error('Arquivo acima de 2 MB.')
      return
    }
    setFile(next)
    setPreview(URL.createObjectURL(next))
  }

  const handleSave = async () => {
    if (!file) {
      toast.error('Selecione uma imagem.')
      return
    }
    setIsSaving(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const response = await fetch('/api/usuarios/avatar', {
        method: 'POST',
        body: form,
        credentials: 'include',
      })
      const payload = (await response.json().catch(() => null)) as {
        data?: { avatar_url?: string }
        error?: string
      } | null
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Falha ao enviar a foto.')
      }
      const url = payload?.data?.avatar_url
      if (!url) throw new Error('Upload sem URL de retorno.')
      await refreshAuth(true)
      onUploaded?.(url)
      toast.success('Foto atualizada.')
      reset()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar a foto.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        size="sm"
        className="w-[95vw] rounded-[24px] border-none bg-app-card p-0 shadow-2xl dark:bg-app-card-dark"
      >
        <DialogHeader className="px-6 pb-2 pt-6">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold text-app-text-primary dark:text-white">
              Alterar foto
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={handleClose}
              disabled={isSaving}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <DialogDescription className="text-sm text-app-text-secondary dark:text-white/60">
            Atualize sua foto de perfil. Formatos: JPG, PNG ou WEBP (máx. 2 MB).
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handlePick}
          />
          <button
            type="button"
            className="flex min-h-[180px] w-full flex-col items-center justify-center rounded-[18px] border border-dashed border-app-border bg-app-bg-secondary text-center dark:border-app-border-dark dark:bg-app-hover"
            onClick={() => fileRef.current?.click()}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Prévia" className="h-32 w-32 rounded-full object-cover" />
            ) : (
              <>
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-app-primary/10 text-app-primary">
                  <ImagePlus className="h-7 w-7" />
                </div>
                <p className="text-sm font-medium text-app-text-primary dark:text-white">
                  Selecione uma nova imagem
                </p>
                <p className="mt-1 text-xs text-app-text-secondary dark:text-white/60">
                  Máximo de 2 MB
                </p>
              </>
            )}
          </button>
        </div>

        <DialogFooter className="gap-3 px-6 pb-6">
          <Button
            variant="outline"
            className="h-11 rounded-integrallys px-6"
            onClick={handleClose}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            className="h-11 rounded-integrallys bg-app-primary px-6 text-white hover:bg-app-primary-hover"
            onClick={() => void handleSave()}
            disabled={isSaving || !file}
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar foto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
