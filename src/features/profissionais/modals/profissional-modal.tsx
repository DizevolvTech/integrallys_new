'use client'

import { Stethoscope } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { FeedbackConsulta, SpinnerCampo } from '@/components/shared/feedback-consulta'
import { ModalHeader } from '@/components/shared/modal-header'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useProcedimentos } from '@/features/procedimentos/hooks/use-procedimentos'
import { useConsultaCep } from '@/hooks/use-consulta-cep'
import { useUnidades } from '@/hooks/use-unidades'
import { cn } from '@/lib/utils'
import {
  formatarCEP,
  formatarCPF,
  formatarTelefone,
  validarCPF,
  validarTelefone,
} from '@/lib/validacao-br'
import type { EnderecoCep } from '@/services/cep.service'
import type { ProfissionalInput, ProfissionalItem, ProfissionalTurno } from '@/types/profissional'

const DIAS: Array<{ label: string; value: number }> = [
  { label: 'Domingo', value: 0 },
  { label: 'Segunda', value: 1 },
  { label: 'Terça', value: 2 },
  { label: 'Quarta', value: 3 },
  { label: 'Quinta', value: 4 },
  { label: 'Sexta', value: 5 },
  { label: 'Sábado', value: 6 },
]

const TURNOS: Array<{ key: ProfissionalTurno; label: string }> = [
  { key: 'manha', label: 'Manhã' },
  { key: 'tarde', label: 'Tarde' },
]

type TurnoForm = {
  ativo: boolean
  horaInicio: string
  horaFim: string
  duracaoMin: string
  duracaoRetornoMin: string
}

type DiaForm = Record<ProfissionalTurno, TurnoForm>

type GradeForm = Record<number, DiaForm>

const emptyTurno = (): TurnoForm => ({ ativo: false, horaInicio: '', horaFim: '', duracaoMin: '', duracaoRetornoMin: '' })

const emptyGrade = (): GradeForm => {
  const grade = {} as GradeForm
  for (const dia of DIAS) {
    grade[dia.value] = { manha: emptyTurno(), tarde: emptyTurno() }
  }
  return grade
}

const gradeFromHorarios = (item: ProfissionalItem | null): GradeForm => {
  const grade = emptyGrade()
  if (!item) return grade
  for (const horario of item.horarios) {
    const dia = grade[horario.diaSemana]
    if (!dia) continue
    dia[horario.turno] = {
      ativo: horario.ativo,
      horaInicio: horario.horaInicio,
      horaFim: horario.horaFim,
      duracaoMin: String(horario.duracaoMin),
      duracaoRetornoMin: horario.duracaoRetornoMin ? String(horario.duracaoRetornoMin) : '',
    }
  }
  return grade
}

type ProfissionalModalProps = {
  isOpen: boolean
  mode: 'create' | 'edit'
  initial?: ProfissionalItem | null
  onClose: () => void
  onSave: (payload: ProfissionalInput) => Promise<void>
}

type BasicForm = {
  nome: string
  email: string
  senha: string
  telefone: string
  conselho: string
  crm: string
  cpf: string
  dataNascimento: string
  rg: string
  estadoCivil: string
  endereco: string
  bairro: string
  cidade: string
  cep: string
  estado: string
  tipoVinculo: 'interno' | 'parceiro'
  status: 'Ativo' | 'Inativo'
  unidadeId: string
}

const emptyBasic = (): BasicForm => ({
  nome: '',
  email: '',
  senha: '',
  telefone: '',
  conselho: '',
  crm: '',
  cpf: '',
  dataNascimento: '',
  rg: '',
  estadoCivil: '',
  endereco: '',
  bairro: '',
  cidade: '',
  cep: '',
  estado: '',
  tipoVinculo: 'interno',
  status: 'Ativo',
  unidadeId: '',
})

export function ProfissionalModal({
  isOpen,
  mode,
  initial = null,
  onClose,
  onSave,
}: ProfissionalModalProps) {
  const { data: procedimentos } = useProcedimentos()
  const { data: unidades } = useUnidades()

  const [basic, setBasic] = useState<BasicForm>(emptyBasic())
  const [grade, setGrade] = useState<GradeForm>(emptyGrade())
  const [procedimentoIds, setProcedimentoIds] = useState<string[]>([])
  const [unidadesAtuacaoIds, setUnidadesAtuacaoIds] = useState<string[]>([])
  const [repasseTipo, setRepasseTipo] = useState<'percentual' | 'valor_fixo'>('percentual')
  const [repasseValor, setRepasseValor] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Auto-preenchimento de endereço pelo CEP (backlog do item 12 — sugestão da
  // Camila). Só preenche campo vazio, para nunca sobrescrever correção manual.
  const aoEncontrarCep = useCallback((endereco: EnderecoCep) => {
    setBasic((prev) => ({
      ...prev,
      endereco: prev.endereco || endereco.logradouro,
      bairro: prev.bairro || endereco.bairro,
      cidade: prev.cidade || endereco.cidade,
      estado: prev.estado || endereco.estado,
    }))
  }, [])

  const consultaCep = useConsultaCep(aoEncontrarCep)

  useEffect(() => {
    if (!isOpen) return
    consultaCep.reiniciar()
    setBasic({
      nome: initial?.nome ?? '',
      email: initial?.email ?? '',
      senha: '',
      telefone: formatarTelefone(initial?.telefone ?? ''),
      conselho: initial?.conselho ?? '',
      crm: initial?.crm ?? '',
      cpf: formatarCPF(initial?.cpf ?? ''),
      dataNascimento: initial?.dataNascimento ?? '',
      rg: initial?.rg ?? '',
      estadoCivil: initial?.estadoCivil ?? '',
      endereco: initial?.endereco ?? '',
      bairro: initial?.bairro ?? '',
      cidade: initial?.cidade ?? '',
      cep: formatarCEP(initial?.cep ?? ''),
      estado: initial?.estado ?? '',
      tipoVinculo: initial?.tipoVinculo ?? 'interno',
      status: initial?.status === 'Inativo' ? 'Inativo' : 'Ativo',
      unidadeId: initial?.unidadeId ?? '',
    })
    setGrade(gradeFromHorarios(initial))
    setProcedimentoIds(initial?.procedimentoIds ?? [])
    setUnidadesAtuacaoIds(initial?.unidadesAtuacaoIds ?? [])
    if (initial?.repasseValorFixo != null) {
      setRepasseTipo('valor_fixo')
      setRepasseValor(String(initial.repasseValorFixo))
    } else if (initial?.repassePercentual != null) {
      setRepasseTipo('percentual')
      setRepasseValor(String(initial.repassePercentual))
    } else {
      setRepasseTipo('percentual')
      setRepasseValor('')
    }
  }, [isOpen, initial, consultaCep.reiniciar])

  const procedimentosAtivos = useMemo(
    () => procedimentos.filter((item) => item.ativo),
    [procedimentos],
  )

  // Filiais adicionais só podem ser diferentes da unidade principal.
  const outrasUnidades = useMemo(
    () => unidades.filter((unidade) => unidade.id !== basic.unidadeId),
    [unidades, basic.unidadeId],
  )

  const setBasicField = <K extends keyof BasicForm>(key: K, value: BasicForm[K]) =>
    setBasic((prev) => ({ ...prev, [key]: value }))

  const handleCepChange = (valor: string) => {
    const mascarado = formatarCEP(valor)
    setBasicField('cep', mascarado)
    void consultaCep.consultar(mascarado)
  }

  // Só acusa erro depois de o documento estar completo — não enquanto digita.
  const cpfCompletoInvalido = basic.cpf.replace(/\D/g, '').length === 11 && !validarCPF(basic.cpf)
  const telefoneCompletoInvalido =
    basic.telefone.replace(/\D/g, '').length >= 10 && !validarTelefone(basic.telefone)

  const setTurnoField = (dia: number, turno: ProfissionalTurno, patch: Partial<TurnoForm>) =>
    setGrade((prev) => ({
      ...prev,
      [dia]: { ...prev[dia], [turno]: { ...prev[dia][turno], ...patch } },
    }))

  const toggleProcedimento = (id: string) =>
    setProcedimentoIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )

  const toggleUnidadeAtuacao = (id: string) =>
    setUnidadesAtuacaoIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )

  const buildHorarios = (): ProfissionalInput['horarios'] | null => {
    const horarios: ProfissionalInput['horarios'] = []
    for (const dia of DIAS) {
      for (const turno of TURNOS) {
        const cfg = grade[dia.value][turno.key]
        if (!cfg.ativo) continue
        const duracaoMin = Number(cfg.duracaoMin)
        if (!cfg.horaInicio || !cfg.horaFim) {
          toast.error(`Informe início e fim do turno ${turno.label.toLowerCase()} de ${dia.label}.`)
          return null
        }
        if (cfg.horaFim <= cfg.horaInicio) {
          toast.error(`O fim deve ser maior que o início (${turno.label} de ${dia.label}).`)
          return null
        }
        if (!Number.isFinite(duracaoMin) || duracaoMin <= 0) {
          toast.error(`Informe uma duração válida (${turno.label} de ${dia.label}).`)
          return null
        }
        const retornoMin = Number(cfg.duracaoRetornoMin)
        if (cfg.duracaoRetornoMin && (!Number.isFinite(retornoMin) || retornoMin <= 0)) {
          toast.error(`Informe uma duração de retorno válida (${turno.label} de ${dia.label}).`)
          return null
        }
        horarios.push({
          diaSemana: dia.value,
          turno: turno.key,
          horaInicio: cfg.horaInicio,
          horaFim: cfg.horaFim,
          duracaoMin: Math.round(duracaoMin),
          duracaoRetornoMin: retornoMin > 0 ? Math.round(retornoMin) : null,
          ativo: true,
        })
      }
    }
    return horarios
  }

  const handleSubmit = async () => {
    if (!basic.nome.trim() || !basic.email.trim()) {
      toast.error('Preencha nome e e-mail.')
      return
    }
    if (mode === 'create' && basic.senha.trim().length < 6) {
      toast.error('Defina uma senha inicial com pelo menos 6 caracteres.')
      return
    }
    if (mode === 'edit' && basic.senha.trim() !== '' && basic.senha.trim().length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (basic.cpf.trim() && !validarCPF(basic.cpf)) {
      toast.error('CPF inválido — confira os dígitos verificadores.')
      return
    }
    if (basic.telefone.trim() && !validarTelefone(basic.telefone)) {
      toast.error('Telefone inválido — confira o DDD e a quantidade de dígitos.')
      return
    }

    const horarios = buildHorarios()
    if (horarios === null) return

    setIsSubmitting(true)
    try {
      const parsed = Number(repasseValor)
      const repasseNumber = repasseValor.trim() === '' || !Number.isFinite(parsed) ? null : parsed
      const isParceiro = basic.tipoVinculo === 'parceiro'
      const senhaDefinida = basic.senha.trim()
      await onSave({
        id: initial?.id,
        nome: basic.nome.trim(),
        email: basic.email.trim(),
        senha: mode === 'create' ? senhaDefinida : senhaDefinida || undefined,
        telefone: basic.telefone.trim() || null,
        conselho: basic.conselho.trim() || null,
        crm: basic.crm.trim() || null,
        cpf: basic.cpf.trim() || null,
        dataNascimento: basic.dataNascimento.trim() || null,
        rg: basic.rg.trim() || null,
        estadoCivil: basic.estadoCivil.trim() || null,
        endereco: basic.endereco.trim() || null,
        bairro: basic.bairro.trim() || null,
        cidade: basic.cidade.trim() || null,
        cep: basic.cep.trim() || null,
        estado: basic.estado.trim() || null,
        tipoVinculo: basic.tipoVinculo,
        repassePercentual: isParceiro && repasseTipo === 'percentual' ? repasseNumber : null,
        repasseValorFixo: isParceiro && repasseTipo === 'valor_fixo' ? repasseNumber : null,
        status: basic.status,
        unidadeId: basic.unidadeId || null,
        unidadesAtuacaoIds: unidadesAtuacaoIds.filter((id) => id !== basic.unidadeId),
        horarios,
        procedimentoIds,
      })
      // Item 15b — devolve a senha definida de forma copiável, para o operador ter
      // um artefato concreto para repassar ao profissional (não há convite por e-mail
      // nem autoatendimento de senha). Vale na criação (senha obrigatória) e na edição
      // quando o operador preencheu "Nova senha".
      if (senhaDefinida) {
        toast.success(mode === 'edit' ? 'Senha redefinida.' : 'Profissional cadastrado.', {
          description: `Login: ${basic.email.trim()} · Senha: ${senhaDefinida} — repasse ao profissional.`,
          duration: 15000,
          action: {
            label: 'Copiar',
            onClick: () => {
              void navigator.clipboard?.writeText(`${basic.email.trim()} / ${senhaDefinida}`)
            },
          },
        })
      } else {
        toast.success('Profissional atualizado com sucesso.')
      }
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar o profissional.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="2xl" className="gap-0 overflow-hidden rounded-[24px] p-0">
        <ModalHeader
          className="px-6 pt-6 pb-4 shrink-0"
          icon={Stethoscope}
          title={mode === 'edit' ? 'Editar Profissional' : 'Novo Profissional'}
          description="Cadastre os dados, a grade semanal de atendimento e os procedimentos atendidos."
        />

        <div className="max-h-[70vh] overflow-y-auto custom-scrollbar px-6 py-4 space-y-8">
          {/* Dados básicos */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-app-text-secondary">
              Dados do profissional
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-[var(--app-text-primary)] dark:text-white">
                  Nome completo
                </Label>
                <Input
                  placeholder="Digite o nome completo"
                  value={basic.nome}
                  onChange={(e) => setBasicField('nome', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-[var(--app-text-primary)] dark:text-white">
                  E-mail
                </Label>
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={basic.email}
                  onChange={(e) => setBasicField('email', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-[var(--app-text-primary)] dark:text-white">
                  {mode === 'create' ? 'Senha inicial' : 'Nova senha (opcional)'}
                </Label>
                <Input
                  type="password"
                  placeholder={
                    mode === 'create'
                      ? 'Mínimo de 6 caracteres'
                      : 'Deixe em branco para manter a senha atual'
                  }
                  value={basic.senha}
                  onChange={(e) => setBasicField('senha', e.target.value)}
                />
                {mode === 'edit' && (
                  <p className="text-xs text-app-text-muted">
                    Preencha para redefinir a senha de acesso deste profissional.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-[var(--app-text-primary)] dark:text-white">
                  Telefone
                </Label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={basic.telefone}
                  onChange={(e) => setBasicField('telefone', formatarTelefone(e.target.value))}
                  inputMode="tel"
                />
                {telefoneCompletoInvalido && (
                  <p className="mt-1 text-xs leading-snug text-[var(--app-danger-text)]">
                    Telefone inválido — confira o DDD e a quantidade de dígitos.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-[var(--app-text-primary)] dark:text-white">
                  Conselho de classe
                </Label>
                <Input
                  placeholder="Ex.: CRM, CRO, CREFITO"
                  value={basic.conselho}
                  onChange={(e) => setBasicField('conselho', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-[var(--app-text-primary)] dark:text-white">
                  Nº de registro
                </Label>
                <Input
                  placeholder="Número no conselho"
                  value={basic.crm}
                  onChange={(e) => setBasicField('crm', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-[var(--app-text-primary)] dark:text-white">
                  Unidade
                </Label>
                <Select
                  value={basic.unidadeId || 'none'}
                  onValueChange={(value) =>
                    setBasicField('unidadeId', value === 'none' ? '' : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem unidade definida</SelectItem>
                    {unidades.map((unidade) => (
                      <SelectItem key={unidade.id} value={unidade.id}>
                        {unidade.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-[var(--app-text-primary)] dark:text-white">
                  Tipo de vínculo
                </Label>
                <Select
                  value={basic.tipoVinculo}
                  onValueChange={(value: 'interno' | 'parceiro') =>
                    setBasicField('tipoVinculo', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="interno">Interno (clínica paga repasse)</SelectItem>
                    <SelectItem value="parceiro">Parceiro (% sobre valor bruto)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-[var(--app-text-primary)] dark:text-white">
                  Status
                </Label>
                <Select
                  value={basic.status}
                  onValueChange={(value: 'Ativo' | 'Inativo') => setBasicField('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-[var(--app-text-primary)] dark:text-white">
                Também atende em (outras filiais)
              </Label>
              <p className="text-xs text-app-text-muted">
                A unidade principal acima já conta como filial de atendimento. Marque aqui as
                filiais adicionais onde este profissional também atende.
              </p>
              {outrasUnidades.length === 0 ? (
                <p className="text-sm text-app-text-muted">Nenhuma outra unidade disponível.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {outrasUnidades.map((unidade) => {
                    const selected = unidadesAtuacaoIds.includes(unidade.id)
                    return (
                      <button
                        key={unidade.id}
                        type="button"
                        onClick={() => toggleUnidadeAtuacao(unidade.id)}
                        className={cn(
                          'rounded-full border px-3.5 py-1.5 text-sm transition-colors',
                          selected
                            ? 'border-[var(--app-primary)] bg-app-primary text-white'
                            : 'border-app-border bg-app-card text-app-text-primary hover:bg-app-bg-secondary dark:border-app-border-dark dark:bg-app-card-dark dark:text-white dark:hover:bg-app-hover',
                        )}
                      >
                        {unidade.nome}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Dados pessoais */}
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-app-text-secondary">
                Dados pessoais
              </h3>
              <p className="text-xs text-app-text-muted mt-1">
                Usados na geração de documentos como o contrato de parceria.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-[var(--app-text-primary)] dark:text-white">
                  CPF
                </Label>
                <Input
                  placeholder="000.000.000-00"
                  value={basic.cpf}
                  onChange={(e) => setBasicField('cpf', formatarCPF(e.target.value))}
                  inputMode="numeric"
                />
                {cpfCompletoInvalido && (
                  <p className="mt-1 text-xs leading-snug text-[var(--app-danger-text)]">
                    CPF inválido — confira os dígitos verificadores.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-[var(--app-text-primary)] dark:text-white">
                  RG
                </Label>
                <Input
                  placeholder="Documento de identidade"
                  value={basic.rg}
                  onChange={(e) => setBasicField('rg', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-[var(--app-text-primary)] dark:text-white">
                  Data de nascimento
                </Label>
                <Input
                  type="date"
                  value={basic.dataNascimento}
                  onChange={(e) => setBasicField('dataNascimento', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-[var(--app-text-primary)] dark:text-white">
                  Estado civil
                </Label>
                <Input
                  placeholder="Ex.: Casado(a)"
                  value={basic.estadoCivil}
                  onChange={(e) => setBasicField('estadoCivil', e.target.value)}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-sm font-semibold text-[var(--app-text-primary)] dark:text-white">
                  Endereço (rua e número)
                </Label>
                <Input
                  placeholder="Ex.: Av. Paulista, 1000"
                  value={basic.endereco}
                  onChange={(e) => setBasicField('endereco', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-[var(--app-text-primary)] dark:text-white">
                  Bairro
                </Label>
                <Input
                  placeholder="Bairro"
                  value={basic.bairro}
                  onChange={(e) => setBasicField('bairro', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-[var(--app-text-primary)] dark:text-white">
                  Cidade
                </Label>
                <Input
                  placeholder="Cidade"
                  value={basic.cidade}
                  onChange={(e) => setBasicField('cidade', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-[var(--app-text-primary)] dark:text-white">
                  CEP
                </Label>
                <div className="relative">
                  <Input
                    placeholder="00000-000"
                    value={basic.cep}
                    onChange={(e) => handleCepChange(e.target.value)}
                    inputMode="numeric"
                    className="pr-10"
                  />
                  {consultaCep.status === 'buscando' && <SpinnerCampo />}
                </div>
                <FeedbackConsulta
                  status={consultaCep.status}
                  buscando="Buscando endereço..."
                  encontrado="Endereço preenchido pelo CEP — confira e ajuste se precisar."
                  naoEncontrado="CEP não encontrado — preencha o endereço manualmente."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-[var(--app-text-primary)] dark:text-white">
                  Estado (UF)
                </Label>
                <Input
                  placeholder="Ex.: SP"
                  maxLength={2}
                  value={basic.estado}
                  onChange={(e) => setBasicField('estado', e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Repasse (só parceiro) */}
          {basic.tipoVinculo === 'parceiro' && (
            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-app-text-secondary">
                  Repasse do parceiro
                </h3>
                <p className="text-xs text-app-text-muted mt-1">
                  Percentual sobre o valor bruto ou um valor fixo por atendimento. Salvo como a
                  regra ativa de repasse deste profissional.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-[var(--app-text-primary)] dark:text-white">
                    Tipo de repasse
                  </Label>
                  <Select
                    value={repasseTipo}
                    onValueChange={(value: 'percentual' | 'valor_fixo') => setRepasseTipo(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentual">Percentual (%)</SelectItem>
                      <SelectItem value="valor_fixo">Valor fixo (R$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-[var(--app-text-primary)] dark:text-white">
                    {repasseTipo === 'percentual' ? 'Percentual (%)' : 'Valor fixo (R$)'}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder={repasseTipo === 'percentual' ? 'Ex.: 30' : 'Ex.: 150,00'}
                      value={repasseValor}
                      onChange={(e) => setRepasseValor(e.target.value)}
                      className="flex-1"
                    />
                    {(() => {
                      // Opção 1 (item 7): rótulo computado, sem coluna no banco.
                      // 100% = Total; qualquer outro % = Parcial; valor fixo = rótulo neutro.
                      if (repasseTipo === 'valor_fixo') {
                        if (repasseValor.trim() === '') return null
                        return (
                          <span className="shrink-0 rounded-full border border-app-border bg-app-bg-secondary px-2.5 py-1 text-xs font-medium text-app-text-secondary dark:border-app-border-dark dark:text-white/70">
                            Valor fixo por atendimento
                          </span>
                        )
                      }
                      const parsed = Number(repasseValor)
                      if (repasseValor.trim() === '' || !Number.isFinite(parsed)) return null
                      const isTotal = parsed === 100
                      return (
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                            isTotal
                              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                              : 'border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
                          )}
                        >
                          {isTotal ? 'Total' : 'Parcial'}
                        </span>
                      )
                    })()}
                  </div>
                  {repasseTipo === 'percentual' && (
                    <p className="text-xs text-app-text-muted">
                      100% = repasse total; qualquer outro percentual = repasse parcial.
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Grade semanal */}
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-app-text-secondary">
                Grade semanal de atendimento
              </h3>
              <p className="text-xs text-app-text-muted mt-1">
                Ative os turnos atendidos e informe a janela e a duração de cada consulta. A geração
                de agenda usará estes horários.
              </p>
            </div>

            <div className="space-y-3">
              {DIAS.map((dia) => (
                <div
                  key={dia.value}
                  className="rounded-2xl border border-app-border p-4 dark:border-app-border-dark"
                >
                  <p className="mb-3 text-sm font-semibold text-app-text-primary dark:text-white">
                    {dia.label}
                  </p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {TURNOS.map((turno) => {
                      const cfg = grade[dia.value][turno.key]
                      return (
                        <div
                          key={turno.key}
                          className={cn(
                            'rounded-xl border p-3 transition-colors',
                            cfg.ativo
                              ? 'border-[var(--app-primary)]/40 bg-app-bg-secondary dark:bg-app-hover'
                              : 'border-app-border dark:border-app-border-dark',
                          )}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-medium text-app-text-primary dark:text-white">
                              {turno.label}
                            </span>
                            <Switch
                              checked={cfg.ativo}
                              onCheckedChange={(value) =>
                                setTurnoField(dia.value, turno.key, { ativo: value })
                              }
                            />
                          </div>
                          {cfg.ativo && (
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                              <div className="space-y-1">
                                <Label className="text-xs font-normal text-app-text-muted">
                                  Início
                                </Label>
                                <Input
                                  type="time"
                                  value={cfg.horaInicio}
                                  onChange={(e) =>
                                    setTurnoField(dia.value, turno.key, {
                                      horaInicio: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs font-normal text-app-text-muted">
                                  Fim
                                </Label>
                                <Input
                                  type="time"
                                  value={cfg.horaFim}
                                  onChange={(e) =>
                                    setTurnoField(dia.value, turno.key, { horaFim: e.target.value })
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs font-normal text-app-text-muted">
                                  1ª consulta (min)
                                </Label>
                                <Input
                                  type="number"
                                  min={1}
                                  step={5}
                                  value={cfg.duracaoMin}
                                  onChange={(e) =>
                                    setTurnoField(dia.value, turno.key, {
                                      duracaoMin: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs font-normal text-app-text-muted">
                                  Retorno (min)
                                </Label>
                                <Input
                                  type="number"
                                  min={1}
                                  step={5}
                                  placeholder="= 1ª consulta"
                                  value={cfg.duracaoRetornoMin}
                                  onChange={(e) =>
                                    setTurnoField(dia.value, turno.key, {
                                      duracaoRetornoMin: e.target.value,
                                    })
                                  }
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Procedimentos */}
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-app-text-secondary">
                Procedimentos atendidos
              </h3>
              <p className="text-xs text-app-text-muted mt-1">
                Selecione os procedimentos que este profissional realiza.
              </p>
            </div>
            {procedimentosAtivos.length === 0 ? (
              <p className="text-sm text-app-text-muted">
                Nenhum procedimento ativo cadastrado. Cadastre procedimentos para vinculá-los.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {procedimentosAtivos.map((procedimento) => {
                  const selected = procedimentoIds.includes(procedimento.id)
                  return (
                    <button
                      key={procedimento.id}
                      type="button"
                      onClick={() => toggleProcedimento(procedimento.id)}
                      className={cn(
                        'rounded-full border px-3.5 py-1.5 text-sm transition-colors',
                        selected
                          ? 'border-[var(--app-primary)] bg-app-primary text-white'
                          : 'border-app-border bg-app-card text-app-text-primary hover:bg-app-bg-secondary dark:border-app-border-dark dark:bg-app-card-dark dark:text-white dark:hover:bg-app-hover',
                      )}
                    >
                      {procedimento.nome}
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="px-6 py-5 shrink-0 gap-3 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-11 rounded-lg border-app-border px-6 dark:border-app-border-dark"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="h-11 rounded-lg bg-app-primary px-8 font-medium text-white shadow-sm hover:bg-app-primary-hover"
          >
            {isSubmitting
              ? 'Salvando...'
              : mode === 'edit'
                ? 'Salvar alterações'
                : 'Salvar profissional'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
