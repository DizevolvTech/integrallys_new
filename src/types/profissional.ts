/**
 * Tipos do cadastro de Profissionais (especialistas).
 *
 * Profissional é um `usuarios` com perfil='especialista' acrescido de:
 *  - grade semanal (`profissional_horarios`) — migration 079
 *  - procedimentos atendidos (`profissional_procedimentos`) — migration 079
 *
 * `diaSemana` segue 0=Dom .. 6=Sáb (getDay() de api/agenda/gerar/route.ts), que
 * a Fase 2 consumirá para derivar dias/janelas/duração da geração de agenda.
 */

export type ProfissionalTurno = 'manha' | 'tarde'

export const PROFISSIONAL_TURNOS = [
  'manha',
  'tarde',
] as const satisfies readonly ProfissionalTurno[]

export type ProfissionalTipoVinculo = 'interno' | 'parceiro'

export interface ProfissionalHorario {
  id?: string
  /** 0=Dom .. 6=Sáb, alinhado ao getDay() usado na geração de agenda. */
  diaSemana: number
  turno: ProfissionalTurno
  /** Formato HH:MM. */
  horaInicio: string
  /** Formato HH:MM. */
  horaFim: string
  /** Duração da 1ª consulta (min) e passo dos slots gerados. */
  duracaoMin: number
  /** Duração do retorno (min); null = igual à da 1ª consulta. */
  duracaoRetornoMin?: number | null
  ativo: boolean
}

export interface ProfissionalItem {
  id: string
  nome: string
  email: string
  telefone?: string | null
  /** Conselho de classe (ex.: CRM, CRO, CREFITO). */
  conselho?: string | null
  /** Número de registro no conselho. */
  crm?: string | null
  cpf?: string | null
  dataNascimento?: string | null
  rg?: string | null
  estadoCivil?: string | null
  endereco?: string | null
  bairro?: string | null
  cidade?: string | null
  cep?: string | null
  estado?: string | null
  tipoVinculo: ProfissionalTipoVinculo
  /** Regra de repasse ativa (só faz sentido p/ parceiro) — para prefill do modal. */
  repassePercentual?: number | null
  repasseValorFixo?: number | null
  status: string
  /** Unidade principal / de login. */
  unidadeId?: string | null
  /** Filiais ADICIONAIS onde também atende (profissional_unidades) — exclui a principal. */
  unidadesAtuacaoIds: string[]
  horarios: ProfissionalHorario[]
  procedimentoIds: string[]
}

export interface ProfissionalInput {
  id?: string
  nome: string
  email: string
  /** Obrigatória na criação (mín. 6 caracteres); ignorada/omitida na edição. */
  senha?: string
  telefone?: string | null
  conselho?: string | null
  crm?: string | null
  cpf?: string | null
  dataNascimento?: string | null
  rg?: string | null
  estadoCivil?: string | null
  endereco?: string | null
  bairro?: string | null
  cidade?: string | null
  cep?: string | null
  estado?: string | null
  tipoVinculo: ProfissionalTipoVinculo
  /** Regra de repasse (só aplicada quando parceiro). */
  repassePercentual?: number | null
  repasseValorFixo?: number | null
  status?: string
  /** Unidade principal / de login. */
  unidadeId?: string | null
  /** Filiais ADICIONAIS onde também atende — exclui a principal. */
  unidadesAtuacaoIds: string[]
  horarios: ProfissionalHorario[]
  procedimentoIds: string[]
}
