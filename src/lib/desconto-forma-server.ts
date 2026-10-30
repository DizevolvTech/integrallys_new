import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CONFIG_DESCONTOS_CATEGORIA,
  CONFIG_DESCONTOS_CHAVE,
  normalizarDescontos,
  type DescontosPorForma,
} from '@/lib/desconto-forma'

/** Lê o cadastro de descontos por forma (uma linha em `configuracoes`); sem cadastro, tudo 0%. */
export async function lerDescontosPorForma(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('configuracoes')
    .select('valor')
    .eq('categoria', CONFIG_DESCONTOS_CATEGORIA)
    .eq('chave', CONFIG_DESCONTOS_CHAVE)
    .maybeSingle()
  if (error) return { descontos: null, error }
  let bruto: unknown = null
  try {
    bruto = data?.valor ? JSON.parse(String(data.valor)) : null
  } catch {
    bruto = null
  }
  return { descontos: normalizarDescontos(bruto), error: null }
}

export async function gravarDescontosPorForma(supabase: SupabaseClient, descontos: DescontosPorForma) {
  return supabase
    .from('configuracoes')
    .upsert(
      { categoria: CONFIG_DESCONTOS_CATEGORIA, chave: CONFIG_DESCONTOS_CHAVE, valor: JSON.stringify(descontos) },
      { onConflict: 'categoria,chave' },
    )
}
