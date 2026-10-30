export const VINCULO_TIPOS = ['cliente', 'especialista', 'fornecedor', 'colaborador', 'outro'] as const
export type VinculoTipo = (typeof VINCULO_TIPOS)[number]

export interface VinculoEstoque {
  tipo: VinculoTipo | null
  id: string | null
  nome: string | null
}

const NOME_MAX = 200
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Normaliza o vínculo enviado pela tela. Fornecedor e "outro" não têm cadastro (id nulo, texto livre);
 * os demais guardam o id do cadastro. Para colaborador o nome é refeito no servidor a partir do usuário.
 */
export function normalizarVinculo(body: { vinculoTipo?: unknown; vinculoId?: unknown; vinculoNome?: unknown }): VinculoEstoque {
  const tipo = VINCULO_TIPOS.find((t) => t === body.vinculoTipo) ?? null
  if (!tipo) return { tipo: null, id: null, nome: null }
  const semCadastro = tipo === 'fornecedor' || tipo === 'outro'
  const id = !semCadastro && typeof body.vinculoId === 'string' && UUID.test(body.vinculoId.trim()) ? body.vinculoId.trim() : null
  const nome = typeof body.vinculoNome === 'string' ? body.vinculoNome.trim().slice(0, NOME_MAX) : ''
  return { tipo, id, nome: nome || null }
}

/** "Outros" só vale com o texto de quem foi e por quê. */
export function vinculoValido(v: VinculoEstoque): boolean {
  if (v.tipo === 'outro') return Boolean(v.nome)
  if (v.tipo === 'colaborador') return Boolean(v.id)
  return true
}
