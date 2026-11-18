'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  PenTool,
  Printer,
  Send,
} from 'lucide-react'
import type { DocumentoTemplate } from '@/lib/documentos'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { useApi } from '@/hooks/use-api'
import { SignaturePad } from '@/components/shared/signature-pad'
import { DocumentPreview } from './document-preview'
import { TemplateForm } from './template-form'
import { downloadBlob, gerarPdfDoElemento, imprimirElemento } from './generate-pdf'
import type {
  ConteudoPreenchido,
  PreenchimentoContexto,
  SecaoPreenchida,
  ValoresForm,
} from './types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  pacienteId: string
  pacienteNome: string
  pacienteCpf?: string
  agendamentoId?: string | null
}

interface TemplatesResponse {
  data: DocumentoTemplate[]
}

interface GerarResponse {
  data: {
    id: string
    pdf_url: string | null
  }
}

interface ClinicaResponse {
  data: {
    nome?: string
    cidade_uf?: string | null
    endereco?: string | null
    cep?: string | null
    telefone?: string | null
    logo_url?: string | null
    cor_primaria?: string
  } | null
}

interface MeResponse {
  user: { id: string; name: string }
}

type Step = 'lista' | 'preencher'

function buildConteudoPreenchido(
  template: DocumentoTemplate,
  valores: ValoresForm,
): ConteudoPreenchido {
  const secoes: SecaoPreenchida[] = template.conteudo.secoes.map((secao, index) => {
    const valor = valores[index]
    if (valor === undefined) return { ...secao } as SecaoPreenchida
    return { ...secao, valor } as SecaoPreenchida
  })
  return { ...template.conteudo, secoes }
}

export function GerarDocumentoModal({
  open,
  onOpenChange,
  pacienteId,
  pacienteNome,
  pacienteCpf,
  agendamentoId,
}: Props) {
  const api = useApi()
  const [step, setStep] = useState<Step>('lista')
  const [templates, setTemplates] = useState<DocumentoTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [selecionado, setSelecionado] = useState<DocumentoTemplate | null>(null)
  const [valores, setValores] = useState<ValoresForm>({})
  const [disponivelPortal, setDisponivelPortal] = useState(false)
  const [contexto, setContexto] = useState<PreenchimentoContexto>({})
  const [isGenerating, setIsGenerating] = useState(false)
  const [showSignaturePad, setShowSignaturePad] = useState(false)
  const [persistedDocId, setPersistedDocId] = useState<string | null>(null)
  const [isAssinado, setIsAssinado] = useState(false)
  const previewRef = useRef<HTMLDivElement | null>(null)

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setStep('lista')
      setSelecionado(null)
      setValores({})
      setDisponivelPortal(false)
      setPersistedDocId(null)
      setIsAssinado(false)
      setShowSignaturePad(false)
    }
  }, [open])

  // Carrega templates e contexto ao abrir
  useEffect(() => {
    if (!open) return
    let mounted = true
    const load = async () => {
      setLoadingTemplates(true)
      try {
        const [templatesRes, clinicaRes, meRes] = await Promise.all([
          api.get<TemplatesResponse>('/api/documentos/templates'),
          api.get<ClinicaResponse>('/api/clinica-config').catch(() => ({ data: null })),
          api.get<MeResponse>('/api/auth/me').catch(() => ({ user: null })),
        ])
        if (!mounted) return
        setTemplates(templatesRes.data)
        const c = clinicaRes.data
        setContexto({
          cliente: { nome: pacienteNome, cpf: pacienteCpf },
          clinica: c
            ? {
                nome: c.nome ?? '',
                cidade_uf: c.cidade_uf ?? '',
                endereco: c.endereco ?? '',
                cep: c.cep ?? '',
                telefone: c.telefone ?? '',
                logo_url: c.logo_url ?? null,
                cor_primaria: c.cor_primaria ?? '#111827',
              }
            : undefined,
          profissional: meRes.user ? { nome: meRes.user.name } : undefined,
        })
      } catch (err) {
        if (!mounted) return
        toast.error(err instanceof Error ? err.message : 'Falha ao carregar dados')
      } finally {
        if (mounted) setLoadingTemplates(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [open, api, pacienteNome, pacienteCpf])

  const selecionar = (template: DocumentoTemplate) => {
    setSelecionado(template)
    setValores({})
    setDisponivelPortal(template.disponivel_portal_paciente)
    setStep('preencher')
  }

  const filename = useMemo(() => {
    if (!selecionado) return 'documento.pdf'
    const slug = `${pacienteNome.replace(/\s+/g, '-').toLowerCase()}-${selecionado.slug}-${Date.now()}`
    return `${slug}.pdf`
  }, [pacienteNome, selecionado])

  const handleImprimir = useCallback(() => {
    if (!previewRef.current) return
    if (!imprimirElemento(previewRef.current)) toast.error('Habilite pop-ups para imprimir')
  }, [])

  const persistirDocumento = useCallback(async (): Promise<{ id: string } | null> => {
    if (!selecionado) return null
    if (persistedDocId) return { id: persistedDocId }
    const conteudoPreenchido = buildConteudoPreenchido(selecionado, valores)
    const res = await api.post<GerarResponse>('/api/documentos/gerar', {
      templateId: selecionado.id,
      pacienteId,
      agendamentoId: agendamentoId ?? null,
      disponivelNoPortal: disponivelPortal,
      conteudoPreenchido,
    })
    setPersistedDocId(res.data.id)
    return { id: res.data.id }
  }, [api, selecionado, valores, pacienteId, agendamentoId, disponivelPortal, persistedDocId])

  const handleAssinarDocumento = useCallback(async (signatureBase64: string) => {
    try {
      // Persiste o documento antes de assinar (se ainda não persistido)
      const persistencia = await persistirDocumento()
      if (!persistencia) throw new Error('Falha ao persistir documento')
      const res = await fetch(`/api/documentos/assinar/${persistencia.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ assinaturaBase64: signatureBase64 }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'Falha ao assinar documento')
      }
      setIsAssinado(true)
      setShowSignaturePad(false)
      toast.success('Documento assinado.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao assinar documento')
    }
  }, [persistirDocumento])

  const handleBaixarPdf = async () => {
    if (!selecionado || !previewRef.current || isGenerating) return
    setIsGenerating(true)
    try {
      const { blob, filename: outName } = await gerarPdfDoElemento(previewRef.current, filename)
      downloadBlob(blob, outName)
      const persistencia = await persistirDocumento()
      toast.success('PDF gerado e registrado.')
      return persistencia
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao gerar PDF')
      return null
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDisponibilizarPortal = async () => {
    if (!selecionado || !previewRef.current || isGenerating) return
    setIsGenerating(true)
    try {
      setDisponivelPortal(true)
      const persistencia = await persistirDocumento()
      if (!persistencia) throw new Error('Falha ao persistir documento')
      const { blob } = await gerarPdfDoElemento(previewRef.current, filename)
      const formData = new FormData()
      formData.append('file', new File([blob], filename, { type: 'application/pdf' }))
      const upload = await fetch(`/api/documentos/pdf/${persistencia.id}`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      if (!upload.ok) {
        const payload = await upload.json().catch(() => null)
        throw new Error(payload?.error ?? 'Falha no upload')
      }
      toast.success('Documento disponibilizado no portal do paciente.')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao disponibilizar')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="flex flex-col rounded-[24px] p-0">
        <div className="px-8 pt-6">
          <DialogHeader>
            <DialogTitle>
              {step === 'lista' ? 'Gerar documento' : selecionado?.nome ?? 'Preencher documento'}
            </DialogTitle>
            <DialogDescription>
              {step === 'lista'
                ? 'Selecione um modelo configurado pela clínica.'
                : 'Preencha os campos manuais. As variáveis são resolvidas automaticamente.'}
            </DialogDescription>
          </DialogHeader>
        </div>

        {step === 'lista' ? (
          <div className="flex-1 overflow-y-auto px-8 pb-6">
            {loadingTemplates ? (
              <div className="py-10 text-center text-sm text-app-text-secondary dark:text-white/60">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                Carregando modelos...
              </div>
            ) : templates.length === 0 ? (
              <div className="py-10 text-center text-sm text-app-text-secondary dark:text-white/60">
                Nenhum template ativo. Peça ao gestor para configurar em
                <code className="mx-1">Configurações → Templates de Documentos</code>.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => selecionar(template)}
                    className="text-left p-4 rounded-xl border border-app-border dark:border-app-border-dark hover:border-app-primary/50 hover:bg-app-primary/5 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-app-bg-secondary dark:bg-app-hover flex items-center justify-center">
                        <FileText className="h-5 w-5 text-app-text-secondary dark:text-white/70" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium dark:text-white truncate">
                          {template.nome}
                        </div>
                        <div className="text-xs text-app-text-muted capitalize">
                          {template.tipo}
                        </div>
                        {template.disponivel_portal_paciente && (
                          <div className="text-xs mt-1 text-app-primary">
                            disponível no portal
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-0">
            {/* Formulário */}
            <div className="overflow-y-auto px-8 py-4 border-r border-app-border dark:border-app-border-dark space-y-5">
              {selecionado && (
                <TemplateForm
                  template={selecionado}
                  valores={valores}
                  onChange={setValores}
                />
              )}
              <div className="flex items-center justify-between p-3 rounded-xl border border-app-border dark:border-app-border-dark">
                <div className="text-xs">
                  <div className="font-medium dark:text-white/80">Disponibilizar no portal</div>
                  <div className="text-app-text-muted">Paciente vê na aba Documentos</div>
                </div>
                <Switch checked={disponivelPortal} onCheckedChange={setDisponivelPortal} />
              </div>
            </div>

            {/* Preview */}
            <div className="overflow-y-auto bg-app-bg-secondary dark:bg-app-hover/20 p-6">
              {selecionado && (
                <div className="mx-auto" style={{ maxWidth: '210mm' }}>
                  <DocumentPreview
                    ref={previewRef}
                    template={selecionado}
                    valores={valores}
                    contexto={contexto}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 px-8 py-4 border-t border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark">
          <div>
            {step === 'preencher' && (
              <Button
                variant="ghost"
                className="rounded-xl"
                onClick={() => setStep('lista')}
                disabled={isGenerating}
              >
                Trocar modelo
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-xl border-app-border dark:border-app-border-dark"
              onClick={() => onOpenChange(false)}
              disabled={isGenerating}
            >
              Fechar
            </Button>
            {step === 'preencher' && (
              <>
                {isAssinado && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Assinado
                  </span>
                )}
                <Button
                  variant="outline"
                  className="rounded-xl border-app-border dark:border-app-border-dark"
                  onClick={() => setShowSignaturePad(true)}
                  disabled={isGenerating || isAssinado}
                >
                  <PenTool className="h-4 w-4 mr-2" />
                  {isAssinado ? 'Assinado' : 'Assinar documento'}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl border-app-border dark:border-app-border-dark"
                  onClick={handleImprimir}
                  disabled={isGenerating}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl border-app-border dark:border-app-border-dark"
                  onClick={() => void handleBaixarPdf()}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Baixar PDF
                </Button>
                {(disponivelPortal || selecionado?.disponivel_portal_paciente) && (
                  <Button
                    className="rounded-xl bg-app-primary text-white hover:bg-app-primary-hover"
                    onClick={() => void handleDisponibilizarPortal()}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Disponibilizar no portal
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>

      <Dialog open={showSignaturePad} onOpenChange={setShowSignaturePad}>
        <DialogContent size="lg" className="rounded-[24px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5" />
              Assinar documento
            </DialogTitle>
            <DialogDescription>
              Desenhe sua assinatura abaixo para anexar ao documento gerado.
            </DialogDescription>
          </DialogHeader>
          <SignaturePad
            onSave={(signature) => void handleAssinarDocumento(signature)}
            onCancel={() => setShowSignaturePad(false)}
          />
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
