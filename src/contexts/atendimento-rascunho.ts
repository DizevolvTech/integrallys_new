// Rascunho do atendimento guardado no navegador por agendamento (cartão 1073):
// sair e "Continuar atendimento" traz de volta o que o especialista já preencheu.
// Apagado ao finalizar.

import type { AnamneseData, ItemPrescrito } from './atendimento-context'

export interface RascunhoAtendimento {
  currentStep: number
  anamneseType: 'consulta' | 'reconsulta'
  anamneseData: AnamneseData
  evolucaoAtual: string
  prescritos: ItemPrescrito[]
  observacoesGerais: string
  observacoesFinais: string
}

const VERSAO = 1
const chave = (agendamentoId: string) => `integrallys:atendimento-rascunho:${agendamentoId}`

export function serializarRascunho(r: RascunhoAtendimento): string {
  return JSON.stringify({
    v: VERSAO,
    ...r,
    anamneseData: {
      ...r.anamneseData,
      historicos: [...r.anamneseData.historicos],
      medicamentos: [...r.anamneseData.medicamentos],
    },
  })
}

export function lerRascunho(texto: string | null, padrao: AnamneseData): RascunhoAtendimento | null {
  if (!texto) return null
  try {
    const bruto = JSON.parse(texto) as Record<string, unknown>
    if (bruto.v !== VERSAO) return null
    const a = (bruto.anamneseData ?? {}) as Record<string, unknown>
    return {
      currentStep: Number(bruto.currentStep) >= 1 && Number(bruto.currentStep) <= 5 ? Number(bruto.currentStep) : 1,
      anamneseType: bruto.anamneseType === 'reconsulta' ? 'reconsulta' : 'consulta',
      anamneseData: {
        ...padrao,
        ...(a as Partial<AnamneseData>),
        historicos: new Set(Array.isArray(a.historicos) ? (a.historicos as string[]) : []),
        medicamentos: new Set(Array.isArray(a.medicamentos) ? (a.medicamentos as string[]) : []),
      },
      evolucaoAtual: typeof bruto.evolucaoAtual === 'string' ? bruto.evolucaoAtual : '',
      prescritos: Array.isArray(bruto.prescritos) ? (bruto.prescritos as ItemPrescrito[]) : [],
      observacoesGerais: typeof bruto.observacoesGerais === 'string' ? bruto.observacoesGerais : '',
      observacoesFinais: typeof bruto.observacoesFinais === 'string' ? bruto.observacoesFinais : '',
    }
  } catch {
    return null
  }
}

function armazenamento(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function carregarRascunho(agendamentoId: string | undefined, padrao: AnamneseData): RascunhoAtendimento | null {
  if (!agendamentoId) return null
  return lerRascunho(armazenamento()?.getItem(chave(agendamentoId)) ?? null, padrao)
}

export function salvarRascunho(agendamentoId: string | undefined, r: RascunhoAtendimento) {
  if (!agendamentoId) return
  try {
    armazenamento()?.setItem(chave(agendamentoId), serializarRascunho(r))
  } catch {
    // Sem espaço ou bloqueado: o atendimento continua só em memória.
  }
}

export function apagarRascunho(agendamentoId: string | undefined) {
  if (!agendamentoId) return
  armazenamento()?.removeItem(chave(agendamentoId))
}
