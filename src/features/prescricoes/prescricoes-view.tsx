'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Clock, Edit, Eye, FileText, MoreVertical, Plus, Printer, Receipt, Search, ShoppingCart, Trash2 } from 'lucide-react'
import { usePrescricoes, type PrescricaoInput, type PrescricaoItem } from '@/hooks/use-prescricoes'
import { useApi } from '@/hooks/use-api'
import { registrarRetornoMaisTarde, useRetornosPendentesDetalhe } from '@/features/retornos/hooks/use-retornos'
import { usePacientes } from '@/hooks/use-pacientes'
import { useUsuarios } from '@/hooks/use-usuarios'
import { useEstoque } from '@/features/estoque/hooks/use-estoque'
import { DataTable } from '@/components/shared/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/shared/page-header'
import { ReciboModal } from '@/features/recibos'
import { CLASSE_TOM_STATUS, classificarPrescricao, normalizarStatusPrescricao, statusExibicaoPrescricao, type StatusPrescricao, type TomStatusPrescricao } from '@/lib/prescricao-status'
import { formatarMoeda } from '@/lib/moeda'
import { hojeIso } from '@/features/relatorios/format'
import { CartaoMobile, ListaCartoesMobile } from '@/components/shared/mobile-card'
import { formatarMargem } from '@/lib/margem'
import {
  AgendarRetornoModal,
  DetalhesVendaModal,
  EditarPrescricaoModal,
  ExcluirPrescricaoModal,
  ConverterVendaModal,
  LabelEditorModal,
  NovaVendaModal,
} from './modals'
import type { ConverterVendaDados } from './modals/converter-venda-modal'
import type { LabelData } from './modals/label-editor-modal'
import { FiltroDataSetas } from './components/filtro-data-setas'
import { dataBrParaIso } from './components/filtro-data-setas.utils'
import { escolherRetornoPendente, RetornoPendenteLink, rotaDoRetorno } from './components/retorno-pendente-link'

interface PrescriptionRow extends PrescricaoItem {
  createdAt: string
  type: string
  generator: string
  validity: string
  specialistName: string
  paymentMethod?: string
  parcela?: string
  items: Array<{
    productName: string
    quantity: number
    posology?: string
    unitPrice: number
    total: number
    custoUnitario?: number
    margem?: number
    margemPercentual?: number
  }>
}

const PONTO_TOM: Record<TomStatusPrescricao, string> = {
  ativa: 'bg-emerald-500',
  vencida: 'bg-amber-500',
  concluida: 'bg-sky-500',
  cancelada: 'bg-red-500',
  neutro: 'bg-slate-400',
}

function SeloStatus({ item, className }: { item: PrescriptionRow; className: string }) {
  const { rotulo, tom } = statusExibicaoPrescricao(item.status, item.validity, hojeIso())
  return <span className={`inline-flex items-center rounded-full border font-medium ${CLASSE_TOM_STATUS[tom]} ${className}`}>{rotulo}</span>
}

function OpcaoStatus({ valor, rotulo, tom }: { valor: string; rotulo: string; tom: TomStatusPrescricao }) {
  return (
    <SelectItem value={valor}>
      <span className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${PONTO_TOM[tom]}`} aria-hidden="true" />
        {rotulo}
      </span>
    </SelectItem>
  )
}

function normalizePrescription(item: PrescricaoItem): PrescriptionRow {
  return {
    ...item,
    createdAt: item.data || '-',
    type: item.tipo || 'Prescrição',
    generator: 'Sistema',
    validity: item.validade || '-',
    specialistName: '-',
    paymentMethod: item.formaPagamento,
    items: (item.items ?? []).map((line) => ({
      productName: line.productName,
      quantity: line.quantity,
      posology: line.posology,
      unitPrice: line.unitPrice,
      total: line.total,
      custoUnitario: line.custoUnitario,
      margem: line.margem,
      margemPercentual: line.margemPercentual,
    })),
  }
}

const statusDe = (item: PrescriptionRow): StatusPrescricao => normalizarStatusPrescricao(item.status)
const classeDe = (item: PrescriptionRow) => classificarPrescricao(item.status, item.validity, hojeIso())
/** Mensagem do servidor (ex.: "Caixa não aberto…") em vez de falha silenciosa. */
const mensagemDeErro = (err: unknown, padrao: string) => (err instanceof Error && err.message ? err.message : padrao)
const CABECALHO = 'font-normal text-app-text-secondary dark:text-white/80'

export function PrescricoesView() {
  const router = useRouter()
  const { data, error, isLoading, createPrescricao, updatePrescricao, deletePrescricao } = usePrescricoes()
  const { data: pacientes } = usePacientes()
  const { data: usuarios } = useUsuarios()
  const { data: estoque } = useEstoque()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'todos' | 'Pendente' | 'Ativa' | 'Vencida' | 'Convertida' | 'Cancelada'>('todos')
  const [tipoFilter, setTipoFilter] = useState<'todos' | 'Prescrição' | 'Venda' | 'Consumo'>('todos')
  const [validadeFilter, setValidadeFilter] = useState<'todos' | 'no-prazo' | 'limite-prazo' | 'vencida'>('todos')
  const [selectedPrescription, setSelectedPrescription] = useState<PrescriptionRow | null>(null)
  const [isVendaModalOpen, setIsVendaModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isNovaVendaModalOpen, setIsNovaVendaModalOpen] = useState(false)
  const [isDetalhesModalOpen, setIsDetalhesModalOpen] = useState(false)
  const [isAgendarRetornoModalOpen, setIsAgendarRetornoModalOpen] = useState(false)
  const api = useApi()
  const { retornosPendentes, reload: reloadRetornosPendentes } = useRetornosPendentesDetalhe()
  // Filtro de data (data da prescrição/venda): padrão hoje; null = todas as datas.
  const [dataFiltro, setDataFiltro] = useState<string | null>(() => hojeIso())
  const [rotulosParaImprimir, setRotulosParaImprimir] = useState<LabelData[]>([])
  const [reciboVendaId, setReciboVendaId] = useState<string | null>(null)

  const prescriptions = useMemo(() => data.map(normalizePrescription), [data])
  const temMargem = prescriptions.some((item) => item.margemTotal !== undefined)
  const patientOptions = useMemo(
    () => pacientes.map((patient) => ({ id: patient.id, nome: patient.nome })),
    [pacientes],
  )
  const productOptions = useMemo(
    () =>
      estoque
        .filter(
          (item) =>
            Number(item.quantidade ?? 0) > 0 &&
            !String(item.status ?? '').toLowerCase().includes('indispon'),
        )
        .map((item) => ({
          id: item.id,
          name: item.produto,
          stock: item.quantidade,
          price: item.precoVenda ?? 0,
          costPrice: item.precoCusto ?? 0,
        })),
    [estoque],
  )
  const sellerOptions = useMemo(
    () =>
      usuarios
        .filter((user) => (user.perfil ?? '').toLowerCase() === 'recepcao')
        .map((user) => ({ id: user.id, name: user.nome })),
    [usuarios],
  )

  // CR-074 · classificação de validade. "Limite de prazo" = 0 < dias_restantes ≤ 10.
  // Status do registro tem prioridade sobre o cálculo: prescrição "Vencida" no banco
  // é vencida, mesmo que a data ainda esteja no futuro (caso raro de fix manual).
  const getValidadeBucket = (item: PrescriptionRow): 'no-prazo' | 'limite-prazo' | 'vencida' | null => {
    if (statusDe(item) === 'Vencida') return 'vencida'
    if (item.validity === '-' || !item.validity) return null
    const parts = item.validity.split('/')
    if (parts.length !== 3) return null
    const [d, m, y] = parts
    const validade = new Date(`${y}-${m}-${d}T00:00:00`)
    if (Number.isNaN(validade.getTime())) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffDays = Math.ceil((validade.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return 'vencida'
    if (diffDays <= 10) return 'limite-prazo'
    return 'no-prazo'
  }

  const filteredPrescriptions = useMemo(() => {
    return prescriptions.filter((item) => {
      const matchesSearch = [item.numero, item.paciente, item.status]
        .join(' ')
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
      if (!matchesSearch) return false
      if (dataFiltro && dataBrParaIso(item.data) !== dataFiltro) return false

      if (statusFilter === 'Ativa' || statusFilter === 'Vencida') {
        if (classeDe(item) !== (statusFilter === 'Ativa' ? 'ativa' : 'vencida')) return false
      } else if (statusFilter === 'Pendente') {
        if (statusExibicaoPrescricao(item.status, item.validity, hojeIso()).rotulo !== 'Pendente') return false
      } else if (statusFilter !== 'todos' && statusDe(item) !== statusFilter) return false
      if (tipoFilter !== 'todos' && item.type !== tipoFilter) return false
      if (validadeFilter !== 'todos') {
        const bucket = getValidadeBucket(item)
        if (bucket !== validadeFilter) return false
      }
      return true
    })
  }, [prescriptions, searchTerm, dataFiltro, statusFilter, tipoFilter, validadeFilter])

  // CR-074 · 3 cards: Ativas / Vencidas / Concluídas com count + valor total.
  // Regra única (mesma dos Relatórios > Prescrição): ver classificarPrescricao.
  const ativasList = useMemo(() => prescriptions.filter((item) => classeDe(item) === 'ativa'), [prescriptions])
  const vencidasList = useMemo(() => prescriptions.filter((item) => classeDe(item) === 'vencida'), [prescriptions])
  const concluidasList = useMemo(() => prescriptions.filter((item) => classeDe(item) === 'concluida'), [prescriptions])

  const ativasCount = ativasList.length
  const ativasTotal = ativasList.reduce((sum, item) => sum + item.valorTotal, 0)
  const vencidasCount = vencidasList.length
  const vencidasTotal = vencidasList.reduce((sum, item) => sum + item.valorTotal, 0)
  const concluidasCount = concluidasList.length
  const concluidasTotal = concluidasList.reduce((sum, item) => sum + item.valorTotal, 0)

  // Cartão de status: lista todas as datas com esse status filtrado.
  const handleCardClick = (status: 'Ativa' | 'Vencida' | 'Convertida') => {
    setDataFiltro(null)
    setStatusFilter(status)
  }

  const handleOpenVenda = (item: PrescriptionRow) => {
    setSelectedPrescription(item)
    setIsVendaModalOpen(true)
  }

  const handleOpenEdit = (item: PrescriptionRow) => {
    setSelectedPrescription(item)
    setIsEditModalOpen(true)
  }

  const handleOpenDelete = (item: PrescriptionRow) => {
    setSelectedPrescription(item)
    setIsDeleteModalOpen(true)
  }

  const handleOpenDetalhes = (item: PrescriptionRow) => {
    setSelectedPrescription(item)
    setIsDetalhesModalOpen(true)
  }

  const handleCreatePrescription = async (payload: PrescricaoInput) => {
    // Falha (caixa fechado, estoque...) propaga: o modal mostra o erro e NÃO exibe "realizada". O modal fecha sozinho no sucesso.
    await createPrescricao(payload)
  }

  const handleUpdatePrescription = async (payload: PrescricaoInput) => {
    try {
      await updatePrescricao(payload)
      toast.success('Prescrição/Vendas atualizada com sucesso.')
      setIsEditModalOpen(false)
    } catch (err) {
      toast.error(mensagemDeErro(err, 'Não foi possível atualizar a prescrição/venda.'))
    }
  }

  const handleDeletePrescription = async (item: PrescricaoItem) => {
    try {
      await deletePrescricao(item.id)
      toast.success('Prescrição/Vendas removida com sucesso.')
      setIsDeleteModalOpen(false)
      setSelectedPrescription(null)
    } catch (err) {
      toast.error(mensagemDeErro(err, 'Não foi possível remover a prescrição/venda.'))
    }
  }

  /** Converte a prescrição ativa em venda no servidor (forma de pagamento, estoque, caixa). Falha sobe ao modal. */
  const handleConvertSale = async (item: PrescriptionRow, dados: ConverterVendaDados) => {
    await updatePrescricao({
      id: item.id,
      pacienteId: item.pacienteId || '',
      numero: item.numero,
      valorTotal: dados.valorTotal,
      status: 'Convertida',
      tipo: item.type,
      data: item.data ? item.data.split('/').reverse().join('-') : undefined,
      validade: item.validity !== '-' ? item.validity.split('/').reverse().join('-') : undefined,
      observacoes: item.observacoes,
      formaPagamento: dados.formaPagamento,
      bandeira: dados.bandeira,
      contaBancariaId: dados.contaBancariaId,
      numeroParcelas: dados.numeroParcelas,
      valorParcela: dados.valorParcela,
    })
    setSelectedPrescription({ ...item, status: 'Convertida' })
    toast.success('Prescrição/Vendas convertida com sucesso.')
    setTimeout(() => setIsAgendarRetornoModalOpen(true), 200)
  }

  const handleImprimirRotulos = (item: PrescriptionRow) => {
    setRotulosParaImprimir(
      item.items.map((line) => ({
        patientName: item.paciente,
        productName: line.productName,
        composition: line.posology,
        usage: undefined,
        validity: '',
      })),
    )
  }

  const seloRetorno = (item: PrescriptionRow) => {
    const retorno = item.pacienteId ? escolherRetornoPendente(retornosPendentes, item.pacienteId, item.id) : null
    return item.pacienteId && retorno ? (
      <RetornoPendenteLink pacienteId={item.pacienteId} retorno={retorno} onAbrir={(rota) => router.push(rota)} />
    ) : null
  }

  const renderAcoes = (item: PrescriptionRow) => {
    const status = statusDe(item)
    const aberta = status !== 'Convertida' && status !== 'Cancelada'
    const botao = 'h-9 w-9 text-app-text-muted hover:bg-app-bg-secondary dark:hover:bg-app-hover transition-colors'
    return (
      <div className="flex items-center justify-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => handleOpenDetalhes(item)} className={botao} aria-label="Ver detalhes">
          <Eye size={18} />
        </Button>
        {aberta && (
          <Button onClick={() => handleOpenVenda(item)} variant="ghost" size="icon" className={botao} title="Converter em venda" aria-label="Converter em venda">
            <ShoppingCart size={18} />
          </Button>
        )}
        {status === 'Convertida' && (
          <Button variant="ghost" size="icon" onClick={() => setReciboVendaId(item.id)} className={botao} title="Emitir recibo ou NF" aria-label="Emitir recibo ou NF">
            <Receipt size={18} />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className={botao} aria-label="Mais ações">
              <MoreVertical size={18} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-xl">
            <DropdownMenuItem onClick={() => handleImprimirRotulos(item)} className="flex items-center gap-2 cursor-pointer">
              <Printer size={16} />
              Imprimir rótulos
            </DropdownMenuItem>
            {aberta && (
              <DropdownMenuItem onClick={() => handleOpenEdit(item)} className="flex items-center gap-2 cursor-pointer">
                <Edit size={16} />
                Editar Prescrição/Vendas
              </DropdownMenuItem>
            )}
            {aberta && (
              <DropdownMenuItem onClick={() => handleOpenDelete(item)} className="flex items-center gap-2 cursor-pointer text-[var(--app-danger-text)] focus:text-[var(--app-danger-text)]">
                <Trash2 size={16} />
                Excluir Prescrição/Vendas
              </DropdownMenuItem>
            )}
            {!aberta && (
              <DropdownMenuItem onClick={() => handleOpenDetalhes(item)} className="flex items-center gap-2 cursor-pointer">
                <Eye size={16} />
                Ver detalhes
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  return (
    <div className="app-page app-page-loose pb-10">
      <PageHeader
        title="Prescrição/Vendas"
        description="Visualize prescrições, vendas convertidas e emissão de documentos"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('')
                setStatusFilter('todos')
                setDataFiltro(hojeIso())
              }}
              className="h-11 px-4 rounded-integrallys font-normal"
            >
              Limpar busca
            </Button>
            <Button
              onClick={() => setIsNovaVendaModalOpen(true)}
              className="h-11 px-6 bg-app-primary hover:bg-app-primary-hover text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-[var(--app-primary)]/20 transition-all active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Nova Prescrição/Vendas
            </Button>
          </>
        }
      />

      <ConverterVendaModal
        isOpen={isVendaModalOpen}
        onClose={() => setIsVendaModalOpen(false)}
        prescription={
          selectedPrescription
            ? {
                id: selectedPrescription.id,
                numero: selectedPrescription.numero,
                paciente: selectedPrescription.paciente,
                valorTotal: selectedPrescription.valorTotal,
                items: selectedPrescription.items,
              }
            : null
        }
        onConfirm={(dados) => (selectedPrescription ? handleConvertSale(selectedPrescription, dados) : Promise.resolve())}
      />

      <LabelEditorModal isOpen={rotulosParaImprimir.length > 0} onClose={() => setRotulosParaImprimir([])} dataList={rotulosParaImprimir} />

      <EditarPrescricaoModal
        isOpen={isEditModalOpen}
        onClose={setIsEditModalOpen}
        prescricao={selectedPrescription}
        patients={patientOptions}
        onSave={(payload) => void handleUpdatePrescription(payload)}
      />

      <NovaVendaModal
        isOpen={isNovaVendaModalOpen}
        onClose={() => setIsNovaVendaModalOpen(false)}
        patients={patientOptions}
        products={productOptions}
        users={sellerOptions}
        onSave={handleCreatePrescription}
      />

      <DetalhesVendaModal
        isOpen={isDetalhesModalOpen}
        onClose={() => setIsDetalhesModalOpen(false)}
        venda={selectedPrescription ? {
          number: selectedPrescription.numero,
          patientName: selectedPrescription.paciente,
          specialistName: selectedPrescription.specialistName,
          paymentMethod: selectedPrescription.paymentMethod,
          parcela: selectedPrescription.parcela,
          createdAt: selectedPrescription.createdAt,
          totalValue: selectedPrescription.valorTotal,
          items: selectedPrescription.items,
          custoTotal: selectedPrescription.custoTotal,
          margemTotal: selectedPrescription.margemTotal,
          margemPercentual: selectedPrescription.margemPercentual,
        } : null}
        onEmitirRecibo={selectedPrescription && statusDe(selectedPrescription) === 'Convertida' ? () => setReciboVendaId(selectedPrescription.id) : undefined}
      />

      <ReciboModal isOpen={reciboVendaId !== null} onClose={() => setReciboVendaId(null)} tipo="prescricao" origemId={reciboVendaId} />

      <ExcluirPrescricaoModal
        isOpen={isDeleteModalOpen}
        onClose={setIsDeleteModalOpen}
        prescricao={selectedPrescription}
        onConfirm={(item) => void handleDeletePrescription(item)}
      />

      <AgendarRetornoModal
        isOpen={isAgendarRetornoModalOpen}
        onClose={() => setIsAgendarRetornoModalOpen(false)}
        patientName={selectedPrescription?.paciente}
        onConfirm={() => {
          setIsAgendarRetornoModalOpen(false)
          const pacienteId = selectedPrescription?.pacienteId
          const retorno = pacienteId ? escolherRetornoPendente(retornosPendentes, pacienteId, selectedPrescription?.id) : null
          router.push(pacienteId ? rotaDoRetorno(pacienteId, retorno) : '/agenda')
        }}
        onLater={() => {
          const alvo = selectedPrescription
          setIsAgendarRetornoModalOpen(false)
          if (!alvo?.pacienteId) return
          // "Mais tarde" grava no banco: entra no relatório de retornos e a tag persiste.
          registrarRetornoMaisTarde(api.post, { pacienteId: alvo.pacienteId, prescricaoId: alvo.id })
            .then(() => reloadRetornosPendentes())
            .catch((err) =>
              toast.error(err instanceof Error ? err.message : 'Não foi possível registrar o retorno pendente.'),
            )
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button
          type="button"
          onClick={() => handleCardClick('Ativa')}
          className="text-left transition-all"
          aria-pressed={statusFilter === 'Ativa'}
        >
          <Card
            className={`shadow-sm border-app-border dark:border-app-border-dark cursor-pointer hover:shadow-md transition-shadow ${
              statusFilter === 'Ativa'
                ? 'ring-2 ring-[var(--app-success-text)]/40 border-[var(--app-success-text)]/60'
                : ''
            }`}
          >
            <CardContent className="p-6 md:p-8 flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-normal text-app-text-secondary dark:text-white/60">Ativas</p>
                <h2 className="text-3xl md:text-4xl font-normal text-[var(--app-success-text)]">{ativasCount}</h2>
                <p className="text-xs text-app-text-muted">
                  {formatarMoeda(ativasTotal)}
                </p>
              </div>
              <FileText size={32} className="text-[var(--app-success-text)]" />
            </CardContent>
          </Card>
        </button>

        <button
          type="button"
          onClick={() => handleCardClick('Vencida')}
          className="text-left transition-all"
          aria-pressed={statusFilter === 'Vencida'}
        >
          <Card
            className={`shadow-sm border-app-border dark:border-app-border-dark cursor-pointer hover:shadow-md transition-shadow ${
              statusFilter === 'Vencida'
                ? 'ring-2 ring-[var(--app-warning-text)]/40 border-[var(--app-warning-text)]/60'
                : ''
            }`}
          >
            <CardContent className="p-6 md:p-8 flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-normal text-app-text-secondary dark:text-white/60">Vencidas</p>
                <h2 className="text-3xl md:text-4xl font-normal text-[var(--app-warning-text)]">{vencidasCount}</h2>
                <p className="text-xs text-app-text-muted">
                  {formatarMoeda(vencidasTotal)}
                </p>
              </div>
              <Clock size={32} className="text-[var(--app-warning-text)]" />
            </CardContent>
          </Card>
        </button>

        <button
          type="button"
          onClick={() => handleCardClick('Convertida')}
          className="text-left transition-all"
          aria-pressed={statusFilter === 'Convertida'}
        >
          <Card
            className={`shadow-sm border-app-border dark:border-app-border-dark cursor-pointer hover:shadow-md transition-shadow ${
              statusFilter === 'Convertida'
                ? 'ring-2 ring-[var(--app-info-text)]/40 border-[var(--app-info-text)]/60'
                : ''
            }`}
          >
            <CardContent className="p-6 md:p-8 flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-normal text-app-text-secondary dark:text-white/60">Concluídas</p>
                <h2 className="text-3xl md:text-4xl font-normal text-[var(--app-info-text)]">{concluidasCount}</h2>
                <p className="text-xs text-app-text-muted">
                  {formatarMoeda(concluidasTotal)}
                </p>
              </div>
              <FileText size={32} className="text-[var(--app-info-text)]" />
            </CardContent>
          </Card>
        </button>
      </div>

      {error && <p className="text-sm text-[var(--app-danger-text)]">{error}</p>}

      <Card className="rounded-[20px] border border-app-border dark:border-app-border-dark/50 bg-app-card dark:bg-app-card-dark shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 space-y-8">
          <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-app-bg-secondary dark:bg-app-table-header-dark flex items-center justify-center border border-app-border dark:border-app-border-dark">
                <FileText className="h-5 w-5 text-app-text-primary dark:text-white" />
              </div>
              <h2 className="text-xl font-normal text-app-text-primary dark:text-white tracking-tight">
                Lista de Prescrição/Vendas ({filteredPrescriptions.length})
              </h2>
            </div>

            <div className="flex flex-col gap-3 w-full lg:flex-row lg:items-center lg:flex-wrap 2xl:w-auto">
              <div className="relative w-full lg:w-[320px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-app-text-muted" />
                <Input
                  placeholder="Buscar por paciente ou número..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-12 h-12 rounded-integrallys-lg border-app-border dark:border-app-border-dark bg-app-bg-secondary/50 dark:bg-app-bg-dark focus-visible:ring-[var(--app-primary)] transition-all w-full"
                />
              </div>
              <FiltroDataSetas valor={dataFiltro} onChange={setDataFiltro} />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex lg:items-center lg:gap-2">
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                  <SelectTrigger className="h-12 rounded-integrallys-lg border-app-border bg-app-bg-secondary/50 dark:border-app-border-dark dark:bg-app-bg-dark text-sm w-full lg:w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos status</SelectItem>
                    <OpcaoStatus valor="Pendente" rotulo="Pendente" tom="ativa" />
                    <OpcaoStatus valor="Ativa" rotulo="Ativa" tom="ativa" />
                    <OpcaoStatus valor="Vencida" rotulo="Vencida" tom="vencida" />
                    <OpcaoStatus valor="Convertida" rotulo="Convertida" tom="concluida" />
                    <OpcaoStatus valor="Cancelada" rotulo="Cancelada" tom="cancelada" />
                  </SelectContent>
                </Select>
                <Select value={tipoFilter} onValueChange={(value) => setTipoFilter(value as typeof tipoFilter)}>
                  <SelectTrigger className="h-12 rounded-integrallys-lg border-app-border bg-app-bg-secondary/50 dark:border-app-border-dark dark:bg-app-bg-dark text-sm w-full lg:w-[140px]">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos tipos</SelectItem>
                    <SelectItem value="Prescrição">Prescrição</SelectItem>
                    <SelectItem value="Venda">Venda</SelectItem>
                    <SelectItem value="Consumo">Consumo</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={validadeFilter} onValueChange={(value) => setValidadeFilter(value as typeof validadeFilter)}>
                  <SelectTrigger className="h-12 rounded-integrallys-lg border-app-border bg-app-bg-secondary/50 dark:border-app-border-dark dark:bg-app-bg-dark text-sm w-full lg:w-[160px]">
                    <SelectValue placeholder="Validade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas validades</SelectItem>
                    <SelectItem value="no-prazo">No prazo</SelectItem>
                    <SelectItem value="limite-prazo">Limite de prazo</SelectItem>
                    <SelectItem value="vencida">Vencida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="rounded-[18px] border border-app-border/60 dark:border-app-border-dark/60 overflow-hidden">
            {isLoading ? (
              <p className="py-12 text-center text-app-text-secondary dark:text-white/60">Carregando prescrições...</p>
            ) : filteredPrescriptions.length === 0 ? (
              <p className="py-12 text-center text-app-text-secondary dark:text-white/60">Nenhuma prescrição encontrada.</p>
            ) : (
              <DataTable data={filteredPrescriptions}>
                {(pageData) => (
                  <>
                    <ListaCartoesMobile>
                      {pageData.map((item) => (
                        <CartaoMobile
                          key={item.id}
                          titulo={
                            <>
                              <button type="button" onClick={() => handleOpenDetalhes(item)} className="font-medium uppercase text-app-primary hover:underline dark:text-[var(--app-info-text)]">
                                {item.numero}
                              </button>{' '}
                              · {item.paciente}
                            </>
                          }
                          subtitulo={`${item.type} · criada em ${item.createdAt}`}
                          valor={formatarMoeda(item.valorTotal)}
                          selo={
                            <div className="flex flex-wrap items-center gap-2">
                              <SeloStatus item={item} className="min-h-7 px-3 py-0.5 text-xs" />
                              {seloRetorno(item)}
                            </div>
                          }
                          acoes={renderAcoes(item)}
                          campos={[
                            { rotulo: 'Validade', valor: item.validity },
                            { rotulo: 'Fato gerador', valor: item.generator },
                            ...(temMargem && item.custoTotal !== undefined ? [{ rotulo: 'Custo', valor: formatarMoeda(item.custoTotal) }] : []),
                            ...(temMargem && item.margemTotal !== undefined
                              ? [{ rotulo: 'Margem', valor: formatarMargem({ valor: item.margemTotal, percentual: item.margemPercentual ?? null }) }]
                              : []),
                          ]}
                        />
                      ))}
                    </ListaCartoesMobile>
                    <div className="hidden w-full md:block">
                      <Table className="[&_td]:px-2 [&_th]:px-2">
                        <TableHeader>
                          <TableRow className="hover:bg-transparent border-app-border dark:border-app-border-dark">
                            <TableHead className={`${CABECALHO} pl-4 h-14`}>Número</TableHead>
                            <TableHead className={CABECALHO}>Paciente</TableHead>
                            <TableHead className={`${CABECALHO} text-right`}>Valor total</TableHead>
                            {temMargem && <TableHead className={`${CABECALHO} text-right`}>Custo</TableHead>}
                            {temMargem && <TableHead className={`${CABECALHO} text-right`}>Margem</TableHead>}
                            <TableHead className={CABECALHO}>Tipo</TableHead>
                            <TableHead className={CABECALHO}>Status</TableHead>
                            <TableHead className={CABECALHO}>Validade</TableHead>
                            <TableHead className={`${CABECALHO} pr-4 text-center`}>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pageData.map((item) => (
                            <TableRow key={item.id} className="hover:bg-app-bg-secondary/50 dark:hover:bg-app-hover transition-colors border-app-border dark:border-app-border-dark">
                              <TableCell className="pl-4 py-4">
                                <button
                                  type="button"
                                  onClick={() => handleOpenDetalhes(item)}
                                  className="font-normal text-app-primary dark:text-[var(--app-info-text)] uppercase hover:underline"
                                  title="Abrir detalhamento"
                                >
                                  {item.numero}
                                </button>
                                <p className="text-xs text-app-text-secondary dark:text-white/60">{item.createdAt}</p>
                              </TableCell>
                              <TableCell>
                                <p className="font-normal text-app-text-primary dark:text-white/90">{item.paciente}</p>
                                <p className="text-xs text-app-text-secondary dark:text-white/60 font-normal">{item.specialistName}</p>
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-right font-normal text-app-text-primary dark:text-white">
                                {formatarMoeda(item.valorTotal)}
                              </TableCell>
                              {temMargem && (
                                <TableCell className="whitespace-nowrap text-right text-app-text-secondary dark:text-white/80">
                                  {item.custoTotal !== undefined ? formatarMoeda(item.custoTotal) : '—'}
                                </TableCell>
                              )}
                              {temMargem && (
                                <TableCell className="text-right text-[var(--app-success-text)]">
                                  {item.margemTotal !== undefined ? formatarMargem({ valor: item.margemTotal, percentual: item.margemPercentual ?? null }) : '—'}
                                </TableCell>
                              )}
                              <TableCell>
                                <Badge variant="outline" className="bg-app-bg-secondary dark:bg-app-hover border-app-border dark:border-app-border-dark text-app-text-secondary dark:text-white/80 font-normal rounded-lg px-3 py-1">
                                  {item.type}
                                </Badge>
                                <p className="mt-1 text-xs text-app-text-secondary dark:text-white/60">{item.generator}</p>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-2 items-start">
                                  <SeloStatus item={item} className="min-h-8 px-3.5 py-1 text-xs shadow-sm" />
                                  {seloRetorno(item)}
                                </div>
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-app-text-secondary dark:text-white/60 font-normal">{item.validity}</TableCell>
                              <TableCell className="text-center pr-4">{renderAcoes(item)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </DataTable>
            )}
          </div>
        </div>
      </Card>


    </div>
  )
}
