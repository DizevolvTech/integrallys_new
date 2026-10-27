'use client'

import { Edit2, FileText, MoreHorizontal, Plus, Search, Stethoscope, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AcessoNegadoState } from '@/components/shared/acesso-negado-state'
import { EmptyState } from '@/components/shared/empty-state'
import { CartaoMobile, ListaCartoesMobile } from '@/components/shared/mobile-card'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useApi } from '@/hooks/use-api'
import { useUnidades } from '@/hooks/use-unidades'
import type { DocumentoTemplate } from '@/lib/documentos'
import type { ProfissionalInput, ProfissionalItem } from '@/types/profissional'
import { useProfissionais } from './hooks/use-profissionais'
import { GerarContratoModal } from './modals/gerar-contrato-modal'
import { ProfissionalModal } from './modals/profissional-modal'

type ModalType = 'create' | 'edit' | 'delete' | 'contrato' | null

const VINCULO_LABEL: Record<'interno' | 'parceiro', string> = {
  interno: 'Interno',
  parceiro: 'Parceiro',
}

export function ProfissionaisView() {
  const api = useApi()
  const {
    data,
    isLoading,
    error,
    accessDenied,
    createProfissional,
    updateProfissional,
    deleteProfissional,
  } = useProfissionais()
  const { data: unidades } = useUnidades()
  const [searchFilter, setSearchFilter] = useState('')
  const [modalType, setModalType] = useState<ModalType>(null)
  const [selected, setSelected] = useState<ProfissionalItem | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [contratoTemplates, setContratoTemplates] = useState<DocumentoTemplate[]>([])
  const [contratoAutoGenerate, setContratoAutoGenerate] = useState(false)

  // Prefetch de modelos tipo contrato — habilita/desabilita a ação "Gerar contrato".
  useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        const res = await api.get<{ data: DocumentoTemplate[] }>('/api/documentos/templates')
        if (!mounted) return
        setContratoTemplates((res.data ?? []).filter((t) => t.tipo === 'contrato' && t.ativo))
      } catch {
        // Sem permissão de documentacao ou falha de rede: ação fica desabilitada.
        if (mounted) setContratoTemplates([])
      }
    })()
    return () => {
      mounted = false
    }
  }, [api])

  const filtered = useMemo(() => {
    const term = searchFilter.trim().toLowerCase()
    return data.filter((item) => {
      if (!term) return true
      return (
        item.nome.toLowerCase().includes(term) ||
        item.email.toLowerCase().includes(term) ||
        (item.conselho ?? '').toLowerCase().includes(term)
      )
    })
  }, [data, searchFilter])

  const stats = useMemo(() => {
    const total = data.length
    const ativos = data.filter((item) => item.status === 'Ativo').length
    const comGrade = data.filter((item) => item.horarios.length > 0).length
    return { total, ativos, comGrade }
  }, [data])

  const handleOpenCreate = () => {
    setSelected(null)
    setModalType('create')
  }

  const handleOpenEdit = (item: ProfissionalItem) => {
    setSelected(item)
    setModalType('edit')
  }

  const handleOpenDelete = (item: ProfissionalItem) => {
    setSelected(item)
    setModalType('delete')
  }

  const handleOpenGerarContrato = (item: ProfissionalItem) => {
    if (item.tipoVinculo !== 'parceiro') return
    setSelected(item)
    setContratoAutoGenerate(contratoTemplates.length === 1)
    setModalType('contrato')
  }

  const handleCloseModal = () => {
    setModalType(null)
    setSelected(null)
    setContratoAutoGenerate(false)
  }

  const handleSave = async (payload: ProfissionalInput) => {
    if (modalType === 'edit' && selected) {
      await updateProfissional({ ...payload, id: selected.id })
    } else {
      await createProfissional(payload)
    }
  }

  const handleDelete = async () => {
    if (!selected) return
    setIsSubmitting(true)
    try {
      await deleteProfissional(selected.id)
      toast.success('Profissional excluído com sucesso.')
      handleCloseModal()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível excluir o profissional.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const diasAtendidos = (item: ProfissionalItem) =>
    new Set(item.horarios.map((h) => h.diaSemana)).size

  const unidadeNomeById = useMemo(
    () => new Map(unidades.map((unidade) => [unidade.id, unidade.nome])),
    [unidades],
  )

  // Principal (usuarios.unidade_id) + filiais adicionais (profissional_unidades).
  const filiaisNomes = (item: ProfissionalItem): string[] =>
    [
      ...(item.unidadeId ? [unidadeNomeById.get(item.unidadeId)] : []),
      ...item.unidadesAtuacaoIds.map((id) => unidadeNomeById.get(id)),
    ].filter((nome): nome is string => Boolean(nome))

  const renderAcoes = (item: ProfissionalItem) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Ações"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg border border-transparent text-[#6a7282] hover:border-app-border hover:bg-app-bg-secondary hover:shadow-sm dark:text-app-text-muted dark:hover:border-app-border-dark dark:hover:bg-app-hover"
          >
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56 rounded-xl border-app-border shadow-lg dark:border-app-border-dark"
        >
          <DropdownMenuItem
            onClick={() => handleOpenEdit(item)}
            className="rounded-lg py-2.5"
          >
            <Edit2 className="mr-3 h-4 w-4 text-app-text-muted" />
            Editar
          </DropdownMenuItem>
          {item.tipoVinculo === 'parceiro' &&
            (contratoTemplates.length === 0 ? (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <DropdownMenuItem
                        disabled
                        className="rounded-lg py-2.5"
                        onSelect={(e) => e.preventDefault()}
                      >
                        <FileText className="mr-3 h-4 w-4 text-app-text-muted" />
                        Gerar contrato
                      </DropdownMenuItem>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs text-xs">
                    Nenhum modelo de contrato cadastrado — crie um em
                    Configurações → Templates de Documentos
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <DropdownMenuItem
                onClick={() => handleOpenGerarContrato(item)}
                className="rounded-lg py-2.5"
              >
                <FileText className="mr-3 h-4 w-4 text-app-text-muted" />
                Gerar contrato
              </DropdownMenuItem>
            ))}
          <DropdownMenuItem
            onClick={() => handleOpenDelete(item)}
            className="rounded-lg py-2.5 text-[var(--app-danger-text)]"
          >
            <Trash2 className="mr-3 h-4 w-4 text-red-400" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
  )

  // 403: perfil sem permissão (ex.: recepção). Mostra SÓ o estado de acesso
  // negado — sem "Novo profissional" e sem o estado de "nenhum cadastrado".
  if (accessDenied) {
    return (
      <div className="app-page app-page-loose app-page-frame pb-10">
        <PageHeader
          title="Profissionais"
          description="Cadastre especialistas com a grade semanal de atendimento e os procedimentos que realizam."
        />
        <AcessoNegadoState />
      </div>
    )
  }

  return (
    <div className="app-page app-page-loose app-page-frame pb-10">
      <PageHeader
        title="Profissionais"
        description="Cadastre especialistas com a grade semanal de atendimento e os procedimentos que realizam."
        actions={
          <Button
            onClick={handleOpenCreate}
            className="h-11 shrink-0 rounded-xl bg-app-primary px-6 font-normal text-white shadow-sm"
          >
            <Plus className="h-5 w-5" />
            <span>Novo profissional</span>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Total cadastrados" value={stats.total} />
        <StatCard label="Ativos" value={stats.ativos} iconTone="success" />
        <StatCard label="Com grade definida" value={stats.comGrade} />
      </div>

      <div className="relative w-full md:max-w-md">
        <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-app-text-muted" />
        <Input
          placeholder="Buscar por nome, e-mail ou conselho..."
          value={searchFilter}
          onChange={(event) => setSearchFilter(event.target.value)}
          className="h-11 rounded-xl border-app-border bg-app-card pl-11 text-sm font-normal shadow-sm transition-all focus:border-[var(--app-primary)] focus:ring-[var(--app-primary)]/20 dark:bg-app-card-dark dark:text-white dark:placeholder:text-app-text-muted"
        />
      </div>

      <Card className="overflow-hidden rounded-2xl border-app-border/60 shadow-sm dark:border-app-border-dark">
        <CardContent className="p-0">
          <div className={`overflow-x-auto custom-scrollbar ${!isLoading && filtered.length > 0 ? 'hidden md:block' : ''}`}>
            <Table>
              <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-card/5">
                <TableRow className="border-app-border hover:bg-transparent dark:border-app-border-dark">
                  <TableHead className="px-6 py-4 text-xs font-normal uppercase tracking-wider text-[#6a7282] dark:text-app-text-muted">
                    Profissional
                  </TableHead>
                  <TableHead className="px-6 py-4 text-xs font-normal uppercase tracking-wider text-[#6a7282] dark:text-app-text-muted">
                    Conselho
                  </TableHead>
                  <TableHead className="px-6 py-4 text-xs font-normal uppercase tracking-wider text-[#6a7282] dark:text-app-text-muted">
                    Vínculo
                  </TableHead>
                  <TableHead className="px-6 py-4 text-xs font-normal uppercase tracking-wider text-[#6a7282] dark:text-app-text-muted">
                    Filiais
                  </TableHead>
                  <TableHead className="px-6 py-4 text-xs font-normal uppercase tracking-wider text-[#6a7282] dark:text-app-text-muted">
                    Atendimento
                  </TableHead>
                  <TableHead className="px-6 py-4 text-xs font-normal uppercase tracking-wider text-[#6a7282] dark:text-app-text-muted">
                    Status
                  </TableHead>
                  <TableHead className="px-6 py-4 text-center text-xs font-normal uppercase tracking-wider text-[#6a7282] dark:text-app-text-muted">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-20 text-center">
                      <p className="text-base font-normal text-[#6a7282] dark:text-app-text-muted">
                        Carregando profissionais...
                      </p>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-20 text-center">
                      <EmptyState
                        icon={Stethoscope}
                        title="Nenhum profissional cadastrado."
                        description="Cadastre o primeiro especialista para configurar a agenda de atendimento."
                        className="border-0 bg-transparent dark:bg-transparent"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item) => (
                    <TableRow
                      key={item.id}
                      className="group border-app-border transition-colors hover:bg-app-bg-secondary dark:border-app-border-dark dark:hover:bg-app-hover"
                    >
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-normal text-app-text-primary dark:text-white">
                            {item.nome}
                          </span>
                          <span className="text-xs text-[#6a7282] dark:text-app-text-muted">
                            {item.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-[#6a7282] dark:text-app-text-muted">
                        {item.conselho ? `${item.conselho}${item.crm ? ` ${item.crm}` : ''}` : '--'}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-[#6a7282] dark:text-app-text-muted">
                        {VINCULO_LABEL[item.tipoVinculo]}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-[#6a7282] dark:text-app-text-muted">
                        {(() => {
                          const nomes = filiaisNomes(item)
                          if (nomes.length === 0) return '--'
                          return (
                            <span className="line-clamp-1" title={nomes.join(', ')}>
                              {nomes[0]}
                              {nomes.length > 1 ? ` +${nomes.length - 1}` : ''}
                            </span>
                          )
                        })()}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-[#6a7282] dark:text-app-text-muted">
                        {diasAtendidos(item) > 0
                          ? `${diasAtendidos(item)} dia(s) · ${item.procedimentoIds.length} proc.`
                          : 'Sem grade'}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <Badge
                          className={
                            item.status === 'Ativo'
                              ? 'app-status-success border-none shadow-sm font-normal'
                              : 'app-status-neutral border-none shadow-sm font-normal'
                          }
                        >
                          {item.status === 'Ativo' ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center justify-center">
                          {renderAcoes(item)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {!isLoading && filtered.length > 0 && (
            <ListaCartoesMobile>
              {filtered.map((item) => (
                <CartaoMobile
                  key={item.id}
                  titulo={item.nome}
                  subtitulo={item.email}
                  selo={
                    <Badge className={item.status === 'Ativo' ? 'app-status-success border-none font-normal' : 'app-status-neutral border-none font-normal'}>
                      {item.status === 'Ativo' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  }
                  acoes={renderAcoes(item)}
                  campos={[
                    { rotulo: 'Conselho', valor: item.conselho ? `${item.conselho}${item.crm ? ` ${item.crm}` : ''}` : '--' },
                    { rotulo: 'Vínculo', valor: VINCULO_LABEL[item.tipoVinculo] },
                    { rotulo: 'Filiais', valor: filiaisNomes(item).join(', ') || '--' },
                    {
                      rotulo: 'Atendimento',
                      valor: diasAtendidos(item) > 0 ? `${diasAtendidos(item)} dia(s) · ${item.procedimentoIds.length} proc.` : 'Sem grade',
                    },
                  ]}
                />
              ))}
            </ListaCartoesMobile>
          )}
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-[var(--app-danger-text)]">{error}</p> : null}

      <ProfissionalModal
        isOpen={modalType === 'create' || modalType === 'edit'}
        mode={modalType === 'edit' ? 'edit' : 'create'}
        initial={modalType === 'edit' ? selected : null}
        onClose={handleCloseModal}
        onSave={handleSave}
      />

      <GerarContratoModal
        open={modalType === 'contrato'}
        onOpenChange={(open) => {
          if (!open) handleCloseModal()
        }}
        profissional={selected}
        templates={contratoTemplates}
        autoGenerate={contratoAutoGenerate}
      />

      <Dialog open={modalType === 'delete'} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent
          size="sm"
          className="rounded-[24px] border border-app-border bg-app-card p-8 shadow-lg dark:border-app-border-dark dark:bg-app-card-dark"
        >
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-2xl font-normal text-app-text-primary dark:text-white">
              Excluir profissional
            </DialogTitle>
            <DialogDescription className="font-normal text-app-text-secondary dark:text-white/60">
              Esta ação remove o profissional <strong>{selected?.nome ?? ''}</strong>, sua grade
              semanal e os vínculos de procedimentos. Não afeta agendamentos já gerados.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              className="rounded-xl border-app-border font-normal dark:border-app-border-dark"
              onClick={handleCloseModal}
            >
              Cancelar
            </Button>
            <Button
              className="rounded-xl bg-[var(--app-danger-text)] font-normal text-white hover:opacity-90"
              onClick={() => void handleDelete()}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
