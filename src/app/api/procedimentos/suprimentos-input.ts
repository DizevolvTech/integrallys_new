import type { getAppSupabase } from '@/lib/app-api'

type Supabase = ReturnType<typeof getAppSupabase>

const UUID = /^[0-9a-f-]{36}$/i

export type SuprimentoProcedimento = { suprimentoId: string; quantidade: number }

/** Item 24: valida "baixa automática de suprimentos" do procedimento (quais e quantos). */
export function lerSuprimentosProcedimento(
  body: Record<string, unknown>,
): { ok: true; baixa: boolean | undefined; itens: SuprimentoProcedimento[] | undefined } | { ok: false; error: string } {
  if (body.baixaSuprimentos === undefined && body.suprimentos === undefined) return { ok: true, baixa: undefined, itens: undefined }
  const baixa = body.baixaSuprimentos === true
  const bruto = Array.isArray(body.suprimentos) ? body.suprimentos : []
  if (bruto.length > 30) return { ok: false, error: 'Máximo de 30 suprimentos por procedimento' }
  const vistos = new Set<string>()
  const itens: SuprimentoProcedimento[] = []
  for (const raw of bruto) {
    const r = (raw ?? {}) as Record<string, unknown>
    const suprimentoId = typeof r.suprimentoId === 'string' ? r.suprimentoId : ''
    const quantidade = Number(r.quantidade)
    if (!UUID.test(suprimentoId) || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 9999) {
      return { ok: false, error: 'Suprimento ou quantidade inválidos' }
    }
    if (vistos.has(suprimentoId)) return { ok: false, error: 'Suprimento repetido na lista' }
    vistos.add(suprimentoId)
    itens.push({ suprimentoId, quantidade })
  }
  if (baixa && itens.length === 0) return { ok: false, error: 'Escolha ao menos um suprimento para a baixa automática' }
  return { ok: true, baixa, itens: baixa ? itens : [] }
}

export async function gravarSuprimentosProcedimento(supabase: Supabase, procedimentoId: string, itens: SuprimentoProcedimento[]) {
  const del = await supabase.from('procedimento_suprimentos').delete().eq('procedimento_id', procedimentoId)
  if (del.error) return del.error
  if (itens.length === 0) return null
  const ins = await supabase
    .from('procedimento_suprimentos')
    .insert(itens.map((i) => ({ procedimento_id: procedimentoId, suprimento_id: i.suprimentoId, quantidade: i.quantidade })))
  return ins.error
}
