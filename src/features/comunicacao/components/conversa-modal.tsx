'use client'

import { useEffect, useRef } from 'react'
import { Bot, MessageSquare } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useConversa } from '@/features/comunicacao/hooks/use-conversa'
import { formatarHoraClinica } from '@/lib/fuso-clinica'

const formatTime = (iso: string) => {
  return formatarHoraClinica(iso)
}
const formatDay = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR')
}

interface Props {
  telefone: string | null
  paciente?: string | null
  onClose: () => void
}

export function ConversaModal({ telefone, paciente, onClose }: Props) {
  const { mensagens, isLoading, error } = useConversa(telefone)
  const endRef = useRef<HTMLDivElement>(null)

  // rola pro fim quando a conversa carrega
  useEffect(() => {
    if (mensagens.length) endRef.current?.scrollIntoView({ block: 'end' })
  }, [mensagens.length])

  return (
    <Dialog
      open={!!telefone}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent size="lg" allowOutsideClose className="gap-0 p-0">
        <DialogHeader className="border-b border-app-border p-6 pr-10 text-left dark:border-app-border-dark">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-app-text-secondary dark:text-white/60">
            <MessageSquare className="h-3.5 w-3.5" /> Conversa do chatbot
          </p>
          <DialogTitle className="truncate">{paciente || 'Paciente sem cadastro'}</DialogTitle>
          <DialogDescription className="text-app-text-muted">{telefone ?? ''}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto bg-app-bg-secondary/40 p-5 dark:bg-white/[0.02]">
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`}>
                  <div className="h-10 w-48 animate-pulse rounded-2xl bg-app-card dark:bg-white/10" />
                </div>
              ))}
            </div>
          ) : error ? (
            <p className="py-10 text-center text-sm text-[var(--app-danger-text)]">{error}</p>
          ) : mensagens.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-app-text-secondary dark:text-white/70">
                Sem mensagens registradas nesta conversa.
              </p>
              <p className="mt-1 text-xs text-app-text-muted">
                O histórico passa a ser gravado a partir das próximas interações do chatbot.
              </p>
            </div>
          ) : (
            mensagens.map((m, i) => {
              const entrada = m.direcao === 'in'
              const showDay =
                i === 0 || formatDay(m.createdAt) !== formatDay(mensagens[i - 1].createdAt)
              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="my-2 text-center">
                      <span className="rounded-full bg-app-card px-3 py-0.5 text-[11px] text-app-text-muted shadow-sm dark:bg-app-card-dark">
                        {formatDay(m.createdAt)}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${entrada ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                        entrada
                          ? 'rounded-tl-sm bg-app-card text-app-text-primary dark:bg-app-card-dark dark:text-white'
                          : 'rounded-tr-sm bg-app-primary text-white'
                      }`}
                    >
                      {!entrada && (
                        <span className="mb-0.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-white/70">
                          <Bot className="h-3 w-3" /> Chatbot
                        </span>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.conteudo}</p>
                      <span
                        className={`mt-0.5 block text-right text-[10px] tabular-nums ${entrada ? 'text-app-text-muted' : 'text-white/60'}`}
                      >
                        {formatTime(m.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={endRef} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
