import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isTipoRetorno,
  STATUS_CONTAM_PARA_RETORNO,
  validateRetornoAgendamento,
} from '@/lib/procedimento-retorno'

export type AgendamentoProcedimentoResolved = {
  procedimentoId: string | null
  valorProcedimento: number | null
  intervaloRecorrenciaDias: number | null
  quantidadeSugeridaPacote: number | null
  temPacote: boolean
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
      },
    }
  }

  const { data: proc, error: procError } = await supabase
    .from('procedimentos')
    .select(
      'id,valor,ativo,tem_retorno,prazo_retorno_dias,valor_retorno,tem_pacote,intervalo_recorrencia_dias,quantidade_sugerida_pacote',
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
  }

  if (isTipoRetorno(params.tipo)) {
    const pacienteId =
      typeof params.pacienteId === 'string' && params.pacienteId.trim()
        ? params.pacienteId.trim()
        : null
    const dataAgendamento =
      typeof params.dataAgendamento === 'string' && params.dataAgendamento.trim()
        ? params.dataAgendamento.trim()
        : null

    if (!pacienteId || !dataAgendamento) {
      return {
        ok: false,
        code: 'RETORNO_DADOS_INCOMPLETOS',
        message: 'Para retorno, informe paciente, data e procedimento.',
      }
    }

    const { data: ultimo, error: ultimoError } = await supabase
      .from('agendamentos')
      .select('data_agendamento,status')
      .eq('paciente_id', pacienteId)
      .eq('procedimento_id', String(proc.id))
      .in('status', [...STATUS_CONTAM_PARA_RETORNO])
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
      temRetorno: Boolean(proc.tem_retorno),
      prazoDias: proc.prazo_retorno_dias != null ? Number(proc.prazo_retorno_dias) : 35,
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
