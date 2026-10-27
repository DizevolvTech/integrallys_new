'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowDownRight, ArrowUpRight, Boxes, ChevronLeft, ChevronRight, Clock, Edit, Eye, History, Info, Inbox, MoreVertical, Package, Plus, Printer, Search, SlidersHorizontal, Trash2, Undo2 } from 'lucide-react'
import { useEstoque, type EstoqueInput, type MovimentacaoEstoqueInput, type MovimentacaoItem } from '@/features/estoque/hooks/use-estoque'
import { toast } from 'sonner'
import { SegmentedControl } from '@/components/shared/segmented-control'
import { FilterBar } from '@/components/shared/filter-bar'
import { EmptyState } from '@/components/shared/empty-state'
import { DateInput } from '@/components/shared/date-input'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { PageHeader } from '@/components/shared/page-header'
import {
  AjusteEstoqueModal,
  EditarProdutoModal,
  EntradaEstoqueModal,
  EstornarMovimentacaoModal,
  ExcluirProdutoModal,
  HistoricoProdutoModal,
  NovoProdutoModal,
  SaidaEstoqueModal,
  VisualizarEstoqueModal,
} from './modals'
import { CategoriasEstoqueModal } from './modals/categorias-estoque-modal'
import { ImprimirEtiquetaModal } from './modals/imprimir-etiqueta-modal'
import { useEstoqueCategorias } from './hooks/use-estoque-categorias'
import { EstoqueIndicadores } from './components/estoque-indicadores'
import { getValidadeStatus } from './estoque-validade'
import { formatarMargem, totalizarMargem } from '@/lib/margem'

type EstoqueModal =
  | 'entrada'
  | 'novo'
  | 'saida'
  | 'ajuste'
  | 'categorias'
  | 'visualizar'
  | 'editar'
  | 'excluir'
  | 'etiqueta'
  | 'historico'
  | 'estornar'
  | null
type EstoqueSection = 'estoque' | 'movimentacoes'

interface EstoqueViewProps {
  initialSection?: EstoqueSection
}

function getItemTone(status: string) {
  const normalized = status.toLowerCase()
  if (normalized.includes('indispon')) return 'bg-[var(--app-danger-text)] text-white dark:bg-red-900/60 dark:text-[var(--app-danger-text)]'
  if (normalized.includes('baixo')) return 'app-status-warning0 text-white dark:bg-amber-900/60 dark:text-[var(--app-warning-text)]'
  if (normalized.includes('crit')) return 'bg-[var(--app-danger-text)] text-white dark:bg-red-900/60 dark:text-[var(--app-danger-text)]'
  return 'bg-[var(--app-success-text)] text-white dark:bg-emerald-900/60 dark:text-[var(--app-success-text)]'
}

const PAGE_SIZE_MOVIMENTACOES = 20

export function EstoqueView({ initialSection = 'estoque' }: EstoqueViewProps) {
  const router = useRouter()
  const {
    data,
    error,
    isLoading,
    createProduto,
    updateProduto,
    deleteProduto,
    registrarEntrada,
    registrarSaida,
    movimentacoes,
    movimentacoesTotal,
    isLoadingMovimentacoes,
    movimentacoesError,
    loadMovimentacoes,
    estornarMovimentacao,
    registrarAjuste,
  } = useEstoque()
  const {
    data: categorias,
    create: createCategoria,
    remove: removeCategoria,
  } = useEstoqueCategorias()
  const categoriaNomes = useMemo(() => categorias.map((item) => item.nome), [categorias])
  const [section, setSection] = useState<EstoqueSection>(initialSection)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeModal, setActiveModal] = useState<EstoqueModal>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [movFiltroTipo, setMovFiltroTipo] = useState<string>('todos')
  const [movFiltroProduto, setMovFiltroProduto] = useState<string>('todos')
  const [movFiltroDe, setMovFiltroDe] = useState<string>('')
  const [movFiltroAte, setMovFiltroAte] = useState<string>('')
  const [movPage, setMovPage] = useState<number>(0)
  const [estornarMov, setEstornarMov] = useState<MovimentacaoItem | null>(null)

  const filteredItems = useMemo(() => {
    return data.filter((item) =>
      [item.produto, item.categoria, item.status].join(' ').toLowerCase().includes(searchTerm.toLowerCase()),
    )
  }, [data, searchTerm])

  const selectedItem = useMemo(() => data.find((item) => item.id === selectedId) ?? null, [data, selectedId])
  const criticalCount = useMemo(
    () =>
      data.filter((item) => {
        const minimo = Number(item.estoqueMinimo ?? 0)
        const qty = Number(item.quantidade ?? 0)
        if (Number.isFinite(minimo) && minimo > 0) return qty <= minimo
        const status = String(item.status ?? '').toLowerCase()
        return status.includes('baixo') || status.includes('crit')
      }).length,
    [data],
  )
  const proximasVencimentoCount = useMemo(
    () =>
      data.filter((item) => {
        const status = getValidadeStatus(item.validade)
        return status === 'proxima' || status === 'vencida'
      }).length,
    [data],
  )
  const filteredMovimentacoes = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) return movimentacoes
    return movimentacoes.filter((item) =>
      [item.produtoNome, item.observacoes ?? '', item.vinculoNome ?? '', item.operadorNome]
        .join(' ')
        .toLowerCase()
        .includes(term),
    )
  }, [movimentacoes, searchTerm])

  const fetchMovimentacoes = useCallback(
    (page: number) => {
      const tipo = movFiltroTipo === 'todos' ? undefined : movFiltroTipo
      const produtoId = movFiltroProduto === 'todos' ? undefined : movFiltroProduto
      void loadMovimentacoes({
        tipo,
        produtoId,
        de: movFiltroDe || undefined,
        ate: movFiltroAte || undefined,
        limit: PAGE_SIZE_MOVIMENTACOES,
        offset: page * PAGE_SIZE_MOVIMENTACOES,
      })
    },
    [loadMovimentacoes, movFiltroAte, movFiltroDe, movFiltroProduto, movFiltroTipo],
  )

  useEffect(() => {
    if (section !== 'movimentacoes') return
    fetchMovimentacoes(movPage)
  }, [section, movPage, fetchMovimentacoes])

  useEffect(() => {
    setMovPage(0)
  }, [movFiltroTipo, movFiltroProduto, movFiltroDe, movFiltroAte])

  const totalMovPages = Math.max(1, Math.ceil(movimentacoesTotal / PAGE_SIZE_MOVIMENTACOES))
  const limparFiltrosMovimentacoes = () => {
    setMovFiltroTipo('todos')
    setMovFiltroProduto('todos')
    setMovFiltroDe('')
    setMovFiltroAte('')
    setMovPage(0)
  }

  const sectionTitle = section === 'movimentacoes' ? 'Entradas e saídas' : 'Consulta de estoque'
  const sectionSubtitle =
    section === 'movimentacoes'
      ? 'Controle entradas, saídas e histórico de abastecimento.'
      : 'Visualize a disponibilidade de produtos para prescrição'
  const sectionDescription =
    section === 'movimentacoes'
      ? 'Gerencie entradas, saídas e o histórico de movimentações dos itens.'
      : 'Acompanhe saldo, nível crítico e itens disponíveis.'

  const openModal = (modal: EstoqueModal, itemId?: string | null) => {
    setSelectedId(itemId ?? null)
    setActiveModal(modal)
  }

  const handleEntrada = async (payload: MovimentacaoEstoqueInput) => {
    await registrarEntrada(payload)
    toast.success('Entrada registrada com sucesso.')
    setActiveModal(null)
  }

  const handleSaida = async (payload: MovimentacaoEstoqueInput) => {
    await registrarSaida(payload)
    toast.success(
      payload.tipoMovimentacao === 'consumo_interno'
        ? 'Consumo interno registrado com sucesso.'
        : 'Saída registrada com sucesso.',
    )
    setActiveModal(null)
  }

  const handleEditar = async (payload: { id?: string; produto: string; categoria: string; quantidade: number; status?: string }) => {
    await updateProduto(payload)
    toast.success('Produto atualizado com sucesso.')
    setActiveModal(null)
    setSelectedId(null)
  }

  const handleCriar = async (payload: EstoqueInput) => {
    await createProduto(payload)
    toast.success('Produto cadastrado com sucesso.')
    setActiveModal(null)
  }

  const handleExcluir = async () => {
    if (!selectedItem) return
    await deleteProduto(selectedItem.id)
    toast.success('Produto excluído com sucesso.')
    setActiveModal(null)
    setSelectedId(null)
  }

  return (
    <div className="app-page app-page-loose pb-10">
      <PageHeader
        title={sectionTitle}
        description={sectionSubtitle}
        actions={
          <>
            <Button
              onClick={() => setActiveModal('novo')}
              className="flex-1 md:flex-none h-11 md:h-12 px-6 bg-app-primary hover:bg-app-primary-hover text-white font-normal rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[var(--app-primary)]/10 transition-all active:scale-[0.98]"
            >
              <Plus size={18} />
              Novo produto
            </Button>
            <Button
              variant="outline"
              onClick={() => setActiveModal('categorias')}
              className="flex-1 md:flex-none h-11 md:h-12 px-4 rounded-xl"
            >
              Categorias
            </Button>
            <Button
              variant="outline"
              onClick={() => setActiveModal('ajuste')}
              className="flex-1 md:flex-none h-11 md:h-12 px-4 rounded-xl"
            >
              Ajuste
            </Button>
            {section === 'estoque' && criticalCount > 0 && (
              <div className="bg-[var(--app-danger-text)] dark:bg-red-900/40 dark:text-[var(--app-danger-text)] text-white flex items-center gap-2 px-4 py-2.5 rounded-[12px] font-normal text-sm shadow-lg shadow-red-500/10">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{criticalCount} item(ns) com estoque baixo</span>
              </div>
            )}
            {section === 'estoque' && proximasVencimentoCount > 0 && (
              <div className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 flex items-center gap-2 px-4 py-2.5 rounded-[12px] font-normal text-sm shadow-lg shadow-amber-500/10">
                <Clock className="h-4 w-4 shrink-0" />
                <span>{proximasVencimentoCount} item(ns) com validade próxima</span>
              </div>
            )}
            {section === 'movimentacoes' && (
              <div className="flex items-center gap-3 w-full md:w-auto">
                <Button
                  onClick={() => openModal('entrada')}
                  className="flex-1 md:flex-none h-11 md:h-12 px-6 bg-app-primary hover:bg-app-primary-hover text-white font-normal rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[var(--app-primary)]/10 transition-all active:scale-[0.98]"
                >
                  <ArrowUpRight size={18} />
                  Entrada
                </Button>
                <Button
                  onClick={() => openModal('saida')}
                  className="flex-1 md:flex-none h-11 md:h-12 px-6 bg-[#E53E3E] hover:bg-[#C53030] text-white font-normal rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-500/10 transition-all active:scale-[0.98]"
                >
                  <ArrowDownRight size={18} />
                  Saída
                </Button>
              </div>
            )}
          </>
        }
      />

      <div className="space-y-4 rounded-[24px] border border-app-border bg-app-card p-5 shadow-sm dark:border-app-border-dark dark:bg-app-card-dark">
        <SegmentedControl
          options={[
            { value: 'estoque', label: 'Estoque' },
            { value: 'movimentacoes', label: 'Movimentos' },
            { value: 'suprimentos', label: 'Suprimentos' },
          ]}
          value={section}
          onChange={(value) => (value === 'suprimentos' ? router.push('/estoque/suprimentos') : setSection(value as EstoqueSection))}
          size="lg"
        />
        <p className="text-sm font-normal text-app-text-secondary dark:text-white/60">{sectionDescription}</p>
      </div>

      {error && <p className="text-sm text-[var(--app-danger-text)]">{error}</p>}

      {section === 'movimentacoes' ? (
        <div className="bg-app-card dark:bg-app-card-dark rounded-[20px] shadow-sm border border-app-border dark:border-app-border-dark/50 overflow-hidden">
          <div className="p-6 md:p-8 space-y-6">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-app-bg-secondary dark:bg-app-table-header-dark flex items-center justify-center border border-app-border dark:border-app-border-dark">
                  <Package className="h-5 w-5 text-app-text-primary dark:text-white" />
                </div>
                <h2 className="text-xl font-normal text-app-text-primary dark:text-white tracking-tight">
                  Movimentações ({movimentacoesTotal})
                </h2>
              </div>

              <div className="relative w-full lg:w-[400px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-app-text-muted" />
                <Input
                  placeholder="Buscar por produto, operador ou vínculo..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-12 h-12 rounded-integrallys-lg border-app-border dark:border-app-border-dark bg-app-bg-secondary/50 dark:bg-app-bg-dark focus-visible:ring-[var(--app-primary)] transition-all w-full"
                />
              </div>
            </div>

            <FilterBar>
              <Select value={movFiltroTipo} onValueChange={setMovFiltroTipo}>
                <SelectTrigger className="h-11 w-full rounded-xl sm:w-44">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                  <SelectItem value="consumo_interno">Consumo interno</SelectItem>
                </SelectContent>
              </Select>

              <Select value={movFiltroProduto} onValueChange={setMovFiltroProduto}>
                <SelectTrigger className="h-11 w-full rounded-xl sm:w-64">
                  <SelectValue placeholder="Produto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os produtos</SelectItem>
                  {data.map((produto) => (
                    <SelectItem key={produto.id} value={produto.id}>
                      {produto.produto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex flex-col gap-1 sm:w-44">
                <span className="text-[11px] uppercase tracking-wider text-app-text-muted">De</span>
                <DateInput value={movFiltroDe} onChange={setMovFiltroDe} />
              </div>
              <div className="flex flex-col gap-1 sm:w-44">
                <span className="text-[11px] uppercase tracking-wider text-app-text-muted">Até</span>
                <DateInput value={movFiltroAte} onChange={setMovFiltroAte} />
              </div>

              <FilterBar.Spacer />

              <Button
                variant="outline"
                onClick={limparFiltrosMovimentacoes}
                className="h-11 rounded-xl px-5 font-normal"
              >
                Limpar filtros
              </Button>
            </FilterBar>

            {movimentacoesError && (
              <p className="text-sm text-[var(--app-danger-text)]">{movimentacoesError}</p>
            )}

            {isLoadingMovimentacoes ? (
              <div className="py-12 text-center text-app-text-muted">Carregando movimentações...</div>
            ) : filteredMovimentacoes.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="Nenhuma movimentação registrada"
                description={
                  movimentacoesTotal === 0
                    ? 'Registre uma entrada ou saída para visualizar movimentações.'
                    : 'Ajuste os filtros para encontrar movimentações.'
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto rounded-[16px] border border-app-border dark:border-app-border-dark">
                  <Table>
                    <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-hover">
                      <TableRow>
                        <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary">Data/Hora</TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary">Produto</TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary">Tipo</TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary">Quantidade</TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary">Operador</TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary">Vínculo</TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary">Observação</TableHead>
                        <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-app-text-secondary">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMovimentacoes.map((mov) => (
                        <MovimentacaoRow
                          key={mov.id}
                          mov={mov}
                          onEstornar={() => {
                            setEstornarMov(mov)
                            setActiveModal('estornar')
                          }}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-app-text-muted">
                    Página {movPage + 1} de {totalMovPages} · {movimentacoesTotal} movimentações
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setMovPage((current) => Math.max(0, current - 1))}
                      disabled={movPage === 0}
                      className="h-10 rounded-xl px-4"
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setMovPage((current) => Math.min(totalMovPages - 1, current + 1))}
                      disabled={movPage >= totalMovPages - 1}
                      className="h-10 rounded-xl px-4"
                    >
                      Próxima
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          {criticalCount > 0 && (
            <div className="bg-app-card dark:bg-app-card-dark border border-app-border dark:border-app-border-dark rounded-[16px] p-6 shadow-sm flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-app-bg-secondary dark:bg-app-table-header-dark flex items-center justify-center shrink-0 border border-app-border dark:border-app-border-dark">
                <Info className="h-5 w-5 text-app-text-muted" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-normal text-app-text-primary dark:text-white">Atenção:</h4>
                <p className="text-base text-app-text-muted dark:text-app-text-muted font-normal leading-relaxed">
                  Existem produtos com estoque abaixo do mínimo recomendado. Considere isso ao prescrever.
                </p>
              </div>
            </div>
          )}

          <div className="bg-app-card dark:bg-app-card-dark rounded-[20px] shadow-sm border border-app-border dark:border-app-border-dark/50 overflow-hidden">
            <div className="p-6 md:p-8 space-y-8">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-app-bg-secondary dark:bg-app-table-header-dark flex items-center justify-center border border-app-border dark:border-app-border-dark">
                    <Package className="h-5 w-5 text-app-text-primary dark:text-white" />
                  </div>
                  <h2 className="text-xl font-normal text-app-text-primary dark:text-white tracking-tight">
                    Produtos disponíveis ({filteredItems.length})
                  </h2>
                </div>

                <div className="relative w-full lg:w-[400px]">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-app-text-muted" />
                  <Input
                    placeholder="Buscar por nome ou categoria..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="pl-12 h-12 rounded-integrallys-lg border-app-border dark:border-app-border-dark bg-app-bg-secondary/50 dark:bg-app-bg-dark focus-visible:ring-[var(--app-primary)] transition-all w-full"
                  />
                </div>
              </div>

              {!isLoading && filteredItems.length > 0 && (() => {
                const { quantidade: totalQtd, custo: totalCusto, venda: totalVenda, margem } = totalizarMargem(filteredItems)
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="rounded-[16px] border-app-border dark:border-app-border-dark p-4">
                      <p className="text-xs text-app-text-muted uppercase tracking-wider">Qtd Total</p>
                      <p className="text-xl font-normal text-app-text-primary dark:text-white mt-1">{totalQtd}</p>
                    </Card>
                    <Card className="rounded-[16px] border-app-border dark:border-app-border-dark p-4">
                      <p className="text-xs text-app-text-muted uppercase tracking-wider">Custo Total</p>
                      <p className="text-xl font-normal text-app-text-primary dark:text-white mt-1">R$ {totalCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </Card>
                    <Card className="rounded-[16px] border-app-border dark:border-app-border-dark p-4">
                      <p className="text-xs text-app-text-muted uppercase tracking-wider">Venda Total</p>
                      <p className="text-xl font-normal text-[var(--app-success-text)] mt-1">R$ {totalVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </Card>
                    <Card className="rounded-[16px] border-app-border dark:border-app-border-dark p-4">
                      <p className="text-xs text-app-text-muted uppercase tracking-wider">Margem Total</p>
                      <p className="text-xl font-normal text-[var(--app-success-text)] mt-1">{formatarMargem(margem)}</p>
                    </Card>
                  </div>
                )
              })()}

              <div className="grid grid-cols-1 gap-4">
              {isLoading && (
                <div className="text-center py-20 bg-app-bg-secondary/50 dark:bg-app-hover rounded-[32px] border-2 border-dashed border-app-border dark:border-app-border-dark">
                  Carregando estoque...
                </div>
              )}

              {!isLoading && filteredItems.map((item) => (
                <Card key={item.id} className="group overflow-hidden rounded-[24px] border-none bg-app-card dark:bg-app-card-dark shadow-sm hover:shadow-md transition-all duration-300">
                  <CardContent className="p-4 md:p-6 flex flex-wrap md:flex-nowrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-app-bg-secondary dark:bg-app-hover flex items-center justify-center text-app-text-muted group-hover:scale-110 transition-transform">
                        <Package size={24} className="md:h-7 md:w-7" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-md md:text-lg font-normal text-app-text-primary dark:text-white truncate">
                          {item.produto}
                        </h4>
                        <p className="text-xs md:text-sm text-app-text-secondary dark:text-white/60 font-normal">
                          {item.categoria}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-end md:items-center gap-3 md:gap-6">
                      <EstoqueIndicadores item={item} className="hidden md:flex items-center gap-4 text-xs text-app-text-secondary dark:text-white/60" />
                      <div className="text-right space-y-0.5">
                        <p className="text-sm md:text-md font-normal text-app-text-primary dark:text-white">
                          Qtd: {item.quantidade} {item.estoqueMinimo > 0 && <span className="text-xs text-app-text-muted">(min: {item.estoqueMinimo})</span>}
                        </p>
                      </div>

                      <span className={`px-4 py-1.5 rounded-full text-xs font-normal shadow-sm text-white whitespace-nowrap ${getItemTone(item.status)}`}>
                        {item.status}
                      </span>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-10 w-10 rounded-xl flex items-center justify-center text-app-text-muted hover:text-app-text-secondary hover:bg-app-bg-secondary dark:hover:bg-app-hover transition-colors">
                            <MoreVertical size={20} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl">
                          <DropdownMenuItem
                            onClick={() => {
                              openModal('visualizar', item.id)
                            }}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Eye size={16} />
                            Visualizar item
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              openModal('historico', item.id)
                            }}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <History size={16} />
                            Histórico
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              openModal('editar', item.id)
                            }}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Edit size={16} />
                            Editar produto
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              openModal('ajuste', item.id)
                            }}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <SlidersHorizontal size={16} />
                            Ajuste de estoque
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              openModal('etiqueta', item.id)
                            }}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Printer size={16} />
                            Imprimir etiqueta
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              openModal('excluir', item.id)
                            }}
                            className="flex items-center gap-2 cursor-pointer text-[var(--app-danger-text)] focus:text-[var(--app-danger-text)]"
                          >
                            <Trash2 size={16} />
                            Excluir produto
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <EstoqueIndicadores item={item} className="order-last grid w-full grid-cols-2 gap-x-4 gap-y-1 text-xs text-app-text-secondary dark:text-white/60 md:hidden" />
                  </CardContent>
                </Card>
              ))}

              {!isLoading && filteredItems.length === 0 && (
                <div className="text-center py-20 bg-app-bg-secondary/50 dark:bg-app-hover rounded-[32px] border-2 border-dashed border-app-border dark:border-app-border-dark">
                  <Boxes className="mx-auto h-12 w-12 text-app-text-muted" />
                  <h3 className="mt-4 text-lg font-normal text-app-text-primary dark:text-white">Nenhum produto encontrado</h3>
                  <p className="text-app-text-muted text-sm font-normal">Tente ajustar sua busca para encontrar o item desejado.</p>
                </div>
              )}
            </div>
          </div>
          </div>
        </>
      )}

      <EntradaEstoqueModal
        isOpen={activeModal === 'entrada'}
        onClose={(open) => {
          if (!open) setActiveModal(null)
        }}
        items={data}
        onConfirm={handleEntrada}
      />

      <SaidaEstoqueModal
        isOpen={activeModal === 'saida'}
        onClose={(open) => {
          if (!open) setActiveModal(null)
        }}
        items={data}
        onConfirm={handleSaida}
      />

      <NovoProdutoModal
        isOpen={activeModal === 'novo'}
        onClose={(open) => {
          if (!open) setActiveModal(null)
        }}
        categorias={categoriaNomes}
        onSave={handleCriar}
      />

      <EditarProdutoModal
        isOpen={activeModal === 'editar'}
        onClose={(open) => {
          if (!open) {
            setActiveModal(null)
            setSelectedId(null)
          }
        }}
        produto={selectedItem}
        categorias={categoriaNomes}
        onSave={handleEditar}
      />

      <AjusteEstoqueModal
        isOpen={activeModal === 'ajuste'}
        onClose={() => {
          setActiveModal(null)
          setSelectedId(null)
        }}
        produtos={data}
        produtoIdInicial={selectedId ?? undefined}
        onSave={async (payload) => {
          await registrarAjuste(payload)
        }}
      />

      <CategoriasEstoqueModal
        isOpen={activeModal === 'categorias'}
        onClose={() => setActiveModal(null)}
        categorias={categorias}
        onCreate={async (nome) => {
          await createCategoria(nome)
        }}
        onRemove={async (id) => {
          await removeCategoria(id)
        }}
      />

      <ExcluirProdutoModal
        isOpen={activeModal === 'excluir'}
        onClose={(open) => {
          if (!open) {
            setActiveModal(null)
            setSelectedId(null)
          }
        }}
        produto={selectedItem}
        onConfirm={async () => {
          await handleExcluir()
        }}
      />

      <VisualizarEstoqueModal
        isOpen={activeModal === 'visualizar'}
        onClose={(open) => {
          if (!open) {
            setActiveModal(null)
            setSelectedId(null)
          }
        }}
        item={selectedItem}
      />

      <ImprimirEtiquetaModal
        isOpen={activeModal === 'etiqueta'}
        onClose={(open) => {
          if (!open) {
            setActiveModal(null)
            setSelectedId(null)
          }
        }}
        item={selectedItem}
      />

      <HistoricoProdutoModal
        isOpen={activeModal === 'historico'}
        onClose={(open) => {
          if (!open) {
            setActiveModal(null)
            setSelectedId(null)
          }
        }}
        produto={selectedItem}
      />

      <EstornarMovimentacaoModal
        isOpen={activeModal === 'estornar'}
        onClose={(open) => {
          if (!open) {
            setActiveModal(null)
            setEstornarMov(null)
          }
        }}
        movimentacao={estornarMov}
        onConfirm={async (movimentacaoId, motivo) => {
          await estornarMovimentacao(movimentacaoId, motivo)
          fetchMovimentacoes(movPage)
        }}
      />
    </div>
  )
}

function formatDateTime(value: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function MovimentacaoRow({ mov, onEstornar }: { mov: MovimentacaoItem; onEstornar: () => void }) {
  const isEntrada = mov.tipo === 'entrada'
  const isConsumo = mov.tipoMovimentacao === 'consumo_interno'

  const badgeClass = mov.estornada
    ? 'rounded-full border-app-border bg-app-bg-secondary/60 text-app-text-muted dark:bg-app-hover'
    : isEntrada
      ? 'rounded-full app-status-success border-transparent text-[var(--app-success-text)] dark:bg-transparent'
      : isConsumo
        ? 'rounded-full app-status-warning border-transparent text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
        : 'rounded-full app-status-danger border-transparent text-[var(--app-danger-text)] dark:bg-transparent'

  const tipoLabel = isEntrada ? 'Entrada' : isConsumo ? 'Consumo interno' : 'Saída'
  const rowClass = mov.estornada ? 'opacity-50' : ''

  return (
    <TableRow className={rowClass}>
      <TableCell className="text-app-text-secondary dark:text-white/70 text-sm whitespace-nowrap">
        {formatDateTime(mov.criadoEm)}
      </TableCell>
      <TableCell className="font-normal text-app-text-primary dark:text-white">
        {mov.produtoNome || '—'}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`px-3 py-1 text-xs font-medium ${badgeClass}`}>
            {tipoLabel}
          </Badge>
          {mov.estornada && (
            <Badge variant="outline" className="rounded-full border-app-border bg-app-bg-secondary/40 px-2 py-0.5 text-[10px] font-medium text-app-text-muted">
              Estornada
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="tabular-nums text-app-text-primary dark:text-white">
        {isEntrada ? '+' : '-'}{mov.quantidade}
      </TableCell>
      <TableCell className="text-app-text-secondary dark:text-white/70">{mov.operadorNome || '—'}</TableCell>
      <TableCell className="text-app-text-secondary dark:text-white/70">
        {mov.vinculoNome ? (
          <span>
            {mov.vinculoNome}
            {mov.vinculoTipo && (
              <span className="ml-1 text-[10px] uppercase tracking-wider text-app-text-muted">({mov.vinculoTipo})</span>
            )}
          </span>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell className="max-w-xs truncate text-xs text-app-text-muted">
        {mov.observacoes ?? '—'}
      </TableCell>
      <TableCell className="text-right">
        {!mov.estornada && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onEstornar}
            className="h-9 rounded-lg px-3 text-xs font-medium text-app-text-secondary hover:bg-app-bg-secondary dark:hover:bg-app-hover"
          >
            <Undo2 className="mr-1 h-3.5 w-3.5" />
            Estornar
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}
