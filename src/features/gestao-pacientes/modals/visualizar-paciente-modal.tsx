'use client'

import { calcularIdade } from '../utils/idade'
import { descreverNotaFiscal, notaFiscalFromFinancial } from '../utils/nota-fiscal'
import { descreverOrigem } from '../utils/origem'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ModalHeader } from '@/components/shared/modal-header'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Patient } from '@/types/patient'
import { DocumentosDoPacienteCard } from '@/features/documentacao-gerar'
import { ExamesPacienteCard } from '@/features/gestao-pacientes/components/exames-paciente-card'
import { apiClient } from '@/lib/api-client'

export interface PacienteCrm {
  estagio: string
  observacoes: string | null
  proxima_acao: string | null
  data_proxima_acao: string | null
  updated_at?: string | null
}

export const CRM_ESTAGIOS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'lead', label: 'Lead' },
  { value: 'ativo', label: 'Ativo' },
  { value: 'em_tratamento', label: 'Em tratamento' },
  { value: 'retorno_pendente', label: 'Retorno pendente' },
  { value: 'inativo', label: 'Inativo' },
  { value: 'vip', label: 'VIP' },
]

interface VisualizarPacienteModalProps {
  isOpen: boolean
  onClose: () => void
  paciente: Patient | null
  /** Dados CRM atuais do paciente (vindos da listagem). */
  crm?: PacienteCrm | null
  /** Aba a abrir por padrão. Default: 'dados'. */
  initialTab?: 'dados' | 'crm'
  /** Callback após salvar CRM (use pra recarregar a lista). */
  onCrmSaved?: () => void
}

const getVinculoLabel = (vinculo?: string) => {
  if (vinculo === 'fornecedor') return 'Fornecedor'
  if (vinculo === 'prestador') return 'Prestador'
  if (vinculo === 'profissional') return 'Profissional'
  if (vinculo === 'usuario') return 'Usuário'
  if (vinculo === 'outro') return 'Outro'
  return 'Cliente'
}

const formatDateTimeBR = (value?: string | null) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

interface CrmFormState {
  estagio: string
  observacoes: string
  proxima_acao: string
  data_proxima_acao: string
}

const emptyCrmForm: CrmFormState = {
  estagio: 'lead',
  observacoes: '',
  proxima_acao: '',
  data_proxima_acao: '',
}

const crmToForm = (crm?: PacienteCrm | null): CrmFormState => ({
  estagio: crm?.estagio || 'lead',
  observacoes: crm?.observacoes ?? '',
  proxima_acao: crm?.proxima_acao ?? '',
  data_proxima_acao: crm?.data_proxima_acao ?? '',
})

export function VisualizarPacienteModal({
  isOpen,
  onClose,
  paciente,
  crm = null,
  initialTab = 'dados',
  onCrmSaved,
}: VisualizarPacienteModalProps) {
  const [activeTab, setActiveTab] = useState<'dados' | 'crm'>(initialTab)
  const [crmForm, setCrmForm] = useState<CrmFormState>(() => crmToForm(crm))
  const [isSaving, setIsSaving] = useState(false)

  // Reset ao abrir / trocar de paciente / receber novo crm
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
      setCrmForm(crmToForm(crm))
    }
  }, [isOpen, paciente?.id, crm, initialTab])

  const estagioAtualDesde = formatDateTimeBR(crm?.updated_at)

  const handleSaveCrm = async () => {
    if (!paciente?.id) return
    setIsSaving(true)
    try {
      await apiClient(`/api/pacientes?action=crm&id=${encodeURIComponent(String(paciente.id))}`, {
        method: 'PATCH',
        body: JSON.stringify({
          estagio: crmForm.estagio,
          observacoes: crmForm.observacoes.trim() || null,
          proxima_acao: crmForm.proxima_acao.trim() || null,
          data_proxima_acao: crmForm.data_proxima_acao || null,
        }),
      })
      toast.success('Estágio CRM atualizado.')
      onCrmSaved?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao atualizar CRM.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[24px] overflow-hidden">
        <ModalHeader
          className="border-b border-app-border dark:border-app-border-dark"
          title="Visualizar paciente"
          description="Dados cadastrais, documentos e funil CRM."
        />

        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 rounded-full overflow-hidden border border-app-border dark:border-app-border-dark bg-app-bg-secondary dark:bg-app-hover shrink-0">
              {paciente?.photoUrl ? (
                <Image
                  src={paciente.photoUrl}
                  alt={paciente?.name || 'Paciente'}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-app-text-muted text-xs font-semibold">
                  {(paciente?.name || 'Paciente').split(' ').map((part) => part[0]).slice(0, 2).join('')}
                </div>
              )}
            </div>
            <div>
              <p className="text-base font-normal text-app-text-primary dark:text-white">{paciente?.name || '-'}</p>
              <p className="text-sm text-app-text-secondary dark:text-white/70">CPF: {paciente?.cpf || '-'}</p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'dados' | 'crm')}>
            <TabsList>
              <TabsTrigger value="dados">Dados cadastrais</TabsTrigger>
              <TabsTrigger value="crm">CRM</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <p><strong>Telefone:</strong> {paciente?.phone || '-'}</p>
                <p><strong>E-mail:</strong> {paciente?.email || '-'}</p>
                <p><strong>RG:</strong> {paciente?.rg || '-'}</p>
                <p><strong>Inscrição Estadual:</strong> {paciente?.inscricaoEstadual || '-'}</p>
                <p><strong>Origem:</strong> {descreverOrigem(paciente?.source, paciente?.origemDetalhe)}</p>
                <p><strong>Nota fiscal:</strong> {descreverNotaFiscal(paciente?.precisaNf === true, notaFiscalFromFinancial(paciente?.financial))}</p>
                <p><strong>Nascimento:</strong> {paciente?.birthDate ? new Date(paciente.birthDate).toLocaleDateString('pt-BR') : '-'}</p>
                <p data-testid="paciente-idade"><strong>Idade:</strong> {(() => { const idade = calcularIdade(paciente?.birthDate); return idade !== null ? `${idade} ${idade === 1 ? 'ano' : 'anos'}` : '-' })()}</p>
                <p><strong>Status:</strong> {paciente?.activeStatus || 'Ativo'}</p>
              </div>

              <div>
                <p className="text-xs text-app-text-muted mb-2">Tipo de vínculo</p>
                <Badge variant="outline" className="rounded-full px-3 py-1 border-app-border dark:border-app-border-dark">
                  {(paciente?.vinculoTipos && paciente.vinculoTipos.length > 0
                    ? paciente.vinculoTipos
                    : ['cliente']
                  )
                    .map(getVinculoLabel)
                    .join(', ')}
                </Badge>
              </div>

              {paciente?.id && (
                <DocumentosDoPacienteCard
                  pacienteId={String(paciente.id)}
                  pacienteTelefone={paciente.phone ?? paciente.telefone}
                  limit={5}
                  ocultarSeVazio={false}
                />
              )}

              {paciente?.id && (
                <ExamesPacienteCard pacienteId={String(paciente.id)} />
              )}
            </TabsContent>

            <TabsContent value="crm" className="space-y-4">
              <div className="rounded-2xl border border-app-border bg-app-bg-secondary/40 p-4 text-xs text-app-text-secondary dark:border-app-border-dark dark:bg-app-surface-muted dark:text-white/70">
                {estagioAtualDesde
                  ? <>Estágio atual desde <span className="font-medium text-app-text-primary dark:text-white">{estagioAtualDesde}</span></>
                  : 'Sem registro CRM para este paciente ainda — o estágio será criado ao salvar.'}
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-normal">Estágio</Label>
                <Select
                  value={crmForm.estagio}
                  onValueChange={(value) => setCrmForm((prev) => ({ ...prev, estagio: value }))}
                >
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CRM_ESTAGIOS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-normal">Observações</Label>
                <Textarea
                  value={crmForm.observacoes}
                  onChange={(event) => setCrmForm((prev) => ({ ...prev, observacoes: event.target.value }))}
                  placeholder="Anote contexto do relacionamento, follow-ups, preferências…"
                  className="min-h-[96px] rounded-xl"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                <div className="space-y-1.5">
                  <Label className="text-sm font-normal">Próxima ação</Label>
                  <Input
                    value={crmForm.proxima_acao}
                    onChange={(event) => setCrmForm((prev) => ({ ...prev, proxima_acao: event.target.value }))}
                    placeholder="Ex.: Ligar para reagendar retorno"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-normal">Data</Label>
                  <Input
                    type="date"
                    value={crmForm.data_proxima_acao}
                    onChange={(event) => setCrmForm((prev) => ({ ...prev, data_proxima_acao: event.target.value }))}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => void handleSaveCrm()}
                  disabled={isSaving || !paciente?.id}
                  className="h-11 rounded-xl bg-app-primary px-6 font-normal text-white hover:bg-app-primary-hover"
                >
                  {isSaving ? 'Salvando…' : 'Salvar estágio'}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="border-t border-app-border dark:border-app-border-dark pt-4">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
