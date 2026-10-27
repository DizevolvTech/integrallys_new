'use client'

import { useRef, useState } from 'react'
import { FileText, X } from 'lucide-react'
import { toast } from 'sonner'

import { DateInput } from '@/components/shared/date-input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'

interface AdicionarDocumentoEnviadoModalProps {
  isOpen: boolean
  onClose: () => void
  evolucaoId: string
  /** Paciente da evolução: o arquivo anexado fica nos exames/documentos dele. */
  pacienteId?: string
  onSave: (payload: {
    evolucaoId: string
    tipo: string
    meio: string
    dataEnvio: string
    recebido: boolean
    anexo?: string
  }) => Promise<void>
}

export function AdicionarDocumentoEnviadoModal({
  isOpen,
  onClose,
  evolucaoId,
  pacienteId,
  onSave,
}: AdicionarDocumentoEnviadoModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [link, setLink] = useState('')
  const [tipo, setTipo] = useState('')
  const [meio, setMeio] = useState('whatsapp')
  const [dataEnvio, setDataEnvio] = useState('')
  const [recebido, setRecebido] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const reset = () => {
    setTipo('')
    setMeio('whatsapp')
    setDataEnvio('')
    setRecebido(false)
    setIsSaving(false)
    setArquivo(null)
    setLink('')
  }

  const handleClose = () => {
    if (isSaving) return
    reset()
    onClose()
  }

  const handleSave = async () => {
    if (!tipo || !meio || !dataEnvio) {
      toast.error('Preencha tipo, meio e data de envio.')
      return
    }

    if (arquivo && !pacienteId) {
      toast.error('Não foi possível localizar o paciente para anexar o arquivo.')
      return
    }

    setIsSaving(true)
    try {
      let anexo: string | undefined = link.trim() || undefined
      if (arquivo && pacienteId) {
        const form = new FormData()
        form.append('file', arquivo)
        form.append('pacienteId', pacienteId)
        form.append('nome', arquivo.name)
        form.append('tipo', tipo)
        const res = await fetch('/api/pacientes/exames/upload', { method: 'POST', body: form, credentials: 'include' })
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(body?.error ?? 'Falha ao enviar o anexo')
        }
        anexo = arquivo.name
      }
      await onSave({ evolucaoId, tipo, meio, dataEnvio, recebido, anexo })
      toast.success('Documento registrado.')
      reset()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível registrar o documento.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        hideCloseButton={true}
        className="w-[95vw] sm:max-w-[550px] p-6 md:p-8 rounded-[24px] bg-app-card dark:bg-app-card-dark border border-app-border dark:border-app-border-dark shadow-lg block custom-scrollbar"
      >
        <DialogTitle className="sr-only">Adicionar documento enviado</DialogTitle>

        <div className="flex justify-between items-start mb-6">
          <div className="space-y-1">
            <h2 className="text-xl font-normal text-app-text-primary dark:text-white tracking-tight">
              Adicionar documento enviado
            </h2>
            <p className="text-base text-app-text-muted dark:text-app-text-muted font-normal">
              Registre um novo documento enviado ao paciente
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark hover:bg-app-bg-secondary dark:hover:bg-app-hover transition-colors shrink-0"
          >
            <X className="h-4 w-4 text-app-text-muted" />
          </button>
        </div>

        <div className="space-y-6 mb-6">
          <div className="space-y-2">
            <Label className="text-sm font-normal text-app-text-primary dark:text-white">Tipo de documento *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="h-12 rounded-[12px] bg-app-bg-secondary dark:bg-app-surface-muted border-app-border dark:border-app-border-dark focus:ring-[var(--app-primary)] text-app-text-secondary dark:text-white/80">
                <SelectValue preferPlaceholder placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent className="rounded-[12px]">
                <SelectItem value="prescricao">Prescrição</SelectItem>
                <SelectItem value="atestado">Atestado</SelectItem>
                <SelectItem value="exame">Exame</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-normal text-app-text-primary dark:text-white">Data de envio *</Label>
            <DateInput
              value={dataEnvio}
              onChange={setDataEnvio}
              className="h-12 rounded-[12px] bg-app-bg-secondary dark:bg-app-surface-muted border-app-border dark:border-app-border-dark focus:ring-[var(--app-primary)] text-app-text-primary dark:text-white pl-4"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-normal text-app-text-primary dark:text-white">Meio de envio</Label>
            <Select value={meio} onValueChange={setMeio}>
              <SelectTrigger className="h-12 rounded-[12px] bg-app-bg-secondary dark:bg-app-surface-muted border-app-border dark:border-app-border-dark focus:ring-[var(--app-primary)] text-app-text-secondary dark:text-white/80">
                <SelectValue preferPlaceholder placeholder="Selecione o meio" />
              </SelectTrigger>
              <SelectContent className="rounded-[12px]">
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="fisico">Físico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-normal text-app-text-primary dark:text-white">
              Anexo (opcional)
            </Label>
            <Button
              variant="outline"
              className="w-full h-12 rounded-[12px] bg-app-card dark:bg-app-card-dark border-app-border dark:border-app-border-dark text-app-text-primary dark:text-white font-normal hover:bg-app-bg-secondary dark:hover:bg-app-hover flex items-center justify-center gap-2"
              onClick={() => inputRef.current?.click()}
            >
              <FileText className="h-4 w-4" />
              {arquivo ? arquivo.name : 'Anexar arquivo'}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="hidden"
              aria-label="Arquivo do documento"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                if (f && f.size > 10 * 1024 * 1024) {
                  toast.error('Arquivo acima de 10 MB.')
                  return
                }
                setArquivo(f)
              }}
            />
            <p className="text-xs text-app-text-muted">PDF, JPG ou PNG até 10 MB. Fica guardado nos exames e documentos do paciente.</p>
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-app-bg-secondary dark:bg-app-bg-dark"></div>
              <span className="text-xs font-normal text-app-text-muted">ou</span>
              <div className="h-px flex-1 bg-app-bg-secondary dark:bg-app-bg-dark"></div>
            </div>
            <Input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Cole o link do documento (URL)"
              className="h-12 rounded-[12px] bg-app-bg-secondary dark:bg-app-surface-muted border-app-border dark:border-app-border-dark focus:ring-[var(--app-primary)] text-app-text-primary dark:text-white"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <Label
              className="text-sm font-normal text-app-text-primary dark:text-white cursor-pointer"
              htmlFor="confirmar-recebimento"
            >
              Confirmar recebimento
            </Label>
            <Switch id="confirmar-recebimento" checked={recebido} onCheckedChange={setRecebido} />
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center gap-3 sm:justify-end w-full border-t border-app-border dark:border-app-border-dark pt-6">
          <Button
            variant="outline"
            onClick={handleClose}
            className="w-full sm:w-auto h-11 px-6 rounded-integrallys font-normal text-app-text-primary dark:text-white hover:bg-app-bg-secondary dark:hover:bg-app-hover border-app-border dark:border-app-border-dark"
          >
            Cancelar
          </Button>
          <Button
            className="w-full sm:w-auto px-6 h-11 bg-app-primary hover:bg-app-primary-hover text-white rounded-integrallys font-normal shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            onClick={() => void handleSave()}
            disabled={isSaving}
          >
            <FileText className="h-4 w-4" />
            {isSaving ? 'Salvando...' : 'Adicionar documento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
