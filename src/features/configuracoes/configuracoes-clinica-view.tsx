'use client'

import { salvarComAviso } from './salvar-com-aviso'
import {
  Bell,
  Building,
  CreditCard,
  Edit,
  Eye,
  Globe,
  MessageSquare,
  Palette,
  Percent,
  Plus,
  QrCode,
  Save,
  Settings2,
  Trash2,
  Upload,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/page-header'
import { SegmentedControl } from '@/components/shared/segmented-control'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useClinicaConfig } from '@/features/configuracoes/hooks/use-clinica-config'
import { useConfiguracoes } from '@/features/configuracoes/hooks/use-configuracoes'
import {
  ALL_BANDEIRAS,
  type Bandeira,
  DEFAULT_MAQUININHA,
  DEFAULT_PAYMENT_DISCOUNTS,
  type MaquininhaConfig,
  type PaymentDiscounts,
  usePaymentConfig,
} from '@/features/prescricoes/hooks/use-payment-config'
import { useApi } from '@/hooks/use-api'
import { CONFIG_MASK } from '@/lib/config-secrets'

type MainTab = 'Identidade' | 'Clínica' | 'Sistema' | 'Integrações' | 'Cadastros' | 'Pagamento'
type CadastroTab =
  | 'bancos'
  | 'formas-pagamento'
  | 'formas-recebimento'
  | 'categorias-dre'
  | 'procedimentos'
  | 'profissionais'
  | 'tipos-documentos'
type DialogMode = 'create' | 'edit' | 'view'

interface IntegracaoItem {
  chave: string
  nome: string
  tipo: string
  ambiente: string
  status: string
  ultimoTeste?: string
  clientId?: string
  apiKey?: string
}

interface CadastroItem {
  chave: string
  nome: string
  codigo?: string
  descricao?: string
  ativo: boolean
}

const CADASTRO_TABS: Array<{ key: CadastroTab; label: string }> = [
  { key: 'bancos', label: 'Bancos' },
  { key: 'formas-pagamento', label: 'Formas de Pagamento' },
  { key: 'formas-recebimento', label: 'Formas de Recebimento' },
  { key: 'categorias-dre', label: 'Categorias DRE' },
  { key: 'procedimentos', label: 'Procedimentos' },
  { key: 'profissionais', label: 'Profissionais' },
  { key: 'tipos-documentos', label: 'Tipos de Documentos' },
]

function safeParseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function createKey(prefix: string) {
  return `${prefix}.${Date.now()}`
}

export function ConfiguracoesClinicaView() {
  const router = useRouter()
  const api = useApi()
  const { data, error, isLoading, saveConfiguracoes, deleteConfiguracao } = useConfiguracoes()
  const [activeTab, setActiveTab] = useState<MainTab>('Identidade')
  const [activeCadastroTab, setActiveCadastroTab] = useState<CadastroTab>('bancos')
  const [clinicaForm, setClinicaForm] = useState({
    nomeFantasia: '',
    razaoSocial: '',
    cnpj: '',
    inscricaoMunicipal: '',
    endereco: '',
    telefone: '',
    email: '',
  })
  const [sistemaForm, setSistemaForm] = useState({
    timezone: 'America/Sao_Paulo',
    moeda: 'BRL',
    notifEmail: true,
    backupAuto: true,
  })
  const [integracaoDialog, setIntegracaoDialog] = useState<{
    open: boolean
    mode: DialogMode
    item: IntegracaoItem | null
  }>({
    open: false,
    mode: 'create',
    item: null,
  })
  const [integracaoForm, setIntegracaoForm] = useState({
    nome: '',
    tipo: 'api',
    clientId: '',
    apiKey: '',
    ambiente: 'sandbox',
    status: 'ativo',
  })
  const [cadastroDialog, setCadastroDialog] = useState<{
    open: boolean
    mode: DialogMode
    item: CadastroItem | null
  }>({
    open: false,
    mode: 'create',
    item: null,
  })
  const [cadastroForm, setCadastroForm] = useState({
    nome: '',
    codigo: '',
    descricao: '',
    ativo: true,
  })
  const [deleteDialog, setDeleteDialog] = useState({ open: false, chave: '', label: '' })
  const [whatsappForm, setWhatsappForm] = useState({
    ativo: false,
    baseUrl: '',
    apiKey: '',
    instance: '',
    lembreteAtivo: true,
    posConsultaAtivo: true,
    aniversarioAtivo: true,
    lembreteHorasAntes: '24',
    posConsultaHorasApos: '2',
    templateLembrete:
      'Olá {paciente}! Lembrando da sua consulta com {especialista} no dia {data} às {hora}. Até logo!',
    templatePosConsulta:
      'Olá {paciente}! Esperamos que sua consulta com {especialista} tenha sido ótima. Qualquer dúvida estamos à disposição!',
    templateAniversario:
      'Feliz aniversário, {paciente}! 🎉 Toda a equipe deseja um dia especial para você!',
  })
  const [isSavingWhatsapp, setIsSavingWhatsapp] = useState(false)
  const [isTestingWhatsapp, setIsTestingWhatsapp] = useState(false)
  const [whatsappTest, setWhatsappTest] = useState<'idle' | 'ok' | 'fail'>('idle')
  const [chatbotForm, setChatbotForm] = useState({
    ativo: false,
    horarioInicio: '08:00',
    horarioFim: '18:00',
    diasSemana: [1, 2, 3, 4, 5] as number[],
    mensagemForaHorario:
      'Olá! Nosso atendimento automático funciona das {horario_inicio} às {horario_fim}. Retornaremos assim que possível.',
    mensagemBoasVindas: 'Olá! Sou o assistente de agendamentos. Qual é o seu nome?',
  })
  const [isSavingChatbot, setIsSavingChatbot] = useState(false)
  const [cieloForm, setCieloForm] = useState({
    ativo: false,
    merchantId: '',
    merchantKey: '',
    linkAccessToken: '',
    ambiente: 'sandbox',
  })
  const [isSavingCielo, setIsSavingCielo] = useState(false)
  const [cieloTest, setCieloTest] = useState<'idle' | 'ok' | 'fail'>('idle')
  const [sicrediForm, setSicrediForm] = useState({
    ativo: false,
    clientId: '',
    clientSecret: '',
    chavePix: '',
    ambiente: 'sandbox',
  })
  const [isSavingSicredi, setIsSavingSicredi] = useState(false)
  const [sicrediTest, setSicrediTest] = useState<'idle' | 'ok' | 'fail'>('idle')
  const {
    paymentDiscounts: loadedPaymentDiscounts,
    maquininha: loadedMaquininha,
    savePaymentDiscounts,
    saveMaquininha,
    isLoading: isPaymentConfigLoading,
  } = usePaymentConfig()
  const [paymentDiscountsForm, setPaymentDiscountsForm] =
    useState<PaymentDiscounts>(DEFAULT_PAYMENT_DISCOUNTS)
  const [maquininhaForm, setMaquininhaForm] = useState<MaquininhaConfig>(DEFAULT_MAQUININHA)
  const [isSavingPayment, setIsSavingPayment] = useState(false)

  const {
    data: identidadeData,
    isLoading: isIdentidadeLoading,
    save: saveIdentidade,
    uploadLogo,
  } = useClinicaConfig()
  const [identidadeForm, setIdentidadeForm] = useState({
    nome: '',
    cidade_uf: '',
    endereco: '',
    cep: '',
    telefone: '',
    logo_url: '',
    cor_primaria: '#000000',
    cor_secundaria: '#ffffff',
  })
  const [isSavingIdentidade, setIsSavingIdentidade] = useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)

  useEffect(() => {
    if (!identidadeData) return
    setIdentidadeForm({
      nome: identidadeData.nome ?? '',
      cidade_uf: identidadeData.cidade_uf ?? '',
      endereco: identidadeData.endereco ?? '',
      cep: identidadeData.cep ?? '',
      telefone: identidadeData.telefone ?? '',
      logo_url: identidadeData.logo_url ?? '',
      cor_primaria: identidadeData.cor_primaria ?? '#000000',
      cor_secundaria: identidadeData.cor_secundaria ?? '#ffffff',
    })
  }, [identidadeData])

  useEffect(() => {
    setMaquininhaForm(loadedMaquininha)
  }, [loadedMaquininha])

  useEffect(() => {
    setPaymentDiscountsForm(loadedPaymentDiscounts)
  }, [loadedPaymentDiscounts])

  useEffect(() => {
    if (!data.length) return
    const byKey = new Map(data.map((item) => [item.chave.toLowerCase(), item.valor]))
    setClinicaForm({
      nomeFantasia: byKey.get('clinica_nome_fantasia') ?? '',
      razaoSocial: byKey.get('clinica_razao_social') ?? '',
      cnpj: byKey.get('clinica_cnpj') ?? '',
      inscricaoMunicipal: byKey.get('clinica_inscricao_municipal') ?? '',
      endereco: byKey.get('clinica_endereco') ?? '',
      telefone: byKey.get('clinica_telefone') ?? '',
      email: byKey.get('clinica_email') ?? '',
    })
    setSistemaForm({
      timezone: byKey.get('sistema_timezone') ?? 'America/Sao_Paulo',
      moeda: byKey.get('sistema_moeda') ?? 'BRL',
      notifEmail: byKey.get('sistema_notif_email') !== 'false',
      backupAuto: byKey.get('sistema_backup_auto') !== 'false',
    })
  }, [data])

  useEffect(() => {
    const wpp = data.filter((item) => item.categoria === 'whatsapp')
    if (!wpp.length) return
    const byKey = new Map(wpp.map((item) => [item.chave, item.valor]))
    setWhatsappForm((current) => ({
      ativo: byKey.get('whatsapp.ativo') === 'true',
      baseUrl: byKey.get('whatsapp.base_url') ?? '',
      apiKey: byKey.get('whatsapp.api_key') ?? '',
      instance: byKey.get('whatsapp.instance') ?? '',
      lembreteAtivo: byKey.get('whatsapp.lembrete_ativo') !== 'false',
      posConsultaAtivo: byKey.get('whatsapp.pos_consulta_ativo') !== 'false',
      aniversarioAtivo: byKey.get('whatsapp.aniversario_ativo') !== 'false',
      lembreteHorasAntes: byKey.get('whatsapp.lembrete_horas_antes') ?? '24',
      posConsultaHorasApos: byKey.get('whatsapp.pos_consulta_horas_apos') ?? '2',
      templateLembrete: byKey.get('whatsapp.template_lembrete') ?? current.templateLembrete,
      templatePosConsulta:
        byKey.get('whatsapp.template_pos_consulta') ?? current.templatePosConsulta,
      templateAniversario:
        byKey.get('whatsapp.template_aniversario') ?? current.templateAniversario,
    }))
  }, [data])

  useEffect(() => {
    const cb = data.filter((item) => item.categoria === 'chatbot')
    if (!cb.length) return
    const byKey = new Map(cb.map((item) => [item.chave, item.valor]))
    setChatbotForm((current) => ({
      ativo: byKey.get('chatbot.ativo') === 'true',
      horarioInicio: byKey.get('chatbot.horario_inicio') ?? '08:00',
      horarioFim: byKey.get('chatbot.horario_fim') ?? '18:00',
      diasSemana: (byKey.get('chatbot.dias_semana') ?? '1,2,3,4,5')
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6),
      mensagemForaHorario:
        byKey.get('chatbot.mensagem_fora_horario') ?? current.mensagemForaHorario,
      mensagemBoasVindas: byKey.get('chatbot.mensagem_boas_vindas') ?? current.mensagemBoasVindas,
    }))
  }, [data])

  useEffect(() => {
    const cielo = data.filter((item) => item.categoria === 'cielo')
    if (cielo.length) {
      const byKey = new Map(cielo.map((item) => [item.chave, item.valor]))
      setCieloForm({
        ativo: byKey.get('cielo.ativo') === 'true',
        merchantId: byKey.get('cielo.merchant_id') ?? '',
        merchantKey: byKey.get('cielo.merchant_key') ?? '',
        linkAccessToken: byKey.get('cielo.link_access_token') ?? '',
        ambiente: byKey.get('cielo.ambiente') ?? 'sandbox',
      })
    }
    const sicredi = data.filter((item) => item.categoria === 'sicredi')
    if (sicredi.length) {
      const byKey = new Map(sicredi.map((item) => [item.chave, item.valor]))
      setSicrediForm({
        ativo: byKey.get('sicredi.ativo') === 'true',
        clientId: byKey.get('sicredi.client_id') ?? '',
        clientSecret: byKey.get('sicredi.client_secret') ?? '',
        chavePix: byKey.get('sicredi.chave_pix') ?? '',
        ambiente: byKey.get('sicredi.ambiente') ?? 'sandbox',
      })
    }
  }, [data])

  const integracoes = useMemo(
    () =>
      data
        .filter((item) => item.categoria === 'integracao')
        .map((item) => {
          const parsed = safeParseJson<Omit<IntegracaoItem, 'chave'>>(item.valor, {
            nome: item.chave,
            tipo: 'api',
            ambiente: 'sandbox',
            status: 'inativo',
          })
          return { chave: item.chave, ...parsed }
        }),
    [data],
  )

  const cadastroItems = useMemo(() => {
    const categoria = `cadastro:${activeCadastroTab}`
    return data
      .filter((item) => item.categoria === categoria)
      .map((item) => {
        const parsed = safeParseJson<Omit<CadastroItem, 'chave'>>(item.valor, {
          nome: item.chave,
          ativo: true,
        })
        return { chave: item.chave, ...parsed }
      })
  }, [activeCadastroTab, data])

  const openIntegracaoDialog = (mode: DialogMode, item: IntegracaoItem | null = null) => {
    setIntegracaoDialog({ open: true, mode, item })
    setIntegracaoForm({
      nome: item?.nome ?? '',
      tipo: item?.tipo ?? 'api',
      clientId: item?.clientId ?? '',
      apiKey: item?.apiKey ?? '',
      ambiente: item?.ambiente ?? 'sandbox',
      status: item?.status ?? 'ativo',
    })
  }

  const openCadastroDialog = (mode: DialogMode, item: CadastroItem | null = null) => {
    setCadastroDialog({ open: true, mode, item })
    setCadastroForm({
      nome: item?.nome ?? '',
      codigo: item?.codigo ?? '',
      descricao: item?.descricao ?? '',
      ativo: item?.ativo ?? true,
    })
  }

  const handleSaveClinica = async () => {
    await saveConfiguracoes([
      { chave: 'clinica_nome_fantasia', valor: clinicaForm.nomeFantasia, categoria: 'clinica' },
      { chave: 'clinica_razao_social', valor: clinicaForm.razaoSocial, categoria: 'clinica' },
      { chave: 'clinica_cnpj', valor: clinicaForm.cnpj, categoria: 'clinica' },
      {
        chave: 'clinica_inscricao_municipal',
        valor: clinicaForm.inscricaoMunicipal,
        categoria: 'clinica',
      },
      { chave: 'clinica_endereco', valor: clinicaForm.endereco, categoria: 'clinica' },
      { chave: 'clinica_telefone', valor: clinicaForm.telefone, categoria: 'clinica' },
      { chave: 'clinica_email', valor: clinicaForm.email, categoria: 'clinica' },
    ])
    toast.success('Perfil da clínica salvo.')
  }

  const handleSaveIdentidade = async () => {
    if (isSavingIdentidade) return
    if (!identidadeForm.nome.trim()) {
      toast.error('Nome da clínica é obrigatório.')
      return
    }
    setIsSavingIdentidade(true)
    try {
      await saveIdentidade({
        nome: identidadeForm.nome.trim(),
        cidade_uf: identidadeForm.cidade_uf || null,
        endereco: identidadeForm.endereco || null,
        cep: identidadeForm.cep || null,
        telefone: identidadeForm.telefone || null,
        logo_url: identidadeForm.logo_url || null,
        cor_primaria: identidadeForm.cor_primaria,
        cor_secundaria: identidadeForm.cor_secundaria,
      })
      toast.success('Identidade da clínica salva.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar identidade')
    } finally {
      setIsSavingIdentidade(false)
    }
  }

  const handleLogoUpload = async (file: File | null) => {
    if (!file) return
    setIsUploadingLogo(true)
    try {
      const url = await uploadLogo(file)
      setIdentidadeForm((current) => ({ ...current, logo_url: url }))
      toast.success('Logo enviado.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha no upload do logo')
    } finally {
      setIsUploadingLogo(false)
    }
  }

  const handleMaquininhaTaxaChange = (parcel: number, rawValue: string) => {
    const numeric = Number(rawValue)
    const normalized = Number.isFinite(numeric) ? Math.min(100, Math.max(0, numeric)) : 0
    setMaquininhaForm((current) => ({
      ...current,
      taxas_parcelas: current.taxas_parcelas.map((row) =>
        row.parcelas === parcel ? { ...row, taxa: normalized } : row,
      ),
    }))
  }

  const handleMaquininhaBandeiraToggle = (bandeira: Bandeira, checked: boolean) => {
    setMaquininhaForm((current) => {
      const set = new Set(current.bandeiras)
      if (checked) set.add(bandeira)
      else set.delete(bandeira)
      return { ...current, bandeiras: ALL_BANDEIRAS.filter((b) => set.has(b)) }
    })
  }

  const handleMaquininhaAntecipacaoChange = (rawValue: string) => {
    const numeric = Number(rawValue)
    const normalized = Number.isFinite(numeric) ? Math.min(100, Math.max(0, numeric)) : 0
    setMaquininhaForm((current) => ({ ...current, taxa_antecipacao: normalized }))
  }

  const handleMaquininhaPrazoDebitoChange = (value: MaquininhaConfig['prazo_debito']) => {
    setMaquininhaForm((current) => ({ ...current, prazo_debito: value }))
  }

  const handleMaquininhaPrazoCreditoAvistaChange = (
    value: MaquininhaConfig['prazo_credito_avista'],
  ) => {
    setMaquininhaForm((current) => ({ ...current, prazo_credito_avista: value }))
  }

  const handlePaymentDiscountChange = (method: keyof PaymentDiscounts, rawValue: string) => {
    const numeric = Number(rawValue)
    const normalized = Number.isFinite(numeric) ? Math.min(100, Math.max(0, numeric)) : 0
    setPaymentDiscountsForm((current) => ({ ...current, [method]: normalized }))
  }

  const handleSavePaymentConfig = async () => {
    if (isSavingPayment) return
    setIsSavingPayment(true)
    try {
      await Promise.all([
        saveMaquininha(maquininhaForm),
        savePaymentDiscounts(paymentDiscountsForm),
      ])
      toast.success('Configurações de pagamento salvas.')
    } catch {
      toast.error('Não foi possível salvar as configurações de pagamento.')
    } finally {
      setIsSavingPayment(false)
    }
  }

  const handleSaveSistema = async () => {
    await saveConfiguracoes([
      { chave: 'sistema_timezone', valor: sistemaForm.timezone, categoria: 'sistema' },
      { chave: 'sistema_moeda', valor: sistemaForm.moeda, categoria: 'sistema' },
      { chave: 'sistema_notif_email', valor: String(sistemaForm.notifEmail), categoria: 'sistema' },
      { chave: 'sistema_backup_auto', valor: String(sistemaForm.backupAuto), categoria: 'sistema' },
    ])
    toast.success('Configurações globais salvas.')
  }

  const handleSaveWhatsapp = async () => {
    if (isSavingWhatsapp) return
    setIsSavingWhatsapp(true)
    try {
      await saveConfiguracoes([
        { chave: 'whatsapp.ativo', valor: String(whatsappForm.ativo), categoria: 'whatsapp' },
        { chave: 'whatsapp.base_url', valor: whatsappForm.baseUrl.trim(), categoria: 'whatsapp' },
        { chave: 'whatsapp.api_key', valor: whatsappForm.apiKey, categoria: 'whatsapp' },
        { chave: 'whatsapp.instance', valor: whatsappForm.instance.trim(), categoria: 'whatsapp' },
        {
          chave: 'whatsapp.lembrete_ativo',
          valor: String(whatsappForm.lembreteAtivo),
          categoria: 'whatsapp',
        },
        {
          chave: 'whatsapp.pos_consulta_ativo',
          valor: String(whatsappForm.posConsultaAtivo),
          categoria: 'whatsapp',
        },
        {
          chave: 'whatsapp.aniversario_ativo',
          valor: String(whatsappForm.aniversarioAtivo),
          categoria: 'whatsapp',
        },
        {
          chave: 'whatsapp.lembrete_horas_antes',
          valor: whatsappForm.lembreteHorasAntes,
          categoria: 'whatsapp',
        },
        {
          chave: 'whatsapp.pos_consulta_horas_apos',
          valor: whatsappForm.posConsultaHorasApos,
          categoria: 'whatsapp',
        },
        {
          chave: 'whatsapp.template_lembrete',
          valor: whatsappForm.templateLembrete,
          categoria: 'whatsapp',
        },
        {
          chave: 'whatsapp.template_pos_consulta',
          valor: whatsappForm.templatePosConsulta,
          categoria: 'whatsapp',
        },
        {
          chave: 'whatsapp.template_aniversario',
          valor: whatsappForm.templateAniversario,
          categoria: 'whatsapp',
        },
      ])
      toast.success('Configurações do WhatsApp salvas.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar WhatsApp')
    } finally {
      setIsSavingWhatsapp(false)
    }
  }

  const handleTestWhatsapp = async () => {
    if (isTestingWhatsapp) return
    setIsTestingWhatsapp(true)
    try {
      const result = await api.post<{ ok: boolean; error?: string }>('/api/whatsapp/disparar', {
        action: 'testar_conexao',
        baseUrl: whatsappForm.baseUrl.trim(),
        instance: whatsappForm.instance.trim(),
        apiKey: whatsappForm.apiKey,
      })
      if (result.ok) {
        setWhatsappTest('ok')
        toast.success('Conexão com a Evolution API bem-sucedida.')
      } else {
        setWhatsappTest('fail')
        toast.error(result.error ?? 'Falha ao conectar na Evolution API.')
      }
    } catch (err) {
      setWhatsappTest('fail')
      toast.error(err instanceof Error ? err.message : 'Falha ao testar conexão')
    } finally {
      setIsTestingWhatsapp(false)
    }
  }

  const toggleDiaSemana = (dia: number) => {
    setChatbotForm((current) => {
      const set = new Set(current.diasSemana)
      if (set.has(dia)) set.delete(dia)
      else set.add(dia)
      return { ...current, diasSemana: Array.from(set).sort((a, b) => a - b) }
    })
  }

  const handleSaveChatbot = async () => {
    if (isSavingChatbot) return
    setIsSavingChatbot(true)
    try {
      await saveConfiguracoes([
        { chave: 'chatbot.ativo', valor: String(chatbotForm.ativo), categoria: 'chatbot' },
        { chave: 'chatbot.horario_inicio', valor: chatbotForm.horarioInicio, categoria: 'chatbot' },
        { chave: 'chatbot.horario_fim', valor: chatbotForm.horarioFim, categoria: 'chatbot' },
        {
          chave: 'chatbot.dias_semana',
          valor: chatbotForm.diasSemana.join(','),
          categoria: 'chatbot',
        },
        {
          chave: 'chatbot.mensagem_fora_horario',
          valor: chatbotForm.mensagemForaHorario,
          categoria: 'chatbot',
        },
        {
          chave: 'chatbot.mensagem_boas_vindas',
          valor: chatbotForm.mensagemBoasVindas,
          categoria: 'chatbot',
        },
      ])
      toast.success('Configurações do chatbot salvas.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar chatbot')
    } finally {
      setIsSavingChatbot(false)
    }
  }

  const handleSaveCielo = async () => {
    if (isSavingCielo) return
    setIsSavingCielo(true)
    try {
      await saveConfiguracoes([
        { chave: 'cielo.ativo', valor: String(cieloForm.ativo), categoria: 'cielo' },
        { chave: 'cielo.merchant_id', valor: cieloForm.merchantId.trim(), categoria: 'cielo' },
        { chave: 'cielo.merchant_key', valor: cieloForm.merchantKey, categoria: 'cielo' },
        { chave: 'cielo.link_access_token', valor: cieloForm.linkAccessToken, categoria: 'cielo' },
        { chave: 'cielo.ambiente', valor: cieloForm.ambiente, categoria: 'cielo' },
      ])
      toast.success('Configurações Cielo salvas.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar Cielo')
    } finally {
      setIsSavingCielo(false)
    }
  }

  const handleTestCielo = async () => {
    try {
      const result = await api.get<{ ok: boolean; error?: string }>(
        '/api/pagamentos/online?action=teste_cielo',
      )
      setCieloTest(result.ok ? 'ok' : 'fail')
      if (result.ok) toast.success('Cielo configurada.')
      else toast.error(result.error ?? 'Cielo não configurada.')
    } catch (err) {
      setCieloTest('fail')
      toast.error(err instanceof Error ? err.message : 'Falha ao testar Cielo')
    }
  }

  const handleSaveSicredi = async () => {
    if (isSavingSicredi) return
    setIsSavingSicredi(true)
    try {
      await saveConfiguracoes([
        { chave: 'sicredi.ativo', valor: String(sicrediForm.ativo), categoria: 'sicredi' },
        { chave: 'sicredi.client_id', valor: sicrediForm.clientId.trim(), categoria: 'sicredi' },
        { chave: 'sicredi.client_secret', valor: sicrediForm.clientSecret, categoria: 'sicredi' },
        { chave: 'sicredi.chave_pix', valor: sicrediForm.chavePix.trim(), categoria: 'sicredi' },
        { chave: 'sicredi.ambiente', valor: sicrediForm.ambiente, categoria: 'sicredi' },
      ])
      toast.success('Configurações Sicredi salvas.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar Sicredi')
    } finally {
      setIsSavingSicredi(false)
    }
  }

  const handleTestSicredi = async () => {
    try {
      const result = await api.get<{ ok: boolean; error?: string }>(
        '/api/pagamentos/online?action=teste_sicredi',
      )
      setSicrediTest(result.ok ? 'ok' : 'fail')
      if (result.ok) toast.success('Sicredi conectada (token OAuth OK).')
      else toast.error(result.error ?? 'Falha ao conectar na Sicredi.')
    } catch (err) {
      setSicrediTest('fail')
      toast.error(err instanceof Error ? err.message : 'Falha ao testar Sicredi')
    }
  }

  const handleSaveIntegracao = async () => {
    const chave = integracaoDialog.item?.chave ?? createKey('integracao')
    await saveConfiguracoes([
      {
        chave,
        categoria: 'integracao',
        valor: JSON.stringify({
          nome: integracaoForm.nome,
          tipo: integracaoForm.tipo,
          clientId: integracaoForm.clientId,
          apiKey: integracaoForm.apiKey,
          ambiente: integracaoForm.ambiente,
          status: integracaoForm.status,
          ultimoTeste: new Date().toLocaleString('pt-BR'),
        }),
      },
    ])
    setIntegracaoDialog({ open: false, mode: 'create', item: null })
    toast.success('Integração salva.')
  }

  const handleSaveCadastro = async () => {
    const chave = cadastroDialog.item?.chave ?? createKey(`cadastro.${activeCadastroTab}`)
    await saveConfiguracoes([
      {
        chave,
        categoria: `cadastro:${activeCadastroTab}`,
        valor: JSON.stringify({
          nome: cadastroForm.nome,
          codigo: cadastroForm.codigo,
          descricao: cadastroForm.descricao,
          ativo: cadastroForm.ativo,
        }),
      },
    ])
    setCadastroDialog({ open: false, mode: 'create', item: null })
    toast.success('Cadastro salvo.')
  }

  const handleDelete = async () => {
    await deleteConfiguracao(deleteDialog.chave)
    setDeleteDialog({ open: false, chave: '', label: '' })
    toast.success('Item excluído.')
  }

  return (
    <div className="app-page app-page-loose app-page-frame pb-10">
      <PageHeader
        title="Configurações da Clínica"
        description="Gerencie identidade institucional, sistema, integrações e cadastros corporativos."
        breadcrumb={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Início</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/configuracoes">Configurações</BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
      />

      <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
        <SegmentedControl
          options={[
            'Identidade',
            'Clínica',
            'Sistema',
            'Integrações',
            'Cadastros',
            'Pagamento',
          ].map((tab) => ({
            value: tab,
            label: tab,
          }))}
          value={activeTab}
          onChange={(value) => setActiveTab(value as MainTab)}
        />
      </div>

      <div className="rounded-[24px] border border-app-border bg-app-card p-8 dark:border-app-border-dark dark:bg-app-card-dark shadow-sm">
        {error && <p className="mb-4 text-sm text-[var(--app-danger-text)]">{error}</p>}
        {isLoading && (
          <p className="mb-4 text-sm text-app-text-secondary dark:text-white/60">
            Carregando configurações...
          </p>
        )}

        {activeTab === 'Identidade' && (
          <div className="space-y-8">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-app-text-primary dark:text-white">
                <Palette size={20} />
                <h3 className="text-xl font-normal">Identidade da Clínica</h3>
              </div>
              <p className="text-app-text-secondary dark:text-white/60 font-normal">
                Nome, contato, logo e cores usados nos documentos gerados pelo sistema (laudos,
                atestados, encaminhamentos, recibos). Substitui a marca &quot;Integrallys&quot; onde
                ela aparece como assinante ou rodapé.
              </p>
            </div>

            {isIdentidadeLoading && (
              <p className="text-sm text-app-text-secondary dark:text-white/60">
                Carregando identidade...
              </p>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-6 bg-app-surface-muted dark:bg-app-surface-muted rounded-[16px] border border-app-border dark:border-app-border-dark">
                  <div
                    className="w-32 h-32 rounded-lg border border-app-border dark:border-app-border-dark flex items-center justify-center overflow-hidden shrink-0"
                    style={{ backgroundColor: identidadeForm.cor_secundaria }}
                  >
                    {identidadeForm.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      // biome-ignore lint/performance/noImgElement: preview de logo enviado pelo usuário (URL/data URL dinâmica — next/image não se aplica)
                      <img
                        src={identidadeForm.logo_url}
                        alt="Logo"
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <span className="text-xs text-app-text-muted uppercase tracking-wider font-medium">
                        Logotipo
                      </span>
                    )}
                  </div>
                  <div className="space-y-3 flex-1">
                    <h4 className="text-sm font-normal dark:text-white">Logotipo da Clínica</h4>
                    <p className="text-xs text-app-text-muted font-normal max-w-md leading-relaxed">
                      PNG, JPG, SVG ou WEBP — até 2 MB. Aparece no cabeçalho dos documentos.
                    </p>
                    <div className="flex gap-2">
                      <label className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-app-border dark:border-app-border-dark text-sm font-normal cursor-pointer hover:bg-app-hover/40">
                        <Upload className="h-3.5 w-3.5" />
                        {isUploadingLogo ? 'Enviando...' : 'Carregar nova'}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/svg+xml,image/webp"
                          className="hidden"
                          disabled={isUploadingLogo}
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null
                            void handleLogoUpload(file)
                            event.target.value = ''
                          }}
                        />
                      </label>
                      {identidadeForm.logo_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-lg h-9 font-normal text-[var(--app-danger-text)]"
                          onClick={() =>
                            setIdentidadeForm((current) => ({ ...current, logo_url: '' }))
                          }
                        >
                          Remover
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <label
                      htmlFor="cfg-nome"
                      className="text-sm font-normal text-[var(--app-text-primary)] dark:text-white/70 ml-1"
                    >
                      Nome da clínica <span className="text-[var(--app-danger-text)]">*</span>
                    </label>
                    <Input
                      id="cfg-nome"
                      value={identidadeForm.nome}
                      onChange={(event) =>
                        setIdentidadeForm((current) => ({ ...current, nome: event.target.value }))
                      }
                      placeholder="Ex.: Clínica Integrativa Natur & Vida"
                      className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="cfg-cidade-uf"
                      className="text-sm font-normal text-[var(--app-text-primary)] dark:text-white/70 ml-1"
                    >
                      Cidade/UF
                    </label>
                    <Input
                      id="cfg-cidade-uf"
                      value={identidadeForm.cidade_uf}
                      onChange={(event) =>
                        setIdentidadeForm((current) => ({
                          ...current,
                          cidade_uf: event.target.value,
                        }))
                      }
                      placeholder="Ex.: Água Boa/MT"
                      className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="cfg-cep"
                      className="text-sm font-normal text-[var(--app-text-primary)] dark:text-white/70 ml-1"
                    >
                      CEP
                    </label>
                    <Input
                      id="cfg-cep"
                      value={identidadeForm.cep}
                      onChange={(event) =>
                        setIdentidadeForm((current) => ({ ...current, cep: event.target.value }))
                      }
                      placeholder="00000-000"
                      className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label
                      htmlFor="cfg-endereco"
                      className="text-sm font-normal text-[var(--app-text-primary)] dark:text-white/70 ml-1"
                    >
                      Endereço
                    </label>
                    <Input
                      id="cfg-endereco"
                      value={identidadeForm.endereco}
                      onChange={(event) =>
                        setIdentidadeForm((current) => ({
                          ...current,
                          endereco: event.target.value,
                        }))
                      }
                      placeholder="Rua, número, bairro"
                      className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="cfg-telefone"
                      className="text-sm font-normal text-[var(--app-text-primary)] dark:text-white/70 ml-1"
                    >
                      Telefone
                    </label>
                    <Input
                      id="cfg-telefone"
                      value={identidadeForm.telefone}
                      onChange={(event) =>
                        setIdentidadeForm((current) => ({
                          ...current,
                          telefone: event.target.value,
                        }))
                      }
                      placeholder="(00) 00000-0000"
                      className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label
                      htmlFor="cfg-cor-primaria"
                      className="text-sm font-normal text-[var(--app-text-primary)] dark:text-white/70 ml-1"
                    >
                      Cor primária
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        id="cfg-cor-primaria"
                        type="color"
                        value={identidadeForm.cor_primaria}
                        onChange={(event) =>
                          setIdentidadeForm((current) => ({
                            ...current,
                            cor_primaria: event.target.value,
                          }))
                        }
                        className="h-12 w-16 rounded-lg border border-app-border dark:border-app-border-dark cursor-pointer bg-transparent p-1"
                      />
                      <Input
                        value={identidadeForm.cor_primaria}
                        onChange={(event) =>
                          setIdentidadeForm((current) => ({
                            ...current,
                            cor_primaria: event.target.value,
                          }))
                        }
                        placeholder="#000000"
                        className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal font-mono text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="cfg-cor-secundaria"
                      className="text-sm font-normal text-[var(--app-text-primary)] dark:text-white/70 ml-1"
                    >
                      Cor secundária
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        id="cfg-cor-secundaria"
                        type="color"
                        value={identidadeForm.cor_secundaria}
                        onChange={(event) =>
                          setIdentidadeForm((current) => ({
                            ...current,
                            cor_secundaria: event.target.value,
                          }))
                        }
                        className="h-12 w-16 rounded-lg border border-app-border dark:border-app-border-dark cursor-pointer bg-transparent p-1"
                      />
                      <Input
                        value={identidadeForm.cor_secundaria}
                        onChange={(event) =>
                          setIdentidadeForm((current) => ({
                            ...current,
                            cor_secundaria: event.target.value,
                          }))
                        }
                        placeholder="#ffffff"
                        className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <aside className="rounded-2xl border border-app-border dark:border-app-border-dark p-6 space-y-4 h-fit sticky top-4">
                <h4 className="text-sm font-normal text-app-text-secondary dark:text-white/70 uppercase tracking-wider">
                  Pré-visualização
                </h4>
                <div
                  className="rounded-xl overflow-hidden border border-app-border dark:border-app-border-dark"
                  style={{ backgroundColor: identidadeForm.cor_secundaria }}
                >
                  <div
                    className="px-4 py-3 flex items-center gap-3"
                    style={{ backgroundColor: identidadeForm.cor_primaria }}
                  >
                    {identidadeForm.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      // biome-ignore lint/performance/noImgElement: preview de logo enviado pelo usuário (URL/data URL dinâmica — next/image não se aplica)
                      <img
                        src={identidadeForm.logo_url}
                        alt="Logo"
                        className="h-10 w-10 object-contain bg-white/10 rounded"
                      />
                    ) : (
                      <div className="h-10 w-10 bg-white/10 rounded" />
                    )}
                    <div className="text-white text-xs font-medium leading-tight">
                      <div className="truncate">{identidadeForm.nome || 'Nome da clínica'}</div>
                      {identidadeForm.cidade_uf && (
                        <div className="opacity-80">{identidadeForm.cidade_uf}</div>
                      )}
                    </div>
                  </div>
                  <div
                    className="p-4 space-y-2 text-xs"
                    style={{ color: identidadeForm.cor_primaria }}
                  >
                    <div className="font-semibold uppercase tracking-wider">Declaração</div>
                    <p className="text-xs leading-relaxed opacity-80">
                      Prévia de como o cabeçalho dos documentos gerados aparecerá para o paciente.
                    </p>
                    <div className="pt-2 text-xs opacity-60 border-t border-current/20">
                      {identidadeForm.endereco || 'Endereço...'}
                      {identidadeForm.telefone ? ` · ${identidadeForm.telefone}` : ''}
                    </div>
                  </div>
                </div>
              </aside>
            </div>

            <div className="flex justify-end">
              <Button
                className="h-12 px-10 bg-app-primary hover:bg-app-primary-hover text-white font-normal rounded-xl shadow-lg shadow-[var(--app-primary)]/20"
                onClick={() => void handleSaveIdentidade()}
                disabled={isSavingIdentidade}
              >
                <Save className="h-4 w-4 mr-2" />
                {isSavingIdentidade ? 'Salvando...' : 'Salvar identidade'}
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'Clínica' && (
          <div className="space-y-8">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-app-text-primary dark:text-white">
                <Building size={20} />
                <h3 className="text-xl font-normal">Perfil da Clínica</h3>
              </div>
              <p className="text-app-text-secondary dark:text-white/60 font-normal">
                Dados cadastrais e fiscais da empresa (razão social, CNPJ, inscrição municipal).
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-[16px] border border-app-border dark:border-app-border-dark bg-app-surface-muted dark:bg-app-surface-muted">
              <p className="text-sm text-app-text-secondary dark:text-white/70 font-normal flex-1">
                O nome, a cidade/UF, o logotipo e o contato que saem nos documentos (declaração, encaminhamento,
                laudos, recibos) ficam na aba Identidade.
              </p>
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-11 whitespace-normal rounded-xl font-normal w-full sm:w-auto"
                onClick={() => setActiveTab('Identidade')}
              >
                Abrir Identidade
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                ['Nome Fantasia', clinicaForm.nomeFantasia, 'nomeFantasia'],
                ['Razão Social', clinicaForm.razaoSocial, 'razaoSocial'],
                ['CNPJ', clinicaForm.cnpj, 'cnpj'],
                ['Inscrição Municipal', clinicaForm.inscricaoMunicipal, 'inscricaoMunicipal'],
                ['Endereço', clinicaForm.endereco, 'endereco'],
                ['Telefone', clinicaForm.telefone, 'telefone'],
                ['Email', clinicaForm.email, 'email'],
              ].map(([label, value, field]) => (
                <div
                  key={String(field)}
                  className={`space-y-2 ${field === 'endereco' || field === 'email' ? 'md:col-span-2' : ''}`}
                >
                  <label
                    htmlFor={`cfg-clinica-${String(field)}`}
                    className="text-sm font-normal text-[var(--app-text-primary)] dark:text-white/70 ml-1"
                  >
                    {label}
                  </label>
                  <Input
                    id={`cfg-clinica-${String(field)}`}
                    value={String(value)}
                    onChange={(event) =>
                      setClinicaForm((current) => ({
                        ...current,
                        [String(field)]: event.target.value,
                      }))
                    }
                    className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <Button
                className="h-12 px-10 bg-app-primary hover:bg-app-primary-hover text-white font-normal rounded-xl shadow-lg shadow-[var(--app-primary)]/20"
                onClick={() => void salvarComAviso(handleSaveClinica)}
              >
                <Save className="h-4 w-4 mr-2" />
                Salvar alterações
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'Sistema' && (
          <div className="space-y-8">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-app-text-primary dark:text-white">
                <Settings2 size={20} />
                <h3 className="text-xl font-normal">Configurações globais</h3>
              </div>
              <p className="text-app-text-secondary dark:text-white/60 font-normal">
                Preferências corporativas compartilhadas pela clínica.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label
                  htmlFor="cfg-timezone"
                  className="text-sm font-normal text-[var(--app-text-primary)] dark:text-white/70 ml-1"
                >
                  Fuso horário
                </label>
                <Select
                  value={sistemaForm.timezone}
                  onValueChange={(value) =>
                    setSistemaForm((current) => ({ ...current, timezone: value }))
                  }
                >
                  <SelectTrigger
                    id="cfg-timezone"
                    className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                  >
                    <SelectValue placeholder="Selecione o fuso" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/Sao_Paulo">America/Sao_Paulo</SelectItem>
                    <SelectItem value="America/Manaus">America/Manaus</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="cfg-moeda"
                  className="text-sm font-normal text-[var(--app-text-primary)] dark:text-white/70 ml-1"
                >
                  Moeda padrão
                </label>
                <Select
                  value={sistemaForm.moeda}
                  onValueChange={(value) =>
                    setSistemaForm((current) => ({ ...current, moeda: value }))
                  }
                >
                  <SelectTrigger
                    id="cfg-moeda"
                    className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                  >
                    <SelectValue placeholder="Selecione a moeda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">BRL</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl p-4 border border-app-border dark:border-app-border-dark">
                <div>
                  <p className="font-normal text-app-text-primary dark:text-white">
                    Notificações por e-mail
                  </p>
                  <p className="text-sm text-app-text-secondary dark:text-white/60 font-normal">
                    Resumo institucional de alertas do sistema.
                  </p>
                </div>
                <Switch
                  checked={sistemaForm.notifEmail}
                  onCheckedChange={(value) =>
                    setSistemaForm((current) => ({ ...current, notifEmail: value }))
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-2xl p-4 border border-app-border dark:border-app-border-dark">
                <div>
                  <p className="font-normal text-app-text-primary dark:text-white">
                    Backup automático
                  </p>
                  <p className="text-sm text-app-text-secondary dark:text-white/60 font-normal">
                    Ativa lembretes de backup periódico.
                  </p>
                </div>
                <Switch
                  checked={sistemaForm.backupAuto}
                  onCheckedChange={(value) =>
                    setSistemaForm((current) => ({ ...current, backupAuto: value }))
                  }
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                className="h-12 px-10 bg-app-primary hover:bg-app-primary-hover text-white font-normal rounded-xl shadow-lg shadow-[var(--app-primary)]/20"
                onClick={() => void salvarComAviso(handleSaveSistema)}
              >
                <Save className="h-4 w-4 mr-2" />
                Salvar alterações
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'Integrações' && (
          <div className="space-y-8">
            <div className="rounded-2xl border border-app-border bg-app-card p-6 shadow-sm dark:border-app-border-dark dark:bg-app-card-dark space-y-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-app-text-primary dark:text-white">
                    <MessageSquare size={20} />
                    <h3 className="text-xl font-normal">WhatsApp (Evolution API)</h3>
                    {whatsappTest === 'ok' && (
                      <span className="rounded-full bg-[var(--app-success-bg)] px-3 py-1 text-xs font-medium text-[var(--app-success-text)]">
                        Conectado
                      </span>
                    )}
                    {whatsappTest === 'fail' && (
                      <span className="rounded-full bg-[var(--app-danger-bg)] px-3 py-1 text-xs font-medium text-[var(--app-danger-text)]">
                        Desconectado
                      </span>
                    )}
                  </div>
                  <p className="text-app-text-secondary dark:text-white/60 font-normal">
                    Disparos automáticos de lembretes, pós-consulta, aniversário e campanhas.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">
                    Ativo
                  </span>
                  <Switch
                    checked={whatsappForm.ativo}
                    onCheckedChange={(value) =>
                      setWhatsappForm((current) => ({ ...current, ativo: value }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">
                    URL base
                  </span>
                  <Input
                    value={whatsappForm.baseUrl}
                    onChange={(event) =>
                      setWhatsappForm((current) => ({ ...current, baseUrl: event.target.value }))
                    }
                    placeholder="https://evolution.meuservidor.com"
                    className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">
                    Instância
                  </span>
                  <Input
                    value={whatsappForm.instance}
                    onChange={(event) =>
                      setWhatsappForm((current) => ({ ...current, instance: event.target.value }))
                    }
                    placeholder="integrallys"
                    className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">
                    API Key
                  </span>
                  <Input
                    type="password"
                    value={whatsappForm.apiKey}
                    onChange={(event) =>
                      setWhatsappForm((current) => ({ ...current, apiKey: event.target.value }))
                    }
                    placeholder={CONFIG_MASK}
                    className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                  />
                  <p className="text-xs font-normal text-app-text-muted dark:text-white/40">
                    A chave fica oculta após salva. Deixe o campo como está ({CONFIG_MASK}) para
                    mantê-la.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  className="h-11 rounded-xl border-app-border dark:border-app-border-dark"
                  onClick={() => void handleTestWhatsapp()}
                  disabled={isTestingWhatsapp}
                >
                  {isTestingWhatsapp ? 'Testando...' : 'Testar conexão'}
                </Button>
                <Button
                  className="h-11 rounded-xl bg-app-primary px-6 text-white hover:bg-app-primary-hover"
                  onClick={() => void handleSaveWhatsapp()}
                  disabled={isSavingWhatsapp}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSavingWhatsapp ? 'Salvando...' : 'Salvar WhatsApp'}
                </Button>
              </div>

              <div className="space-y-4 rounded-2xl border border-app-border bg-app-bg-secondary/40 p-5 dark:border-app-border-dark dark:bg-app-hover/30">
                <h4 className="text-lg font-normal text-app-text-primary dark:text-white">
                  Automações
                </h4>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-sm font-medium text-app-text-primary dark:text-white">
                      Lembrete de consulta
                    </span>
                    <p className="text-xs font-normal text-app-text-muted dark:text-white/40">
                      Enviado X horas antes do agendamento.
                    </p>
                  </div>
                  <Switch
                    checked={whatsappForm.lembreteAtivo}
                    onCheckedChange={(value) =>
                      setWhatsappForm((current) => ({ ...current, lembreteAtivo: value }))
                    }
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">
                      Horas antes
                    </span>
                    <Input
                      type="number"
                      min={1}
                      value={whatsappForm.lembreteHorasAntes}
                      onChange={(event) =>
                        setWhatsappForm((current) => ({
                          ...current,
                          lembreteHorasAntes: event.target.value,
                        }))
                      }
                      className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">
                    Template do lembrete
                  </span>
                  <Textarea
                    value={whatsappForm.templateLembrete}
                    onChange={(event) =>
                      setWhatsappForm((current) => ({
                        ...current,
                        templateLembrete: event.target.value,
                      }))
                    }
                    className="min-h-[90px] rounded-xl"
                  />
                  <p className="text-xs font-normal text-app-text-muted dark:text-white/40">
                    Variáveis: {'{paciente}'} · {'{data}'} · {'{hora}'} · {'{especialista}'}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-app-border pt-4 dark:border-app-border-dark">
                  <div className="space-y-0.5">
                    <span className="text-sm font-medium text-app-text-primary dark:text-white">
                      Pós-consulta
                    </span>
                    <p className="text-xs font-normal text-app-text-muted dark:text-white/40">
                      Enviado Y horas após o check-out.
                    </p>
                  </div>
                  <Switch
                    checked={whatsappForm.posConsultaAtivo}
                    onCheckedChange={(value) =>
                      setWhatsappForm((current) => ({ ...current, posConsultaAtivo: value }))
                    }
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">
                      Horas após
                    </span>
                    <Input
                      type="number"
                      min={1}
                      value={whatsappForm.posConsultaHorasApos}
                      onChange={(event) =>
                        setWhatsappForm((current) => ({
                          ...current,
                          posConsultaHorasApos: event.target.value,
                        }))
                      }
                      className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">
                    Template pós-consulta
                  </span>
                  <Textarea
                    value={whatsappForm.templatePosConsulta}
                    onChange={(event) =>
                      setWhatsappForm((current) => ({
                        ...current,
                        templatePosConsulta: event.target.value,
                      }))
                    }
                    className="min-h-[90px] rounded-xl"
                  />
                  <p className="text-xs font-normal text-app-text-muted dark:text-white/40">
                    Variáveis: {'{paciente}'} · {'{especialista}'}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-app-border pt-4 dark:border-app-border-dark">
                  <div className="space-y-0.5">
                    <span className="text-sm font-medium text-app-text-primary dark:text-white">
                      Aniversário
                    </span>
                    <p className="text-xs font-normal text-app-text-muted dark:text-white/40">
                      Enviado às 9h no dia do aniversário do paciente.
                    </p>
                  </div>
                  <Switch
                    checked={whatsappForm.aniversarioAtivo}
                    onCheckedChange={(value) =>
                      setWhatsappForm((current) => ({ ...current, aniversarioAtivo: value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">
                    Template de aniversário
                  </span>
                  <Textarea
                    value={whatsappForm.templateAniversario}
                    onChange={(event) =>
                      setWhatsappForm((current) => ({
                        ...current,
                        templateAniversario: event.target.value,
                      }))
                    }
                    className="min-h-[90px] rounded-xl"
                  />
                  <p className="text-xs font-normal text-app-text-muted dark:text-white/40">
                    Variáveis: {'{paciente}'}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-app-border bg-app-card p-6 shadow-sm dark:border-app-border-dark dark:bg-app-card-dark space-y-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-app-text-primary dark:text-white">
                    <MessageSquare size={20} />
                    <h3 className="text-xl font-normal">Chatbot de agendamento</h3>
                  </div>
                  <p className="text-app-text-secondary dark:text-white/60 font-normal">
                    Atendimento automático via WhatsApp (depende da conexão acima).
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">
                    Ativo
                  </span>
                  <Switch
                    checked={chatbotForm.ativo}
                    onCheckedChange={(value) =>
                      setChatbotForm((current) => ({ ...current, ativo: value }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">
                    Horário de início
                  </span>
                  <Input
                    type="time"
                    value={chatbotForm.horarioInicio}
                    onChange={(event) =>
                      setChatbotForm((current) => ({
                        ...current,
                        horarioInicio: event.target.value,
                      }))
                    }
                    className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">
                    Horário de fim
                  </span>
                  <Input
                    type="time"
                    value={chatbotForm.horarioFim}
                    onChange={(event) =>
                      setChatbotForm((current) => ({ ...current, horarioFim: event.target.value }))
                    }
                    className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">
                  Dias da semana
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { dia: 0, label: 'Dom' },
                    { dia: 1, label: 'Seg' },
                    { dia: 2, label: 'Ter' },
                    { dia: 3, label: 'Qua' },
                    { dia: 4, label: 'Qui' },
                    { dia: 5, label: 'Sex' },
                    { dia: 6, label: 'Sáb' },
                  ].map(({ dia, label }) => {
                    const active = chatbotForm.diasSemana.includes(dia)
                    return (
                      <Button
                        key={dia}
                        type="button"
                        variant="ghost"
                        className={`h-10 w-14 rounded-xl font-normal ${active ? 'bg-app-primary text-white hover:bg-app-primary-hover' : 'border border-app-border dark:border-app-border-dark'}`}
                        onClick={() => toggleDiaSemana(dia)}
                      >
                        {label}
                      </Button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">
                  Mensagem fora do horário
                </span>
                <Textarea
                  value={chatbotForm.mensagemForaHorario}
                  onChange={(event) =>
                    setChatbotForm((current) => ({
                      ...current,
                      mensagemForaHorario: event.target.value,
                    }))
                  }
                  className="min-h-[80px] rounded-xl"
                />
                <p className="text-xs font-normal text-app-text-muted dark:text-white/40">
                  Variáveis: {'{horario_inicio}'} · {'{horario_fim}'}
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">
                  Mensagem de boas-vindas
                </span>
                <Textarea
                  value={chatbotForm.mensagemBoasVindas}
                  onChange={(event) =>
                    setChatbotForm((current) => ({
                      ...current,
                      mensagemBoasVindas: event.target.value,
                    }))
                  }
                  className="min-h-[80px] rounded-xl"
                />
              </div>

              <Button
                className="h-11 rounded-xl bg-app-primary px-6 text-white hover:bg-app-primary-hover"
                onClick={() => void handleSaveChatbot()}
                disabled={isSavingChatbot}
              >
                <Save className="mr-2 h-4 w-4" />
                {isSavingChatbot ? 'Salvando...' : 'Salvar chatbot'}
              </Button>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-app-text-primary dark:text-white">
                  <Globe size={20} />
                  <h3 className="text-xl font-normal">Conexões externas</h3>
                </div>
                <p className="text-app-text-secondary dark:text-white/60 font-normal">
                  Integrações com serviços e APIs institucionais.
                </p>
              </div>
              <Button
                className="h-11 rounded-xl bg-app-primary px-6 text-white hover:bg-app-primary-hover"
                onClick={() => openIntegracaoDialog('create')}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova API
              </Button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-app-border dark:border-app-border-dark">
              <table className="w-full min-w-[760px]">
                <thead className="bg-app-bg-secondary dark:bg-app-hover/60">
                  <tr className="text-left">
                    {['Nome', 'Tipo', 'Ambiente', 'Status', 'Último teste', 'Ações'].map(
                      (header) => (
                        <th
                          key={header}
                          className="px-4 py-3 text-sm font-normal text-app-text-secondary dark:text-white/70"
                        >
                          {header}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {integracoes.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-sm text-app-text-secondary dark:text-white/60"
                      >
                        Nenhuma integração cadastrada.
                      </td>
                    </tr>
                  ) : (
                    integracoes.map((item) => (
                      <tr
                        key={item.chave}
                        className="border-t border-app-border dark:border-app-border-dark"
                      >
                        <td className="px-4 py-3 text-sm text-app-text-primary dark:text-white">
                          {item.nome}
                        </td>
                        <td className="px-4 py-3 text-sm text-app-text-secondary dark:text-white/70">
                          {item.tipo}
                        </td>
                        <td className="px-4 py-3 text-sm text-app-text-secondary dark:text-white/70">
                          {item.ambiente}
                        </td>
                        <td className="px-4 py-3 text-sm text-app-text-secondary dark:text-white/70">
                          {item.status}
                        </td>
                        <td className="px-4 py-3 text-sm text-app-text-secondary dark:text-white/70">
                          {item.ultimoTeste ?? 'Nunca'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg"
                              onClick={() => openIntegracaoDialog('view', item)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg"
                              onClick={() => openIntegracaoDialog('edit', item)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg text-[var(--app-danger-text)]"
                              onClick={() =>
                                setDeleteDialog({ open: true, chave: item.chave, label: item.nome })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'Cadastros' && (
          <div className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-app-text-primary dark:text-white">
                  <Bell size={20} />
                  <h3 className="text-xl font-normal">Cadastros auxiliares</h3>
                </div>
                <p className="text-app-text-secondary dark:text-white/60 font-normal">
                  Itens administrativos usados em telas corporativas.
                </p>
              </div>
              <Button
                className="h-11 rounded-xl bg-app-primary px-6 text-white hover:bg-app-primary-hover"
                onClick={() =>
                  activeCadastroTab === 'procedimentos'
                    ? router.push('/procedimentos')
                    : openCadastroDialog('create')
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                {activeCadastroTab === 'procedimentos' ? 'Abrir tela dedicada' : 'Adicionar'}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {CADASTRO_TABS.map((tab) => {
                const active = activeCadastroTab === tab.key
                return (
                  <Button
                    key={tab.key}
                    variant="ghost"
                    className={`h-10 rounded-xl font-normal ${active ? 'bg-app-primary text-white hover:bg-app-primary-hover' : 'border border-app-border dark:border-app-border-dark'}`}
                    onClick={() => setActiveCadastroTab(tab.key)}
                  >
                    {tab.label}
                  </Button>
                )
              })}
            </div>

            {activeCadastroTab === 'procedimentos' ? (
              <div className="rounded-2xl border border-app-border bg-app-bg-secondary/40 p-6 dark:border-app-border-dark dark:bg-app-hover/30">
                <div className="space-y-2">
                  <h4 className="text-lg font-normal text-app-text-primary dark:text-white">
                    Cadastro dedicado de procedimentos
                  </h4>
                  <p className="text-sm font-normal text-app-text-secondary dark:text-white/60">
                    Procedimentos agora usam tabela própria para abastecer a lista de espera e
                    outros fluxos clínicos.
                  </p>
                </div>
                <div className="pt-4">
                  <Button
                    className="h-11 rounded-xl bg-app-primary px-6 text-white hover:bg-app-primary-hover"
                    onClick={() => router.push('/procedimentos')}
                  >
                    Abrir gestão de procedimentos
                  </Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-app-border dark:border-app-border-dark">
                <table className="w-full min-w-[680px]">
                  <thead className="bg-app-bg-secondary dark:bg-app-hover/60">
                    <tr className="text-left">
                      {['Nome', 'Código', 'Descrição', 'Status', 'Ações'].map((header) => (
                        <th
                          key={header}
                          className="px-4 py-3 text-sm font-normal text-app-text-secondary dark:text-white/70"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cadastroItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-10 text-center text-sm text-app-text-secondary dark:text-white/60"
                        >
                          Nenhum item cadastrado para esta seção.
                        </td>
                      </tr>
                    ) : (
                      cadastroItems.map((item) => (
                        <tr
                          key={item.chave}
                          className="border-t border-app-border dark:border-app-border-dark"
                        >
                          <td className="px-4 py-3 text-sm text-app-text-primary dark:text-white">
                            {item.nome}
                          </td>
                          <td className="px-4 py-3 text-sm text-app-text-secondary dark:text-white/70">
                            {item.codigo ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-app-text-secondary dark:text-white/70">
                            {item.descricao ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-app-text-secondary dark:text-white/70">
                            {item.ativo ? 'Ativo' : 'Inativo'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg"
                                onClick={() => openCadastroDialog('view', item)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg"
                                onClick={() => openCadastroDialog('edit', item)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-[var(--app-danger-text)]"
                                onClick={() =>
                                  setDeleteDialog({
                                    open: true,
                                    chave: item.chave,
                                    label: item.nome,
                                  })
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'Pagamento' && (
          <div className="space-y-10">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-app-text-primary dark:text-white">
                <CreditCard size={20} />
                <h3 className="text-xl font-normal">Maquininha / Taxas de cartão</h3>
              </div>
              <p className="text-app-text-secondary dark:text-white/60 font-normal">
                Configure as bandeiras aceitas pela maquininha, taxas por número de parcelas, taxa
                de antecipação e prazos de liquidação. Usado no fluxo de Nova Venda e no
                demonstrativo por bandeira do Caixa.
              </p>
            </div>

            {isPaymentConfigLoading ? (
              <p className="text-sm text-app-text-secondary dark:text-white/60">
                Carregando configuração de pagamento...
              </p>
            ) : (
              <div className="space-y-8">
                <div className="space-y-3">
                  <p className="text-sm font-normal text-[var(--app-text-primary)] dark:text-white/70 ml-1">
                    Bandeiras aceitas
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_BANDEIRAS.map((bandeira) => {
                      const checked = maquininhaForm.bandeiras.includes(bandeira)
                      return (
                        <button
                          key={bandeira}
                          type="button"
                          onClick={() => handleMaquininhaBandeiraToggle(bandeira, !checked)}
                          aria-pressed={checked}
                          className={`h-10 px-4 rounded-xl text-sm font-normal border transition-colors ${
                            checked
                              ? 'bg-app-primary text-white border-[var(--app-primary)] shadow-sm'
                              : 'bg-app-bg-secondary text-app-text-primary border-app-border hover:bg-app-hover dark:bg-app-hover dark:text-white/80 dark:border-app-border-dark'
                          }`}
                        >
                          {bandeira}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-normal text-[var(--app-text-primary)] dark:text-white/70 ml-1">
                    Taxas por parcelas (% por venda)
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {maquininhaForm.taxas_parcelas.map((row) => (
                      <div key={row.parcelas} className="space-y-2">
                        <label
                          htmlFor={`cfg-taxa-${row.parcelas}`}
                          className="text-sm font-normal text-[var(--app-text-primary)] dark:text-white/70 ml-1"
                        >
                          {row.parcelas}x (taxa %)
                        </label>
                        <div className="relative">
                          <Input
                            id={`cfg-taxa-${row.parcelas}`}
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            value={row.taxa}
                            onChange={(event) =>
                              handleMaquininhaTaxaChange(row.parcelas, event.target.value)
                            }
                            className="h-12 pr-10 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-app-text-muted font-medium">
                            %
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="cfg-taxa-antecipacao"
                      className="text-sm font-normal text-[var(--app-text-primary)] dark:text-white/70 ml-1"
                    >
                      Taxa de antecipação (% ao mês)
                    </label>
                    <div className="relative">
                      <Input
                        id="cfg-taxa-antecipacao"
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={maquininhaForm.taxa_antecipacao}
                        onChange={(event) => handleMaquininhaAntecipacaoChange(event.target.value)}
                        className="h-12 pr-10 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-app-text-muted font-medium">
                        %
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="cfg-prazo-debito"
                      className="text-sm font-normal text-[var(--app-text-primary)] dark:text-white/70 ml-1"
                    >
                      Prazo liquidação débito
                    </label>
                    <Select
                      value={maquininhaForm.prazo_debito}
                      onValueChange={(value) =>
                        handleMaquininhaPrazoDebitoChange(value as MaquininhaConfig['prazo_debito'])
                      }
                    >
                      <SelectTrigger
                        id="cfg-prazo-debito"
                        className="h-12 rounded-2xl bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="D+1">D+1</SelectItem>
                        <SelectItem value="D+2">D+2</SelectItem>
                        <SelectItem value="D+30">D+30</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="cfg-prazo-credito"
                      className="text-sm font-normal text-[var(--app-text-primary)] dark:text-white/70 ml-1"
                    >
                      Prazo liquidação crédito à vista
                    </label>
                    <Select
                      value={maquininhaForm.prazo_credito_avista}
                      onValueChange={(value) =>
                        handleMaquininhaPrazoCreditoAvistaChange(
                          value as MaquininhaConfig['prazo_credito_avista'],
                        )
                      }
                    >
                      <SelectTrigger
                        id="cfg-prazo-credito"
                        className="h-12 rounded-2xl bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="D+14">D+14</SelectItem>
                        <SelectItem value="D+30">D+30</SelectItem>
                        <SelectItem value="D+60">D+60</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            <div className="h-px bg-app-border dark:bg-app-border-dark" />

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-app-text-primary dark:text-white">
                <Percent size={20} />
                <h3 className="text-xl font-normal">Desconto Automático por Forma de Pagamento</h3>
              </div>
              <p className="text-app-text-secondary dark:text-white/60 font-normal">
                Desconto (%) aplicado automaticamente no total da venda quando a recepção seleciona
                a forma de pagamento correspondente (ex.: PIX e Dinheiro com 5%). Admin e Gestor
                editam; a recepção apenas aplica.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { key: 'pix' as const, label: 'PIX' },
                { key: 'dinheiro' as const, label: 'Dinheiro' },
                { key: 'cartao_debito' as const, label: 'Cartão de Débito' },
                { key: 'cartao_credito' as const, label: 'Cartão de Crédito' },
              ].map((entry) => (
                <div key={entry.key} className="space-y-2">
                  <label
                    htmlFor={`cfg-desconto-${entry.key}`}
                    className="text-sm font-normal text-[var(--app-text-primary)] dark:text-white/70 ml-1"
                  >
                    {entry.label}
                  </label>
                  <div className="relative">
                    <Input
                      id={`cfg-desconto-${entry.key}`}
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={paymentDiscountsForm[entry.key] ?? 0}
                      onChange={(event) =>
                        handlePaymentDiscountChange(entry.key, event.target.value)
                      }
                      className="h-12 pr-10 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-app-text-muted font-medium">
                      %
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <Button
                className="h-12 px-10 bg-app-primary hover:bg-app-primary-hover text-white font-normal rounded-xl shadow-lg shadow-[var(--app-primary)]/20"
                onClick={() => void handleSavePaymentConfig()}
                disabled={isSavingPayment}
              >
                <Save className="h-4 w-4 mr-2" />
                {isSavingPayment ? 'Salvando...' : 'Salvar configurações de pagamento'}
              </Button>
            </div>

            <div className="h-px bg-app-border dark:bg-app-border-dark" />

            <div className="rounded-2xl border border-app-border bg-app-card p-6 shadow-sm dark:border-app-border-dark dark:bg-app-card-dark space-y-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-app-text-primary dark:text-white">
                    <CreditCard size={20} />
                    <h3 className="text-xl font-normal">Cielo — Link de Pagamento</h3>
                    {cieloTest === 'ok' && (
                      <span className="rounded-full bg-[var(--app-success-bg)] px-3 py-1 text-xs font-medium text-[var(--app-success-text)]">
                        Configurada
                      </span>
                    )}
                    {cieloTest === 'fail' && (
                      <span className="rounded-full bg-[var(--app-danger-bg)] px-3 py-1 text-xs font-medium text-[var(--app-danger-text)]">
                        Não configurada
                      </span>
                    )}
                  </div>
                  <p className="text-app-text-secondary dark:text-white/60 font-normal">
                    Gera um link de cobrança por cartão de crédito. O paciente paga no link — o app
                    nunca coleta dados de cartão.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">
                    Ativo
                  </span>
                  <Switch
                    checked={cieloForm.ativo}
                    onCheckedChange={(value) =>
                      setCieloForm((current) => ({ ...current, ativo: value }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">
                    Merchant ID
                  </span>
                  <Input
                    value={cieloForm.merchantId}
                    onChange={(event) =>
                      setCieloForm((current) => ({ ...current, merchantId: event.target.value }))
                    }
                    placeholder="00000000-0000-0000-0000-000000000000"
                    className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">
                    Ambiente
                  </span>
                  <Select
                    value={cieloForm.ambiente}
                    onValueChange={(value) =>
                      setCieloForm((current) => ({ ...current, ambiente: value }))
                    }
                  >
                    <SelectTrigger className="h-12 rounded-2xl bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">Sandbox</SelectItem>
                      <SelectItem value="producao">Produção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">
                    Merchant Key
                  </span>
                  <Input
                    type="password"
                    value={cieloForm.merchantKey}
                    onChange={(event) =>
                      setCieloForm((current) => ({ ...current, merchantKey: event.target.value }))
                    }
                    placeholder={CONFIG_MASK}
                    className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">
                    Access Token (Link de Pagamento)
                  </span>
                  <Input
                    type="password"
                    value={cieloForm.linkAccessToken}
                    onChange={(event) =>
                      setCieloForm((current) => ({
                        ...current,
                        linkAccessToken: event.target.value,
                      }))
                    }
                    placeholder={CONFIG_MASK}
                    className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                  />
                </div>
              </div>

              <p className="text-xs font-normal text-app-text-muted dark:text-white/40">
                Os segredos ficam ocultos após salvos — deixe os campos como estão ({CONFIG_MASK})
                para mantê-los. O Access Token é a "Chave de Integração" do Link de Pagamento.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  className="h-11 rounded-xl border-app-border dark:border-app-border-dark"
                  onClick={() => void handleTestCielo()}
                >
                  Testar configuração
                </Button>
                <Button
                  className="h-11 rounded-xl bg-app-primary px-6 text-white hover:bg-app-primary-hover"
                  onClick={() => void handleSaveCielo()}
                  disabled={isSavingCielo}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSavingCielo ? 'Salvando...' : 'Salvar Cielo'}
                </Button>
              </div>
            </div>

            <div className="h-px bg-app-border dark:bg-app-border-dark" />

            <div className="rounded-2xl border border-app-border bg-app-card p-6 shadow-sm dark:border-app-border-dark dark:bg-app-card-dark space-y-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-app-text-primary dark:text-white">
                    <QrCode size={20} />
                    <h3 className="text-xl font-normal">Sicredi — Pix</h3>
                    {sicrediTest === 'ok' && (
                      <span className="rounded-full bg-[var(--app-success-bg)] px-3 py-1 text-xs font-medium text-[var(--app-success-text)]">
                        Conectada
                      </span>
                    )}
                    {sicrediTest === 'fail' && (
                      <span className="rounded-full bg-[var(--app-danger-bg)] px-3 py-1 text-xs font-medium text-[var(--app-danger-text)]">
                        Desconectada
                      </span>
                    )}
                  </div>
                  <p className="text-app-text-secondary dark:text-white/60 font-normal">
                    Gera cobranças Pix (QR Code + copia e cola) via API Sicredi. A confirmação chega
                    por webhook + polling.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">
                    Ativo
                  </span>
                  <Switch
                    checked={sicrediForm.ativo}
                    onCheckedChange={(value) =>
                      setSicrediForm((current) => ({ ...current, ativo: value }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">
                    Client ID
                  </span>
                  <Input
                    value={sicrediForm.clientId}
                    onChange={(event) =>
                      setSicrediForm((current) => ({ ...current, clientId: event.target.value }))
                    }
                    className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">
                    Ambiente
                  </span>
                  <Select
                    value={sicrediForm.ambiente}
                    onValueChange={(value) =>
                      setSicrediForm((current) => ({ ...current, ambiente: value }))
                    }
                  >
                    <SelectTrigger className="h-12 rounded-2xl bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">Sandbox</SelectItem>
                      <SelectItem value="producao">Produção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">
                    Client Secret
                  </span>
                  <Input
                    type="password"
                    value={sicrediForm.clientSecret}
                    onChange={(event) =>
                      setSicrediForm((current) => ({
                        ...current,
                        clientSecret: event.target.value,
                      }))
                    }
                    placeholder={CONFIG_MASK}
                    className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium text-app-text-secondary dark:text-white/70">
                    Chave Pix
                  </span>
                  <Input
                    value={sicrediForm.chavePix}
                    onChange={(event) =>
                      setSicrediForm((current) => ({ ...current, chavePix: event.target.value }))
                    }
                    placeholder="email, CPF/CNPJ, telefone ou chave aleatória"
                    className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
                  />
                </div>
              </div>

              <p className="text-xs font-normal text-app-text-muted dark:text-white/40">
                Os segredos ficam ocultos após salvos — deixe os campos como estão ({CONFIG_MASK})
                para mantê-los.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  className="h-11 rounded-xl border-app-border dark:border-app-border-dark"
                  onClick={() => void handleTestSicredi()}
                >
                  Testar conexão
                </Button>
                <Button
                  className="h-11 rounded-xl bg-app-primary px-6 text-white hover:bg-app-primary-hover"
                  onClick={() => void handleSaveSicredi()}
                  disabled={isSavingSicredi}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSavingSicredi ? 'Salvando...' : 'Salvar Sicredi'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog
        open={integracaoDialog.open}
        onOpenChange={(open) =>
          !open && setIntegracaoDialog({ open: false, mode: 'create', item: null })
        }
      >
        <DialogContent className="rounded-[24px]">
          <DialogHeader>
            <DialogTitle>
              {integracaoDialog.mode === 'create'
                ? 'Nova API'
                : integracaoDialog.mode === 'edit'
                  ? 'Editar integração'
                  : 'Visualizar integração'}
            </DialogTitle>
            <DialogDescription>
              Gerencie credenciais e parâmetros da conexão externa.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Input
              value={integracaoForm.nome}
              disabled={integracaoDialog.mode === 'view'}
              onChange={(event) =>
                setIntegracaoForm((current) => ({ ...current, nome: event.target.value }))
              }
              placeholder="Nome"
              className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
            />
            <Select
              value={integracaoForm.tipo}
              onValueChange={(value) =>
                setIntegracaoForm((current) => ({ ...current, tipo: value }))
              }
              disabled={integracaoDialog.mode === 'view'}
            >
              <SelectTrigger className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="api">API</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
                <SelectItem value="oauth">OAuth</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={integracaoForm.clientId}
              disabled={integracaoDialog.mode === 'view'}
              onChange={(event) =>
                setIntegracaoForm((current) => ({ ...current, clientId: event.target.value }))
              }
              placeholder="Client ID"
              className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
            />
            <Input
              value={integracaoForm.apiKey}
              disabled={integracaoDialog.mode === 'view'}
              onChange={(event) =>
                setIntegracaoForm((current) => ({ ...current, apiKey: event.target.value }))
              }
              placeholder="API Key"
              className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
            />
            <div className="grid grid-cols-2 gap-4">
              <Select
                value={integracaoForm.ambiente}
                onValueChange={(value) =>
                  setIntegracaoForm((current) => ({ ...current, ambiente: value }))
                }
                disabled={integracaoDialog.mode === 'view'}
              >
                <SelectTrigger className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal">
                  <SelectValue placeholder="Ambiente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox</SelectItem>
                  <SelectItem value="producao">Produção</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={integracaoForm.status}
                onValueChange={(value) =>
                  setIntegracaoForm((current) => ({ ...current, status: value }))
                }
                disabled={integracaoDialog.mode === 'view'}
              >
                <SelectTrigger className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl border-app-border dark:border-app-border-dark"
              onClick={() => setIntegracaoDialog({ open: false, mode: 'create', item: null })}
            >
              Fechar
            </Button>
            {integracaoDialog.mode !== 'view' && (
              <Button
                className="rounded-xl bg-app-primary text-white hover:bg-app-primary-hover"
                onClick={() => void salvarComAviso(handleSaveIntegracao)}
              >
                Salvar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={cadastroDialog.open}
        onOpenChange={(open) =>
          !open && setCadastroDialog({ open: false, mode: 'create', item: null })
        }
      >
        <DialogContent className="rounded-[24px]">
          <DialogHeader>
            <DialogTitle>
              {cadastroDialog.mode === 'create'
                ? 'Novo cadastro'
                : cadastroDialog.mode === 'edit'
                  ? 'Editar cadastro'
                  : 'Visualizar cadastro'}
            </DialogTitle>
            <DialogDescription>Gerencie os itens auxiliares desta seção.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Input
              value={cadastroForm.nome}
              disabled={cadastroDialog.mode === 'view'}
              onChange={(event) =>
                setCadastroForm((current) => ({ ...current, nome: event.target.value }))
              }
              placeholder="Nome"
              className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
            />
            <Input
              value={cadastroForm.codigo}
              disabled={cadastroDialog.mode === 'view'}
              onChange={(event) =>
                setCadastroForm((current) => ({ ...current, codigo: event.target.value }))
              }
              placeholder="Código"
              className="h-12 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal"
            />
            <Textarea
              value={cadastroForm.descricao}
              disabled={cadastroDialog.mode === 'view'}
              onChange={(event) =>
                setCadastroForm((current) => ({ ...current, descricao: event.target.value }))
              }
              placeholder="Descrição"
              className="min-h-[110px] bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-2xl font-normal resize-none"
            />
            <div className="flex items-center justify-between rounded-2xl border border-app-border p-4 dark:border-app-border-dark">
              <div>
                <p className="font-normal text-app-text-primary dark:text-white">Ativo</p>
                <p className="text-sm text-app-text-secondary dark:text-white/60 font-normal">
                  Define se o item pode ser utilizado nas demais telas.
                </p>
              </div>
              <Switch
                checked={cadastroForm.ativo}
                disabled={cadastroDialog.mode === 'view'}
                onCheckedChange={(value) =>
                  setCadastroForm((current) => ({ ...current, ativo: value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl border-app-border dark:border-app-border-dark"
              onClick={() => setCadastroDialog({ open: false, mode: 'create', item: null })}
            >
              Fechar
            </Button>
            {cadastroDialog.mode !== 'view' && (
              <Button
                className="rounded-xl bg-app-primary text-white hover:bg-app-primary-hover"
                onClick={() => void salvarComAviso(handleSaveCadastro)}
              >
                Salvar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => !open && setDeleteDialog({ open: false, chave: '', label: '' })}
      >
        <DialogContent size="sm" className="rounded-[24px]">
          <DialogHeader>
            <DialogTitle>Excluir item</DialogTitle>
            <DialogDescription>
              Deseja remover <strong>{deleteDialog.label}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl border-app-border dark:border-app-border-dark"
              onClick={() => setDeleteDialog({ open: false, chave: '', label: '' })}
            >
              Cancelar
            </Button>
            <Button
              className="rounded-xl bg-[var(--app-danger-text)] text-white hover:opacity-90"
              onClick={() => void salvarComAviso(handleDelete)}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
