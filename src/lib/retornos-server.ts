import type { SupabaseClient } from '@supabase/supabase-js'
import { calcularPrazoRetorno } from '@/lib/retorno-prazo'

/** Data de hoje (YYYY-MM-DD) no fuso da clínica. */
export function hojeIsoSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

export interface RegistrarRetornoParams {
  pacienteId: string
  origem: 'atendimento' | 'prescricao'
  criadoPorId: string
  profissionalId?: string | null
  agendamentoId?: string | null
  procedimentoId?: string | null
  prescricaoId?: string | null
  unidadeId?: string | null
  dataBase: string
  prazoTipo?: string
  prazoDiasCustom?: number | null
  /** Especialista/procedimento DO RETORNO (nulos = os da origem). */
  especialistaRetornoId?: string | null
  procedimentoRetornoId?: string | null
}

export type RegistrarRetornoResult =
  | { ok: true; id: string | null; criado: boolean }
  | { ok: false; message: string; code: string; status: number }

/**
 * Grava o retorno de um paciente.
 * - atendimento: o prazo escolhido substitui qualquer retorno pendente anterior; "liberado" só registra.
 * - prescricao ("Mais tarde"): sem prazo; não duplica se já há retorno pendente; marca a tag
 *   persistente "Retorno pendente" (crm_estagio) no cadastro do paciente.
 */
export async function registrarRetorno(
  supabase: SupabaseClient,
  p: RegistrarRetornoParams,
): Promise<RegistrarRetornoResult> {
  const isPrescricao = p.origem === 'prescricao'
  const prazoTipo = isPrescricao ? 'sem_prazo' : (p.prazoTipo ?? '')
  const calculo = isPrescricao
    ? ({ ok: true, dataPrevista: null, prazoDias: null } as const)
    : calcularPrazoRetorno(prazoTipo, p.dataBase, p.prazoDiasCustom)
  if (!calculo.ok) return { ok: false, message: calculo.message, code: 'INVALID_PRAZO', status: 400 }

  if (isPrescricao) {
    // Só conta o retorno realmente em aberto (view): um pendente já coberto por agendamento de retorno
    // posterior não impede o novo "Mais tarde" de criar o selo.
    const { data: aberto, error: abertoError } = await supabase
      .from('retornos_em_aberto')
      .select('id')
      .eq('paciente_id', p.pacienteId)
      .limit(1)
    if (abertoError) return { ok: false, message: 'Falha ao registrar retorno', code: 'DB_ERROR', status: 500 }
    if (aberto && aberto.length > 0) {
      await marcarTagRetornoPendente(supabase, p.pacienteId, p.criadoPorId)
      return { ok: true, id: String(aberto[0].id), criado: false }
    }
  } else {
    const { error: substError } = await supabase
      .from('retornos_pendentes')
      .update({ status: 'substituido', updated_at: new Date().toISOString() })
      .eq('paciente_id', p.pacienteId)
      .eq('status', 'pendente')
    if (substError) return { ok: false, message: 'Falha ao registrar retorno', code: 'DB_ERROR', status: 500 }
  }

  const liberado = prazoTipo === 'liberado'
  const { data, error } = await supabase
    .from('retornos_pendentes')
    .insert({
      paciente_id: p.pacienteId,
      profissional_id: p.profissionalId ?? null,
      unidade_id: p.unidadeId ?? null,
      agendamento_id: p.agendamentoId ?? null,
      procedimento_id: p.procedimentoId ?? null,
      especialista_retorno_id: isPrescricao ? null : (p.especialistaRetornoId ?? null),
      procedimento_retorno_id: isPrescricao ? null : (p.procedimentoRetornoId ?? null),
      prescricao_id: p.prescricaoId ?? null,
      origem: p.origem,
      prazo_tipo: prazoTipo,
      prazo_dias: calculo.prazoDias,
      data_base: p.dataBase,
      data_prevista: calculo.dataPrevista,
      status: liberado ? 'liberado' : 'pendente',
      criado_por_id: p.criadoPorId,
    })
    .select('id')
    .single()
  if (error) return { ok: false, message: 'Falha ao registrar retorno', code: 'DB_ERROR', status: 500 }

  if (isPrescricao) await marcarTagRetornoPendente(supabase, p.pacienteId, p.criadoPorId)
  return { ok: true, id: String(data.id), criado: true }
}

/** Tag persistente "Retorno pendente" no cadastro (crm_paciente_estagios). Não sobrescreve VIP. */
export async function marcarTagRetornoPendente(
  supabase: SupabaseClient,
  pacienteId: string,
  userId: string,
) {
  const { data: atual } = await supabase
    .from('crm_paciente_estagios')
    .select('estagio')
    .eq('paciente_id', pacienteId)
    .maybeSingle()
  if (atual?.estagio === 'vip' || atual?.estagio === 'retorno_pendente') return
  const { error } = await supabase.from('crm_paciente_estagios').upsert(
    [
      {
        paciente_id: pacienteId,
        estagio: 'retorno_pendente',
        responsavel_id: userId,
        updated_at: new Date().toISOString(),
      },
    ],
    { onConflict: 'paciente_id' },
  )
  if (error) console.error('[retornos] falha ao marcar tag retorno pendente', error)
}

/** Retorno agendado: a tag "Retorno pendente" volta para "ativo". */
export async function limparTagRetornoPendente(supabase: SupabaseClient, pacienteId: string) {
  const { error } = await supabase
    .from('crm_paciente_estagios')
    .update({ estagio: 'ativo', updated_at: new Date().toISOString() })
    .eq('paciente_id', pacienteId)
    .eq('estagio', 'retorno_pendente')
  if (error) console.error('[retornos] falha ao limpar tag retorno pendente', error)
}

/**
 * Confere que o especialista (ativo, perfil especialista) e o procedimento (ativo) do retorno existem.
 * Devolve mensagem de erro ou null quando está tudo certo.
 */
export async function validarAlvoRetorno(
  supabase: SupabaseClient,
  alvo: { especialistaId?: string | null; procedimentoId?: string | null },
): Promise<string | null> {
  if (alvo.especialistaId) {
    const { data } = await supabase
      .from('usuarios')
      .select('id')
      .eq('id', alvo.especialistaId)
      .eq('perfil', 'especialista')
      .eq('status', 'Ativo')
      .maybeSingle()
    if (!data) return 'Especialista do retorno inválido ou inativo'
  }
  if (alvo.procedimentoId) {
    const { data } = await supabase
      .from('procedimentos')
      .select('id')
      .eq('id', alvo.procedimentoId)
      .eq('ativo', true)
      .maybeSingle()
    if (!data) return 'Procedimento do retorno inválido ou inativo'
  }
  return null
}
