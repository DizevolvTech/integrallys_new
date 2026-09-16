'use client'

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ModalHeader } from '@/components/shared/modal-header'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
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
import { useAuth } from '@/hooks/use-auth'
import { useUnidades } from '@/hooks/use-unidades'
import type {
  DocumentoTemplate,
  DocumentoTipo,
  ItemChecklist,
  Secao,
  TemplateConteudo,
} from '@/lib/documentos'

const TIPOS_SECAO: Array<{ value: Secao['tipo']; label: string }> = [
  { value: 'paragrafo', label: 'Parágrafo (texto corrido)' },
  { value: 'campo_data', label: 'Campo de data' },
  { value: 'campo_texto', label: 'Campo de texto curto' },
  { value: 'campo_texto_longo', label: 'Campo de texto longo' },
  { value: 'campo_numero', label: 'Campo numérico' },
  { value: 'checklist', label: 'Checklist (Sim/Não + obs)' },
  { value: 'checkbox_lista', label: 'Lista de marcações' },
  { value: 'checkbox_grupo', label: 'Grupo de opções (radio visual)' },
]

function criarSecao(tipo: Secao['tipo']): Secao {
  switch (tipo) {
    case 'paragrafo':
      return { tipo, conteudo: '' }
    case 'campo_data':
      return { tipo, label: 'Data' }
    case 'campo_texto':
      return { tipo, label: 'Campo' }
    case 'campo_texto_longo':
      return { tipo, label: 'Campo longo' }
    case 'campo_numero':
      return { tipo, label: 'Valor' }
    case 'checklist':
      return { tipo, label: 'Checklist', itens: [] }
    case 'checkbox_lista':
      return { tipo, label: 'Lista', itens: [] }
    case 'checkbox_grupo':
      return { tipo, label: 'Grupo', opcoes: [] }
  }
}

function labelDoTipo(tipo: Secao['tipo']): string {
  return TIPOS_SECAO.find((entry) => entry.value === tipo)?.label ?? tipo
}

interface TemplateUpdates {
  nome: string
  ativo: boolean
  editavel_pelo_especialista: boolean
  disponivel_portal_paciente: boolean
  conteudo: TemplateConteudo
  slug?: string
  tipo?: DocumentoTipo
  /** Só enviado na criação por master/admin (sem unidade implícita no JWT). */
  unidadeId?: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Quando null e `mode === 'create'`, o modal entra em modo de criação. */
  template: DocumentoTemplate | null
  mode?: 'create' | 'edit'
  onSave: (updates: TemplateUpdates) => Promise<void>
}

const TIPOS_DOCUMENTO: Array<{ value: DocumentoTipo; label: string }> = [
  { value: 'formulario', label: 'Formulário' },
  { value: 'declaracao', label: 'Declaração' },
  { value: 'laudo', label: 'Laudo' },
  { value: 'encaminhamento', label: 'Encaminhamento' },
  { value: 'procedimento', label: 'Procedimento' },
  { value: 'dieta', label: 'Dieta' },
  { value: 'contrato', label: 'Contrato' },
]

const SLUG_REGEX = /^[a-z0-9_]+$/

const VARIAVEIS_DISPONIVEIS = [
  '#CLIENTE_NOME#',
  '#CLIENTE_CPF#',
  '#AGENDA_DATA_HORA#',
  '#PROFISSIONAL_NOME#',
  '#PROFISSIONAL_CONSELHO#',
  '#PROFISSIONAL_CPF#',
  '#PROFISSIONAL_RG#',
  '#PROFISSIONAL_ENDERECO#',
  '#PROFISSIONAL_ESTADO_CIVIL#',
  '#REPASSE_PERCENTUAL#',
  '#REPASSE_VALOR_FIXO#',
  '#DATA_ATUAL#',
  '#CLINICA_NOME#',
  '#CLINICA_CIDADE_UF#',
  '#CLINICA_ENDERECO#',
  '#CLINICA_CEP#',
  '#CLINICA_TELEFONE#',
]

export function EditarTemplateModal({
  open,
  onOpenChange,
  template,
  mode = 'edit',
  onSave,
}: Props) {
  const isCreate = mode === 'create'
  const user = useAuth((s) => s.user)
  const { data: unidades } = useUnidades()
  // Sem unidade no JWT → precisa escolher no formulário (independente do role string).
  const precisaEscolherUnidade = isCreate && !user?.unidadeId

  const [nome, setNome] = useState('')
  const [slug, setSlug] = useState('')
  const [tipo, setTipo] = useState<DocumentoTipo>('formulario')
  const [unidadeId, setUnidadeId] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [editavelEspecialista, setEditavelEspecialista] = useState(true)
  const [disponivelPortal, setDisponivelPortal] = useState(false)
  const [conteudo, setConteudo] = useState<TemplateConteudo>({
    cabecalho: { titulo: '', logo: true },
    secoes: [],
    rodape: {},
  })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (template) {
      setNome(template.nome)
      setSlug(template.slug)
      setTipo(template.tipo)
      setUnidadeId(template.unidade_id ?? '')
      setAtivo(template.ativo)
      setEditavelEspecialista(template.editavel_pelo_especialista)
      setDisponivelPortal(template.disponivel_portal_paciente)
      setConteudo(template.conteudo)
    } else if (isCreate) {
      setNome('')
      setSlug('')
      setTipo('formulario')
      setUnidadeId('')
      setAtivo(true)
      setEditavelEspecialista(true)
      setDisponivelPortal(false)
      setConteudo({ cabecalho: { titulo: '', logo: true }, secoes: [], rodape: {} })
    }
  }, [open, template, isCreate])

  const slugValido = !isCreate || (slug.length > 0 && SLUG_REGEX.test(slug))
  const unidadeValida = !precisaEscolherUnidade || unidadeId.length > 0

  const handleSave = async () => {
    if (isSaving) return
    if (!nome.trim()) return
    if (isCreate && !slugValido) return
    if (!unidadeValida) return
    setIsSaving(true)
    try {
      await onSave({
        nome: nome.trim(),
        ativo,
        editavel_pelo_especialista: editavelEspecialista,
        disponivel_portal_paciente: disponivelPortal,
        conteudo,
        ...(isCreate
          ? {
              slug: slug.trim().toLowerCase(),
              tipo,
              ...(precisaEscolherUnidade ? { unidadeId } : {}),
            }
          : {}),
      })
      onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  }

  const updateSecao = (index: number, next: Secao) => {
    setConteudo((current) => {
      const secoes = [...current.secoes]
      secoes[index] = next
      return { ...current, secoes }
    })
  }

  const removeSecao = (index: number) => {
    setConteudo((current) => ({
      ...current,
      secoes: current.secoes.filter((_, i) => i !== index),
    }))
  }

  const moveSecao = (index: number, delta: -1 | 1) => {
    setConteudo((current) => {
      const secoes = [...current.secoes]
      const target = index + delta
      if (target < 0 || target >= secoes.length) return current
      ;[secoes[index], secoes[target]] = [secoes[target], secoes[index]]
      return { ...current, secoes }
    })
  }

  const addSecao = (tipo: Secao['tipo']) => {
    setConteudo((current) => ({
      ...current,
      secoes: [...current.secoes, criarSecao(tipo)],
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="flex flex-col rounded-[24px]">
        <ModalHeader
          title={isCreate ? 'Novo template' : `Editar template · ${template?.slug ?? ''}`}
          description={
            <>
              Este template é aplicado apenas nesta clínica. Use as variáveis{' '}
              <code className="text-xs">#EXEMPLO#</code> para campos preenchidos automaticamente.
            </>
          }
        />

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          <section className="space-y-4">
            {isCreate && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-normal dark:text-white/70">
                    Slug <span className="text-[var(--app-danger-text)]">*</span>
                  </label>
                  <Input
                    value={slug}
                    onChange={(event) =>
                      setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                    }
                    placeholder="ex.: atestado_medico"
                    className="h-11 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-xl font-mono text-sm"
                  />
                  <p className="text-xs text-app-text-muted">
                    Identificador técnico único. Apenas minúsculas, números e _. Não pode ser
                    alterado depois.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-normal dark:text-white/70">Tipo</label>
                  <Select value={tipo} onValueChange={(value) => setTipo(value as DocumentoTipo)}>
                    <SelectTrigger className="h-11 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_DOCUMENTO.map((entry) => (
                        <SelectItem key={entry.value} value={entry.value}>
                          {entry.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {precisaEscolherUnidade && (
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-normal dark:text-white/70">
                      Unidade <span className="text-[var(--app-danger-text)]">*</span>
                    </label>
                    <Select value={unidadeId} onValueChange={setUnidadeId}>
                      <SelectTrigger className="h-11 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-xl">
                        <SelectValue placeholder="Selecione a unidade do template…" />
                      </SelectTrigger>
                      <SelectContent>
                        {unidades.map((unidade) => (
                          <SelectItem key={unidade.id} value={unidade.id}>
                            {unidade.nome}
                            {unidade.cidade ? ` · ${unidade.cidade}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-app-text-muted">
                      Master e admin não têm unidade implícita — o template fica vinculado à unidade
                      escolhida (ex.: para contratos de parceiros dessa clínica).
                    </p>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-normal dark:text-white/70">Nome exibido</label>
                <Input
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  className="h-11 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-xl"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label className="flex flex-col items-start gap-1 p-3 rounded-xl border border-app-border dark:border-app-border-dark">
                  <span className="text-xs text-app-text-secondary dark:text-white/60">Ativo</span>
                  <Switch checked={ativo} onCheckedChange={setAtivo} />
                </label>
                <label className="flex flex-col items-start gap-1 p-3 rounded-xl border border-app-border dark:border-app-border-dark">
                  <span className="text-xs text-app-text-secondary dark:text-white/60">
                    Especialista edita
                  </span>
                  <Switch
                    checked={editavelEspecialista}
                    onCheckedChange={setEditavelEspecialista}
                  />
                </label>
                <label className="flex flex-col items-start gap-1 p-3 rounded-xl border border-app-border dark:border-app-border-dark">
                  <span className="text-xs text-app-text-secondary dark:text-white/60">
                    Portal do paciente
                  </span>
                  <Switch checked={disponivelPortal} onCheckedChange={setDisponivelPortal} />
                </label>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-medium uppercase tracking-wider text-app-text-secondary dark:text-white/60">
              Cabeçalho
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
              <div className="space-y-2">
                <label className="text-sm font-normal dark:text-white/70">Título</label>
                <Input
                  value={conteudo.cabecalho.titulo}
                  onChange={(event) =>
                    setConteudo((current) => ({
                      ...current,
                      cabecalho: { ...current.cabecalho, titulo: event.target.value },
                    }))
                  }
                  className="h-11 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-xl"
                />
              </div>
              <label className="flex flex-col items-start gap-1 p-3 rounded-xl border border-app-border dark:border-app-border-dark">
                <span className="text-xs text-app-text-secondary dark:text-white/60">
                  Exibir logo
                </span>
                <Switch
                  checked={Boolean(conteudo.cabecalho.logo)}
                  onCheckedChange={(checked) =>
                    setConteudo((current) => ({
                      ...current,
                      cabecalho: { ...current.cabecalho, logo: checked },
                    }))
                  }
                />
              </label>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium uppercase tracking-wider text-app-text-secondary dark:text-white/60">
                Seções ({conteudo.secoes.length})
              </h4>
              <div className="flex items-center gap-2">
                <Select onValueChange={(value) => addSecao(value as Secao['tipo'])} value="">
                  <SelectTrigger className="h-9 w-[260px] bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-lg text-sm">
                    <SelectValue placeholder="Adicionar seção..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_SECAO.map((entry) => (
                      <SelectItem key={entry.value} value={entry.value}>
                        {entry.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {conteudo.secoes.length === 0 && (
              <div className="p-6 text-center text-sm text-app-text-secondary dark:text-white/60 border border-dashed border-app-border dark:border-app-border-dark rounded-xl">
                Nenhuma seção. Use o seletor acima para adicionar.
              </div>
            )}

            <div className="space-y-3">
              {conteudo.secoes.map((secao, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-app-border dark:border-app-border-dark p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium uppercase tracking-wider text-app-text-secondary dark:text-white/60">
                      {index + 1}. {labelDoTipo(secao.tipo)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={index === 0}
                        onClick={() => moveSecao(index, -1)}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={index === conteudo.secoes.length - 1}
                        onClick={() => moveSecao(index, 1)}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[var(--app-danger-text)]"
                        onClick={() => removeSecao(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <SecaoEditor secao={secao} onChange={(next) => updateSecao(index, next)} />
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-medium uppercase tracking-wider text-app-text-secondary dark:text-white/60">
              Rodapé
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex flex-col items-start gap-1 p-3 rounded-xl border border-app-border dark:border-app-border-dark">
                <span className="text-xs text-app-text-secondary dark:text-white/60">
                  Linha de assinatura
                </span>
                <Switch
                  checked={Boolean(conteudo.rodape.assinatura)}
                  onCheckedChange={(checked) =>
                    setConteudo((current) => ({
                      ...current,
                      rodape: { ...current.rodape, assinatura: checked },
                    }))
                  }
                />
              </label>
              <label className="flex flex-col items-start gap-1 p-3 rounded-xl border border-app-border dark:border-app-border-dark">
                <span className="text-xs text-app-text-secondary dark:text-white/60">
                  Dados da clínica
                </span>
                <Switch
                  checked={Boolean(conteudo.rodape.dados_clinica)}
                  onCheckedChange={(checked) =>
                    setConteudo((current) => ({
                      ...current,
                      rodape: { ...current.rodape, dados_clinica: checked },
                    }))
                  }
                />
              </label>
              <label className="flex flex-col items-start gap-1 p-3 rounded-xl border border-app-border dark:border-app-border-dark">
                <span className="text-xs text-app-text-secondary dark:text-white/60">
                  Conselho do profissional
                </span>
                <Switch
                  checked={Boolean(conteudo.rodape.conselho)}
                  onCheckedChange={(checked) =>
                    setConteudo((current) => ({
                      ...current,
                      rodape: { ...current.rodape, conselho: checked },
                    }))
                  }
                />
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-normal dark:text-white/70">Texto fixo do rodapé</label>
              <Textarea
                value={conteudo.rodape.texto_fixo ?? ''}
                onChange={(event) =>
                  setConteudo((current) => ({
                    ...current,
                    rodape: { ...current.rodape, texto_fixo: event.target.value },
                  }))
                }
                placeholder="Ex.: Objetivo do laudo descritivo é..."
                className="min-h-[80px] bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-xl font-normal resize-none"
              />
            </div>
          </section>

          <section className="rounded-xl bg-app-surface-muted dark:bg-app-hover/40 p-4 space-y-2">
            <h5 className="text-xs font-medium uppercase tracking-wider text-app-text-secondary dark:text-white/60">
              Variáveis disponíveis
            </h5>
            <div className="flex flex-wrap gap-2">
              {VARIAVEIS_DISPONIVEIS.map((token) => (
                <code
                  key={token}
                  className="text-xs px-2 py-1 rounded bg-app-bg-secondary dark:bg-app-hover border border-app-border dark:border-app-border-dark"
                >
                  {token}
                </code>
              ))}
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-xl border-app-border dark:border-app-border-dark"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            className="rounded-xl bg-app-primary text-white hover:bg-app-primary-hover"
            onClick={() => void handleSave()}
            disabled={isSaving || !nome.trim() || !slugValido || !unidadeValida}
          >
            {isSaving ? 'Salvando...' : isCreate ? 'Criar template' : 'Salvar template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface SecaoEditorProps {
  secao: Secao
  onChange: (next: Secao) => void
}

function SecaoEditor({ secao, onChange }: SecaoEditorProps) {
  switch (secao.tipo) {
    case 'paragrafo':
      return (
        <div className="space-y-2">
          <label className="text-xs text-app-text-secondary dark:text-white/60">Conteúdo</label>
          <Textarea
            value={secao.conteudo}
            onChange={(event) => onChange({ ...secao, conteudo: event.target.value })}
            className="min-h-[80px] bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-lg font-normal resize-none"
          />
        </div>
      )

    case 'campo_data':
    case 'campo_numero':
      return (
        <div className="space-y-2">
          <label className="text-xs text-app-text-secondary dark:text-white/60">Rótulo</label>
          <Input
            value={secao.label}
            onChange={(event) => onChange({ ...secao, label: event.target.value })}
            className="h-10 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-lg"
          />
          {secao.tipo === 'campo_data' && (
            <>
              <label className="text-xs text-app-text-secondary dark:text-white/60">
                Valor padrão
              </label>
              <Input
                value={secao.valor_padrao ?? ''}
                onChange={(event) => onChange({ ...secao, valor_padrao: event.target.value })}
                placeholder="Ex.: #DATA_ATUAL#"
                className="h-10 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-lg"
              />
            </>
          )}
        </div>
      )

    case 'campo_texto':
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs text-app-text-secondary dark:text-white/60">Rótulo</label>
            <Input
              value={secao.label}
              onChange={(event) => onChange({ ...secao, label: event.target.value })}
              className="h-10 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-lg"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-app-text-secondary dark:text-white/60">
              Placeholder
            </label>
            <Input
              value={secao.placeholder ?? ''}
              onChange={(event) => onChange({ ...secao, placeholder: event.target.value })}
              className="h-10 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-lg"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs text-app-text-secondary dark:text-white/60">
              Valor padrão
            </label>
            <Input
              value={secao.valor_padrao ?? ''}
              onChange={(event) => onChange({ ...secao, valor_padrao: event.target.value })}
              className="h-10 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-lg"
            />
          </div>
          <label className="flex items-center justify-between p-3 rounded-lg border border-app-border dark:border-app-border-dark md:col-span-2">
            <span className="text-sm dark:text-white/70">Obrigatório</span>
            <Switch
              checked={Boolean(secao.obrigatorio)}
              onCheckedChange={(checked) => onChange({ ...secao, obrigatorio: checked })}
            />
          </label>
        </div>
      )

    case 'campo_texto_longo':
      return (
        <div className="space-y-2">
          <label className="text-xs text-app-text-secondary dark:text-white/60">Rótulo</label>
          <Input
            value={secao.label}
            onChange={(event) => onChange({ ...secao, label: event.target.value })}
            className="h-10 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-lg"
          />
          <label className="text-xs text-app-text-secondary dark:text-white/60">
            Texto base (editável pelo especialista)
          </label>
          <Textarea
            value={secao.valor_padrao ?? ''}
            onChange={(event) => onChange({ ...secao, valor_padrao: event.target.value })}
            className="min-h-[80px] bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-lg font-normal resize-none"
          />
        </div>
      )

    case 'checklist':
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs text-app-text-secondary dark:text-white/60">
              Rótulo do grupo
            </label>
            <Input
              value={secao.label}
              onChange={(event) => onChange({ ...secao, label: event.target.value })}
              className="h-10 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-lg"
            />
          </div>
          <ItensChecklistEditor
            itens={secao.itens}
            onChange={(itens) => onChange({ ...secao, itens })}
          />
        </div>
      )

    case 'checkbox_lista':
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs text-app-text-secondary dark:text-white/60">
              Rótulo do grupo
            </label>
            <Input
              value={secao.label}
              onChange={(event) => onChange({ ...secao, label: event.target.value })}
              className="h-10 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-lg"
            />
          </div>
          <StringListEditor
            items={secao.itens}
            placeholder="Novo item..."
            onChange={(itens) => onChange({ ...secao, itens })}
          />
        </div>
      )

    case 'checkbox_grupo':
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs text-app-text-secondary dark:text-white/60">
              Rótulo do grupo
            </label>
            <Input
              value={secao.label}
              onChange={(event) => onChange({ ...secao, label: event.target.value })}
              className="h-10 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-lg"
            />
          </div>
          <StringListEditor
            items={secao.opcoes}
            placeholder="Nova opção..."
            onChange={(opcoes) => onChange({ ...secao, opcoes })}
          />
        </div>
      )
  }
}

function StringListEditor({
  items,
  placeholder,
  onChange,
}: {
  items: string[]
  placeholder: string
  onChange: (next: string[]) => void
}) {
  const [novo, setNovo] = useState('')
  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((item, idx) => (
            <li
              key={idx}
              className="flex items-center gap-2 p-2 rounded-lg bg-app-bg-secondary dark:bg-app-hover"
            >
              <Input
                value={item}
                onChange={(event) =>
                  onChange(items.map((value, i) => (i === idx ? event.target.value : value)))
                }
                className="h-8 flex-1 bg-transparent border-0 rounded-md px-2"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-[var(--app-danger-text)]"
                onClick={() => onChange(items.filter((_, i) => i !== idx))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <Input
          value={novo}
          onChange={(event) => setNovo(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && novo.trim()) {
              event.preventDefault()
              onChange([...items, novo.trim()])
              setNovo('')
            }
          }}
          placeholder={placeholder}
          className="h-9 flex-1 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-lg"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-lg border-app-border dark:border-app-border-dark"
          onClick={() => {
            if (!novo.trim()) return
            onChange([...items, novo.trim()])
            setNovo('')
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
        </Button>
      </div>
    </div>
  )
}

function ItensChecklistEditor({
  itens,
  onChange,
}: {
  itens: ItemChecklist[]
  onChange: (next: ItemChecklist[]) => void
}) {
  const [novo, setNovo] = useState('')
  return (
    <div className="space-y-2">
      {itens.length > 0 && (
        <ul className="space-y-1">
          {itens.map((item, idx) => (
            <li
              key={idx}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center p-2 rounded-lg bg-app-bg-secondary dark:bg-app-hover"
            >
              <Input
                value={item.label}
                onChange={(event) =>
                  onChange(
                    itens.map((value, i) =>
                      i === idx ? { ...value, label: event.target.value } : value,
                    ),
                  )
                }
                placeholder="Pergunta (ex.: Tabagismo?)"
                className="h-8 bg-transparent border-0 rounded-md px-2"
              />
              <label className="flex items-center gap-1 text-xs text-app-text-secondary dark:text-white/60">
                <Switch
                  checked={Boolean(item.com_obs)}
                  onCheckedChange={(checked) =>
                    onChange(
                      itens.map((value, i) => (i === idx ? { ...value, com_obs: checked } : value)),
                    )
                  }
                />
                obs
              </label>
              <Input
                value={item.obs_label ?? ''}
                onChange={(event) =>
                  onChange(
                    itens.map((value, i) =>
                      i === idx ? { ...value, obs_label: event.target.value } : value,
                    ),
                  )
                }
                placeholder="Qual?"
                disabled={!item.com_obs}
                className="h-8 w-[100px] bg-app-surface-muted dark:bg-app-hover rounded-md px-2 border-0"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-[var(--app-danger-text)]"
                onClick={() => onChange(itens.filter((_, i) => i !== idx))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <Input
          value={novo}
          onChange={(event) => setNovo(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && novo.trim()) {
              event.preventDefault()
              onChange([...itens, { label: novo.trim(), com_obs: true, obs_label: 'Qual?' }])
              setNovo('')
            }
          }}
          placeholder="Nova pergunta..."
          className="h-9 flex-1 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-lg"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-lg border-app-border dark:border-app-border-dark"
          onClick={() => {
            if (!novo.trim()) return
            onChange([...itens, { label: novo.trim(), com_obs: true, obs_label: 'Qual?' }])
            setNovo('')
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
        </Button>
      </div>
    </div>
  )
}
