import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

// Lógica de roteamento e ocupação de slot da agenda (testável, sem listAgenda).
// CONSULTA (com paciente) sem encaixe → OCUPA um slot 'Disponível' gerado pela 2A.
// Encaixe (foraJanela) ou compromisso pessoal/reunião (sem paciente) → INSERE.

export type FluxoAgendamento = 'ocupar' | 'inserir'

/** Online/Híbrido exigem URL http(s) válida. Presencial limpa plataforma/url no occupy. */
export function validateModalidadeOnlineUrl(params: {
  modalidade: unknown
  urlOnline: unknown
}): { ok: true } | { ok: false; message: string; code: string } {
  const modalidade = typeof params.modalidade === 'string' ? params.modalidade.trim() : ''
  const needsUrl = modalidade === 'Online' || modalidade === 'Hibrido'
  if (!needsUrl) return { ok: true }

  const url = typeof params.urlOnline === 'string' ? params.urlOnline.trim() : ''
  if (!url) {
    return {
      ok: false,
      message: 'Informe a URL do atendimento online/híbrido.',
      code: 'URL_ONLINE_REQUIRED',
    }
  }
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        ok: false,
        message: 'A URL online deve começar com http:// ou https://.',
        code: 'URL_ONLINE_INVALID',
      }
    }
  } catch {
    return {
      ok: false,
      message: 'URL online inválida.',
      code: 'URL_ONLINE_INVALID',
    }
  }
  return { ok: true }
}

export function decidirFluxoAgendamento(params: {
  pacienteId: string | null
  foraJanela: boolean
}): FluxoAgendamento {
  if (params.pacienteId && !params.foraJanela) return 'ocupar'
  return 'inserir'
}

/**
 * Campos aplicados ao converter um slot 'Disponível' em 'Agendado'.
 * NÃO inclui horario_inicio/horario_fim/unidade_id: o slot gerado já os tem
 * corretos e não deve ser movido — só ocupado.
 */
export function buildOccupyUpdate(
  body: Record<string, unknown>,
  pacienteId: string,
): Record<string, unknown> {
  // O slot gerado (2A) nasce sempre 'Presencial'; a ocupação aplica a modalidade
  // escolhida no modal. Sem componente online, plataforma/url vão null (sem lixo).
  const modalidade =
    typeof body.modalidade === 'string' && body.modalidade.length > 0
      ? body.modalidade
      : 'Presencial'
  const comOnline = modalidade === 'Online' || modalidade === 'Hibrido'
  return {
    paciente_id: pacienteId,
    status: 'Agendado',
    tipo: body.tipo ?? null,
    modalidade_atendimento: modalidade,
    plataforma_online: comOnline ? (body.plataformaOnline ?? null) : null,
    url_online: comOnline ? (body.urlOnline ?? null) : null,
    valor_procedimento: body.valorProcedimento ?? null,
    procedimento_id: body.procedimentoId ?? null,
    observacoes: body.observacoes ?? null,
    tipo_encaixe: 'normal',
    fora_janela: false,
    motivo_encaixe: null,
    updated_at: new Date().toISOString(),
  }
}

/**
 * Linha inserida quando NÃO é ocupação de slot: encaixe (fora da grade) ou
 * compromisso pessoal/reunião (sem paciente). Mantém o comportamento legado.
 */
export function buildInsertPayload(params: {
  unidadeId: string | null
  pacienteId: string | null
  profissionalId: string | null
  criadoPorId: string
  body: Record<string, unknown>
  foraJanela: boolean
  motivoEncaixe: string | null
}): Record<string, unknown> {
  const { unidadeId, pacienteId, profissionalId, criadoPorId, body, foraJanela, motivoEncaixe } =
    params
  return {
    unidade_id: unidadeId,
    paciente_id: pacienteId,
    profissional_id: profissionalId,
    criado_por_id: criadoPorId,
    data_agendamento: body.data,
    horario_inicio: body.horario,
    horario_fim: body.horarioFim ?? null,
    status: body.status ?? 'Agendado',
    tipo: body.tipo ?? null,
    titulo: body.titulo ?? null,
    local: body.local ?? null,
    participantes: body.participantes ?? null,
    // A coluna é NOT NULL (default 'Presencial'); compromisso pessoal também precisa de valor.
    modalidade_atendimento: body.modalidade ?? 'Presencial',
    plataforma_online: body.plataformaOnline ?? null,
    url_online: body.urlOnline ?? null,
    valor_procedimento: body.valorProcedimento ?? null,
    procedimento_id: body.procedimentoId ?? null,
    observacoes: body.observacoes ?? null,
    tipo_encaixe: foraJanela ? 'manual' : 'normal',
    fora_janela: foraJanela,
    motivo_encaixe: motivoEncaixe,
  }
}

export type OcuparSlotResult =
  | { kind: 'occupied'; id: string }
  | { kind: 'indisponivel' }
  | { kind: 'error'; error: PostgrestError }

/**
 * Ocupa, de forma concorrência-segura, o slot 'Disponível' do profissional
 * naquela data/hora: o UPDATE é condicional a status='Disponível', então dois
 * atendentes não ocupam o mesmo slot (o segundo afeta 0 linhas → indisponivel).
 */
export async function ocuparSlotDisponivel(
  supabase: SupabaseClient,
  params: {
    profissionalId: string
    data: string
    horario: string
    update: Record<string, unknown>
  },
): Promise<OcuparSlotResult> {
  const { data: rows, error } = await supabase
    .from('agendamentos')
    .update(params.update)
    .eq('profissional_id', params.profissionalId)
    .eq('data_agendamento', params.data)
    // horario é 'HH:MM'; a coluna é Postgres `time`. O PostgREST coage 'HH:MM'→time
    // (mesma coerção que o gerar usa ao INSERIR 'HH:MM'), então o eq casa. Não "consertar".
    .eq('horario_inicio', params.horario)
    .eq('status', 'Disponível')
    .select('id')

  if (error) return { kind: 'error', error }
  if (!rows || rows.length === 0) return { kind: 'indisponivel' }
  return { kind: 'occupied', id: String((rows[0] as { id: unknown }).id) }
}
