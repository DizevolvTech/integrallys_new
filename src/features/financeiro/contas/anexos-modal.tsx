'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, Paperclip, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApi } from '@/hooks/use-api'
import { ANEXO_TIPOS } from '@/lib/financeiro-anexos'

interface Anexo {
  id: string
  nome: string
  tipoDocumento: string | null
  tamanho: number
  criadoEm: string
  url: string | null
}

/** Envia um arquivo ao Storage privado e vincula ao lançamento. Devolve a mensagem de erro, se houver. */
export async function enviarAnexo(lancamentoId: string, file: File, tipoDocumento: string): Promise<string | null> {
  const form = new FormData()
  form.append('file', file)
  form.append('lancamentoId', lancamentoId)
  form.append('tipoDocumento', tipoDocumento)
  const response = await fetch('/api/financeiro/anexos', { method: 'POST', body: form, credentials: 'include' })
  if (response.ok) return null
  const payload = (await response.json().catch(() => null)) as { error?: string } | null
  return payload?.error ?? 'Não foi possível enviar o arquivo.'
}

interface Props {
  open: boolean
  onClose: () => void
  lancamentoId: string | null
  titulo: string
  onChanged: () => void
}

export function AnexosModal({ open, onClose, lancamentoId, titulo, onChanged }: Props) {
  const api = useApi()
  const [anexos, setAnexos] = useState<Anexo[]>([])
  const [carregando, setCarregando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [tipo, setTipo] = useState<string>('Nota fiscal')
  const entrada = useRef<HTMLInputElement>(null)

  const carregar = useCallback(async () => {
    if (!lancamentoId) return
    setCarregando(true)
    try {
      const response = await api.get<{ data: Anexo[] }>(`/api/financeiro/anexos?lancamentoId=${lancamentoId}`)
      setAnexos(response.data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível carregar os documentos.')
    } finally {
      setCarregando(false)
    }
  }, [api, lancamentoId])

  useEffect(() => {
    if (open) void carregar()
    else setAnexos([])
  }, [open, carregar])

  const enviar = async (file: File | undefined) => {
    if (!file || !lancamentoId) return
    setEnviando(true)
    const erro = await enviarAnexo(lancamentoId, file, tipo)
    setEnviando(false)
    if (entrada.current) entrada.current.value = ''
    if (erro) {
      toast.error(erro)
      return
    }
    toast.success('Documento anexado.')
    await carregar()
    onChanged()
  }

  const remover = async (anexo: Anexo) => {
    try {
      await api.delete('/api/financeiro/anexos', { id: anexo.id })
      toast.success('Documento removido.')
      await carregar()
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível remover.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(proximo) => !proximo && onClose()}>
      <DialogContent className="max-h-[90vh] w-[95%] overflow-y-auto rounded-[24px] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Documentos da despesa</DialogTitle>
          <DialogDescription>{titulo}. PDF, JPG, PNG ou WEBP, até 10 MB. Os arquivos ficam em armazenamento privado.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="h-11 rounded-xl sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ANEXO_TIPOS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
          <input
            ref={entrada}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => void enviar(event.target.files?.[0])}
          />
          <Button onClick={() => entrada.current?.click()} disabled={enviando} className="h-11 rounded-xl bg-app-primary text-white">
            <Upload className="mr-2 h-4 w-4" />
            {enviando ? 'Enviando...' : 'Anexar arquivo'}
          </Button>
        </div>
        {carregando ? (
          <p className="py-4 text-center text-sm text-app-text-muted">Carregando...</p>
        ) : anexos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-app-border py-8 text-center text-sm text-app-text-muted dark:border-app-border-dark">
            Nenhum documento anexado ainda.
          </p>
        ) : (
          <ul className="divide-y divide-app-border rounded-2xl border border-app-border dark:divide-app-border-dark dark:border-app-border-dark">
            {anexos.map((anexo) => (
              <li key={anexo.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <Paperclip className="h-4 w-4 shrink-0 text-app-text-muted" />
                  <span className="min-w-0">
                    <span className="block truncate text-app-text-primary dark:text-white">{anexo.nome}</span>
                    <span className="block text-xs text-app-text-muted">{anexo.tipoDocumento ?? 'Documento'} · {(anexo.tamanho / 1024).toFixed(0)} KB</span>
                  </span>
                </span>
                <span className="flex shrink-0 gap-1">
                  {anexo.url && (
                    <Button asChild variant="outline" size="sm" className="rounded-lg">
                      <a href={anexo.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1 h-3.5 w-3.5" />Abrir</a>
                    </Button>
                  )}
                  <Button variant="outline" size="icon" aria-label="Remover documento" className="h-8 w-8 rounded-lg" onClick={() => void remover(anexo)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
