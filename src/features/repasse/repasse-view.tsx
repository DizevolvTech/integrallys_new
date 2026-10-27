'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Calendar, MoreVertical, Plus, Settings2, WalletCards } from 'lucide-react'
import { toast } from 'sonner'
import {
  type RepasseItem,
  type RepasseRuleItem,
  useRepasse,
} from '@/features/repasse/hooks/use-repasse'
import { CartaoMobile, ListaCartoesMobile } from '@/components/shared/mobile-card'
import { DataTable } from '@/components/shared/data-table'
import { PageHeader } from '@/components/shared/page-header'
import { SegmentedControl } from '@/components/shared/segmented-control'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { EfetuarPagamentoRepasseModal } from './modals'

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

type TabValue = 'geracao' | 'configuracao'
type RuleModalState = { open: boolean; item: RepasseRuleItem | null }

const EMPTY_GENERATION = {
  periodoInicio: '',
  periodoFim: '',
  profissionalId: 'todos',
  unidadeId: 'todas',
}

const EMPTY_RULE_FORM = {
  profissionalId: '',
  unidadeId: 'todas',
  modo: 'percentual' as 'percentual' | 'fixo',
  valor: '',
  ativo: 'ativo' as 'ativo' | 'inativo',
  observacoes: '',
}

export function RepasseView() {
  const {
    data,
    rules,
    profissionais,
    unidades,
    isLoading,
    error,
    generateRepasse,
    saveRule,
    deleteRule,
    cancelRepasse,
  } = useRepasse()

  const [tab, setTab] = useState<TabValue>('geracao')
  const [generationModalOpen, setGenerationModalOpen] = useState(false)
  const [ruleModal, setRuleModal] = useState<RuleModalState>({ open: false, item: null })
  const [deleteModal, setDeleteModal] = useState<RuleModalState>({ open: false, item: null })
  const [generationForm, setGenerationForm] = useState(EMPTY_GENERATION)
  const [ruleForm, setRuleForm] = useState(EMPTY_RULE_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedRepasse, setSelectedRepasse] = useState<RepasseItem | null>(null)
  const [isEfetuarPagamentoOpen, setIsEfetuarPagamentoOpen] = useState(false)

  const stats = useMemo(() => {
    const total = data.reduce((acc, item) => acc + item.valor, 0)
    const pagos = data.filter((item) => item.status.toLowerCase().includes('pago')).length
    const pendentes = data.filter((item) => !item.status.toLowerCase().includes('pago')).length

    return [
      { title: 'Total a repassar', value: formatCurrency(total) },
      { title: 'Pagos', value: String(pagos) },
      { title: 'Pendentes', value: String(pendentes) },
    ]
  }, [data])

  const resetRuleForm = (item?: RepasseRuleItem | null) => {
    if (!item) {
      setRuleForm(EMPTY_RULE_FORM)
      return
    }

    setRuleForm({
      profissionalId: item.profissionalId,
      unidadeId: item.unidadeId ?? 'todas',
      modo: item.valorFixo != null ? 'fixo' : 'percentual',
      valor: String(item.valorFixo ?? item.percentual ?? ''),
      ativo: item.ativo ? 'ativo' : 'inativo',
      observacoes: item.observacoes ?? '',
    })
  }

  const openCreateRule = () => {
    setRuleModal({ open: true, item: null })
    resetRuleForm(null)
  }

  const openEditRule = (item: RepasseRuleItem) => {
    setRuleModal({ open: true, item })
    resetRuleForm(item)
  }

  const handleGenerate = async () => {
    if (!generationForm.periodoInicio || !generationForm.periodoFim) {
      toast.error('Informe o período inicial e final para gerar os repasses.')
      return
    }

    setIsSubmitting(true)
    try {
      await generateRepasse({
        periodoInicio: generationForm.periodoInicio,
        periodoFim: generationForm.periodoFim,
        profissionalId: generationForm.profissionalId === 'todos' ? undefined : generationForm.profissionalId,
        unidadeId: generationForm.unidadeId === 'todas' ? undefined : generationForm.unidadeId,
      })
      toast.success('Repasses gerados com sucesso.')
      setGenerationModalOpen(false)
      setGenerationForm(EMPTY_GENERATION)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível gerar os repasses.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveRule = async () => {
    if (!ruleForm.profissionalId || !ruleForm.valor) {
      toast.error('Selecione o profissional e informe o valor da regra.')
      return
    }

    setIsSubmitting(true)
    try {
      const numericValue = Number(ruleForm.valor.replace(',', '.'))
      await saveRule({
        id: ruleModal.item?.id,
        profissionalId: ruleForm.profissionalId,
        unidadeId: ruleForm.unidadeId === 'todas' ? undefined : ruleForm.unidadeId,
        percentual: ruleForm.modo === 'percentual' ? numericValue : null,
        valorFixo: ruleForm.modo === 'fixo' ? numericValue : null,
        ativo: ruleForm.ativo === 'ativo',
        observacoes: ruleForm.observacoes || undefined,
      })
      toast.success(ruleModal.item ? 'Regra atualizada com sucesso.' : 'Regra criada com sucesso.')
      setRuleModal({ open: false, item: null })
      resetRuleForm(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar a regra.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteRule = async () => {
    if (!deleteModal.item) return

    setIsSubmitting(true)
    try {
      await deleteRule(deleteModal.item.id)
      toast.success('Regra removida com sucesso.')
      setDeleteModal({ open: false, item: null })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível remover a regra.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancelRepasse = async (item: RepasseItem) => {
    try {
      await cancelRepasse(item.id)
      toast.success(`Repasse de ${item.profissional} cancelado.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível cancelar o repasse.')
    }
  }

  const renderAcoes = (item: (typeof data)[number]) => (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
                              <MoreVertical className="h-4 w-4 text-app-text-secondary" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            {!item.status.toLowerCase().includes('pago') && !item.status.toLowerCase().includes('cancel') && (
                              <DropdownMenuItem onClick={() => { setSelectedRepasse(item); setIsEfetuarPagamentoOpen(true) }}>Efetuar pagamento</DropdownMenuItem>
                            )}
                            {item.status.toLowerCase().includes('pago') && (
                              <DropdownMenuItem onClick={() => {
                                const content = `RECIBO DE REPASSE\n\nProfissional: ${item.profissional}\nPeríodo: ${item.periodo}\nValor: ${formatCurrency(item.valor)}\nPago em: ${item.pagoEm || '-'}\n\nAssinatura: ___________________________`
                                const w = window.open('', '_blank', 'width=400,height=500')
                                if (w) { w.document.write(`<pre style="font-family:monospace;padding:24px;white-space:pre-wrap">${content}</pre>`); w.document.close(); w.print() }
                              }}>Imprimir recibo</DropdownMenuItem>
                            )}
                            {!item.status.toLowerCase().includes('cancel') && (
                              <DropdownMenuItem
                                onClick={() => void handleCancelRepasse(item)}
                                className="text-[var(--app-danger-text)] focus:text-[var(--app-danger-text)]"
                              >
                                Cancelar repasse
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
  )

  return (
    <div className="app-page app-page-loose">
      <PageHeader
        breadcrumb={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/" className="text-app-text-primary/70 dark:text-white/80 hover:text-app-primary dark:hover:text-white">
                  Início
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink className="text-app-text-primary/70 dark:text-white/80">
                  Financeiro
                </BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
        title="Repasse de profissionais"
        description="Controle administrativo de geração, pagamento e configuração dos repasses."
      />

      <div className="app-grid-stats md:grid-cols-3">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            className="rounded-integrallys-lg border border-app-border bg-app-card p-8 shadow-sm dark:border-app-border-dark dark:bg-app-card-dark"
          >
            <div className="space-y-3">
              <span className="text-sm font-normal tracking-wider text-app-text-muted">{stat.title}</span>
              <h3 className="text-3xl font-normal text-app-text-primary dark:text-white">{stat.value}</h3>
            </div>
          </Card>
        ))}
      </div>

      <div className="app-page-frame mx-auto">
        <div className="w-full max-w-2xl mx-auto">
          <SegmentedControl
            options={[
              { value: 'geracao', label: 'Geração de repasse' },
              { value: 'configuracao', label: 'Configuração' },
            ]}
            value={tab}
            onChange={(value) => setTab(value as TabValue)}
          />
        </div>
      </div>

      {error && (
        <Card className="rounded-integrallys-lg border-[var(--app-danger-border)] bg-[var(--app-danger-bg)] p-4 text-sm text-[var(--app-danger-text)]">
          {error}
        </Card>
      )}

      {tab === 'geracao' ? (
        <div className="overflow-hidden rounded-[24px] border border-app-border bg-app-card shadow-sm dark:border-app-border-dark dark:bg-app-card-dark">
          <div className="flex items-center justify-between gap-4 p-8 pb-4">
            <div className="flex items-center gap-3">
              <WalletCards className="h-6 w-6 text-app-text-primary dark:text-white" />
              <div>
                <h2 className="text-xl font-normal tracking-tight text-app-text-primary dark:text-white">Geração de repasse</h2>
                <p className="mt-1 text-sm text-app-text-muted">Apure os valores por período e acompanhe a liquidação dos pagamentos.</p>
              </div>
            </div>
            <Button className="h-11 rounded-xl px-5" onClick={() => setGenerationModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Gerar repasse
            </Button>
          </div>

          {isLoading ? (
            <div className="px-8 pb-8 text-sm text-app-text-muted">Carregando repasses...</div>
          ) : data.length === 0 ? (
            <div className="px-8 pb-8">
              <div className="rounded-[12px] border border-dashed border-app-border bg-app-bg-secondary/40 p-8 text-center dark:border-app-border-dark dark:bg-app-bg-dark">
                <p className="text-base text-app-text-primary dark:text-white">Nenhum repasse encontrado.</p>
                <p className="mt-2 text-sm text-app-text-muted">Gere a apuração do período para preencher esta listagem.</p>
              </div>
            </div>
          ) : (
            <DataTable data={data}>
              {(pageData) => (
                <>
                <ListaCartoesMobile>
                  {pageData.map((item) => (
                    <CartaoMobile
                      key={item.id}
                      titulo={item.profissional}
                      subtitulo={`${item.tipoVinculo === 'parceiro' ? 'Parceiro' : 'Interno'} · ${item.unidade || 'Global'}`}
                      valor={formatCurrency(item.valor)}
                      selo={
                        <Badge
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            item.status.toLowerCase().includes('pago')
                              ? 'app-status-success text-white'
                              : item.status.toLowerCase().includes('cancel')
                                ? 'bg-rose-500 text-white'
                                : 'app-status-warning text-white'
                          }`}
                        >
                          {item.status}
                        </Badge>
                      }
                      acoes={renderAcoes(item)}
                      campos={[
                        { rotulo: 'Período', valor: item.periodo },
                        { rotulo: 'Pago em', valor: item.pagoEm || '--' },
                      ]}
                    />
                  ))}
                </ListaCartoesMobile>
                <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-hover">
                  <TableRow>
                    <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary">Profissional</TableHead>
                    <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary">Tipo</TableHead>
                    <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary">Unidade</TableHead>
                    <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary">Período</TableHead>
                    <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-app-text-secondary">Valor</TableHead>
                    <TableHead className="text-center text-xs font-medium uppercase tracking-wider text-app-text-secondary">Status</TableHead>
                    <TableHead className="text-center text-xs font-medium uppercase tracking-wider text-app-text-secondary">Pago em</TableHead>
                    <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-app-text-secondary">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-normal text-app-text-primary dark:text-white">{item.profissional}</TableCell>
                      <TableCell>
                        <Badge
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            item.tipoVinculo === 'parceiro'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900/40'
                              : 'bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800/40 dark:text-gray-300 dark:border-gray-700/40'
                          }`}
                        >
                          {item.tipoVinculo === 'parceiro' ? 'Parceiro' : 'Interno'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-app-text-secondary dark:text-white/70">{item.unidade || 'Global'}</TableCell>
                      <TableCell className="text-app-text-secondary dark:text-white/70">{item.periodo}</TableCell>
                      <TableCell className="text-right font-normal text-app-text-primary dark:text-white">{formatCurrency(item.valor)}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            item.status.toLowerCase().includes('pago')
                              ? 'app-status-success text-white'
                              : item.status.toLowerCase().includes('cancel')
                                ? 'bg-rose-500 text-white'
                                : 'app-status-warning text-white'
                          }`}
                        >
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-app-text-secondary dark:text-white/70">{item.pagoEm || '--'}</TableCell>
                      <TableCell className="text-right">
                        {renderAcoes(item)}
                      </TableCell>
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
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-app-border bg-app-card shadow-sm dark:border-app-border-dark dark:bg-app-card-dark">
          <div className="flex items-center justify-between gap-4 p-8 pb-4">
            <div className="flex items-center gap-3">
              <Settings2 className="h-6 w-6 text-app-text-primary dark:text-white" />
              <div>
                <h2 className="text-xl font-normal tracking-tight text-app-text-primary dark:text-white">Configuração de repasse</h2>
                <p className="mt-1 text-sm text-app-text-muted">Gerencie as regras por profissional, unidade e tipo de cálculo.</p>
              </div>
            </div>
            <Button className="h-11 rounded-xl px-5" onClick={openCreateRule}>
              <Plus className="mr-2 h-4 w-4" />
              Nova regra
            </Button>
          </div>

          {rules.length === 0 ? (
            <div className="px-8 pb-8">
              <div className="rounded-[12px] border border-dashed border-app-border bg-app-bg-secondary/40 p-8 text-center dark:border-app-border-dark dark:bg-app-bg-dark">
                <p className="text-base text-app-text-primary dark:text-white">Nenhuma regra cadastrada.</p>
                <p className="mt-2 text-sm text-app-text-muted">Cadastre as regras de percentual ou valor fixo para começar a apuração.</p>
              </div>
            </div>
          ) : (
            <DataTable data={rules}>
              {(pageData) => (
                <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-hover">
                  <TableRow>
                    <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary">Profissional</TableHead>
                    <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary">Unidade</TableHead>
                    <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary">Regra</TableHead>
                    <TableHead className="text-center text-xs font-medium uppercase tracking-wider text-app-text-secondary">Status</TableHead>
                    <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-app-text-secondary">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-normal text-app-text-primary dark:text-white">{item.profissional}</TableCell>
                      <TableCell className="text-app-text-secondary dark:text-white/70">{item.unidade || 'Global'}</TableCell>
                      <TableCell className="text-app-text-secondary dark:text-white/70">
                        {item.valorFixo != null ? formatCurrency(item.valorFixo) : `${item.percentual ?? 0}%`}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={`rounded-full px-3 py-1 text-xs font-medium ${item.ativo ? 'app-status-success text-white' : 'bg-slate-400 text-white'}`}>
                          {item.ativo ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
                              <MoreVertical className="h-4 w-4 text-app-text-secondary" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => openEditRule(item)}>Editar regra</DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteModal({ open: true, item })}
                              className="text-[var(--app-danger-text)] focus:text-[var(--app-danger-text)]"
                            >
                              Excluir regra
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
              )}
            </DataTable>
          )}
        </div>
      )}

      <Dialog open={generationModalOpen} onOpenChange={setGenerationModalOpen}>
        <DialogContent className="gap-0 overflow-hidden rounded-[24px] border border-app-border p-0 dark:border-app-border-dark">
          <div className="bg-app-card p-8 dark:bg-app-card-dark">
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-xl font-normal text-app-text-primary dark:text-white">Gerar repasse</DialogTitle>
              <DialogDescription className="text-sm text-app-text-muted">
                Selecione o período e, se necessário, filtre por profissional ou unidade.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-6 flex items-start gap-4 rounded-[18px] border border-app-border bg-app-bg-secondary/40 p-5 dark:border-app-border-dark dark:bg-app-bg-dark/40">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--app-info-bg)] text-[var(--app-info-text)]">
                <WalletCards className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-normal text-app-text-primary dark:text-white">Apuração do período</p>
                <p className="text-sm text-app-text-muted">
                  Gere a prévia do repasse preservando os filtros atuais da tela administrativa.
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Período inicial</Label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-muted" />
                  <Input
                    type="date"
                    className="h-12 rounded-[12px] pl-10"
                    value={generationForm.periodoInicio}
                    onChange={(event) => setGenerationForm((current) => ({ ...current, periodoInicio: event.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Período final</Label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-muted" />
                  <Input
                    type="date"
                    className="h-12 rounded-[12px] pl-10"
                    value={generationForm.periodoFim}
                    onChange={(event) => setGenerationForm((current) => ({ ...current, periodoFim: event.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Profissional</Label>
                <Select
                  value={generationForm.profissionalId}
                  onValueChange={(value) => setGenerationForm((current) => ({ ...current, profissionalId: value }))}
                >
                  <SelectTrigger className="h-12 rounded-[12px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os profissionais</SelectItem>
                    {profissionais.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select
                  value={generationForm.unidadeId}
                  onValueChange={(value) => setGenerationForm((current) => ({ ...current, unidadeId: value }))}
                >
                  <SelectTrigger className="h-12 rounded-[12px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as unidades</SelectItem>
                    {unidades.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="mt-8 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setGenerationModalOpen(false)} className="h-11 rounded-[12px] px-6">
                Cancelar
              </Button>
              <Button onClick={() => void handleGenerate()} disabled={isSubmitting} className="h-11 rounded-[12px] px-6 text-white">
                Gerar repasse
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={ruleModal.open}
        onOpenChange={(open) => {
          setRuleModal((current) => ({ ...current, open }))
          if (!open) resetRuleForm(null)
        }}
      >
        <DialogContent size="lg" className="gap-0 overflow-hidden rounded-[24px] border border-app-border p-0 dark:border-app-border-dark">
          <div className="bg-app-card p-8 dark:bg-app-card-dark">
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-xl font-normal text-app-text-primary dark:text-white">
                {ruleModal.item ? 'Editar regra de repasse' : 'Nova regra de repasse'}
              </DialogTitle>
              <DialogDescription className="text-sm text-app-text-muted">
                Defina a regra de percentual ou valor fixo por profissional e unidade.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-6 flex items-start gap-4 rounded-[18px] border border-app-border bg-app-bg-secondary/40 p-5 dark:border-app-border-dark dark:bg-app-bg-dark/40">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--app-info-bg)] text-[var(--app-info-text)]">
                <Settings2 className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-normal text-app-text-primary dark:text-white">
                  {ruleForm.modo === 'percentual' ? 'Regra por percentual' : 'Regra por valor fixo'}
                </p>
                <p className="text-sm text-app-text-muted">
                  Configure o cálculo e mantenha o vínculo administrativo do profissional sem alterar o fluxo atual.
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Profissional</Label>
              <Select
                value={ruleForm.profissionalId}
                onValueChange={(value) => setRuleForm((current) => ({ ...current, profissionalId: value }))}
              >
                <SelectTrigger className="h-12 rounded-[12px]">
                  <SelectValue placeholder="Selecione o profissional" />
                </SelectTrigger>
                <SelectContent>
                  {profissionais.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select
                value={ruleForm.unidadeId}
                onValueChange={(value) => setRuleForm((current) => ({ ...current, unidadeId: value }))}
              >
                <SelectTrigger className="h-12 rounded-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Global</SelectItem>
                  {unidades.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status da regra</Label>
              <Select
                value={ruleForm.ativo}
                onValueChange={(value) => setRuleForm((current) => ({ ...current, ativo: value as 'ativo' | 'inativo' }))}
              >
                <SelectTrigger className="h-12 rounded-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativa</SelectItem>
                  <SelectItem value="inativo">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de cálculo</Label>
              <Select
                value={ruleForm.modo}
                onValueChange={(value) => setRuleForm((current) => ({ ...current, modo: value as 'percentual' | 'fixo' }))}
              >
                <SelectTrigger className="h-12 rounded-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentual">Percentual</SelectItem>
                  <SelectItem value="fixo">Valor fixo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{ruleForm.modo === 'percentual' ? 'Percentual' : 'Valor fixo'}</Label>
              <Input
                type="number"
                step="0.01"
                className="h-12 rounded-[12px]"
                value={ruleForm.valor}
                onChange={(event) => setRuleForm((current) => ({ ...current, valor: event.target.value }))}
                placeholder={ruleForm.modo === 'percentual' ? 'Ex.: 40' : 'Ex.: 500.00'}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Observações</Label>
              <textarea
                value={ruleForm.observacoes}
                onChange={(event) => setRuleForm((current) => ({ ...current, observacoes: event.target.value }))}
                className="min-h-24 w-full rounded-xl border border-app-border bg-app-card px-3 py-2 text-sm text-app-text-primary outline-none transition focus:border-[var(--app-primary)] dark:border-app-border-dark dark:bg-app-card-dark dark:text-white"
                placeholder="Observações opcionais da regra..."
              />
            </div>
            </div>
            <DialogFooter className="mt-8 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setRuleModal({ open: false, item: null })} className="h-11 rounded-[12px] px-6">
                Cancelar
              </Button>
              <Button onClick={() => void handleSaveRule()} disabled={isSubmitting} className="h-11 rounded-[12px] px-6 text-white">
                {ruleModal.item ? 'Salvar alterações' : 'Criar regra'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteModal.open}
        onOpenChange={(open) => setDeleteModal((current) => ({ ...current, open }))}
      >
        <DialogContent size="sm" className="gap-0 overflow-hidden rounded-[24px] border border-app-border p-0 dark:border-app-border-dark">
          <div className="bg-app-card p-8 dark:bg-app-card-dark">
            <DialogHeader className="items-center space-y-2 text-center">
              <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full app-status-danger">
                <AlertTriangle className="h-7 w-7 text-[var(--app-danger-text)]" />
              </div>
              <DialogTitle className="text-xl font-bold text-app-text-primary dark:text-white">Excluir regra</DialogTitle>
              <DialogDescription className="max-w-xs text-app-text-muted">
                {deleteModal.item
                  ? `Deseja remover a regra de repasse de ${deleteModal.item.profissional}?`
                  : 'Deseja remover esta regra de repasse?'}
              </DialogDescription>
            </DialogHeader>
            {deleteModal.item && (
              <div className="mt-6 rounded-xl border border-transparent app-status-danger p-4 text-center">
                <p className="text-sm font-bold text-[var(--app-danger-text)]">
                  Profissional: <span className="font-extrabold">{deleteModal.item.profissional}</span>
                </p>
              </div>
            )}
            <DialogFooter className="mt-8 flex items-center justify-center gap-3">
              <Button variant="outline" onClick={() => setDeleteModal({ open: false, item: null })} className="h-11 rounded-[12px] px-6">
                Cancelar
              </Button>
              <Button variant="destructive" onClick={() => void handleDeleteRule()} disabled={isSubmitting} className="h-11 rounded-[12px] px-6">
                Excluir
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <EfetuarPagamentoRepasseModal
        isOpen={isEfetuarPagamentoOpen}
        onClose={setIsEfetuarPagamentoOpen}
        repasse={selectedRepasse}
        onSuccess={() => {
          setSelectedRepasse(null)
        }}
      />
    </div>
  )
}
