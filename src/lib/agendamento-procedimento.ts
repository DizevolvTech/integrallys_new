import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isProcedimentoRetornoNome,
  isTipoRetorno,
  prazoDiasDoNomeRetorno,
  STATUS_CONTAM_PARA_RETORNO,
  validateRetornoAgendamento,
} from '@/lib/procedimento-retorno'

export type AgendamentoProcedimentoResolved = {
  procedimentoId: string | null
  valorProcedimento: number | null
  intervaloRecorrenciaDias: number | null
  quantidadeSugeridaPacote: number | null
  temPacote: boolean
  /** Agendamento de retorno (tipo Retorno ou procedimento de retorno): ocupa a duração de retorno. */
  ehRetorno: boolean
}

/**
 * Resolve procedimento + valor para POST/PUT de agendamento.
 * Se tipo=retorno, aplica valor_retorno e valida prazo (padrão 35 dias).
 */
export async function resolveAgendamentoProcedimento(
  supabase: SupabaseClient,
  params: {
    procedimentoId: unknown
    valorProcedimento: unknown
    profissionalId: string | null
    tipo?: unknown
    pacienteId?: string | null
    dataAgendamento?: string | null
    /** false = edição que não mexe em data/hora/procedimento/tipo: não revalida o prazo do retorno. */
    validarRetorno?: boolean
  },
): Promise<
  | { ok: true; data: AgendamentoProcedimentoResolved }
  | { ok: false; code: string; message: string }
> {
  const rawId =
    typeof params.procedimentoId === 'string' && params.procedimentoId.trim().length > 0
      ? params.procedimentoId.trim()
      : null

  if (!rawId) {
    const explicit =
      params.valorProcedimento != null && params.valorProcedimento !== ''
        ? Number(params.valorProcedimento)
        : null
    return {
      ok: true,
      data: {
        procedimentoId: null,
        valorProcedimento: explicit != null && Number.isFinite(explicit) ? explicit : null,
        intervaloRecorrenciaDias: null,
        quantidadeSugeridaPacote: null,
        temPacote: false,
        ehRetorno: isTipoRetorno(params.tipo),
      },
    }
  }

  const { data: proc, error: procError } = await supabase
    .from('procedimentos')
    .select(
      'id,nome,valor,ativo,tem_retorno,prazo_retorno_dias,valor_retorno,tem_pacote,intervalo_recorrencia_dias,quantidade_sugerida_pacote',
    )
    .eq('id', rawId)
    .maybeSingle()

  if (procError) {
    return { ok: false, code: 'PROCEDIMENTO_LOOKUP_FAILED', message: 'Falha ao carregar procedimento' }
  }
  if (!proc?.id) {
    return { ok: false, code: 'PROCEDIMENTO_NOT_FOUND', message: 'Procedimento não encontrado' }
  }
  if (proc.ativo === false) {
    return { ok: false, code: 'PROCEDIMENTO_INATIVO', message: 'Procedimento inativo' }
  }

  if (params.profissionalId) {
    const { data: vinculos, error: vincError } = await supabase
      .from('profissional_procedimentos')
      .select('procedimento_id')
      .eq('profissional_id', params.profissionalId)

    if (vincError) {
      return {
        ok: false,
        code: 'PROCEDIMENTO_VINCULO_FAILED',
        message: 'Falha ao validar procedimentos do profissional',
      }
    }

    const allowed = (vinculos ?? []).map((row) => String(row.procedimento_id ?? ''))
    // Sem vínculos cadastrados: não libera "qualquer procedimento" (alinha UI da call).
    if (allowed.length === 0) {
      return {
        ok: false,
        code: 'PROCEDIMENTO_SEM_VINCULOS',
        message:
          'Este profissional não possui procedimentos vinculados. Cadastre o vínculo em Profissionais.',
      }
    }
    if (!allowed.includes(String(proc.id))) {
      return {
        ok: false,
        code: 'PROCEDIMENTO_NAO_VINCULADO',
        message: 'Procedimento não vinculado a este profissional',
      }
    }
  }

  const valorFromProc = proc.valor != null ? Number(proc.valor) : null
  const intervalo =
    proc.intervalo_recorrencia_dias != null ? Number(proc.intervalo_recorrencia_dias) : null
  const qtdPacote =
    proc.quantidade_sugerida_pacote != null ? Number(proc.quantidade_sugerida_pacote) : null
  const temPacote = Boolean(proc.tem_pacote)

  const baseMeta = {
    procedimentoId: String(proc.id),
    intervaloRecorrenciaDias: intervalo != null && Number.isFinite(intervalo) ? intervalo : null,
    quantidadeSugeridaPacote: qtdPacote != null && Number.isFinite(qtdPacote) ? qtdPacote : null,
    temPacote,
    ehRetorno: false,
  }

  const procedimentoDeRetorno = isProcedimentoRetornoNome(proc.nome)
  if (isTipoRetorno(params.tipo) || procedimentoDeRetorno) {
    const pacienteId =
      typeof params.pacienteId === 'string' && params.pacienteId.trim()
        ? params.pacienteId.trim()
        : null
    const dataAgendamento =
      typeof params.dataAgendamento === 'string' && params.dataAgendamento.trim()
        ? params.dataAgendamento.trim()
        : null

    if (params.validarRetorno === false) {
      const salvo =
        params.valorProcedimento != null && params.valorProcedimento !== ''
          ? Number(params.valorProcedimento)
          : valorFromProc
      return {
        ok: true,
        data: {
          ...baseMeta,
          ehRetorno: true,
          valorProcedimento: salvo != null && Number.isFinite(salvo) ? salvo : null,
        },
      }
    }

    if (!pacienteId || !dataAgendamento) {
      return {
        ok: false,
        code: 'RETORNO_DADOS_INCOMPLETOS',
        message: 'Para retorno, informe paciente, data e procedimento.',
      }
    }

    // Procedimento de retorno genérico: vale qualquer atendimento concluído com o profissional.
    // Procedimento comum: o último atendimento do mesmo procedimento.
    let historico = supabase
      .from('agendamentos')
      .select('data_agendamento,status')
      .eq('paciente_id', pacienteId)
    historico = procedimentoDeRetorno
      ? historico.eq('profissional_id', params.profissionalId ?? '')
      : historico.eq('procedimento_id', String(proc.id))
    const { data: ultimo, error: ultimoError } = await historico
      .in('status', procedimentoDeRetorno ? ['Check-out', 'Concluído'] : [...STATUS_CONTAM_PARA_RETORNO])
      .order('data_agendamento', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (ultimoError) {
      return {
        ok: false,
        code: 'RETORNO_HISTORICO_FAILED',
        message: 'Falha ao consultar histórico para validar o retorno.',
      }
    }

    const validated = validateRetornoAgendamento({
      temRetorno: Boolean(proc.tem_retorno) || procedimentoDeRetorno,
      prazoDias: procedimentoDeRetorno
        ? (prazoDiasDoNomeRetorno(proc.nome) ?? 35)
        : proc.prazo_retorno_dias != null
          ? Number(proc.prazo_retorno_dias)
          : 35,
      valorRetorno: proc.valor_retorno != null ? Number(proc.valor_retorno) : null,
      valorConsulta: valorFromProc,
      dataAgendamento,
      ultimaDataAtendimento: ultimo?.data_agendamento ? String(ultimo.data_agendamento).slice(0, 10) : null,
    })

    if (!validated.ok) {
      return { ok: false, code: validated.code, message: validated.message }
    }

    return {
      ok: true,
      data: {
        ...baseMeta,
        ehRetorno: true,
        valorProcedimento: validated.valor,
      },
    }
  }

  const explicit =
    params.valorProcedimento != null && params.valorProcedimento !== ''
      ? Number(params.valorProcedimento)
      : null
  const valorProcedimento =
    explicit != null && Number.isFinite(explicit)
      ? explicit
      : valorFromProc != null && Number.isFinite(valorFromProc)
        ? valorFromProc
        : null

  return {
    ok: true,
    data: {
      ...baseMeta,
      valorProcedimento,
    },
  }
}
