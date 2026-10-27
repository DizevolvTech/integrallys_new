'use client'

import { Edit, Eye, FileText, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/page-header'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/hooks/use-auth'
import { useUnidades } from '@/hooks/use-unidades'
import type { DocumentoTemplate } from '@/lib/documentos'
import { useCadastro } from '@/features/cadastros/hooks/use-cadastro'
import { useDocumentTemplates } from './hooks/use-document-templates'
import { EditarTemplateModal } from './modals/editar-template-modal'
import { VisualizarTemplateModal } from './modals/visualizar-template-modal'

const TIPO_LABEL: Record<DocumentoTemplate['tipo'], string> = {
  formulario: 'Formulário',
  declaracao: 'Declaração',
  laudo: 'Laudo',
  encaminhamento: 'Encaminhamento',
  procedimento: 'Procedimento',
  dieta: 'Dieta',
  contrato: 'Contrato',
}

export function ConfiguracoesDocumentosView() {
  const { data, isLoading, error, patch, create, remove } = useDocumentTemplates()
  const { data: tiposCadastro } = useCadastro('tipos-documento')
  // Admin/master recebem os modelos de todas as unidades (cada unidade tem a sua cópia):
  // quando a lista cobre mais de uma unidade, filtra por unidade para não repetir o mesmo modelo.
  const unidadeDoUsuario = useAuth((s) => s.user?.unidadeId)
  const { data: unidades } = useUnidades()
  const [unidadeFiltro, setUnidadeFiltro] = useState<string | null>(null)
  const idsNaLista = [...new Set(data.map((t) => t.unidade_id))]
  const multiUnidade = idsNaLista.length > 1
  const unidadesLista = unidades.filter((u) => idsNaLista.includes(u.id))
  const unidadeAtiva = multiUnidade
    ? (unidadeFiltro ?? (unidadeDoUsuario && idsNaLista.includes(unidadeDoUsuario) ? unidadeDoUsuario : idsNaLista[0]))
    : 'todas'
  const unidadesPorId = new Map(unidades.map((u) => [u.id, u.nome]))
  const lista = unidadeAtiva === 'todas' ? data : data.filter((t) => t.unidade_id === unidadeAtiva)
  const tiposPorId = new Map(tiposCadastro.map((tipo) => [tipo.id, tipo.nome]))
  const [editando, setEditando] = useState<DocumentoTemplate | null>(null)
  const [visualizando, setVisualizando] = useState<DocumentoTemplate | null>(null)
  const [criando, setCriando] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState<DocumentoTemplate | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleToggleAtivo = async (template: DocumentoTemplate, ativo: boolean) => {
    setTogglingId(template.id)
    try {
      await patch(template.id, { ativo })
      toast.success(ativo ? 'Template ativado.' : 'Template desativado.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao alternar status')
    } finally {
      setTogglingId(null)
    }
  }

  const handleTogglePortal = async (template: DocumentoTemplate, disponivel: boolean) => {
    setTogglingId(template.id)
    try {
      await patch(template.id, { disponivel_portal_paciente: disponivel })
      toast.success(disponivel ? 'Disponível no portal.' : 'Removido do portal.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao alternar portal')
    } finally {
      setTogglingId(null)
    }
  }

  const handleExcluir = async () => {
    if (!excluindo || isDeleting) return
    setIsDeleting(true)
    try {
      const res = await remove(excluindo.id)
      if (res.desativado) {
        toast.info('Template em uso por documentos emitidos — foi desativado em vez de excluído.')
      } else {
        toast.success('Template excluído.')
      }
      setExcluindo(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao excluir template')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="app-page app-page-loose app-page-frame pb-10">
      <PageHeader
        title="Templates de Documentos"
        description="Edite os modelos clínicos gerados no encerramento de atendimentos (anamneses, laudos, declarações, encaminhamentos, dietas e procedimentos)."
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
        actions={
          <Button
            className="h-11 px-5 rounded-xl bg-app-primary text-white hover:bg-app-primary-hover"
            onClick={() => setCriando(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo template
          </Button>
        }
      />

      <div className="rounded-[24px] border border-app-border bg-app-card p-6 dark:border-app-border-dark dark:bg-app-card-dark shadow-sm">
        {error && <p className="mb-4 text-sm text-[var(--app-danger-text)]">{error}</p>}
        {isLoading && (
          <p className="text-sm text-app-text-secondary dark:text-white/60">
            Carregando templates...
          </p>
        )}

        {!isLoading && data.length === 0 && !error && (
          <div className="text-center py-10 text-sm text-app-text-secondary dark:text-white/60">
            Nenhum template cadastrado para esta clínica.
          </div>
        )}

        {multiUnidade && (
          <div className="mb-4 max-w-xs">
            <Select value={unidadeAtiva} onValueChange={setUnidadeFiltro}>
              <SelectTrigger aria-label="Unidade" className="h-11 rounded-xl">
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                {unidadesLista.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome}
                  </SelectItem>
                ))}
                <SelectItem value="todas">Todas as unidades</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-app-bg-secondary dark:bg-app-hover/60">
              <tr className="text-left">
                {['Nome', 'Tipo', 'Seções', 'Portal', 'Ativo', 'Ações'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-sm font-normal text-app-text-secondary dark:text-white/70"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((template) => {
                const qtdSecoes = Array.isArray(template.conteudo?.secoes)
                  ? template.conteudo.secoes.length
                  : 0
                const isToggling = togglingId === template.id
                return (
                  <tr
                    key={template.id}
                    className="border-t border-app-border dark:border-app-border-dark hover:bg-app-bg-secondary/40 dark:hover:bg-app-hover/20"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-app-bg-secondary dark:bg-app-hover flex items-center justify-center">
                          <FileText className="h-4 w-4 text-app-text-secondary dark:text-white/70" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-app-text-primary dark:text-white">
                            {template.nome}
                          </div>
                          <code className="text-xs text-app-text-muted">{template.slug}</code>
                          {multiUnidade && unidadeAtiva === 'todas' && (
                            <span className="ml-2 text-xs text-app-text-muted">
                              {unidadesPorId.get(template.unidade_id) ?? ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-app-text-secondary dark:text-white/70">
                      {tiposPorId.get(template.tipo_documento_id ?? '') ?? TIPO_LABEL[template.tipo] ?? template.tipo}
                    </td>
                    <td className="px-4 py-3 text-sm text-app-text-secondary dark:text-white/70">
                      {qtdSecoes}
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={template.disponivel_portal_paciente}
                        disabled={isToggling}
                        onCheckedChange={(checked) => void handleTogglePortal(template, checked)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={template.ativo}
                        disabled={isToggling}
                        onCheckedChange={(checked) => void handleToggleAtivo(template, checked)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-lg font-normal"
                          onClick={() => setVisualizando(template)}
                          title="Pré-visualizar"
                          aria-label="Visualizar"
                        >
                          <Eye className="h-3.5 w-3.5 md:mr-2" />
                          <span className="hidden md:inline">Visualizar</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-lg font-normal"
                          onClick={() => setEditando(template)}
                          aria-label="Editar"
                        >
                          <Edit className="h-3.5 w-3.5 md:mr-2" />
                          <span className="hidden md:inline">Editar</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-[var(--app-danger-text)]"
                          onClick={() => setExcluindo(template)}
                          title="Excluir template"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <EditarTemplateModal
        open={Boolean(editando)}
        mode="edit"
        template={editando}
        onOpenChange={(open) => {
          if (!open) setEditando(null)
        }}
        onSave={async (updates) => {
          if (!editando) return
          try {
            await patch(editando.id, updates)
            toast.success('Template atualizado.')
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Falha ao salvar')
            throw err
          }
        }}
      />

      <VisualizarTemplateModal
        open={Boolean(visualizando)}
        template={visualizando}
        onOpenChange={(open) => {
          if (!open) setVisualizando(null)
        }}
      />

      <EditarTemplateModal
        open={criando}
        mode="create"
        template={null}
        onOpenChange={setCriando}
        onSave={async (updates) => {
          if (!updates.slug || !updates.tipo) {
            throw new Error('slug e tipo são obrigatórios')
          }
          try {
            await create({
              slug: updates.slug,
              nome: updates.nome,
              tipo: updates.tipo,
              tipoDocumentoId: updates.tipoDocumentoId,
              conteudo: updates.conteudo,
              unidadeId: updates.unidadeId,
              ativo: updates.ativo,
              editavel_pelo_especialista: updates.editavel_pelo_especialista,
              disponivel_portal_paciente: updates.disponivel_portal_paciente,
            })
            toast.success('Template criado.')
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Falha ao criar')
            throw err
          }
        }}
      />

      <Dialog
        open={Boolean(excluindo)}
        onOpenChange={(open) => {
          if (!open) setExcluindo(null)
        }}
      >
        <DialogContent size="sm" className="rounded-[24px]">
          <DialogHeader>
            <DialogTitle>Excluir template?</DialogTitle>
            <DialogDescription>
              Deseja remover o template <strong>{excluindo?.nome}</strong>?<br />
              Se já houver documentos emitidos a partir dele, o template será apenas desativado para
              preservar o histórico.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl border-app-border dark:border-app-border-dark"
              onClick={() => setExcluindo(null)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              className="rounded-xl bg-[var(--app-danger-text)] text-white hover:opacity-90"
              onClick={() => void handleExcluir()}
              disabled={isDeleting}
            >
              {isDeleting ? 'Removendo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
