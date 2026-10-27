'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Eye,
  FileText,
  Plus,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import { AtendimentoProvider, useAtendimento } from '@/contexts/atendimento-context'
import type { GeneratedDoc, HistoricoItem, PatientDetails } from '@/contexts/atendimento-context'
import { useAtendimentoHistorico } from '@/hooks/use-atendimento-historico'
import { useProntuarioLivePublish } from '@/hooks/use-prontuario-live-sync'
import { useEstoque } from '@/features/estoque/hooks/use-estoque'
import {
  PRAZO_RETORNO_INICIAL,
  PrazoRetornoSelector,
  prazoEscolhido,
  resumoPrazoRetorno,
  type PrazoRetornoValor,
} from '@/features/retornos/prazo-retorno-selector'
import { useApi } from '@/hooks/use-api'
import { usePacientes } from '@/hooks/use-pacientes'
import {
  loadDocumentTemplatesAsync,
  resetDocumentTemplateAsync,
  saveDocumentTemplateAsync,
} from '@/lib/document-templates'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { SignaturePad } from '@/components/shared/signature-pad'
import { PacienteCadastroCard } from '@/components/shared/paciente-cadastro-card'
import { AnatomyPanel } from '@/components/shared/anatomy-panel'
import { DocumentPreviewModal } from './components/document-preview-modal'
import { LabelEditorModal } from './components/label-editor-modal'
import type { LabelData } from './components/label-editor-modal'
import { GerarDocumentoModal, DocumentosEmitidosPanel } from '@/features/documentacao-gerar'
import { ExamesPacienteCard } from '@/features/gestao-pacientes/components/exames-paciente-card'
import { formatarDataHoraClinica } from '@/lib/fuso-clinica'

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Anamnese' },
  { id: 2, label: 'Prontuário' },
  { id: 3, label: 'Prescrição' },
  { id: 4, label: 'Documentos' },
  { id: 5, label: 'Conclusão' },
]

const HISTORICOS = [
  'Tabagismo',
  'Etilismo',
  'Dependência de drogas',
  'Pratica atividade física',
]

const MEDICAMENTOS = [
  'Anticoncepcional',
  'Antidepressivo',
  'Ansiolítico',
  'Sonífero',
  'Diurético',
  'Insulina',
  'Hipertensivos',
  'Medicação para colesterol',
  'Medicação para triglicerídeos',
  'Medicação para tireoide',
]

interface DocumentTemplate {
  id: string
  title: string
  type: 'fields' | 'editor'
  fields?: { label: string; placeholder: string }[]
  defaultValue?: string
}

const today = new Date().toLocaleDateString('pt-BR')

const DOCUMENT_TYPES: DocumentTemplate[] = [
  {
    id: 'atestado',
    title: 'Atestado Médico',
    type: 'fields',
    fields: [
      { label: 'Dias de Afastamento', placeholder: 'Ex: 3' },
      { label: 'Motivo', placeholder: 'Descreva o motivo do atestado...' },
    ],
  },
  {
    id: 'dieta',
    title: 'Plano Alimentar / Dieta',
    type: 'editor',
    defaultValue: 'PLANO ALIMENTAR\n\nCafé da Manhã:\n- Opção 1: ...\n\nAlmoço:\n- ...\n\nLanche:\n- ...\n\nJantar:\n- ...\n\nObservações:\n-',
  },
  {
    id: 'encaminhamento',
    title: 'Encaminhamento para Especialista',
    type: 'editor',
    defaultValue: 'ENCAMINHAMENTO MÉDICO\n\nAo Dr(a). Especialista em ...\n\nSolicito avaliação do paciente quanto a ...\n\nMotivo da Consulta:\n\nAntecedentes Relevantes:\n\nConduta Recomendada:',
  },
  {
    id: 'laudo',
    title: 'Laudo Médico',
    type: 'editor',
    defaultValue: 'LAUDO MÉDICO\n\nAvaliação:\n\nAchados Clínicos:\n\nConclusão:\n\nRecomendações:',
  },
  {
    id: 'declaracao',
    title: 'Declaração de Comparecimento',
    type: 'editor',
    defaultValue: `DECLARAÇÃO DE COMPARECIMENTO\n\nDeclaro para os devidos fins que o(a) paciente [NOME DO PACIENTE] compareceu à consulta médica nesta data (${today}).\n\nA consulta teve duração aproximada de 1 (uma) hora.\n\nEsta declaração é válida para aprovação junto ao empregador ou instituição de ensino.\n\nAtenciosamente,\n\nDr(a). [NOME DO MÉDICO]\nCRM: [NÚMERO]\nData: ${today}`,
  },
  {
    id: 'fototerapy',
    title: 'Procedimento Fototerapia',
    type: 'editor',
    defaultValue: `RELATÓRIO DE PROCEDIMENTO - FOTOTERAPIA\n\nPaciente: [NOME DO PACIENTE]\nData do Procedimento: ${today}\n\nPROCEDIMENTO REALIZADO:\nFototerapia com LED de alta potência\n\nÁREA TRATADA:\n[Descrever a área do corpo tratada]\n\nPROTOCOLO UTILIZADO:\n- Comprimento de onda: [especificar nm]\n- Potência: [especificar mW/cm²]\n- Tempo de exposição: [especificar minutos]\n- Distância do equipamento: [especificar cm]`,
  },
  {
    id: 'biomodular',
    title: 'Procedimento Biomodular Infra',
    type: 'editor',
    defaultValue: `RELATÓRIO DE PROCEDIMENTO - BIOMODULAÇÃO INFRAVERMELHO\n\nPaciente: [NOME DO PACIENTE]\nData do Procedimento: ${today}\n\nPROCEDIMENTO REALIZADO:\nBiomodulação com Infravermelho de Alta Intensidade\n\nÁREA TRATADA:\n[Descrever a região anatômica tratada]\n\nPROTOCOLO UTILIZADO:\n- Comprimento de onda: [especificar nm]\n- Potência: [especificar W]\n- Densidade de energia: [especificar J/cm²]\n- Tempo de aplicação: [especificar minutos]\n- Modo de aplicação: [contínuo/pulsado]`,
  },
]

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ currentStep }: { currentStep: number }) {
  const pct = ((currentStep - 1) / (STEPS.length - 1)) * 100
  return (
    <div className="bg-app-card dark:bg-app-card-dark p-6 rounded-integrallys-lg shadow-sm border border-app-border dark:border-app-border-dark">
      <div className="flex items-center justify-between relative px-12">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full px-20 -z-0">
          <div className="h-0.5 bg-app-bg-secondary dark:bg-app-hover w-full relative">
            <div
              className="absolute left-0 top-0 h-full bg-app-primary transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        {STEPS.map((step) => {
          const isCompleted = currentStep > step.id
          const isActive = currentStep === step.id
          return (
            <div
              key={step.id}
              className="relative z-10 flex flex-col items-center gap-2 bg-app-card dark:bg-app-card-dark px-4"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-normal border-2 transition-all ${
                  isCompleted || isActive
                    ? 'bg-app-primary border-[var(--app-primary)] text-white'
                    : 'bg-app-bg-secondary border-app-border dark:border-app-border-dark text-app-text-muted dark:bg-app-hover'
                }`}
              >
                {isCompleted ? <Check className="h-5 w-5 stroke-[3]" /> : step.id}
              </div>
              <span className={`text-xs font-normal ${isActive ? 'text-[var(--app-primary)]' : 'text-app-text-muted'}`}>
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Anamnese Section ─────────────────────────────────────────────────────────

function AnamneseSection({ onCancel, onNext }: { onCancel: () => void; onNext: () => void }) {
  const { anamneseType, setAnamneseType, anamneseData, setAnamneseData, status, patientName, appointmentTime, pacienteId } =
    useAtendimento()
  const isReadOnly = status === 'read-only'
  const [showAnatomy, setShowAnatomy] = useState(false)
  const { data: pacientes } = usePacientes()
  const pacienteSexo = useMemo(() => {
    if (!pacienteId) return undefined
    return pacientes.find((p) => p.id === pacienteId)?.gender
  }, [pacienteId, pacientes])

  const handleAnswer = (section: 'historico' | 'medicamento', item: string, value: 'sim' | 'nao') => {
    if (isReadOnly) return
    const key = `${section}:${item}`
    setAnamneseData((prev) => {
      const newHistoricos = new Set(prev.historicos)
      const newMedicamentos = new Set(prev.medicamentos)
      if (section === 'historico') {
        if (value === 'sim') newHistoricos.add(item)
        else newHistoricos.delete(item)
      } else {
        if (value === 'sim') newMedicamentos.add(item)
        else newMedicamentos.delete(item)
      }
      const newCondicoes = { ...prev.condicoes }
      if (value === 'nao') delete newCondicoes[key]
      return { ...prev, historicos: newHistoricos, medicamentos: newMedicamentos, condicoes: newCondicoes }
    })
  }

  const handleObservacao = (section: 'historico' | 'medicamento', item: string, value: string) => {
    if (isReadOnly) return
    const key = `${section}:${item}`
    setAnamneseData((prev) => ({ ...prev, condicoes: { ...prev.condicoes, [key]: value } }))
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-normal text-app-text-primary dark:text-white">Anamnese</h2>
        <p className="text-app-text-muted dark:text-app-text-muted">Preencha a ficha de anamnese conforme o tipo de consulta</p>
      </div>

      {/* Patient card */}
      <div className="bg-app-bg-secondary dark:bg-app-card-dark/50 border border-app-border dark:border-app-border-dark rounded-[12px] p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <User className="h-5 w-5 text-app-text-muted" />
          <div>
            <p className="text-sm text-app-text-muted">Paciente</p>
            <p className="font-normal text-app-text-primary dark:text-white text-base">{patientName}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-app-text-muted">Horário</p>
          <p className="font-normal text-app-text-primary dark:text-white text-base">{appointmentTime || '00:00'} - 1h</p>
        </div>
      </div>

      {/* Type selector */}
      <div className="space-y-2">
        <Label className="font-normal text-app-text-primary dark:text-white">Tipo de Anamnese *</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { value: 'consulta', label: 'Consulta', desc: 'Primeira vez / Avaliação inicial completa', color: 'blue' },
            { value: 'reconsulta', label: 'Reconsulta', desc: 'Retorno / Avaliação de evolução', color: 'primary' },
          ].map((opt) => {
            const isSelected = anamneseType === opt.value
            return (
              <div
                key={opt.value}
                onClick={() => !isReadOnly && setAnamneseType(opt.value as 'consulta' | 'reconsulta')}
                className={`cursor-pointer p-6 rounded-integrallys-lg border-2 transition-all flex items-center gap-4 ${
                  isSelected
                    ? 'border-[var(--app-primary)] bg-[var(--app-primary)]/5'
                    : 'border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark'
                } ${isReadOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    isSelected ? 'border-[var(--app-primary)]' : 'border-app-border'
                  }`}
                >
                  {isSelected && <div className="w-3 h-3 rounded-full bg-app-primary" />}
                </div>
                <div>
                  <h4 className="font-normal text-app-text-primary dark:text-white">{opt.label}</h4>
                  <p className="text-sm text-app-text-muted">{opt.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Vitals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <Label className="font-normal text-app-text-primary dark:text-white">Data *</Label>
          <div className="relative">
            <Input
              defaultValue={new Date().toISOString().split('T')[0]}
              readOnly
              className="pl-10 h-11 bg-app-bg-secondary/50 dark:bg-app-card-dark/50 border-app-border dark:border-app-border-dark rounded-integrallys font-normal"
            />
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-app-text-muted" />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="font-normal text-app-text-primary dark:text-white">Peso (kg) *</Label>
          <Input
            placeholder="Ex: 70.5"
            value={anamneseData.peso}
            onChange={(e) => setAnamneseData((p) => ({ ...p, peso: e.target.value }))}
            readOnly={isReadOnly}
            className="h-11 px-4 bg-app-bg-secondary/50 dark:bg-app-card-dark/50 border-app-border dark:border-app-border-dark rounded-integrallys font-normal"
          />
        </div>
        <div className="space-y-2">
          <Label className="font-normal text-app-text-primary dark:text-white">Altura (cm) *</Label>
          <Input
            placeholder="Ex: 175"
            value={anamneseData.altura}
            onChange={(e) => setAnamneseData((p) => ({ ...p, altura: e.target.value }))}
            readOnly={isReadOnly}
            className="h-11 px-4 bg-app-bg-secondary/50 dark:bg-app-card-dark/50 border-app-border dark:border-app-border-dark rounded-integrallys font-normal"
          />
        </div>
      </div>

      {/* Conditional content */}
      {anamneseType === 'consulta' ? (
        <>
          {/* Blue banner */}
          <div className="app-status-info border-l-4 border-blue-500 p-4 rounded-r-[10px]">
            <p className="text-blue-700 dark:text-blue-300 font-normal text-sm">
              <span className="font-normal">Consulta (Primeira Vez)</span> — Preencha todos os campos de histórico do paciente
            </p>
          </div>

          {/* Queixa */}
          <div className="space-y-2">
            <Label className="font-normal text-app-text-primary dark:text-white">Queixa Principal *</Label>
            <Textarea
              placeholder="Descreva a queixa principal do paciente..."
              value={anamneseData.queixa}
              onChange={(e) => setAnamneseData((p) => ({ ...p, queixa: e.target.value }))}
              readOnly={isReadOnly}
              className="min-h-[100px] p-4 bg-app-bg-secondary/50 dark:bg-app-card-dark/50 border-app-border dark:border-app-border-dark rounded-integrallys font-normal resize-none"
            />
          </div>

          {/* Históricos */}
          <div className="space-y-4">
            <h3 className="font-normal text-app-text-primary dark:text-white text-lg">Históricos Diários</h3>
            <div className="grid gap-3">
              {HISTORICOS.map((item) => {
                const isYes = anamneseData.historicos.has(item)
                return (
                  <div key={item} className="bg-app-card dark:bg-app-card-dark border border-app-border dark:border-app-border-dark p-4 rounded-[12px] space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-normal text-app-text-primary dark:text-gray-200">{item}?</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleAnswer('historico', item, 'sim')}
                          disabled={isReadOnly}
                          className={`px-3 py-1 rounded-full text-xs font-normal border transition-all ${
                            isYes
                              ? 'bg-app-primary border-[var(--app-primary)] text-white'
                              : 'border-app-border text-app-text-secondary hover:border-[var(--app-primary)]/40 hover:text-[var(--app-primary)]'
                          } ${isReadOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                          Sim
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAnswer('historico', item, 'nao')}
                          disabled={isReadOnly}
                          className={`px-3 py-1 rounded-full text-xs font-normal border transition-all ${
                            !isYes
                              ? 'bg-app-bg-secondary/60 border-app-border text-app-text-secondary'
                              : 'border-app-border text-app-text-secondary hover:border-[var(--app-primary)]/40'
                          } ${isReadOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                          Não
                        </button>
                      </div>
                    </div>
                    {isYes && (
                      <div className="space-y-2">
                        <Label className="text-xs font-normal text-app-text-muted uppercase tracking-wider">
                          Qual? / Observações
                        </Label>
                        <Textarea
                          value={anamneseData.condicoes[`historico:${item}`] || ''}
                          onChange={(e) => handleObservacao('historico', item, e.target.value)}
                          readOnly={isReadOnly}
                          className="min-h-[80px] bg-app-bg-secondary/50 dark:bg-app-card-dark/50 border-app-border dark:border-app-border-dark rounded-integrallys font-normal resize-none"
                          placeholder="Descreva..."
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Medicamentos */}
          <div className="space-y-4 p-4 bg-blue-50/30 dark:bg-blue-900/5 rounded-[16px]">
            <h3 className="font-normal text-app-text-primary dark:text-white text-lg">Uso de Medicamentos</h3>
            <div className="grid gap-3">
              {MEDICAMENTOS.map((item) => {
                const isYes = anamneseData.medicamentos.has(item)
                return (
                  <div key={item} className="bg-app-card dark:bg-app-card-dark border border-app-border dark:border-app-border-dark p-4 rounded-[12px] space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-normal text-app-text-primary dark:text-gray-200">{item}?</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleAnswer('medicamento', item, 'sim')}
                          disabled={isReadOnly}
                          className={`px-3 py-1 rounded-full text-xs font-normal border transition-all ${
                            isYes
                              ? 'bg-app-primary border-[var(--app-primary)] text-white'
                              : 'border-app-border text-app-text-secondary hover:border-[var(--app-primary)]/40 hover:text-[var(--app-primary)]'
                          } ${isReadOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                          Sim
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAnswer('medicamento', item, 'nao')}
                          disabled={isReadOnly}
                          className={`px-3 py-1 rounded-full text-xs font-normal border transition-all ${
                            !isYes
                              ? 'bg-app-bg-secondary/60 border-app-border text-app-text-secondary'
                              : 'border-app-border text-app-text-secondary hover:border-[var(--app-primary)]/40'
                          } ${isReadOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                          Não
                        </button>
                      </div>
                    </div>
                    {isYes && (
                      <div className="space-y-2">
                        <Label className="text-xs font-normal text-app-text-muted uppercase tracking-wider">
                          Qual? / Observações
                        </Label>
                        <Textarea
                          value={anamneseData.condicoes[`medicamento:${item}`] || ''}
                          onChange={(e) => handleObservacao('medicamento', item, e.target.value)}
                          readOnly={isReadOnly}
                          className="min-h-[80px] bg-app-bg-secondary/50 dark:bg-app-card-dark/50 border-app-border dark:border-app-border-dark rounded-integrallys font-normal resize-none"
                          placeholder="Descreva..."
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Diagnose */}
          <div className="space-y-2">
            <Label className="font-normal text-app-text-primary dark:text-white">Diagnose *</Label>
            <Textarea
              placeholder="Registre o diagnóstico do especialista..."
              value={anamneseData.diagnostico}
              onChange={(e) => setAnamneseData((p) => ({ ...p, diagnostico: e.target.value }))}
              readOnly={isReadOnly}
              className="min-h-[80px] bg-app-bg-secondary/50 dark:bg-app-card-dark/50 border-app-border dark:border-app-border-dark rounded-integrallys font-normal resize-none"
            />
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAnatomy((prev) => !prev)}
                className="h-10 rounded-integrallys"
              >
                {showAnatomy ? 'Ocultar Anatomia 3D' : 'Visualizar Anatomia 3D'}
              </Button>
            </div>
            {showAnatomy && (
              <div className="rounded-[12px] border border-app-border dark:border-app-border-dark bg-app-bg-secondary dark:bg-app-card-dark/50 p-3">
                <AnatomyPanel sexo={pacienteSexo} />
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Green banner */}
          <div className="bg-green-50 dark:bg-transparent border-l-4 border-green-500 p-4 rounded-r-[10px]">
            <p className="text-green-700 dark:text-green-300 font-normal text-sm">
              <span className="font-normal">Reconsulta (Retorno)</span> — Avalie a evolução do tratamento do paciente
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="font-normal text-app-text-primary dark:text-white">Avaliação do Cliente *</Label>
              <Textarea
                placeholder="Registre a percepção do especialista sobre o estado atual do paciente..."
                value={anamneseData.avaliacaoCliente}
                onChange={(e) => setAnamneseData((p) => ({ ...p, avaliacaoCliente: e.target.value }))}
                readOnly={isReadOnly}
                className="min-h-[80px] p-4 bg-app-bg-secondary/50 dark:bg-app-card-dark/50 border-app-border dark:border-app-border-dark rounded-integrallys font-normal resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-normal text-app-text-primary dark:text-white">Resultados *</Label>
              <Textarea
                placeholder="Detalhe os resultados obtidos até o momento..."
                value={anamneseData.resultados}
                onChange={(e) => setAnamneseData((p) => ({ ...p, resultados: e.target.value }))}
                readOnly={isReadOnly}
                className="min-h-[80px] p-4 bg-app-bg-secondary/50 dark:bg-app-card-dark/50 border-app-border dark:border-app-border-dark rounded-integrallys font-normal resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-normal text-app-text-primary dark:text-white">Indicação para os Próximos Tratamentos *</Label>
              <Textarea
                placeholder="Planejamento dos próximos passos ou encaminhamentos..."
                value={anamneseData.indicacaoTratamento}
                onChange={(e) => setAnamneseData((p) => ({ ...p, indicacaoTratamento: e.target.value }))}
                readOnly={isReadOnly}
                className="min-h-[80px] bg-app-bg-secondary/50 dark:bg-app-card-dark/50 border-app-border dark:border-app-border-dark rounded-integrallys font-normal resize-none"
              />
            </div>
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-6 border-t border-app-border dark:border-app-border-dark">
        <Button
          variant="outline"
          onClick={onCancel}
          className="h-12 px-6 rounded-integrallys border-app-border dark:border-app-border-dark font-normal"
        >
          Cancelar Atendimento
        </Button>
        <Button
          onClick={onNext}
          className="h-12 px-8 bg-app-primary hover:bg-app-primary-hover text-white rounded-integrallys font-normal flex items-center gap-2"
        >
          Próximo: Prontuário <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ─── Prontuário Section ──────────────────────────────────────────────────────

function ProntuarioSection({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { evolucaoAtual, setEvolucaoAtual, status, anamneseData, anamneseType, historicoAtendimentos, pacienteId } =
    useAtendimento()
  const isReadOnly = status === 'read-only'
  const [expandedDate, setExpandedDate] = useState<string | null>(null)

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-xl font-normal text-app-text-primary dark:text-white">Prontuário do Paciente</h2>
        <p className="text-app-text-muted">Visualize o histórico completo e registre a evolução do atendimento</p>
      </div>

      {/* Anamnese summary */}
      <div className="bg-blue-50/50 dark:bg-transparent p-6 rounded-integrallys-lg border border-transparent flex items-start gap-4">
        <ClipboardList className="h-6 w-6 text-app-text-primary dark:text-white mt-1 shrink-0" />
        <div className="w-full">
          <h4 className="font-normal text-app-text-primary dark:text-white mb-2">
            Anamnese registrada — {anamneseType === 'consulta' ? 'Consulta (Primeira Vez)' : 'Reconsulta'}
          </h4>
          <p className="text-app-text-muted font-normal mb-4">
            {anamneseData.queixa || 'Nenhuma queixa registrada'}
          </p>
          <div className="flex justify-between max-w-md text-sm text-app-text-muted">
            <span>Peso: {anamneseData.peso || '-'} kg</span>
            <span>Altura: {anamneseData.altura || '-'} cm</span>
          </div>
        </div>
      </div>

      {/* Exames externos do paciente — read-only durante o atendimento */}
      {pacienteId && (
        <div className="rounded-integrallys-lg border border-app-border dark:border-app-border-dark p-6">
          <ExamesPacienteCard pacienteId={pacienteId} readOnly />
        </div>
      )}

      {/* Historical consultations */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-normal text-app-text-primary dark:text-white">Histórico de Consultas Anteriores</h3>
          <Badge className="bg-app-primary dark:bg-blue-900/40 dark:text-[var(--app-info-text)] text-white border-0 font-normal px-3 py-1 rounded-full">
            {historicoAtendimentos.length} consultas
          </Badge>
        </div>
        <div className="space-y-4">
          {historicoAtendimentos.length === 0 && (
            <div className="rounded-[12px] border border-dashed border-app-border dark:border-app-border-dark p-8 text-center text-sm text-app-text-muted">
              Nenhuma consulta anterior registrada
            </div>
          )}
          {historicoAtendimentos.map((consulta: HistoricoItem) => (
            <div
              key={consulta.date}
              className="bg-app-card dark:bg-app-card-dark border border-app-border dark:border-app-border-dark rounded-integrallys-lg overflow-hidden"
            >
              <div
                className="p-6 flex items-center justify-between cursor-pointer hover:bg-app-bg-secondary dark:hover:bg-app-hover"
                onClick={() => setExpandedDate(expandedDate === consulta.date ? null : consulta.date)}
              >
                <div>
                  <p className="font-normal text-app-text-primary dark:text-white text-lg">
                    {consulta.anamneseType === 'reconsulta' ? 'Reconsulta' : 'Consulta'} — {consulta.date}
                  </p>
                  <p className="text-app-text-muted text-sm">{consulta.doctor}</p>
                  {consulta.prescricoes.length > 0 && (
                    <p className="text-app-text-muted text-xs mt-1">
                      Produtos:{' '}
                      {consulta.prescricoes
                        .map((item) => (item.posologia ? `${item.produto} (${item.posologia})` : item.produto))
                        .join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 text-app-text-muted text-sm">
                  Ver detalhes
                  {expandedDate === consulta.date ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>
              {expandedDate === consulta.date && (
                <div className="px-6 pb-6 pt-0 space-y-6 border-t border-app-border dark:border-app-border-dark">
                  <div className="mt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <ClipboardList className="h-4 w-4 text-app-text-muted" />
                      <h4 className="font-normal text-app-text-primary dark:text-white/80">
                        Anamnese — {consulta.anamneseType === 'reconsulta' ? 'Reconsulta' : 'Consulta (Primeira Vez)'}
                      </h4>
                    </div>
                    <div className="pl-6 space-y-4">
                      <div className="flex gap-12 text-app-text-secondary dark:text-white/60">
                        <span>Peso: <span className="text-app-text-primary dark:text-white font-normal">{consulta.anamnese.weight} kg</span></span>
                        <span>Altura: <span className="text-app-text-primary dark:text-white font-normal">{consulta.anamnese.height} cm</span></span>
                      </div>
                      <div>
                        <p className="text-app-text-muted text-sm mb-1">Queixa Principal:</p>
                        <p className="text-app-text-primary dark:text-white">{consulta.anamnese.queixa}</p>
                      </div>
                      {consulta.anamnese.historicos.length > 0 && (
                        <div>
                          <p className="text-app-text-muted text-sm mb-2">Históricos:</p>
                          <div className="space-y-2">
                            {consulta.anamnese.historicos.map((hist, idx) => (
                              <div key={idx} className="flex items-start gap-2">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-app-primary shrink-0" />
                                <span className="text-app-text-primary dark:text-white">
                                  {hist.label}: <span className="font-normal">{hist.value}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <p className="text-app-text-muted text-sm mb-1">Diagnose:</p>
                        <p className="text-app-text-primary dark:text-white">{consulta.anamnese.diagnose}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-normal text-app-text-primary dark:text-white/80 mb-3">Prontuário / Evolução</h4>
                    <div className="bg-app-bg-secondary/50 dark:bg-app-card-dark/50 p-4 rounded-integrallys text-app-text-primary dark:text-white">
                      {consulta.evolucao}
                    </div>
                  </div>
                  {consulta.prescricoes.length > 0 && (
                    <div>
                      <h4 className="font-normal text-app-text-primary dark:text-white/80 mb-3">Prescrições ({consulta.prescricoes.length})</h4>
                      <div className="space-y-2">
                        {consulta.prescricoes.map((item, idx) => {
                          const titulo = item.quantidade > 1
                            ? `${item.quantidade}× ${item.produto}`
                            : item.produto
                          return (
                            <div key={idx} className="bg-app-card dark:bg-app-card-dark border border-app-border dark:border-app-border-dark p-4 rounded-integrallys">
                              <div className="flex items-start justify-between gap-3">
                                <p className="font-normal text-app-text-primary dark:text-white">{titulo}</p>
                                {item.valorUnitario != null && (
                                  <span className="text-xs text-app-text-muted whitespace-nowrap">
                                    {item.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </span>
                                )}
                              </div>
                              {item.posologia && (
                                <p className="text-sm text-app-text-muted mt-1">
                                  <span className="font-medium">Posologia:</span> {item.posologia}
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {consulta.documentos && consulta.documentos.length > 0 && (
                    <div>
                      <h4 className="font-normal text-app-text-primary dark:text-white/80 mb-3">
                        Documentos emitidos ({consulta.documentos.length})
                      </h4>
                      <div className="space-y-2">
                        {consulta.documentos.map((doc) => (
                          <div
                            key={doc.id}
                            className="bg-app-card dark:bg-app-card-dark border border-app-border dark:border-app-border-dark p-4 rounded-integrallys flex items-center gap-3"
                          >
                            <FileText className="h-4 w-4 text-app-text-secondary dark:text-white/70" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-app-text-primary dark:text-white truncate">{doc.titulo}</p>
                              <p className="text-xs text-app-text-muted">
                                {formatarDataHoraClinica(doc.geradoEm)}
                              </p>
                            </div>
                            {doc.pdfUrl ? (
                              <a
                                href={doc.pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-app-primary hover:underline"
                              >
                                Abrir PDF
                              </a>
                            ) : (
                              <span className="text-xs text-app-text-muted">Sem PDF</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Current evolution */}
      <div className="space-y-2 pt-4">
        <Label className="font-normal text-app-text-primary dark:text-white text-base">Evolução do Atendimento Atual *</Label>
        <Textarea
          placeholder="Registre a evolução do atendimento atual, diagnóstico, conduta médica..."
          className="min-h-[120px] p-4 bg-app-bg-secondary/50 dark:bg-app-card-dark/50 border-app-border dark:border-app-border-dark rounded-integrallys font-normal resize-none"
          value={evolucaoAtual}
          onChange={(e) => setEvolucaoAtual(e.target.value)}
          readOnly={isReadOnly}
        />
      </div>

      <div className="flex items-center justify-between pt-6 border-t border-app-border dark:border-app-border-dark">
        <Button variant="outline" onClick={onBack} className="h-12 px-6 rounded-integrallys font-normal flex items-center gap-2">
          <ChevronLeft className="h-4 w-4" /> Voltar: Anamnese
        </Button>
        <Button onClick={onNext} className="h-12 px-8 bg-app-primary hover:bg-app-primary-hover text-white rounded-integrallys font-normal flex items-center gap-2">
          Próximo: Prescrição <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ─── Prescrição Section ──────────────────────────────────────────────────────

function PrescricaoSection({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { prescritos, setPrescritos, status, observacoesGerais, setObservacoesGerais, patientName } = useAtendimento()
  const { data: estoqueItems } = useEstoque()
  const [searchTerm, setSearchTerm] = useState('')
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false)
  const [selectedLabelData, setSelectedLabelData] = useState<LabelData | null>(null)
  const isReadOnly = status === 'read-only'

  const stockItems = useMemo(
    () =>
      estoqueItems
        .filter(
          (item) =>
            Number(item.quantidade ?? 0) > 0 &&
            !String(item.status ?? '').toLowerCase().includes('indispon'),
        )
        .map((item) => ({
          id: item.id,
          nome: item.produto,
          categoria: item.categoria,
          aguaBoa: item.quantidade,
          querencia: 0,
          total: item.quantidade,
        })),
    [estoqueItems],
  )

  const filteredStock = stockItems.filter(
    (item) =>
      item.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.categoria.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleOpenLabelEditor = (item: (typeof prescritos)[0]) => {
    setSelectedLabelData({
      patientName: patientName || 'Paciente',
      productName: item.nome,
      composition: item.categoria,
      usage: item.posologia || 'Conforme orientação médica',
      validity: new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toLocaleDateString('pt-BR'),
    })
    setIsLabelModalOpen(true)
  }

  const handleAddItem = (item: (typeof stockItems)[0]) => {
    if (isReadOnly) return
    if (prescritos.find((p) => p.id === item.id)) return
    setPrescritos((prev) => [
      { id: item.id, nome: item.nome, categoria: item.categoria, quantidade: 1, posologia: '' },
      ...prev,
    ])
  }

  const handleRemoveItem = (id: string) => {
    if (isReadOnly) return
    setPrescritos((prev) => prev.filter((p) => p.id !== id))
  }

  const updateItem = (id: string, field: 'quantidade' | 'posologia', value: number | string) => {
    if (isReadOnly) return
    setPrescritos((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-xl font-normal text-app-text-primary dark:text-white">Prescrição de Medicamentos/Suplementos</h2>
        <p className="text-app-text-muted">Selecione medicamentos do estoque e defina a posologia</p>
      </div>

      {/* Prescribed items */}
      {prescritos.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-normal text-app-text-primary dark:text-white">Medicamentos Prescritos ({prescritos.length})</h3>
          <div className="space-y-4">
            {prescritos.map((item) => {
              const stockRef = stockItems.find((s) => s.id === item.id)
              return (
                <div key={item.id} className="bg-app-card dark:bg-app-card-dark border border-app-border dark:border-app-border-dark rounded-[12px] p-6 shadow-sm relative">
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleOpenLabelEditor(item)}
                      className="bg-app-primary hover:bg-app-primary-hover text-white h-9 px-3 rounded-integrallys font-normal flex items-center gap-2"
                    >
                      <Tag className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline text-xs">Imprimir Etiqueta</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-400 hover:text-[var(--app-danger-text)]"
                      onClick={() => handleRemoveItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mb-4">
                    <h4 className="font-normal text-app-text-primary dark:text-white text-lg">{item.nome}</h4>
                    <p className="text-app-text-muted text-sm">Categoria: {item.categoria}</p>
                    {stockRef && (
                      <div className="flex gap-4 text-xs text-app-text-muted mt-1">
                        <span>Água Boa: {stockRef.aguaBoa}</span>
                        <span>Querência: {stockRef.querencia}</span>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <Label className="font-normal text-app-text-primary dark:text-white text-sm">Quantidade</Label>
                      <Input
                        type="number"
                        value={item.quantidade}
                        onChange={(e) => updateItem(item.id, 'quantidade', parseInt(e.target.value) || 0)}
                        min={1}
                        className="h-11 bg-app-bg-secondary/50 dark:bg-app-card-dark/50 border-app-border dark:border-app-border-dark rounded-integrallys font-normal"
                      />
                    </div>
                    <div className="md:col-span-3 space-y-2">
                      <Label className="font-normal text-app-text-primary dark:text-white text-sm">Posologia *</Label>
                      <Input
                        placeholder="Ex: Tomar 1 cápsula 2x ao dia, após refeições"
                        value={item.posologia}
                        onChange={(e) => updateItem(item.id, 'posologia', e.target.value)}
                        className="h-11 px-4 bg-app-bg-secondary/50 dark:bg-app-card-dark/50 border-app-border dark:border-app-border-dark rounded-integrallys font-normal"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Stock section */}
      <div className="space-y-4">
        <h3 className="font-normal text-app-text-primary dark:text-white">
          Estoque Disponível ({filteredStock.length} produtos)
        </h3>
        <div className="relative">
          <Input
            placeholder="Buscar suplementos por nome ou categoria..."
            className="pl-10 h-12 bg-app-bg-secondary dark:bg-app-card-dark/50 border-app-border dark:border-app-border-dark rounded-integrallys font-normal text-base"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-app-text-muted" />
        </div>
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          {filteredStock.map((item) => {
            const isAdded = prescritos.some((p) => p.id === item.id)
            return (
              <div
                key={item.id}
                className="bg-app-card dark:bg-app-card-dark border border-app-border dark:border-app-border-dark p-4 rounded-[12px] flex items-center justify-between"
              >
                <div>
                  <h4 className="font-normal text-app-text-primary dark:text-white text-lg">{item.nome}</h4>
                  <p className="text-app-text-muted text-sm">{item.categoria}</p>
                  <div className="flex gap-4 text-xs text-app-text-muted mt-1">
                    <span>Água Boa: {item.aguaBoa}</span>
                    <span>Querência: {item.querencia}</span>
                    <span>Total: {item.total}</span>
                  </div>
                </div>
                <Button
                  variant={isAdded ? 'ghost' : 'outline'}
                  onClick={() => !isAdded && handleAddItem(item)}
                  disabled={isAdded || isReadOnly}
                  className={`h-10 px-4 rounded-integrallys font-normal gap-2 ${isAdded ? 'text-app-text-muted cursor-default hover:bg-transparent' : ''}`}
                >
                  <Plus className="h-4 w-4" />
                  {isAdded ? 'Adicionado' : 'Adicionar'}
                </Button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Observations */}
      <div className="space-y-2 pt-4 border-t border-app-border dark:border-app-border-dark">
        <Label className="font-normal text-app-text-primary dark:text-white text-base">Observações da Prescrição</Label>
        <Textarea
          placeholder="Orientações gerais para o paciente sobre o uso dos medicamentos..."
          value={observacoesGerais}
          onChange={(e) => setObservacoesGerais(e.target.value)}
          readOnly={isReadOnly}
          className="min-h-[100px] p-4 bg-app-bg-secondary/50 dark:bg-app-card-dark/50 border-app-border dark:border-app-border-dark rounded-integrallys font-normal resize-none"
        />
      </div>

      <div className="flex items-center justify-between pt-6 border-t border-app-border dark:border-app-border-dark">
        <Button variant="outline" onClick={onBack} className="h-12 px-6 rounded-integrallys font-normal flex items-center gap-2">
          <ChevronLeft className="h-4 w-4" /> Voltar: Prontuário
        </Button>
        <Button onClick={onNext} className="h-12 px-8 bg-app-primary hover:bg-app-primary-hover text-white rounded-integrallys font-normal flex items-center gap-2">
          Próximo: Documentos <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <LabelEditorModal isOpen={isLabelModalOpen} onClose={() => setIsLabelModalOpen(false)} data={selectedLabelData ?? undefined} />
    </div>
  )
}

// ─── Documentos Section ──────────────────────────────────────────────────────

function DocumentosSection({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const {
    status,
    patientName,
    patientDetails,
    pacienteId,
    appointmentId,
    isSigned,
    setIsSigned,
    signature,
    setSignature,
    setGeneratedDocuments,
  } = useAtendimento()
  const isReadOnly = status === 'read-only'

  const [selectedDocs, setSelectedDocs] = useState<string[]>([])
  const [docData, setDocData] = useState<Record<string, Record<string, string>>>({})
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [showGerarDocumentoModal, setShowGerarDocumentoModal] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<{ title: string; content: string } | null>(null)
  const [templates, setTemplates] = useState<Record<string, string>>({})

  useEffect(() => {
    // SEC-05 fechado: única fonte = API. Helpers sync/localStorage foram
    // removidos do `document-templates.ts` (Agente 19). Slugs ausentes no
    // admin caem no `defaultValue` do `DocumentTemplate` via `getTemplateContent`.
    void (async () => {
      const apiTemplates = await loadDocumentTemplatesAsync()
      setTemplates(apiTemplates)
    })()
  }, [])

  const authenticationId = useMemo(
    () =>
      `${patientName}-${selectedDocs.join('-')}`
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(0, 10)
        .toUpperCase()
        .padEnd(10, 'X'),
    [patientName, selectedDocs],
  )

  const signatureAuthId = useMemo(
    () =>
      `${patientName}-${selectedDocs.length}`
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(0, 8)
        .toUpperCase()
        .padEnd(8, 'X'),
    [patientName, selectedDocs.length],
  )

  const getTemplateContent = (doc: DocumentTemplate) => templates[doc.id] ?? doc.defaultValue ?? ''

  const getDocContent = (doc: DocumentTemplate) => {
    const base = docData[doc.id]?.content ?? getTemplateContent(doc)
    return base.replace('[NOME DO PACIENTE]', patientName || 'Paciente')
  }

  const toggleDoc = (doc: DocumentTemplate) => {
    if (isReadOnly) return
    setSelectedDocs((prev) =>
      prev.includes(doc.id) ? prev.filter((d) => d !== doc.id) : [...prev, doc.id],
    )
    if (doc.type === 'editor' && !docData[doc.id]?.content) {
      setDocData((prev) => ({ ...prev, [doc.id]: { ...prev[doc.id], content: getTemplateContent(doc) } }))
    }
  }

  const updateDocData = (id: string, field: string, value: string) => {
    setDocData((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  const handleSaveTemplate = async (doc: DocumentTemplate) => {
    const content = docData[doc.id]?.content ?? doc.defaultValue ?? ''
    const next = { ...templates, [doc.id]: content }
    setTemplates(next)
    // SEC-05 fechado: persistência só via API. Se o slug não está cadastrado
    // no admin (`saveDocumentTemplateAsync` retorna `false`), avisa o usuário —
    // não há mais fallback de localStorage.
    const ok = await saveDocumentTemplateAsync(doc.id, content)
    if (!ok) {
      toast.error('Template não cadastrado nesta unidade. Cadastre em Configurações → Documentos antes de personalizar.')
    }
  }

  const handleResetTemplate = async (doc: DocumentTemplate) => {
    const next = { ...templates }
    delete next[doc.id]
    setTemplates(next)
    setDocData((prev) => ({ ...prev, [doc.id]: { ...prev[doc.id], content: doc.defaultValue || '' } }))
    const ok = await resetDocumentTemplateAsync(doc.id)
    if (!ok) {
      toast.error('Não foi possível restaurar o template no servidor.')
    }
  }

  const buildGeneratedDocuments = (): GeneratedDoc[] =>
    selectedDocs.flatMap((docId) => {
      const doc = DOCUMENT_TYPES.find((d) => d.id === docId)
      if (!doc) return []
      const documento =
        doc.type === 'fields' ? JSON.stringify(docData[doc.id] ?? {}) : getDocContent(doc)
      return [{ tipo: doc.id, categoria: doc.title, documento: signature ? `${documento}\n\nAssinatura: ${signature}` : documento }]
    })

  const handleNextClick = () => {
    setGeneratedDocuments(buildGeneratedDocuments())
    onNext()
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-normal text-app-text-primary dark:text-white">Documentos Adicionais</h3>
          <p className="text-app-text-muted">Gere atestados, dietas, encaminhamentos, laudos, declarações e documentos de procedimentos</p>
        </div>
        <div className="flex items-center gap-2">
          {pacienteId && (
            <Button
              variant="outline"
              onClick={() => setShowGerarDocumentoModal(true)}
              disabled={isReadOnly}
              className="h-11 px-4 rounded-[12px] font-normal flex items-center gap-2 border-app-border dark:border-app-border-dark"
            >
              <FileText className="h-4 w-4" />
              Usar modelo da clínica
            </Button>
          )}
          {!isSigned && selectedDocs.length > 0 && (
            <Button
              onClick={() => setShowSignatureModal(true)}
              className="h-11 px-6 bg-app-primary hover:bg-app-primary-hover text-white rounded-[12px] font-normal flex items-center gap-2"
            >
              <ShieldCheck className="h-4 w-4" />
              Assinar documentos selecionados
            </Button>
          )}
        </div>
      </div>

      {pacienteId && (
        <GerarDocumentoModal
          open={showGerarDocumentoModal}
          onOpenChange={setShowGerarDocumentoModal}
          pacienteId={pacienteId}
          pacienteNome={patientName}
          pacienteCpf={patientDetails?.cpf}
          agendamentoId={appointmentId ?? null}
        />
      )}

      {/* Signature dialog */}
      <Dialog open={showSignatureModal} onOpenChange={setShowSignatureModal}>
        <DialogContent className="p-8 bg-app-card dark:bg-app-card-dark border-none shadow-2xl">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-[var(--app-primary)]" />
              </div>
              <div>
                <h3 className="text-lg font-normal text-app-text-primary dark:text-white">Assinatura Eletrônica</h3>
                <p className="text-xs text-app-text-muted">Sua assinatura manuscrita será aplicada aos documentos</p>
              </div>
            </div>
            <SignaturePad
              onCancel={() => setShowSignatureModal(false)}
              onSave={(sig) => {
                setSignature(sig)
                setIsSigned(true)
                setShowSignatureModal(false)
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Document list */}
      <div className="space-y-4">
        {DOCUMENT_TYPES.map((doc) => {
          const isSelected = selectedDocs.includes(doc.id)
          return (
            <div
              key={doc.id}
              className="bg-app-card dark:bg-app-card-dark border border-app-border dark:border-app-border-dark rounded-[12px] overflow-hidden transition-all duration-200"
            >
              <div
                className="p-4 flex items-center gap-4 cursor-pointer hover:bg-app-bg-secondary dark:hover:bg-app-hover transition-colors"
                onClick={() => toggleDoc(doc)}
              >
                <div
                  className={`h-6 w-6 rounded border flex items-center justify-center transition-colors shrink-0 ${
                    isSelected
                      ? 'bg-app-primary border-[var(--app-primary)] text-white'
                      : 'bg-white dark:bg-transparent border-app-border dark:border-app-border-dark'
                  }`}
                >
                  {isSelected && <Check className="h-4 w-4" />}
                </div>
                <div className="flex items-center justify-between flex-1">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-app-text-primary dark:text-white" />
                    <span className="font-normal text-app-text-primary dark:text-white">{doc.title}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {isSelected && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setPreviewDoc({ title: doc.title, content: getDocContent(doc) })
                        }}
                        className="h-8 px-3 rounded-full text-xs font-normal text-[var(--app-primary)] hover:bg-blue-50"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> Visualizar
                      </Button>
                    )}
                    {isSigned && isSelected && (
                      <Badge className="bg-[var(--app-success-text)] text-white border-none font-normal px-3 py-1 rounded-full text-xs">
                        Assinado digitalmente
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {isSelected && (
                <div className="p-6 pt-0">
                  <div className="pt-4 border-t border-app-border dark:border-app-border-dark space-y-4">
                    {doc.type === 'fields' && doc.fields && (
                      <div className="space-y-4">
                        {doc.fields.map((field, idx) => (
                          <div key={idx} className="space-y-2">
                            <Label className="font-normal text-app-text-primary dark:text-white">{field.label}</Label>
                            <Input
                              placeholder={field.placeholder}
                              className="h-11 bg-app-bg-secondary/50 dark:bg-app-card-dark/50 border-app-border dark:border-app-border-dark rounded-integrallys font-normal"
                              value={docData[doc.id]?.[field.label] || ''}
                              onChange={(e) => updateDocData(doc.id, field.label, e.target.value)}
                              disabled={isReadOnly}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {doc.type === 'editor' && (
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <Label className="font-normal text-app-text-primary dark:text-white">Modelo do documento (editável)</Label>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleSaveTemplate(doc)}
                              disabled={isReadOnly}
                              className="h-8 px-3 rounded-full text-xs font-normal"
                            >
                              Salvar modelo
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResetTemplate(doc)}
                              disabled={isReadOnly}
                              className="h-8 px-3 rounded-full text-xs font-normal text-app-text-muted"
                            >
                              Restaurar padrão
                            </Button>
                          </div>
                        </div>
                        <Textarea
                          className="min-h-[300px] p-4 bg-app-bg-secondary/50 dark:bg-app-card-dark/50 border-app-border dark:border-app-border-dark rounded-integrallys font-mono text-sm leading-relaxed whitespace-pre-wrap"
                          value={docData[doc.id]?.content ?? getTemplateContent(doc)}
                          onChange={(e) => updateDocData(doc.id, 'content', e.target.value)}
                          disabled={isReadOnly}
                        />
                      </div>
                    )}

                    {isSigned && (
                      <div className="mt-6 p-4 rounded-[16px] border border-[var(--app-primary)]/20 bg-[var(--app-primary)]/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-white dark:bg-app-card-dark border border-[var(--app-primary)]/30 flex items-center justify-center">
                            <ShieldCheck className="h-6 w-6 text-[var(--app-primary)]" />
                          </div>
                          <div>
                            <p className="text-sm font-normal text-app-text-primary dark:text-white">Documento assinado digitalmente</p>
                            <p className="text-xs text-app-text-muted">Autenticação: {authenticationId}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Signature summary */}
      <div className="p-8 rounded-[24px] bg-white dark:bg-app-bg-dark border border-app-border dark:border-app-border-dark/30 shadow-sm space-y-6">
        <div className="space-y-1">
          <h3 className="text-lg font-normal text-app-text-primary dark:text-white">Assinatura eletrônica</h3>
          <p className="text-sm text-app-text-muted font-normal">
            Sua assinatura garante a validade jurídica de todos os documentos gerados neste atendimento
          </p>
        </div>

        {!isSigned ? (
          <p className="text-[var(--app-danger-text)] text-sm font-normal">Assinatura pendente para os documentos selecionados.</p>
        ) : (
          <div className="bg-[var(--app-primary)]/5 dark:bg-blue-900/10 border border-[var(--app-primary)]/10 rounded-[16px] p-4 flex items-center gap-4">
            <div className="h-16 w-32 bg-white dark:bg-app-card-dark rounded-lg border border-app-border flex items-center justify-center p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {signature && <img src={signature} alt="Sua Assinatura" className="h-full object-contain grayscale" />}
            </div>
            <div className="flex-1">
              <p className="text-app-text-primary dark:text-white text-sm font-normal">Assinatura manuscrita capturada!</p>
              <p className="text-app-text-muted text-xs font-normal">
                ID de Autenticação: {signatureAuthId}-{new Date().getFullYear()}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setIsSigned(false); setSignature(null) }}
              className="text-app-text-muted hover:text-gray-900 dark:hover:text-white font-normal text-xs"
            >
              Alterar assinatura
            </Button>
          </div>
        )}
      </div>

      {/* Preview modal */}
      <DocumentPreviewModal
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        docTitle={previewDoc?.title || ''}
        docContent={previewDoc?.content || ''}
      />

      {appointmentId && (
        <DocumentosEmitidosPanel
          agendamentoId={appointmentId}
          pacienteTelefone={patientDetails?.telefone}
        />
      )}

      <div className="flex items-center justify-between pt-6 border-t border-app-border dark:border-app-border-dark">
        <Button variant="outline" onClick={onBack} className="h-12 px-6 rounded-integrallys font-normal flex items-center gap-2">
          <ChevronLeft className="h-4 w-4" /> Voltar: Prescrição
        </Button>
        <Button onClick={handleNextClick} className="h-12 px-8 bg-app-primary hover:bg-app-primary-hover text-white rounded-integrallys font-normal flex items-center gap-2">
          Próximo: Conclusão <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ─── Conclusão Section ───────────────────────────────────────────────────────

interface PrazoRetornoState {
  valor: PrazoRetornoValor
  semPrazo: boolean
  onChange: (valor: PrazoRetornoValor) => void
  onSemPrazoChange: (semPrazo: boolean) => void
}

function hojeIsoSaoPaulo() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

function ConclusaoSection({
  onBack,
  onFinalize,
  prazo,
}: {
  onBack: () => void
  onFinalize: () => void
  prazo: PrazoRetornoState
}) {
  const { patientName, anamneseData, prescritos, isSigned, observacoesFinais, setObservacoesFinais, generatedDocuments } =
    useAtendimento()
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false)
  const [labelsToPrint, setLabelsToPrint] = useState<LabelData[]>([])

  const handlePrintLabels = () => {
    const labels = prescritos.map((item) => ({
      patientName: patientName || 'Paciente',
      productName: item.nome,
      composition: item.categoria,
      usage: item.posologia || 'Conforme orientação médica',
      validity: new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toLocaleDateString('pt-BR'),
    }))
    setLabelsToPrint(labels)
    setIsLabelModalOpen(true)
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-xl font-normal text-app-text-primary dark:text-white">Conclusão do Atendimento</h2>
        <p className="text-app-text-muted">Revise e finalize o atendimento</p>
      </div>

      {/* Resume card */}
      <div className="app-status-success border border-transparent p-6 rounded-integrallys-lg">
        <div className="flex items-center gap-2 mb-4">
          <Check className="h-5 w-5 text-[var(--app-primary)] dark:text-[#4da885]" />
          <h3 className="font-normal text-app-text-primary dark:text-white">Resumo do Atendimento</h3>
        </div>
        <div className="space-y-4 pl-7">
          <p className="text-app-text-primary dark:text-white">
            <span className="font-normal">Paciente:</span> {patientName || '—'}
          </p>
          <p className="text-app-text-primary dark:text-white">
            <span className="font-normal">Queixa Principal:</span> {anamneseData?.queixa || 'Não informada'}
          </p>
          <div className="flex items-center gap-4">
            <p className="text-app-text-primary dark:text-white">
              <span className="font-normal">Medicamentos Prescritos:</span> {prescritos.length} itens
            </p>
            {prescritos.length > 0 && (
              <Button
                size="sm"
                onClick={handlePrintLabels}
                className="bg-app-primary hover:bg-app-primary-hover text-white h-8 px-3 rounded-[8px] font-normal flex items-center gap-2 text-xs"
              >
                <Tag className="h-3 w-3" />
                Imprimir Todos os Rótulos
              </Button>
            )}
          </div>
          <p className="text-app-text-primary dark:text-white">
            <span className="font-normal">Documentos Gerados:</span>{' '}
            {generatedDocuments.length > 0 ? `${generatedDocuments.length} documento(s)` : 'Nenhum'}
          </p>
          <div className="flex items-center gap-2">
            <span className="font-normal text-app-text-primary dark:text-white">Assinatura digital:</span>
            {isSigned ? (
              <Badge className="bg-[var(--app-success-text)] dark:bg-transparent dark:text-[var(--app-success-text)] text-white border-none font-normal px-3 py-1 rounded-full text-xs">
                Assinado eletronicamente
              </Badge>
            ) : (
              <Badge className="bg-[var(--app-warning-text)] dark:bg-transparent dark:text-[var(--app-warning-text)] text-white border-none font-normal px-3 py-1 rounded-full text-xs">
                Pendente
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Edição pós-finalização (contrato / opção 2) */}
      <div className="bg-sky-50/50 dark:bg-sky-900/10 border border-sky-100 dark:border-sky-900/20 p-6 rounded-integrallys-lg flex gap-4">
        <AlertCircle className="h-6 w-6 text-sky-700 dark:text-sky-300 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-normal text-sky-800 dark:text-sky-200">Prontuário editável após finalizar</h4>
          <p className="text-sm text-sky-700 dark:text-sky-300 leading-relaxed font-normal">
            O prontuário permanece editável após a finalização. Cada alteração gera snapshot de auditoria. Evoluções
            continuam com fluxo de nota/errata quando aplicável.
          </p>
        </div>
      </div>

      {/* Prazo de retorno: escolhido aqui, antes de confirmar a finalização */}
      <section className="space-y-3 rounded-integrallys-lg border border-app-border p-6 dark:border-app-border-dark" aria-labelledby="prazo-retorno-titulo">
        <div className="space-y-1">
          <h3 id="prazo-retorno-titulo" className="font-normal text-app-text-primary dark:text-white">Prazo de retorno</h3>
          <p className="text-sm text-app-text-muted">
            Em quanto tempo o paciente deve voltar. O prazo alimenta a lista de retornos da recepção.
          </p>
        </div>
        {!prazo.semPrazo && <PrazoRetornoSelector value={prazo.valor} onChange={prazo.onChange} idPrefix="conclusao-prazo" />}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-app-text-secondary dark:text-white/70" data-testid="resumo-prazo-retorno">
            {prazo.semPrazo ? 'Nenhum prazo de retorno será registrado.' : resumoPrazoRetorno(prazo.valor, hojeIsoSaoPaulo())}
          </p>
          <Button type="button" variant="ghost" size="sm" className="font-normal" onClick={() => prazo.onSemPrazoChange(!prazo.semPrazo)}>
            {prazo.semPrazo ? 'Definir prazo de retorno' : 'Finalizar sem definir prazo'}
          </Button>
        </div>
      </section>

      {/* Final observations */}
      <div className="space-y-2">
        <Label className="font-normal text-app-text-primary dark:text-white">Observações Finais (Opcional)</Label>
        <Textarea
          placeholder="Adicione observações finais sobre o atendimento..."
          value={observacoesFinais}
          onChange={(e) => setObservacoesFinais(e.target.value)}
          className="min-h-[100px] p-4 bg-app-bg-secondary/50 dark:bg-app-card-dark/50 border-app-border dark:border-app-border-dark rounded-integrallys font-normal resize-none"
        />
      </div>

      <div className="flex flex-col-reverse gap-3 pt-6 border-t border-app-border dark:border-app-border-dark sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" onClick={onBack} className="h-12 w-full px-6 rounded-integrallys font-normal flex items-center justify-center gap-2 sm:w-auto">
          <ChevronLeft className="h-4 w-4" /> Voltar: Documentos
        </Button>
        <Button
          onClick={onFinalize}
          className="h-12 w-full justify-center px-8 sm:w-auto bg-app-primary hover:bg-app-primary-hover border border-app-border-dark text-white rounded-integrallys font-normal flex items-center gap-2"
        >
          <Check className="h-4 w-4" /> Finalizar Atendimento
        </Button>
      </div>

      <LabelEditorModal
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
        dataList={labelsToPrint}
      />
    </div>
  )
}

// ─── Inner ────────────────────────────────────────────────────────────────────

function AtendimentoInner({ onBack, onFinalize }: { onBack: () => void; onFinalize?: () => void | Promise<void> }) {
  const {
    currentStep,
    setCurrentStep,
    patientName,
    finalizeAtendimento,
    pacienteId,
    appointmentId,
    evolucaoAtual,
  } = useAtendimento()
  const api = useApi()
  useProntuarioLivePublish(pacienteId, evolucaoAtual)
  const [showFinalizeModal, setShowFinalizeModal] = useState(false)
  const [prazoValor, setPrazoValor] = useState<PrazoRetornoValor>(PRAZO_RETORNO_INICIAL)
  const [semPrazo, setSemPrazo] = useState(false)
  const [isFinalizing, setIsFinalizing] = useState(false)

  const handleNext = () => {
    if (currentStep < 5) setCurrentStep(currentStep + 1)
    else setShowFinalizeModal(true)
  }

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
    else onBack()
  }

  const doFinalize = async () => {
    await onFinalize?.()
    finalizeAtendimento()
    toast.success('Atendimento finalizado com sucesso.')
    onBack()
  }

  // O prazo é gravado antes de finalizar: se falhar, o atendimento continua aberto.
  const handleFinalize = async () => {
    const escolhido = semPrazo ? null : prazoEscolhido(prazoValor)
    if (escolhido && 'erro' in escolhido) {
      setShowFinalizeModal(false)
      toast.error(escolhido.erro)
      return
    }
    setIsFinalizing(true)
    try {
      if (escolhido && pacienteId) {
        await api.post('/api/retornos', { origem: 'atendimento', pacienteId, agendamentoId: appointmentId, prazo: escolhido })
      }
      setShowFinalizeModal(false)
      await doFinalize()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar o prazo de retorno.')
    } finally {
      setIsFinalizing(false)
    }
  }

  return (
    <div className="app-page space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              onClick={onBack}
              className="cursor-pointer text-app-text-primary/70 dark:text-white/80 hover:text-[var(--app-primary)] flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Agenda
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-normal text-app-text-primary dark:text-white">
              Atendimento: {patientName}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Patient header */}
      <div className="bg-app-card dark:bg-app-card-dark p-6 rounded-integrallys-lg shadow-sm border border-app-border dark:border-app-border-dark">
        <div className="flex flex-col lg:flex-row gap-6">
          <PacienteCadastroCard pacienteId={pacienteId} nomeFallback={patientName} className="flex-1" />
          <div className="lg:self-start">
            <Button
              variant="outline"
              onClick={onBack}
              className="h-10 px-4 rounded-integrallys font-normal border-app-border dark:border-app-border-dark whitespace-nowrap"
            >
              Sair do atendimento
            </Button>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <ProgressBar currentStep={currentStep} />

      {/* Section content */}
      <div className="bg-app-card dark:bg-app-card-dark p-8 rounded-integrallys-lg shadow-sm border border-app-border dark:border-app-border-dark">
        {currentStep === 1 && <AnamneseSection onCancel={onBack} onNext={handleNext} />}
        {currentStep === 2 && <ProntuarioSection onBack={handleBack} onNext={handleNext} />}
        {currentStep === 3 && <PrescricaoSection onBack={handleBack} onNext={handleNext} />}
        {currentStep === 4 && <DocumentosSection onBack={handleBack} onNext={handleNext} />}
        {currentStep === 5 && <ConclusaoSection
            onBack={handleBack}
            onFinalize={() => setShowFinalizeModal(true)}
            prazo={{ valor: prazoValor, semPrazo, onChange: setPrazoValor, onSemPrazoChange: setSemPrazo }}
          />}
      </div>

      {/* Finalize modal */}
      <Dialog open={showFinalizeModal} onOpenChange={setShowFinalizeModal}>
        <DialogContent className="p-8">
          <div className="text-center space-y-4">
            <div className="h-16 w-16 app-status-success rounded-full flex items-center justify-center mx-auto text-[var(--app-success-text)]">
              <Check className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-normal text-app-text-primary dark:text-white">Finalizar atendimento?</h2>
            <p className="text-app-text-muted font-normal">
              O prontuário permanece editável após a finalização (com auditoria). A orçamentação automática será
              disparada normalmente.
            </p>
            <p className="text-sm font-normal text-app-text-primary dark:text-white" data-testid="dialogo-prazo-retorno">
              {semPrazo ? 'Prazo de retorno: não definido.' : `Prazo de retorno: ${resumoPrazoRetorno(prazoValor, hojeIsoSaoPaulo())}`}
            </p>
            <div className="flex gap-4 pt-4">
              <Button variant="outline" className="flex-1 font-normal" onClick={() => setShowFinalizeModal(false)}>
                Revisar
              </Button>
              <Button className="flex-1 bg-app-primary font-normal" disabled={isFinalizing} onClick={() => void handleFinalize()}>
                {isFinalizing ? 'Finalizando…' : 'Sim, finalizar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Public export ────────────────────────────────────────────────────────────

interface AtendimentoViewProps {
  patientName: string
  patientDetails?: Partial<PatientDetails>
  pacienteId?: string
  appointmentId?: string
  appointmentTime?: string
  onBack: () => void
  onFinalize?: () => void | Promise<void>
}

export function AtendimentoView({ patientName, patientDetails, pacienteId, appointmentId, appointmentTime, onBack, onFinalize }: AtendimentoViewProps) {
  const { data: historicoAtendimentos } = useAtendimentoHistorico(pacienteId)
  return (
    <AtendimentoProvider
      patientName={patientName}
      patientDetails={patientDetails}
      pacienteId={pacienteId}
      appointmentId={appointmentId}
      appointmentTime={appointmentTime}
      historicoAtendimentos={historicoAtendimentos}
    >
      <AtendimentoInner onBack={onBack} onFinalize={onFinalize} />
    </AtendimentoProvider>
  )
}
