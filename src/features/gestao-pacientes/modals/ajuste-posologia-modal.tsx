'use client'

import { Pill, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useApi } from '@/hooks/use-api'
import type { ItemAjustavel } from '@/lib/posologia-ajuste'
import type { Patient } from '@/types/patient'

interface AjustePosologiaModalProps {
  isOpen: boolean
  onClose: () => void
  paciente: Patient | null
}

function dataBr(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : '—'
}

export function AjustePosologiaModal({ isOpen, onClose, paciente }: AjustePosologiaModalProps) {
  const api = useApi()
  const [itens, setItens] = useState<ItemAjustavel[]>([])
  const [novas, setNovas] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const pacienteId = paciente?.id ? String(paciente.id) : null

  useEffect(() => {
    if (!isOpen || !pacienteId) return
    let ativo = true
    setIsLoading(true)
    setErro(null)
    setNovas({})
    api
      .get<{ data: ItemAjustavel[] }>(
        `/api/pacientes/posologia?pacienteId=${encodeURIComponent(pacienteId)}`,
      )
      .then((res) => ativo && setItens(res.data))
      .catch((err) => {
        if (!ativo) return
        setItens([])
        setErro(err instanceof Error ? err.message : 'Não foi possível carregar os produtos.')
      })
      .finally(() => ativo && setIsLoading(false))
    return () => {
      ativo = false
    }
  }, [api, isOpen, pacienteId])

  const alterados = itens.filter((item) => {
    const nova = (novas[item.itemId] ?? '').trim()
    return nova !== '' && nova !== item.posologia
  })

  const salvar = async () => {
    if (!pacienteId || alterados.length === 0 || isSaving) return
    setIsSaving(true)
    try {
      await api.put('/api/pacientes/posologia', {
        pacienteId,
        ajustes: alterados.map((item) => ({
          itemId: item.itemId,
          posologia: novas[item.itemId].trim(),
        })),
      })
      toast.success('Forma de tomar atualizada.')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar o ajuste.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!paciente) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        hideCloseButton
        size="lg"
        className="flex flex-col gap-0 overflow-y-hidden rounded-[16px] border-none p-0 shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-app-border px-5 pb-4 pt-6 dark:border-app-border-dark sm:px-8">
          <div className="space-y-1">
            <DialogTitle className="flex items-center gap-2 text-2xl leading-tight">
              <Pill className="h-5 w-5 text-app-primary" />
              Ajuste de posologia
            </DialogTitle>
            <DialogDescription className="text-base text-app-text-muted">
              Produtos prescritos para{' '}
              <span className="font-medium text-app-text-primary dark:text-white">
                {paciente.name}
              </span>{' '}
              nos últimos 30 dias.
            </DialogDescription>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-app-border bg-white hover:bg-app-bg-secondary dark:border-app-border-dark dark:bg-transparent dark:hover:bg-app-hover"
          >
            <X className="h-4 w-4 text-app-text-muted" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto custom-scrollbar px-5 py-5 sm:px-8">
          {isLoading && <p className="text-sm text-app-text-muted">Carregando produtos…</p>}
          {erro && <p className="text-sm text-[var(--app-danger-text)]">{erro}</p>}
          {!isLoading && !erro && itens.length === 0 && (
            <p className="rounded-[12px] border border-dashed border-app-border p-5 text-sm text-app-text-secondary dark:border-app-border-dark dark:text-white/70">
              Este paciente não tem produtos prescritos nos últimos 30 dias.
            </p>
          )}
          {itens.map((item) => (
            <div
              key={item.itemId}
              className="space-y-3 rounded-[12px] border border-app-border p-4 dark:border-app-border-dark"
            >
              <div>
                <h4 className="text-base text-app-text-primary dark:text-white">{item.produto}</h4>
                <p className="text-xs text-app-text-muted">
                  Prescrito em {dataBr(item.dataPrescricao)}
                </p>
              </div>
              <div className="rounded-[8px] border border-dashed border-app-border bg-app-bg-secondary px-3 py-2 dark:border-app-border-dark dark:bg-app-table-header-dark">
                <span className="text-xs text-app-text-muted">Forma atual: </span>
                <span className="text-sm text-app-text-secondary dark:text-white/80">
                  {item.posologia || 'Não informada'}
                </span>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`nova-${item.itemId}`} className="text-sm font-normal">
                  Nova forma de tomar
                </Label>
                <Input
                  id={`nova-${item.itemId}`}
                  placeholder="Ex.: 1 cápsula após o café e 1 ao dormir"
                  maxLength={500}
                  value={novas[item.itemId] ?? ''}
                  onChange={(e) =>
                    setNovas((atual) => ({ ...atual, [item.itemId]: e.target.value }))
                  }
                  className="h-11 rounded-integrallys font-normal"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-app-border bg-app-bg-secondary/30 px-5 py-4 dark:border-app-border-dark sm:px-8">
          <span className="text-sm text-app-text-muted">
            {alterados.length > 0 ? 'Alterações pendentes para salvar' : 'Nenhuma alteração feita'}
          </span>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="h-11 rounded-integrallys px-6 font-normal"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void salvar()}
              disabled={alterados.length === 0 || isSaving}
              className="h-11 rounded-integrallys bg-app-primary px-8 font-normal text-white hover:bg-app-primary-hover disabled:opacity-50"
            >
              {isSaving ? 'Salvando…' : 'Salvar ajuste'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
