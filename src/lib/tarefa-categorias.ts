import type { SupabaseClient } from '@supabase/supabase-js'

export const CATEGORIA_NOME_MAX = 60

/** Nome normalizado: sem espaços nas pontas e sem espaços duplicados. */
export function normalizeCategoriaNome(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

export function categoriaNomeErro(nome: string) {
  if (!nome) return 'Informe o nome da categoria.'
  if (nome.length > CATEGORIA_NOME_MAX) return `O nome da categoria aceita até ${CATEGORIA_NOME_MAX} letras.`
  return null
}

/**
 * Valida a categoria enviada numa tarefa: precisa ser uma categoria ativa cadastrada.
 * Exceção: manter o valor antigo da própria tarefa (texto livre legado ou categoria desativada).
 */
export async function categoriaTarefaErro(
  supabase: SupabaseClient,
  categoria: unknown,
  categoriaAtual: unknown,
) {
  const nome = normalizeCategoriaNome(categoria)
  if (!nome) return null
  if (nome === normalizeCategoriaNome(categoriaAtual)) return null
  const { data, error } = await supabase
    .from('tarefa_categorias')
    .select('id')
    .eq('ativa', true)
    .ilike('nome', nome.replace(/[\\%_]/g, '\\$&'))
    .limit(1)
  if (error) return 'Falha ao validar a categoria.'
  return data && data.length > 0 ? null : 'Escolha uma categoria cadastrada em "Gerenciar categorias".'
}
