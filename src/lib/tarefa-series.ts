import type { getAppSupabase } from '@/lib/app-api'
import {
  limiteGeracaoRecorrencia,
  normalizeDiasSemana,
  normalizeTarefaRecorrencia,
  proximasOcorrencias,
} from '@/lib/tarefa-recorrencia'

type Supabase = ReturnType<typeof getAppSupabase>

const MODELO_SELECT =
  'id,serie_id,titulo,descricao,responsavel_id,vencimento_em,recorrencia,dias_semana,alerta,prioridade,categoria,created_by_id'

/** Cria a série de uma tarefa recorrente recém-criada (ou que passou a ser recorrente). */
export async function criarSerie(supabase: Supabase, tarefaId: string, vencimentoEm: string) {
  const { data, error } = await supabase
    .from('tarefa_series')
    .insert({ gerada_ate: vencimentoEm })
    .select('id')
    .single()
  if (error || !data?.id) return error
  const { error: linkError } = await supabase
    .from('tarefas')
    .update({ serie_id: data.id })
    .eq('id', tarefaId)
  return linkError
}

/** Encerra a série: não gera mais ocorrências e remove as futuras ainda não tocadas. */
export async function encerrarSerie(supabase: Supabase, serieId: string, aposVencimento: string | null) {
  await supabase.from('tarefa_series').update({ ativa: false }).eq('id', serieId)
  if (!aposVencimento) return
  await supabase
    .from('tarefas')
    .delete()
    .eq('serie_id', serieId)
    .eq('status', 'Pendente')
    .gt('vencimento_em', aposVencimento)
}

/**
 * Gera as ocorrências de todas as séries ativas até o horizonte (hoje + N dias).
 * O modelo é a ocorrência mais recente da série; `gerada_ate` guarda até onde
 * já se gerou, para que uma ocorrência excluída nunca volte. Sem trabalho
 * pendente custa uma única consulta.
 */
export async function materializarSeries(supabase: Supabase, agora: Date = new Date()) {
  const limite = limiteGeracaoRecorrencia(agora)
  const { data: series, error } = await supabase
    .from('tarefa_series')
    .select('id,gerada_ate')
    .eq('ativa', true)
    .lt('gerada_ate', limite.toISOString())
  if (error) return error
  if (!series?.length) return null

  const serieIds = series.map((s) => String(s.id))
  const { data: ocorrencias, error: modeloError } = await supabase
    .from('tarefas')
    .select(MODELO_SELECT)
    .in('serie_id', serieIds)
    .order('vencimento_em', { ascending: false })
  if (modeloError) return modeloError

  const modeloPorSerie = new Map<string, Record<string, unknown>>()
  for (const row of ocorrencias ?? []) {
    const key = String(row.serie_id)
    if (!modeloPorSerie.has(key)) modeloPorSerie.set(key, row)
  }

  const novas: Array<Record<string, unknown>> = []
  const avancos: Array<{ id: string; geradaAte: string }> = []
  const encerradas: string[] = []

  for (const serie of series) {
    const serieId = String(serie.id)
    const modelo = modeloPorSerie.get(serieId)
    const recorrencia = normalizeTarefaRecorrencia(modelo?.recorrencia)
    if (!modelo || recorrencia === 'nenhuma') {
      encerradas.push(serieId)
      continue
    }
    const diasSemana = normalizeDiasSemana(modelo.dias_semana)
    const datas = proximasOcorrencias(recorrencia, String(serie.gerada_ate), limite, diasSemana)
    if (datas.length === 0) continue
    for (const data of datas) {
      novas.push({
        serie_id: serieId,
        titulo: modelo.titulo,
        descricao: modelo.descricao ?? null,
        responsavel_id: modelo.responsavel_id ?? null,
        status: 'Pendente',
        vencimento_em: data.toISOString(),
        recorrencia,
        dias_semana: diasSemana.length > 0 ? diasSemana : null,
        alerta: Boolean(modelo.alerta),
        prioridade: modelo.prioridade ?? null,
        categoria: modelo.categoria ?? null,
        created_by_id: modelo.created_by_id ?? null,
      })
    }
    avancos.push({ id: serieId, geradaAte: datas[datas.length - 1].toISOString() })
  }

  if (novas.length > 0) {
    const { error: insertError } = await supabase
      .from('tarefas')
      .upsert(novas, { onConflict: 'serie_id,vencimento_em', ignoreDuplicates: true })
    if (insertError) return insertError
  }
  await Promise.all([
    ...avancos.map((a) =>
      supabase.from('tarefa_series').update({ gerada_ate: a.geradaAte }).eq('id', a.id).lt('gerada_ate', a.geradaAte),
    ),
    encerradas.length > 0
      ? supabase.from('tarefa_series').update({ ativa: false }).in('id', encerradas)
      : Promise.resolve(null),
  ])
  return null
}
