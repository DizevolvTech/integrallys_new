'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CRM_ESTAGIOS, type PacienteCrm } from '@/features/gestao-pacientes/modals/visualizar-paciente-modal'
import type { Patient } from '@/types/patient'

interface CrmKanbanProps {
  porEstagio: Map<string, Patient[]>
  crmPorPaciente: Map<string, PacienteCrm>
  onAbrir: (paciente: Patient) => void
  /** Move o cartão para outra coluna (grava no servidor); lança erro se falhar. */
  onMover: (paciente: Patient, estagio: string) => Promise<void>
}

/**
 * Quadro CRM: arrastar e soltar (mouse) entre colunas, "Mover estágio" (toque/teclado),
 * barra horizontal visível e rolagem vertical por coluna.
 */
export function CrmKanban({ porEstagio, crmPorPaciente, onAbrir, onMover }: CrmKanbanProps) {
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [colunaAlvo, setColunaAlvo] = useState<string | null>(null)

  const soltar = (estagio: string, pacienteId: string | null) => {
    setColunaAlvo(null)
    setArrastando(null)
    if (!pacienteId) return
    for (const [atual, lista] of porEstagio) {
      const paciente = lista.find((p) => String(p.id) === pacienteId)
      if (!paciente) continue
      if (atual !== estagio) void onMover(paciente, estagio)
      return
    }
  }

  return (
    <div className="board-scroll overflow-x-auto pb-3" data-testid="crm-board">
      <div className="grid min-w-[1100px] grid-cols-6 gap-4">
        {CRM_ESTAGIOS.map((col) => {
          const cards = porEstagio.get(col.value) ?? []
          return (
            <section
              key={col.value}
              aria-label={col.label}
              data-testid={`crm-col-${col.value}`}
              onDragOver={(event) => {
                if (!arrastando) return
                event.preventDefault()
                setColunaAlvo(col.value)
              }}
              onDragLeave={() => setColunaAlvo((atual) => (atual === col.value ? null : atual))}
              onDrop={(event) => {
                event.preventDefault()
                soltar(col.value, event.dataTransfer.getData('text/plain') || arrastando)
              }}
              className={`flex max-h-[70vh] flex-col rounded-2xl border bg-app-bg-secondary/40 p-4 dark:bg-app-surface-muted ${
                colunaAlvo === col.value
                  ? 'border-[var(--app-primary)] ring-2 ring-[var(--app-primary)]/30'
                  : 'border-app-border dark:border-app-border-dark'
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-app-text-primary dark:text-white">{col.label}</h3>
                <Badge variant="outline" className="rounded-full border-app-border px-2 py-0.5 text-xs dark:border-app-border-dark">
                  {cards.length}
                </Badge>
              </div>
              <div className="board-scroll min-h-24 flex-1 space-y-2 overflow-y-auto pr-1">
                {cards.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-app-border p-3 text-center text-xs text-app-text-muted dark:border-app-border-dark">
                    Sem pacientes
                  </div>
                ) : (
                  cards.map((p) => {
                    const id = String(p.id)
                    const crm = crmPorPaciente.get(id)
                    const dataProxima = crm?.data_proxima_acao
                      ? new Date(`${crm.data_proxima_acao}T00:00:00`).toLocaleDateString('pt-BR')
                      : null
                    return (
                      // biome-ignore lint/a11y/useSemanticElements: cartão arrastável (draggable) com filhos de bloco; <button> não arrasta de forma confiável
                      <div
                        key={id}
                        role="button"
                        tabIndex={0}
                        draggable
                        data-testid={`crm-card-${id}`}
                        onDragStart={(event) => {
                          event.dataTransfer.setData('text/plain', id)
                          event.dataTransfer.effectAllowed = 'move'
                          setArrastando(id)
                        }}
                        onDragEnd={() => {
                          setArrastando(null)
                          setColunaAlvo(null)
                        }}
                        onClick={() => onAbrir(p)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onAbrir(p)
                          }
                        }}
                        className={`cursor-grab rounded-xl border border-app-border bg-app-card p-3 text-left transition hover:border-app-primary focus:border-app-primary focus:outline-none active:cursor-grabbing dark:border-app-border-dark dark:bg-app-card-dark ${
                          arrastando === id ? 'opacity-50' : ''
                        }`}
                      >
                        <p className="truncate text-sm font-medium text-app-text-primary dark:text-white">{p.name}</p>
                        <p className="mt-1 text-xs text-app-text-muted">Último atendimento: —</p>
                        {(crm?.proxima_acao || dataProxima) && (
                          <p className="mt-1 text-xs text-[var(--app-primary)]">
                            Próxima: {crm?.proxima_acao || '(sem descrição)'}
                            {dataProxima ? ` · ${dataProxima}` : ''}
                          </p>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 h-7 px-2 text-xs text-[var(--app-primary)] hover:bg-app-bg-secondary"
                          onClick={(event) => {
                            event.stopPropagation()
                            onAbrir(p)
                          }}
                        >
                          Mover estágio →
                        </Button>
                      </div>
                    )
                  })
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
