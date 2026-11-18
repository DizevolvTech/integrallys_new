'use client'

import { createContext, useContext, useMemo, useState } from 'react'
import type { CampoPersonalizadoDef } from '@/features/agenda/atendimento-finalizar-payload'

// ─── Types ───────────────────────────────────────────────────────────────────

export type AtendimentoStatus = 'draft' | 'finalized' | 'read-only'

export interface PatientDetails {
  nome: string
  dataNascimento: string
  cpf: string
  telefone: string
  email: string
  endereco: string
  sexo?: string
}

export interface AnamneseData {
  peso: string
  altura: string
  queixa: string
  diagnostico: string
  avaliacaoCliente: string
  resultados: string
  indicacaoTratamento: string
  historicos: Set<string>
  medicamentos: Set<string>
  condicoes: Record<string, string>
  // Perguntas fixas Sim/Não com texto (cartão 1073)
  alergiasSim: boolean
  alergiasTexto: string
  medicamentosUsoSim: boolean
  medicamentosUsoTexto: string
  // Campos personalizados cadastrados (id → valor) e campos avulsos desta anamnese
  camposPersonalizados: Record<string, string>
  camposAdicionais: { id: string; label: string; valor: string }[]
}

export interface ItemPrescrito {
  id: string
  nome: string
  categoria: string
  quantidade: number
  posologia: string
}

export interface DocumentState {
  selected: boolean
  dias?: string
  motivo?: string
  detalhes?: string
  especialidade?: string
  texto?: string
}

export interface DocumentosData {
  atestado: DocumentState
  dieta: DocumentState
  encaminhamento: DocumentState
  laudo: DocumentState
  declaracao: DocumentState
  fototerapia: DocumentState
  biomodulacao: DocumentState
}

export interface HistoricoPrescricaoItem {
  produto: string
  quantidade: number
  posologia: string | null
  valorUnitario: number | null
}

export interface HistoricoDocumentoItem {
  id: string
  titulo: string
  geradoEm: string
  pdfUrl: string | null
}

export interface HistoricoItem {
  date: string
  doctor: string
  anamneseType: 'consulta' | 'reconsulta'
  anamnese: {
    weight: string
    height: string
    queixa: string
    historicos: { label: string; value: string }[]
    diagnose: string
  }
  evolucao: string
  prescricoes: HistoricoPrescricaoItem[]
  documentos: HistoricoDocumentoItem[]
}

export interface GeneratedDoc {
  tipo: string
  categoria: string
  documento: string
  /** Estrutura do documento (modelo da clínica preenchido) e itens marcados — para gravar no histórico. */
  conteudo?: unknown
  valores?: Record<number, unknown>
}

const DEFAULT_ANAMNESE_DATA: AnamneseData = {
  peso: '',
  altura: '',
  queixa: '',
  diagnostico: '',
  avaliacaoCliente: '',
  resultados: '',
  indicacaoTratamento: '',
  historicos: new Set<string>(),
  medicamentos: new Set<string>(),
  condicoes: {},
  alergiasSim: false,
  alergiasTexto: '',
  medicamentosUsoSim: false,
  medicamentosUsoTexto: '',
  camposPersonalizados: {},
  camposAdicionais: [],
}

const DEFAULT_DOCUMENTOS: DocumentosData = {
  atestado: { selected: false, dias: '', motivo: '' },
  dieta: { selected: false, detalhes: '' },
  encaminhamento: { selected: false, especialidade: '', motivo: '' },
  laudo: { selected: false, detalhes: '' },
  declaracao: { selected: false, texto: '' },
  fototerapia: { selected: false, texto: '' },
  biomodulacao: { selected: false, texto: '' },
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface AtendimentoContextValue {
  // Patient
  patientName: string
  patientDetails: PatientDetails
  pacienteId?: string
  appointmentId?: string
  appointmentTime?: string

  // Navigation
  currentStep: number
  setCurrentStep: (step: number) => void
  status: AtendimentoStatus
  setStatus: (s: AtendimentoStatus) => void

  // Step 1 – Anamnese
  anamneseType: 'consulta' | 'reconsulta'
  setAnamneseType: (t: 'consulta' | 'reconsulta') => void
  anamneseData: AnamneseData
  setAnamneseData: React.Dispatch<React.SetStateAction<AnamneseData>>
  camposAnamnese: CampoPersonalizadoDef[]
  setCamposAnamnese: (campos: CampoPersonalizadoDef[]) => void

  // Step 2 – Prontuário
  evolucaoAtual: string
  setEvolucaoAtual: (v: string) => void
  historicoAtendimentos: HistoricoItem[]

  // Step 3 – Prescrição
  prescritos: ItemPrescrito[]
  setPrescritos: React.Dispatch<React.SetStateAction<ItemPrescrito[]>>
  observacoesGerais: string
  setObservacoesGerais: (v: string) => void

  // Step 4 – Documentos
  documentosData: DocumentosData
  setDocumentosData: React.Dispatch<React.SetStateAction<DocumentosData>>
  isSigned: boolean
  setIsSigned: (v: boolean) => void
  signature: string | null
  setSignature: (v: string | null) => void
  generatedDocuments: GeneratedDoc[]
  setGeneratedDocuments: React.Dispatch<React.SetStateAction<GeneratedDoc[]>>

  // Step 5 – Conclusão
  observacoesFinais: string
  setObservacoesFinais: (v: string) => void

  // Actions
  finalizeAtendimento: () => void
}

const AtendimentoContext = createContext<AtendimentoContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

const DEFAULT_PATIENT_DETAILS: PatientDetails = {
  nome: '',
  dataNascimento: '--',
  cpf: '--',
  telefone: '--',
  email: '--',
  endereco: '--',
}

export function AtendimentoProvider({
  patientName,
  patientDetails,
  pacienteId,
  appointmentId,
  appointmentTime,
  initialAnamneseType = 'consulta',
  historicoAtendimentos = [],
  children,
}: {
  patientName: string
  patientDetails?: Partial<PatientDetails>
  pacienteId?: string
  appointmentId?: string
  appointmentTime?: string
  initialAnamneseType?: 'consulta' | 'reconsulta'
  historicoAtendimentos?: HistoricoItem[]
  children: React.ReactNode
}) {
  const [currentStep, setCurrentStep] = useState(1)
  const [status, setStatus] = useState<AtendimentoStatus>('draft')

  const [anamneseType, setAnamneseType] = useState<'consulta' | 'reconsulta'>(initialAnamneseType)
  const [anamneseData, setAnamneseData] = useState<AnamneseData>(DEFAULT_ANAMNESE_DATA)

  const [camposAnamnese, setCamposAnamnese] = useState<CampoPersonalizadoDef[]>([])

  const [evolucaoAtual, setEvolucaoAtual] = useState('')

  const [prescritos, setPrescritos] = useState<ItemPrescrito[]>([])
  const [observacoesGerais, setObservacoesGerais] = useState('')

  const [documentosData, setDocumentosData] = useState<DocumentosData>(DEFAULT_DOCUMENTOS)
  const [isSigned, setIsSigned] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  const [generatedDocuments, setGeneratedDocuments] = useState<GeneratedDoc[]>([])

  const [observacoesFinais, setObservacoesFinais] = useState('')

  const finalizeAtendimento = () => setStatus('finalized')

  const value = useMemo<AtendimentoContextValue>(
    () => ({
      patientName,
      patientDetails: { ...DEFAULT_PATIENT_DETAILS, nome: patientName, ...patientDetails },
      pacienteId,
      appointmentId,
      appointmentTime,
      currentStep,
      setCurrentStep,
      status,
      setStatus,
      anamneseType,
      setAnamneseType,
      anamneseData,
      setAnamneseData,
      camposAnamnese,
      setCamposAnamnese,
      evolucaoAtual,
      setEvolucaoAtual,
      historicoAtendimentos,
      prescritos,
      setPrescritos,
      observacoesGerais,
      setObservacoesGerais,
      documentosData,
      setDocumentosData,
      isSigned,
      setIsSigned,
      signature,
      setSignature,
      generatedDocuments,
      setGeneratedDocuments,
      observacoesFinais,
      setObservacoesFinais,
      finalizeAtendimento,
    }),
    [
      patientName, patientDetails, pacienteId, appointmentId, appointmentTime,
      currentStep, status,
      anamneseType, anamneseData, camposAnamnese,
      evolucaoAtual, historicoAtendimentos,
      prescritos, observacoesGerais,
      documentosData, isSigned, signature, generatedDocuments,
      observacoesFinais,
    ],
  )

  return <AtendimentoContext.Provider value={value}>{children}</AtendimentoContext.Provider>
}

export function useAtendimento() {
  const ctx = useContext(AtendimentoContext)
  if (!ctx) throw new Error('useAtendimento deve ser usado dentro de AtendimentoProvider')
  return ctx
}
