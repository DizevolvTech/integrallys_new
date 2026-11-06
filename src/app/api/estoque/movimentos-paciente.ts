import type { SupabaseClient } from '@supabase/supabase-js'
import { emLotes } from '@/lib/em-lotes'

/** Filtro por data é o dia de Brasília (UTC-3), não o dia UTC. */
export const inicioDoDia = (dia: string) => (/^\d{4}-\d{2}-\d{2}$/.test(dia) ? `${dia}T00:00:00-03:00` : dia)
export const fimDoDia = (dia: string) => `${dia.slice(0, 10)}T23:59:59.999-03:00`

/** Paciente (nome) da venda/conversão de prescrição ligada a cada movimento: um lote por 150 ids, sem N+1. */
export async function pacientesDosMovimentos(
  supabase: SupabaseClient,
  movimentacaoIds: string[],
): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  const lotes = emLotes(Array.from(new Set(movimentacaoIds)))
  const respostas = await Promise.all(
    lotes.map((lote) =>
      supabase.from('movimentacoes_estoque_paciente').select('movimentacao_id,paciente_nome').in('movimentacao_id', lote),
    ),
  )
  for (const { data, error } of respostas) {
    if (error) throw new Error('Falha ao carregar o paciente das movimentações')
    for (const row of data ?? []) mapa.set(String(row.movimentacao_id), String(row.paciente_nome ?? ''))
  }
  return mapa
}

/** Ids (no máximo 150) de movimentos cujo paciente tem o nome buscado; entra no `or` da busca do topo. */
export async function idsMovimentosPorPaciente(supabase: SupabaseClient, busca: string): Promise<string[]> {
  const { data } = await supabase
    .from('movimentacoes_estoque_paciente')
    .select('movimentacao_id')
    .ilike('paciente_nome', `%${busca}%`)
    .limit(150)
  return (data ?? []).map((row) => String(row.movimentacao_id))
}
