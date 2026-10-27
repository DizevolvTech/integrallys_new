export type TipoAtendimento = 'presencial' | 'online' | 'hibrido'

// Valores do enum public.modalidade_atendimento (migration 013):
// 'Presencial' | 'Online' | 'Hibrido'  — atenção: 'Hibrido' é SEM acento.
const MODALIDADE_POR_TIPO: Record<TipoAtendimento, string> = {
  presencial: 'Presencial',
  online: 'Online',
  hibrido: 'Hibrido',
}

/**
 * Converte a escolha do modal (tipoAtendimento minúsculo) no valor do enum +
 * a plataforma. Presencial não carrega plataforma (evita lixo de seleção anterior).
 */
export function resolveModalidade(
  tipoAtendimento: TipoAtendimento,
  plataformaOnline: string,
): { modalidade: string; plataformaOnline?: string } {
  const comOnline = tipoAtendimento === 'online' || tipoAtendimento === 'hibrido'
  return {
    modalidade: MODALIDADE_POR_TIPO[tipoAtendimento],
    plataformaOnline: comOnline ? plataformaOnline : undefined,
  }
}

/** Mensagem quando o agendamento não tem horário utilizável (data passada, grade vazia ou horário já passado). */
export function mensagemSemHorario(params: {
  data: string
  hoje: string
  encaixe: boolean
  temHorarios: boolean
  horarioPassado?: boolean
}): string {
  const dataPassada = params.data < params.hoje
  if (params.horarioPassado || dataPassada || (params.data === params.hoje && !params.temHorarios)) {
    return params.encaixe
      ? 'Esse horário já passou. Informe um horário futuro para o encaixe.'
      : 'Esse horário já passou. Escolha uma data ou horário futuro — ou ative "Encaixe fora do horário padrão" e informe um horário futuro fora da grade.'
  }
  return params.encaixe
    ? 'Informe o horário do encaixe.'
    : 'Selecione um horário disponível. Se não houver, gere a agenda do profissional ou ative "Encaixe fora do horário padrão".'
}
