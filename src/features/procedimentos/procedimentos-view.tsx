'use client'

import { ProcedimentoSuprimentosField, type SuprimentoDoProcedimento } from '@/features/suprimentos/components/procedimento-suprimentos-field'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Activity, Edit2, Eye, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react'
import { useProcedimentos, type ProcedimentoItem } from './hooks/use-procedimentos'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { StatCard } from '@/components/shared/stat-card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/shared/page-header'

type ModalType = 'create' | 'edit' | 'view' | 'delete' | null

type FormState = {
  nome: string
  codigo: string
  descricao: string
  valor: string
  duracaoMin: string
  temRetorno: boolean
  prazoRetornoDias: string
  valorRetorno: string
  temPacote: boolean
  intervaloRecorrenciaDias: string
  quantidadeSugeridaPacote: string
  ativo: boolean
  baixaSuprimentos: boolean
  suprimentos: SuprimentoDoProcedimento[]
}

const initialFormState: FormState = {
  nome: '',
  codigo: '',
  descricao: '',
  valor: '',
  duracaoMin: '',
  temRetorno: false,
  prazoRetornoDias: '35',
  valorRetorno: '',
  temPacote: false,
  intervaloRecorrenciaDias: '',
  quantidadeSugeridaPacote: '',
  ativo: true,
  baixaSuprimentos: false,
  suprimentos: [],
}

const toNumber = (value: string): number | undefined =>
  value.trim() === '' ? undefined : Number(value)

export function ProcedimentosView() {
  const { data, isLoading, error, createProcedimento, updateProcedimento, deleteProcedimento } = useProcedimentos()
  const [searchFilter, setSearchFilter] = useState('')
  const [modalType, setModalType] = useState<ModalType>(null)
  const [selectedProcedimento, setSelectedProcedimento] = useState<ProcedimentoItem | null>(null)
  const [formData, setFormData] = useState<FormState>(initialFormState)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const filteredProcedimentos = useMemo(() => {
    const term = searchFilter.trim().toLowerCase()
    return data.filter((item) => {
      if (!term) return true
      return (
        item.nome.toLowerCase().includes(term) ||
        (item.codigo ?? '').toLowerCase().includes(term) ||
        (item.descricao ?? '').toLowerCase().includes(term)
      )
    })
  }, [data, searchFilter])

  const stats = useMemo(() => {
    const total = data.length
    const ativos = data.filter((item) => item.ativo).length
    return { total, ativos, inativos: total - ativos }
  }, [data])

  const handleOpenModal = (type: ModalType, item?: ProcedimentoItem) => {
    setModalType(type)
    if (item) {
      setSelectedProcedimento(item)
      setFormData({
        nome: item.nome,
        codigo: item.codigo ?? '',
        descricao: item.descricao ?? '',
        valor: item.valor != null ? String(item.valor) : '',
        duracaoMin: item.duracaoMin != null ? String(item.duracaoMin) : '',
        temRetorno: item.temRetorno,
        prazoRetornoDias: item.prazoRetornoDias != null ? String(item.prazoRetornoDias) : '35',
        valorRetorno: item.valorRetorno != null ? String(item.valorRetorno) : '',
        temPacote: Boolean(item.temPacote),
        intervaloRecorrenciaDias:
          item.intervaloRecorrenciaDias != null ? String(item.intervaloRecorrenciaDias) : '',
        quantidadeSugeridaPacote:
          item.quantidadeSugeridaPacote != null ? String(item.quantidadeSugeridaPacote) : '',
        ativo: item.ativo,
        baixaSuprimentos: item.baixaSuprimentos === true,
        suprimentos: (item.suprimentos ?? []).map((s) => ({ suprimentoId: s.suprimentoId, quantidade: s.quantidade })),
      })
      return
    }

    setSelectedProcedimento(null)
    setFormData(initialFormState)
  }

  const handleCloseModal = () => {
    setModalType(null)
    setSelectedProcedimento(null)
    setFormData(initialFormState)
  }

  const handleSave = async () => {
    if (!formData.nome.trim()) {
      toast.error('Informe o nome do procedimento.')
      return
    }
    if (formData.temPacote && !toNumber(formData.intervaloRecorrenciaDias)) {
      toast.error('Informe o intervalo em dias do pacote (ex.: 15).')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        nome: formData.nome.trim(),
        codigo: formData.codigo.trim() || undefined,
        descricao: formData.descricao.trim() || undefined,
        valor: toNumber(formData.valor),
        duracaoMin: toNumber(formData.duracaoMin),
        temRetorno: formData.temRetorno,
        prazoRetornoDias: formData.temRetorno ? toNumber(formData.prazoRetornoDias) ?? 35 : undefined,
        valorRetorno: formData.temRetorno ? toNumber(formData.valorRetorno) : undefined,
        temPacote: formData.temPacote,
        intervaloRecorrenciaDias: formData.temPacote
          ? toNumber(formData.intervaloRecorrenciaDias)
          : undefined,
        quantidadeSugeridaPacote: formData.temPacote
          ? toNumber(formData.quantidadeSugeridaPacote)
          : undefined,
        ativo: formData.ativo,
        baixaSuprimentos: formData.baixaSuprimentos,
        suprimentos: formData.baixaSuprimentos ? formData.suprimentos : [],
      }

      if (modalType === 'edit' && selectedProcedimento) {
        await updateProcedimento({ id: selectedProcedimento.id, ...payload })
        toast.success('Procedimento atualizado com sucesso.')
      } else {
        await createProcedimento(payload)
        toast.success('Procedimento criado com sucesso.')
      }

      handleCloseModal()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar o procedimento.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedProcedimento) return

    setIsSubmitting(true)
    try {
      await deleteProcedimento(selectedProcedimento.id)
      toast.success('Procedimento excluído com sucesso.')
      handleCloseModal()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível excluir o procedimento.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="app-page app-page-loose app-page-frame pb-10">
      <PageHeader
        title="Procedimentos"
        description="Cadastre os procedimentos usados em agendamentos, filas e demais fluxos da clínica."
        actions={
          <Button
            onClick={() => handleOpenModal('create')}
            className="h-11 shrink-0 rounded-xl bg-app-primary px-6 font-normal text-white shadow-sm"
          >
            <Plus className="h-5 w-5" />
            <span>Novo procedimento</span>
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total cadastrados" value={stats.total} />
        <StatCard label="Ativos" value={stats.ativos} iconTone="success" />
        <StatCard label="Inativos" value={stats.inativos} />
      </div>

      <div className="relative w-full md:max-w-md">
        <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-app-text-muted" />
        <Input
          placeholder="Buscar por nome, código ou descrição..."
          value={searchFilter}
          onChange={(event) => setSearchFilter(event.target.value)}
          className="h-11 rounded-xl border-app-border bg-app-card pl-11 text-sm font-normal shadow-sm transition-all focus:border-[var(--app-primary)] focus:ring-[var(--app-primary)]/20 dark:bg-app-card-dark dark:text-white dark:placeholder:text-app-text-muted"
        />
      </div>

      <Card className="overflow-hidden rounded-2xl border-app-border/60 shadow-sm dark:border-app-border-dark">
        <CardContent className="p-0">
          <div className="overflow-x-auto custom-scrollbar">
            <Table>
              <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-card/5">
                <TableRow className="border-app-border hover:bg-transparent dark:border-app-border-dark">
                  <TableHead className="px-6 py-4 text-xs font-normal uppercase tracking-wider text-[#6a7282] dark:text-app-text-muted">Procedimento</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-normal uppercase tracking-wider text-[#6a7282] dark:text-app-text-muted">Código</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-normal uppercase tracking-wider text-[#6a7282] dark:text-app-text-muted">Descrição</TableHead>
                  <TableHead className="px-6 py-4 text-xs font-normal uppercase tracking-wider text-[#6a7282] dark:text-app-text-muted">Status</TableHead>
                  <TableHead className="px-6 py-4 text-center text-xs font-normal uppercase tracking-wider text-[#6a7282] dark:text-app-text-muted">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-20 text-center">
                      <p className="text-base font-normal text-[#6a7282] dark:text-app-text-muted">Carregando procedimentos...</p>
                    </TableCell>
                  </TableRow>
                ) : filteredProcedimentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-20 text-center">
                      <EmptyState
                        icon={Activity}
                        title="Nenhum procedimento cadastrado."
                        description="Adicione o primeiro procedimento para disponibilizá-lo no sistema."
                        className="border-0 bg-transparent dark:bg-transparent"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProcedimentos.map((item) => (
                    <TableRow key={item.id} className="group border-app-border transition-colors hover:bg-app-bg-secondary dark:border-app-border-dark dark:hover:bg-app-hover">
                      <TableCell className="px-6 py-4">
                        <span className="font-normal text-app-text-primary dark:text-white">{item.nome}</span>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-[#6a7282] dark:text-app-text-muted">
                        {item.codigo ?? '--'}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-[#6a7282] dark:text-app-text-muted">
                        <span className="line-clamp-2">{item.descricao ?? '--'}</span>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <Badge className={item.ativo ? 'app-status-success border-none shadow-sm font-normal' : 'app-status-neutral border-none shadow-sm font-normal'}>
                          {item.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center justify-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-lg border border-transparent text-[#6a7282] hover:border-app-border hover:bg-app-bg-secondary hover:shadow-sm dark:text-app-text-muted dark:hover:border-app-border-dark dark:hover:bg-app-hover"
                              >
                                <MoreHorizontal className="h-5 w-5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl border-app-border shadow-lg dark:border-app-border-dark">
                              <DropdownMenuItem onClick={() => handleOpenModal('view', item)} className="rounded-lg py-2.5">
                                <Eye className="mr-3 h-4 w-4 text-app-text-muted" />
                                Visualizar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenModal('edit', item)} className="rounded-lg py-2.5">
                                <Edit2 className="mr-3 h-4 w-4 text-app-text-muted" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenModal('delete', item)} className="rounded-lg py-2.5 text-[var(--app-danger-text)]">
                                <Trash2 className="mr-3 h-4 w-4 text-red-400" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-[var(--app-danger-text)]">{error}</p> : null}

      <Dialog open={modalType === 'create' || modalType === 'edit' || modalType === 'view'} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="rounded-[24px] border border-app-border bg-app-card p-0 shadow-lg dark:border-app-border-dark dark:bg-app-card-dark">
          <div className="p-8 space-y-6">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-2xl font-normal text-app-text-primary dark:text-white">
                {modalType === 'create' ? 'Novo procedimento' : modalType === 'edit' ? 'Editar procedimento' : 'Detalhes do procedimento'}
              </DialogTitle>
              <DialogDescription className="font-normal text-app-text-secondary dark:text-white/60">
                {modalType === 'view'
                  ? 'Visualize os dados completos do procedimento.'
                  : 'Cadastre os dados que ficarão disponíveis para agenda e lista de espera.'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-5">
              <div className="space-y-2">
                <Label className="font-normal text-app-text-primary dark:text-white/80">Nome</Label>
                <Input
                  value={formData.nome}
                  onChange={(event) => setFormData((current) => ({ ...current, nome: event.target.value }))}
                  disabled={modalType === 'view'}
                  className="h-12 rounded-2xl border-app-border bg-app-bg-secondary font-normal dark:border-app-border-dark dark:bg-app-hover"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-normal text-app-text-primary dark:text-white/80">Código</Label>
                <Input
                  value={formData.codigo}
                  onChange={(event) => setFormData((current) => ({ ...current, codigo: event.target.value }))}
                  disabled={modalType === 'view'}
                  placeholder="Gerado automaticamente se deixado em branco"
                  className="h-12 rounded-2xl border-app-border bg-app-bg-secondary font-normal dark:border-app-border-dark dark:bg-app-hover"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-normal text-app-text-primary dark:text-white/80">Descrição</Label>
                <Textarea
                  value={formData.descricao}
                  onChange={(event) => setFormData((current) => ({ ...current, descricao: event.target.value }))}
                  disabled={modalType === 'view'}
                  className="min-h-[120px] rounded-2xl border-app-border bg-app-bg-secondary font-normal dark:border-app-border-dark dark:bg-app-hover"
                />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="font-normal text-app-text-primary dark:text-white/80">Valor (R$)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={formData.valor}
                    onChange={(event) => setFormData((current) => ({ ...current, valor: event.target.value }))}
                    disabled={modalType === 'view'}
                    placeholder="0,00"
                    className="h-12 rounded-2xl border-app-border bg-app-bg-secondary font-normal dark:border-app-border-dark dark:bg-app-hover"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-normal text-app-text-primary dark:text-white/80">Duração (min)</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    step="5"
                    min="0"
                    value={formData.duracaoMin}
                    onChange={(event) => setFormData((current) => ({ ...current, duracaoMin: event.target.value }))}
                    disabled={modalType === 'view'}
                    placeholder="Ex: 30"
                    className="h-12 rounded-2xl border-app-border bg-app-bg-secondary font-normal dark:border-app-border-dark dark:bg-app-hover"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-app-border px-4 py-3 dark:border-app-border-dark">
                <div>
                  <p className="font-normal text-app-text-primary dark:text-white">Tem retorno?</p>
                  <p className="text-sm text-app-text-secondary dark:text-white/60 font-normal">
                    Ative para definir prazo e valor do retorno vinculado a este procedimento.
                  </p>
                </div>
                <Switch
                  checked={formData.temRetorno}
                  onCheckedChange={(value) =>
                    setFormData((current) => ({
                      ...current,
                      temRetorno: value,
                      prazoRetornoDias: value
                        ? current.prazoRetornoDias || '35'
                        : current.prazoRetornoDias,
                    }))
                  }
                  disabled={modalType === 'view'}
                />
              </div>

              {formData.temRetorno ? (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="font-normal text-app-text-primary dark:text-white/80">Prazo do retorno (dias)</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      step="1"
                      min="0"
                      value={formData.prazoRetornoDias}
                      onChange={(event) => setFormData((current) => ({ ...current, prazoRetornoDias: event.target.value }))}
                      disabled={modalType === 'view'}
                      placeholder="35"
                      className="h-12 rounded-2xl border-app-border bg-app-bg-secondary font-normal dark:border-app-border-dark dark:bg-app-hover"
                    />
                    <p className="text-xs text-app-text-muted">Padrão da clínica: 35 dias corridos.</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-normal text-app-text-primary dark:text-white/80">Valor do retorno (R$)</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={formData.valorRetorno}
                      onChange={(event) => setFormData((current) => ({ ...current, valorRetorno: event.target.value }))}
                      disabled={modalType === 'view'}
                      placeholder="0,00"
                      className="h-12 rounded-2xl border-app-border bg-app-bg-secondary font-normal dark:border-app-border-dark dark:bg-app-hover"
                    />
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between rounded-2xl border border-app-border px-4 py-3 dark:border-app-border-dark">
                <div>
                  <p className="font-normal text-app-text-primary dark:text-white">Pacote / recorrência?</p>
                  <p className="text-sm text-app-text-secondary dark:text-white/60 font-normal">
                    Ex.: psicanálise a cada 15 dias — gera série na agenda.
                  </p>
                </div>
                <Switch
                  checked={formData.temPacote}
                  onCheckedChange={(value) => setFormData((current) => ({ ...current, temPacote: value }))}
                  disabled={modalType === 'view'}
                />
              </div>

              {formData.temPacote ? (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="font-normal text-app-text-primary dark:text-white/80">
                      Intervalo entre sessões (dias)
                    </Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      step="1"
                      min="1"
                      value={formData.intervaloRecorrenciaDias}
                      onChange={(event) =>
                        setFormData((current) => ({
                          ...current,
                          intervaloRecorrenciaDias: event.target.value,
                        }))
                      }
                      disabled={modalType === 'view'}
                      placeholder="Ex: 15"
                      className="h-12 rounded-2xl border-app-border bg-app-bg-secondary font-normal dark:border-app-border-dark dark:bg-app-hover"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-normal text-app-text-primary dark:text-white/80">
                      Qtd. sugerida no pacote
                    </Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      step="1"
                      min="1"
                      value={formData.quantidadeSugeridaPacote}
                      onChange={(event) =>
                        setFormData((current) => ({
                          ...current,
                          quantidadeSugeridaPacote: event.target.value,
                        }))
                      }
                      disabled={modalType === 'view'}
                      placeholder="Ex: 10"
                      className="h-12 rounded-2xl border-app-border bg-app-bg-secondary font-normal dark:border-app-border-dark dark:bg-app-hover"
                    />
                  </div>
                </div>
              ) : null}

              <ProcedimentoSuprimentosField
                baixa={formData.baixaSuprimentos}
                itens={formData.suprimentos}
                disabled={modalType === 'view'}
                onChange={({ baixa, itens }) => setFormData((current) => ({ ...current, baixaSuprimentos: baixa, suprimentos: itens }))}
              />

              <div className="flex items-center justify-between rounded-2xl border border-app-border px-4 py-3 dark:border-app-border-dark">
                <div>
                  <p className="font-normal text-app-text-primary dark:text-white">Ativo</p>
                  <p className="text-sm text-app-text-secondary dark:text-white/60 font-normal">
                    Procedimentos inativos deixam de aparecer nos fluxos operacionais.
                  </p>
                </div>
                <Switch
                  checked={formData.ativo}
                  onCheckedChange={(value) => setFormData((current) => ({ ...current, ativo: value }))}
                  disabled={modalType === 'view'}
                />
              </div>
            </div>

            {modalType !== 'view' ? (
              <div className="flex justify-end gap-3">
                <Button variant="outline" className="rounded-xl border-app-border font-normal dark:border-app-border-dark" onClick={handleCloseModal}>
                  Cancelar
                </Button>
                <Button className="rounded-xl bg-app-primary font-normal text-white shadow-sm hover:bg-app-primary-hover" onClick={() => void handleSave()} disabled={isSubmitting}>
                  {isSubmitting ? 'Salvando...' : 'Salvar procedimento'}
                </Button>
              </div>
            ) : (
              <div className="flex justify-end">
                <Button variant="outline" className="rounded-xl border-app-border font-normal dark:border-app-border-dark" onClick={handleCloseModal}>
                  Fechar
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={modalType === 'delete'} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent size="sm" className="rounded-[24px] border border-app-border bg-app-card p-8 shadow-lg dark:border-app-border-dark dark:bg-app-card-dark">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-2xl font-normal text-app-text-primary dark:text-white">Excluir procedimento</DialogTitle>
            <DialogDescription className="font-normal text-app-text-secondary dark:text-white/60">
              Esta ação remove o procedimento <strong>{selectedProcedimento?.nome ?? ''}</strong> do cadastro.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" className="rounded-xl border-app-border font-normal dark:border-app-border-dark" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button className="rounded-xl bg-[var(--app-danger-text)] font-normal text-white hover:opacity-90" onClick={() => void handleDelete()} disabled={isSubmitting}>
              {isSubmitting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
