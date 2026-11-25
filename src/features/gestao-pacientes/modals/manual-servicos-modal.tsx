'use client'

import { CheckCircle, FileText, Printer, Share2, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useClinicaConfig } from '@/features/configuracoes/hooks/use-clinica-config'
import type { Patient } from '@/types/patient'
import { DocumentoCadastro } from '../components/documento-cadastro'
import {
  baixarManualPdf,
  imprimirManualPdf,
  mensagemWhatsAppManual,
} from '../utils/manual-servicos-pdf'

interface ManualServicosModalProps {
  isOpen: boolean
  onClose: () => void
  paciente: Patient | null
}

/** Número para o wa.me: só dígitos, com 55 quando vier sem o código do país. */
function numeroWhatsApp(valor: string): string {
  const digitos = valor.replace(/\D/g, '')
  return digitos.length <= 11 ? `55${digitos}` : digitos
}

export function ManualServicosModal({ isOpen, onClose, paciente }: ManualServicosModalProps) {
  const [mostrarNumero, setMostrarNumero] = useState(false)
  const [numero, setNumero] = useState('')
  const [enviado, setEnviado] = useState(false)
  // A unidade do paciente define de qual clínica vem o manual (admin com várias unidades não tem unidade própria).
  const { data: clinicaConfig, isLoading: carregandoManual } = useClinicaConfig(paciente?.unidadeId)
  const nomeClinica = clinicaConfig?.nome ?? 'Clínica'
  const manual = clinicaConfig?.manual_servicos?.trim() ?? ''
  const clinica = { nome: nomeClinica, cidadeUf: clinicaConfig?.cidade_uf }

  const fechar = () => {
    setMostrarNumero(false)
    setNumero('')
    setEnviado(false)
    onClose()
  }

  const abrirWhatsApp = () => {
    if (!paciente) return
    if (!mostrarNumero) {
      setNumero(paciente.phone ?? '')
      setMostrarNumero(true)
      return
    }
    if (numero.replace(/\D/g, '').length < 10) return
    baixarManualPdf(paciente, clinica, manual)
    const texto = encodeURIComponent(mensagemWhatsAppManual(paciente.name ?? '', nomeClinica))
    window.open(
      `https://wa.me/${numeroWhatsApp(numero)}?text=${texto}`,
      '_blank',
      'noopener,noreferrer',
    )
    setEnviado(true)
    setTimeout(() => {
      setEnviado(false)
      setMostrarNumero(false)
    }, 3000)
  }

  if (!paciente) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && fechar()}>
      <DialogContent
        size="xl"
        className="flex flex-col gap-0 overflow-y-hidden rounded-[28px] border-none bg-app-card p-0 dark:bg-app-card-dark"
      >
        <DialogHeader className="shrink-0 border-b border-app-border p-5 pb-4 pr-14 dark:border-app-border-dark md:p-8 md:pb-4">
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold text-app-text-primary dark:text-white">
            <FileText className="h-6 w-6 text-[var(--app-primary)]" />
            Cadastro & Manual
          </DialogTitle>
          <DialogDescription className="text-app-text-secondary dark:text-white/60">
            Visualize, imprima ou envie o documento completo do paciente
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar bg-app-bg-secondary px-4 py-5 dark:bg-transparent md:px-8 md:py-6">
          {manual ? (
            <div className="overflow-hidden rounded-lg border border-app-border bg-white shadow-sm dark:border-app-border-dark">
              <DocumentoCadastro
                data={paciente}
                manualText={manual}
                clinicaNome={clinicaConfig?.nome}
                clinicaSubtitulo={clinicaConfig?.cidade_uf ?? undefined}
                clinicaLogoUrl={clinicaConfig?.logo_url}
              />
            </div>
          ) : carregandoManual ? (
            <p className="text-sm text-app-text-muted">Carregando manual…</p>
          ) : (
            <p
              role="status"
              className="rounded-[12px] border border-dashed border-app-border bg-white p-5 text-sm text-app-text-secondary dark:border-app-border-dark dark:bg-app-hover dark:text-white/70"
            >
              Cadastre o manual em Configurações &gt; Config. da Clínica
            </p>
          )}
        </div>

        <DialogFooter className="shrink-0 flex-row flex-wrap items-center justify-center gap-2 border-t sm:justify-between border-app-border bg-app-bg-secondary p-4 dark:border-app-border-dark dark:bg-app-card-dark/50 md:p-6 sm:space-x-0">
          {mostrarNumero ? (
            <div className="flex w-full items-center gap-2">
              <input
                type="text"
                inputMode="tel"
                aria-label="Número do WhatsApp"
                placeholder="(11) 98765-4321"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                className="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-app-border-dark dark:bg-app-card-dark"
              />
              <Button
                onClick={abrirWhatsApp}
                disabled={enviado || numero.replace(/\D/g, '').length < 10}
                className="h-11 bg-[var(--app-success-text)] text-white hover:bg-green-700"
              >
                {enviado ? (
                  <>
                    <CheckCircle className="mr-1 h-4 w-4" /> Baixado e aberto
                  </>
                ) : (
                  'Baixar e abrir WhatsApp'
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Cancelar envio"
                onClick={() => setMostrarNumero(false)}
                className="h-11 w-11"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={fechar}
                className="h-11 rounded-[12px] px-6 font-normal"
              >
                Fechar
              </Button>
              <Button
                variant="outline"
                disabled={!manual}
                onClick={() => baixarManualPdf(paciente, clinica, manual)}
                className="h-11 gap-2 rounded-[12px] px-4 font-normal"
              >
                <FileText className="h-4 w-4" />
                Salvar PDF
              </Button>
              <Button
                variant="outline"
                disabled={!manual}
                onClick={abrirWhatsApp}
                className="h-11 gap-2 rounded-[12px] border-green-600 px-4 font-normal text-[var(--app-success-text)]"
              >
                <Share2 className="h-4 w-4" />
                WhatsApp
              </Button>
              <Button
                disabled={!manual}
                onClick={() => imprimirManualPdf(paciente, clinica, manual)}
                className="h-11 gap-2 rounded-[12px] bg-app-primary px-6 font-normal text-white hover:bg-app-primary-hover"
              >
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
