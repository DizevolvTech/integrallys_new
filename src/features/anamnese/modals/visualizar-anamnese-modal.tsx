'use client'

import React from 'react'
import { Activity, Eye, Scale, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import type { AnamneseItem } from '../hooks/use-anamnese'
import { extrasLegiveis } from '../anamnese-extras-view'

interface VisualizarAnamneseModalProps {
  isOpen: boolean
  onClose: () => void
  anamnese: AnamneseItem | null
}

function getIMCCategory(imc?: number) {
  if (typeof imc !== 'number' || Number.isNaN(imc)) return null
  if (imc < 18.5) return { label: 'Abaixo do peso', color: 'text-[var(--app-info-text)]' }
  if (imc < 25) return { label: 'Peso normal', color: 'text-[var(--app-success-text)]' }
  if (imc < 30) return { label: 'Sobrepeso', color: 'text-[var(--app-warning-text)]' }
  return { label: 'Obesidade', color: 'text-[var(--app-danger-text)]' }
}

function metricValue(value?: number, suffix = '') {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return `${value}${suffix}`
}

export function VisualizarAnamneseModal({
  isOpen,
  onClose,
  anamnese,
}: VisualizarAnamneseModalProps) {
  if (!anamnese) return null

  const imcCategory = getIMCCategory(anamnese.imc)
  const extras = extrasLegiveis(anamnese.camposExtras)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        hideCloseButton={true}
        className="sm:max-w-[650px] p-0 rounded-[24px] overflow-hidden border border-app-border dark:border-app-border-dark shadow-lg bg-app-card dark:bg-app-card-dark"
      >
        <div className="bg-app-card dark:bg-app-card-dark p-8 custom-scrollbar">
          <div className="flex justify-between items-start mb-6">
            <div className="space-y-1 focus:outline-none">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-app-bg-secondary dark:bg-app-table-header-dark flex items-center justify-center">
                  <Eye className="h-5 w-5 text-app-text-primary dark:text-white" />
                </div>
                <h2 className="text-xl font-normal text-app-text-primary dark:text-white leading-tight">
                  Visualizar anamnese
                </h2>
              </div>
              <p className="text-app-text-muted dark:text-app-text-muted text-sm font-normal">
                {anamnese.tipo} - {anamnese.paciente} - {anamnese.data}
              </p>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark hover:bg-app-bg-secondary dark:hover:bg-app-hover transition-all shrink-0"
            >
              <X className="h-4 w-4 text-app-text-muted" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-6 mb-8 mt-4">
            <div className="space-y-1">
              <span className="text-xs font-normal text-app-text-muted tracking-wider">Paciente</span>
              <p className="text-base font-normal text-app-text-primary dark:text-white/80">{anamnese.paciente}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-normal text-app-text-muted tracking-wider">Tipo</span>
              <div>
                <Badge className="app-status-info text-white border-none px-3 py-0.5 font-normal rounded-lg shadow-sm">
                  {anamnese.tipo}
                </Badge>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-normal text-app-text-muted tracking-wider">Data</span>
              <p className="text-base font-normal text-app-text-primary dark:text-white/80">{anamnese.data}</p>
            </div>
          </div>

          <div className="space-y-6 pt-6 border-t border-app-border dark:border-app-border-dark">
            <div className="flex items-center gap-2 mb-2">
              <Scale className="h-5 w-5 text-app-primary dark:text-white" />
              <h3 className="text-lg font-normal text-app-text-primary dark:text-white">Bioimpedância</h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-4 rounded-[12px] border border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark shadow-sm space-y-1">
                <span className="text-xs font-normal text-app-text-muted tracking-wider">Peso</span>
                <p className="text-xl font-normal text-app-text-primary dark:text-white">{metricValue(anamnese.peso, ' kg')}</p>
              </div>

              <div className="p-4 rounded-[12px] border border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark shadow-sm space-y-1">
                <span className="text-xs font-normal text-app-text-muted tracking-wider">Altura</span>
                <p className="text-xl font-normal text-app-text-primary dark:text-white">{metricValue(anamnese.altura, ' cm')}</p>
              </div>

              <div className="p-4 rounded-[12px] border border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark shadow-sm space-y-0.5">
                <span className="text-xs font-normal text-app-text-muted tracking-wider">IMC</span>
                <p className={`text-xl font-normal ${imcCategory?.color ?? 'text-app-text-primary dark:text-white'}`}>
                  {metricValue(anamnese.imc)}
                </p>
                <p className={`text-xs font-normal ${imcCategory?.color ?? 'text-app-text-muted'}`}>
                  {imcCategory?.label ?? 'Não informado'}
                </p>
              </div>

              <div className="p-4 rounded-[12px] border border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark shadow-sm space-y-1">
                <span className="text-xs font-normal text-app-text-muted tracking-wider line-clamp-1">Gordura corporal</span>
                <p className="text-xl font-normal text-app-text-primary dark:text-white">{metricValue(anamnese.gordura, '%')}</p>
              </div>

              <div className="p-4 rounded-[12px] border border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark shadow-sm space-y-1">
                <span className="text-xs font-normal text-app-text-muted tracking-wider line-clamp-1">Massa muscular</span>
                <p className="text-xl font-normal text-app-text-primary dark:text-white">{metricValue(anamnese.massaMuscular, ' kg')}</p>
              </div>

              <div className="p-4 rounded-[12px] border border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark shadow-sm space-y-1">
                <span className="text-xs font-normal text-app-text-muted tracking-wider line-clamp-1">Gordura visceral</span>
                <p className="text-xl font-normal text-app-text-primary dark:text-white">{metricValue(anamnese.gorduraVisceral)}</p>
              </div>

              <div className="p-4 rounded-[12px] border border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark shadow-sm space-y-1">
                <span className="text-xs font-normal text-app-text-muted tracking-wider line-clamp-1">Massa óssea</span>
                <p className="text-xl font-normal text-app-text-primary dark:text-white">{metricValue(anamnese.massaOssea, ' kg')}</p>
              </div>

              <div className="p-4 rounded-[12px] border border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark shadow-sm space-y-1">
                <span className="text-xs font-normal text-app-text-muted tracking-wider line-clamp-1">Água corporal</span>
                <p className="text-xl font-normal text-app-text-primary dark:text-white">{metricValue(anamnese.aguaCorporal, '%')}</p>
              </div>
            </div>

            <div className="mt-6 p-8 rounded-[20px] bg-app-bg-secondary/50 dark:bg-app-table-header-dark border border-app-border dark:border-app-border-dark flex flex-col items-start space-y-4">
              <span className="text-lg font-normal text-app-text-muted dark:text-app-text-muted">Metabolismo basal</span>
              <p className="text-4xl font-normal text-app-primary dark:text-white">— kcal/dia</p>
            </div>
          </div>

          <div className="space-y-4 pt-6 mt-6 border-t border-app-border dark:border-app-border-dark">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-app-primary dark:text-white" />
              <h3 className="text-lg font-normal text-app-text-primary dark:text-white">Histórico diário</h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-[12px] border border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark flex justify-between items-center shadow-sm">
                <span className="text-xs font-normal text-app-text-muted">Tabagismo</span>
                <Badge className="app-status-neutral text-white px-2 py-0.5 rounded-lg border-none text-xs font-normal tracking-wide">—</Badge>
              </div>
              <div className="p-3.5 rounded-[12px] border border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark flex justify-between items-center shadow-sm">
                <span className="text-xs font-normal text-app-text-muted">Álcool</span>
                <Badge className="app-status-neutral text-white px-2 py-0.5 rounded-lg border-none text-xs font-normal tracking-wide">—</Badge>
              </div>
              <div className="p-3.5 rounded-[12px] border border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark flex justify-between items-center shadow-sm">
                <span className="text-xs font-normal text-app-text-muted">Atividade física</span>
                <Badge className="app-status-neutral text-white px-2 py-0.5 rounded-lg border-none text-xs font-normal tracking-wide">—</Badge>
              </div>
              <div className="p-3.5 rounded-[12px] border border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark space-y-0.5 shadow-sm">
                <span className="text-xs font-normal text-app-text-muted tracking-wider">Qualidade do sono</span>
                <p className="text-sm font-normal text-app-text-primary dark:text-white">Não informado</p>
              </div>
              <div className="p-3.5 rounded-[12px] border border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark space-y-0.5 shadow-sm">
                <span className="text-xs font-normal text-app-text-muted tracking-wider">Água (l/dia)</span>
                <p className="text-sm font-normal text-app-text-primary dark:text-white">Não informado</p>
              </div>
              <div className="p-3.5 rounded-[12px] border border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark space-y-0.5 shadow-sm">
                <span className="text-xs font-normal text-app-text-muted tracking-wider">Intestino</span>
                <p className="text-sm font-normal text-app-text-primary dark:text-white">Não informado</p>
              </div>
            </div>

            <div className="p-4 rounded-[12px] bg-app-card dark:bg-app-card-dark border border-app-border dark:border-app-border-dark space-y-0.5 shadow-sm">
              <span className="text-xs font-normal text-app-text-muted tracking-wider">Nível de estresse</span>
              <p className="text-sm font-normal text-app-text-primary dark:text-white">Não informado</p>
            </div>
          </div>

          <div className="space-y-6 pt-6 mt-6 border-t border-app-border dark:border-app-border-dark">
            <div className="space-y-1.5">
              <h3 className="text-xs font-normal text-app-text-muted tracking-wider">Queixa principal</h3>
              <div className="p-4 rounded-[12px] bg-app-bg-secondary/20 dark:bg-app-table-header-dark border border-app-border dark:border-app-border-dark/50">
                <p className="text-sm text-app-text-secondary dark:text-white/80 leading-relaxed font-normal">
                  {anamnese.queixa || 'Não informado'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <h4 className="text-xs font-normal text-app-text-muted tracking-wider">Medicamentos em uso</h4>
                <div className="p-4 rounded-[12px] bg-app-bg-secondary/20 dark:bg-app-table-header-dark border border-app-border dark:border-app-border-dark/50 min-h-[60px] flex items-center">
                  <p className="text-sm text-app-text-secondary dark:text-white/80 font-normal break-words">{extras.medicamentosUso || 'Não informado'}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <h4 className="text-xs font-normal text-app-text-muted tracking-wider">Alergias</h4>
                <div className="p-4 rounded-[12px] bg-app-bg-secondary/20 dark:bg-app-table-header-dark border border-app-border dark:border-app-border-dark/50 min-h-[60px] flex items-center">
                  <p className="text-sm text-app-text-secondary dark:text-white/80 font-normal break-words">{extras.alergias || 'Não informado'}</p>
                </div>
              </div>
            </div>

            {(extras.respostas.length > 0 || extras.textos.length > 0 || extras.personalizados.length > 0) && (
              <div className="space-y-3" data-testid="anamnese-respostas-atendimento">
                {extras.respostas.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {extras.respostas.map((r) => (
                      <div key={r.label} className="p-3.5 rounded-[12px] border border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark shadow-sm">
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-xs font-normal text-app-text-muted">{r.label}</span>
                          <span className="text-xs font-normal text-app-text-primary dark:text-white">{r.resposta}</span>
                        </div>
                        {r.detalhe && <p className="text-sm text-app-text-secondary dark:text-white/80 mt-1 break-words">{r.detalhe}</p>}
                      </div>
                    ))}
                  </div>
                )}
                {[...extras.textos, ...extras.personalizados].map((t) => (
                  <div key={t.label} className="space-y-1.5">
                    <h4 className="text-xs font-normal text-app-text-muted tracking-wider">{t.label}</h4>
                    <div className="p-4 rounded-[12px] bg-app-bg-secondary/20 dark:bg-app-table-header-dark border border-app-border dark:border-app-border-dark/50">
                      <p className="text-sm text-app-text-secondary dark:text-white/80 font-normal break-words">{t.valor}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <h4 className="text-xs font-normal text-app-text-muted tracking-wider">Histórico familiar</h4>
                <div className="p-4 rounded-[12px] bg-app-bg-secondary/20 dark:bg-app-table-header-dark border border-app-border dark:border-app-border-dark/50">
                  <p className="text-sm text-app-text-secondary dark:text-white/80 font-normal">Não informado</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <h4 className="text-xs font-normal text-app-text-muted tracking-wider">Observações adicionais</h4>
                <div className="p-4 rounded-[12px] bg-app-bg-secondary/20 dark:bg-app-table-header-dark border border-app-border dark:border-app-border-dark/50">
                  <p className="text-sm text-app-text-secondary dark:text-white/80 leading-relaxed font-normal">
                    Não informado
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end pt-6 mt-6 border-t border-app-border dark:border-app-border-dark">
            <Button
              onClick={onClose}
              className="h-9 px-6 rounded-lg bg-app-primary hover:bg-app-primary-hover text-white font-normal text-sm shadow-sm transition-all"
            >
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
