'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useCaixa } from '@/hooks/use-caixa'
import { useFinanceiro } from '@/hooks/use-financeiro'
import { FilterBar } from '@/components/shared/filter-bar'
import { PageHeader } from '@/components/shared/page-header'
import { SegmentedControl } from '@/components/shared/segmented-control'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { FinanceiroItem } from '@/hooks/use-financeiro'
import { FinanceiroStatsCards } from './components/financeiro-stats-cards'
import { FinanceiroTabContent } from './components/financeiro-tab-content'
import { useCaixaForm } from './hooks/use-caixa-form'
import { initialFormState, useLancamentoForm } from './hooks/use-lancamento-form'
import { useFinanceiroStats } from './hooks/use-financeiro-stats'
import {
  CaixaActionModal,
  CaixaDeleteModal,
  CaixaEditModal,
  CaixaViewModal,
} from './modals/caixa-modals'
import {
  LancamentoDeleteModal,
  LancamentoEditModal,
  LancamentoViewModal,
} from './modals/lancamento-modals'
import { NovoLancamentoModal } from './modals/novo-lancamento-modal'
import { ComprovanteLancamentoModal, RegistrarRecebimentoModal } from './modals'
import { FINANCEIRO_TABS, TAB_DESCRIPTIONS } from './financeiro.utils'
import { ContasTab, type AcaoConta } from './contas/contas-tab'
import { DetalheGruposModal } from './contas/detalhe-grupos-modal'
import { detalheCaixa, detalheLancamentos, type DetalheCard, type TipoDetalheFinanceiro } from './contas/detalhes-cards'

const TIPOS_STAT: TipoDetalheFinanceiro[] = ['entradas', 'saidas', 'saldo', 'centros']

export function FinanceiroView() {
  const financeiro = useFinanceiro()
  const caixa = useCaixa()
  const stats = useFinanceiroStats(financeiro.data, caixa.data, caixa.session)
  const lancamentoForm = useLancamentoForm({
    onCreate: financeiro.createLancamento,
    onUpdate: financeiro.updateLancamento,
    onDelete: financeiro.deleteLancamento,
  })
  const caixaForm = useCaixaForm({
    onOpen: caixa.openCaixa,
    onAdd: caixa.addMovimentacao,
    onClose: caixa.closeCaixa,
    onUpdate: caixa.updateMovimentacao,
    onDelete: caixa.deleteMovimentacao,
  })
  const [tab, setTab] = useState('recebimentos')
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('todas')
  const [comprovanteOpen, setComprovanteOpen] = useState(false)
  const [recebimentoOpen, setRecebimentoOpen] = useState(false)
  const [detalhe, setDetalhe] = useState<DetalheCard | null>(null)
  const [novaContaOpen, setNovaContaOpen] = useState(false)
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [cardFilter, setCardFilter] = useState<'todos' | 'liquidado' | 'pendente' | 'atrasado'>(
    'todos',
  )

  const contasTab = tab === 'recebimentos' || tab === 'pagamentos'
  // biome-ignore lint/correctness/useExhaustiveDependencies: recarrega as contas sempre que a lista de lançamentos muda
  useEffect(() => setRefreshSignal((atual) => atual + 1), [financeiro.data])
  const recarregarContas = () => setRefreshSignal((atual) => atual + 1)

  const handleAcaoConta = (acao: AcaoConta, item: FinanceiroItem) => {
    lancamentoForm.setSelectedLancamento(item)
    if (acao === 'ver') lancamentoForm.handleOpenLancamentoView(item)
    else if (acao === 'editar') lancamentoForm.handleOpenLancamentoEdit(item)
    else if (acao === 'excluir') lancamentoForm.setIsLancamentoDeleteOpen(true)
    else if (item.tipo === 'receita') setRecebimentoOpen(true)
    else {
      void financeiro
        .updateLancamento({ ...item, data: item.data, status: 'Pago' })
        .then(() => {
          toast.success('Despesa marcada como paga.')
          recarregarContas()
        })
        .catch((err) => toast.error(err instanceof Error ? err.message : 'Não foi possível marcar como pago.'))
    }
  }

  const categories = useMemo(
    () =>
      Array.from(new Set(financeiro.data.map((item) => item.categoria).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [financeiro.data],
  )
  const filteredData = useMemo(() => {
    const byTab =
      tab === 'recebimentos'
        ? financeiro.data.filter((item) => item.tipo === 'receita')
        : tab === 'pagamentos'
          ? financeiro.data.filter((item) => item.tipo === 'despesa')
          : financeiro.data
    return byTab.filter((item) => {
      const normalizedSearch = searchTerm.trim().toLowerCase()
      const matchesSearch =
        normalizedSearch === '' ||
        item.descricao.toLowerCase().includes(normalizedSearch) ||
        item.categoria.toLowerCase().includes(normalizedSearch)
      const matchesCategory = categoryFilter === 'todas' || item.categoria === categoryFilter
      const statusNorm = (item.status || '').toLowerCase()
      const isPago =
        statusNorm.includes('pago') ||
        statusNorm.includes('quitado') ||
        statusNorm.includes('liquidado')
      const isAtrasado = !isPago && statusNorm.includes('atrasado')
      const matchesCard =
        cardFilter === 'todos' ||
        (cardFilter === 'liquidado' && isPago) ||
        (cardFilter === 'pendente' && !isPago && !isAtrasado) ||
        (cardFilter === 'atrasado' && isAtrasado)
      return matchesSearch && matchesCategory && matchesCard
    })
  }, [cardFilter, categoryFilter, financeiro.data, searchTerm, tab])

  return (
    <div className="app-page">
      <PageHeader
        title="Financeiro"
        description={TAB_DESCRIPTIONS[tab]}
        actions={
          <Button
            onClick={() => (contasTab ? setNovaContaOpen(true) : lancamentoForm.setIsNewOpen(true))}
            className="h-11 shrink-0 rounded-xl bg-app-primary px-6 font-normal text-white shadow-sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            {tab === 'recebimentos' ? 'Novo recebimento' : tab === 'pagamentos' ? 'Nova despesa' : 'Novo lançamento'}
          </Button>
        }
      />

      <FinanceiroStatsCards
        cards={stats.cards}
        onSelect={(index) => setDetalhe(detalheLancamentos(TIPOS_STAT[index], financeiro.data))}
      />

      <div className="rounded-[24px] border border-app-border bg-app-card p-5 shadow-sm dark:border-app-border-dark dark:bg-app-card-dark md:p-6">
        <div className="space-y-5">
          <SegmentedControl
            options={FINANCEIRO_TABS}
            value={tab}
            onChange={(v) => {
              setTab(v)
              setCardFilter('todos')
            }}
          />

          {tab === 'lancamentos' && (
          <FilterBar>
            <div className="relative w-full lg:max-w-[420px]">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-muted" />
              <Input
                placeholder="Buscar por descrição ou categoria..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-11 rounded-xl border-app-border bg-app-bg-secondary/35 pl-10 text-sm shadow-sm dark:border-app-border-dark dark:bg-app-hover dark:text-white"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-11 w-full rounded-xl border-app-border bg-app-bg-secondary/35 lg:w-[240px] dark:border-app-border-dark dark:bg-app-hover">
                <SelectValue placeholder="Todas as categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={cardFilter} onValueChange={(v) => setCardFilter(v as typeof cardFilter)}>
              <SelectTrigger className="h-11 w-full rounded-xl border-app-border bg-app-bg-secondary/35 lg:w-[200px] dark:border-app-border-dark dark:bg-app-hover">
                <SelectValue placeholder="Status pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="liquidado">Liquidado</SelectItem>
                <SelectItem value="pendente">A vencer</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
              </SelectContent>
            </Select>

            <FilterBar.Spacer />

            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('')
                setCategoryFilter('todas')
                setCardFilter('todos')
              }}
              className="h-11 rounded-xl border-app-border px-5 font-normal dark:border-app-border-dark"
            >
              Limpar filtros
            </Button>
          </FilterBar>
          )}
        </div>
      </div>

      {(financeiro.error || caixa.error) && (
        <Card className="rounded-integrallys-lg border-[var(--app-danger-border)] bg-[var(--app-danger-bg)] p-4 text-sm text-[var(--app-danger-text)]">
          {financeiro.error ?? caixa.error}
        </Card>
      )}
      {contasTab && (
        <ContasTab
          key={tab}
          tipo={tab === 'recebimentos' ? 'receita' : 'despesa'}
          lancamentos={financeiro.data}
          refreshSignal={refreshSignal}
          novaContaOpen={novaContaOpen}
          onNovaContaClose={() => setNovaContaOpen(false)}
          onChanged={() => void financeiro.load()}
          onAcao={handleAcaoConta}
        />
      )}
      {!contasTab && (
      <FinanceiroTabContent
        tab={tab}
        filteredData={filteredData}
        isLoading={financeiro.isLoading}
        isLoadingCaixa={caixa.isLoading}
        data={financeiro.data}
        stats={stats}
        caixaData={caixa.data}
        caixaSession={caixa.session}
        onLancamentoView={lancamentoForm.handleOpenLancamentoView}
        onLancamentoEdit={lancamentoForm.handleOpenLancamentoEdit}
        onLancamentoDelete={(item) => {
          lancamentoForm.setSelectedLancamento(item)
          lancamentoForm.setIsLancamentoDeleteOpen(true)
        }}
        onLancamentoComprovante={(item) => {
          lancamentoForm.setSelectedLancamento(item)
          setComprovanteOpen(true)
        }}
        onLancamentoRecebimento={(item) => {
          lancamentoForm.setSelectedLancamento(item)
          setRecebimentoOpen(true)
        }}
        onCaixaView={caixaForm.handleOpenCaixaView}
        onCaixaEdit={caixaForm.handleOpenCaixaEdit}
        onCaixaDelete={(item) => {
          caixaForm.setSelectedCaixaItem(item)
          caixaForm.setIsCaixaDeleteOpen(true)
        }}
        onCaixaAction={caixaForm.setActiveCaixaModal}
        onDetalheCaixa={(tipo) =>
          setDetalhe(detalheCaixa(tipo, stats.caixaTodayData, stats.caixaStatus))
        }
        onDetalheLancamentos={(tipo) => setDetalhe(detalheLancamentos(tipo, financeiro.data))}
      />
      )}
      <DetalheGruposModal
        open={detalhe !== null}
        onClose={() => setDetalhe(null)}
        titulo={detalhe?.titulo ?? ''}
        descricao={detalhe?.descricao}
        total={detalhe?.total ?? 0}
        grupos={detalhe?.grupos ?? []}
        agrupadoPor={detalhe?.agrupadoPor}
      />
      <NovoLancamentoModal
        open={lancamentoForm.isNewOpen}
        onClose={() => {
          lancamentoForm.setIsNewOpen(false)
          lancamentoForm.setFormData(initialFormState)
        }}
        form={lancamentoForm.formData}
        onChange={lancamentoForm.setFormData}
        onSave={() => void lancamentoForm.handleCreateLancamento()}
      />
      <LancamentoViewModal
        open={lancamentoForm.isLancamentoViewOpen}
        onClose={() => lancamentoForm.setIsLancamentoViewOpen(false)}
        item={lancamentoForm.selectedLancamento}
      />
      <LancamentoEditModal
        open={lancamentoForm.isLancamentoEditOpen}
        onClose={() => {
          lancamentoForm.setIsLancamentoEditOpen(false)
          lancamentoForm.setSelectedLancamento(null)
        }}
        form={lancamentoForm.editLancamentoForm}
        onChange={lancamentoForm.setEditLancamentoForm}
        onSave={() => void lancamentoForm.handleUpdateLancamento()}
      />
      <LancamentoDeleteModal
        open={lancamentoForm.isLancamentoDeleteOpen}
        onClose={() => lancamentoForm.setIsLancamentoDeleteOpen(false)}
        item={lancamentoForm.selectedLancamento}
        onConfirm={() => void lancamentoForm.handleDeleteLancamento()}
      />
      <ComprovanteLancamentoModal
        isOpen={comprovanteOpen}
        onClose={() => setComprovanteOpen(false)}
        transacao={
          lancamentoForm.selectedLancamento
            ? {
                id: lancamentoForm.selectedLancamento.id,
                descricao: lancamentoForm.selectedLancamento.descricao,
                valor: lancamentoForm.selectedLancamento.valor,
                data: lancamentoForm.selectedLancamento.data,
                tipo: lancamentoForm.selectedLancamento.tipo,
                categoria: lancamentoForm.selectedLancamento.categoria,
                status: lancamentoForm.selectedLancamento.status,
              }
            : null
        }
      />
      <RegistrarRecebimentoModal
        isOpen={recebimentoOpen}
        onClose={() => setRecebimentoOpen(false)}
        pacienteNome={lancamentoForm.selectedLancamento?.descricao}
        transacaoId={lancamentoForm.selectedLancamento?.id}
        onSave={async (payload) => {
          if (!lancamentoForm.selectedLancamento) return
          await financeiro.updateLancamento({
            ...lancamentoForm.selectedLancamento,
            id: payload.transacaoId ?? lancamentoForm.selectedLancamento.id,
            descricao: lancamentoForm.selectedLancamento.descricao,
            categoria: lancamentoForm.selectedLancamento.categoria,
            valor: Number(payload.valor.replace(/\./g, '').replace(',', '.')),
            tipo: lancamentoForm.selectedLancamento.tipo,
            data: lancamentoForm.selectedLancamento.data,
            metodo: payload.metodo,
            status: 'Pago',
            observacoes: payload.observacao ?? lancamentoForm.selectedLancamento.observacoes,
          })
          toast.info('Lançamento atualizado como recebido.')
        }}
      />
      <CaixaActionModal
        open={caixaForm.activeCaixaModal !== null}
        mode={caixaForm.activeCaixaModal}
        onClose={() => {
          caixaForm.setActiveCaixaModal(null)
          caixaForm.resetCaixaForm()
        }}
        form={caixaForm.caixaForm}
        onChange={caixaForm.setCaixaForm}
        onSubmit={() => void caixaForm.handleSubmitCaixaAction()}
        caixaStatus={stats.caixaStatus}
      />
      <CaixaViewModal
        open={caixaForm.isCaixaViewOpen}
        onClose={() => caixaForm.setIsCaixaViewOpen(false)}
        item={caixaForm.selectedCaixaItem}
      />
      <CaixaEditModal
        open={caixaForm.isCaixaEditOpen}
        onClose={() => {
          caixaForm.setIsCaixaEditOpen(false)
          caixaForm.resetCaixaForm()
        }}
        item={caixaForm.selectedCaixaItem}
        form={caixaForm.caixaForm}
        onChange={caixaForm.setCaixaForm}
        onSave={() => void caixaForm.handleUpdateCaixaMovimento()}
      />
      <CaixaDeleteModal
        open={caixaForm.isCaixaDeleteOpen}
        onClose={() => caixaForm.setIsCaixaDeleteOpen(false)}
        item={caixaForm.selectedCaixaItem}
        onConfirm={() => void caixaForm.handleDeleteCaixaMovimento()}
      />
    </div>
  )
}
