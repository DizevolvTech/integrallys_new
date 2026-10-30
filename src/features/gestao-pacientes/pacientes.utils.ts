// Vínculos que NÃO são clientes e não devem aparecer na lista de Pacientes.
// Fornecedor/prestador são linhas de `pacientes` com vínculo próprio; têm
// telas próprias (ex.: /fornecedores) e vazavam na lista de clientes.
const VINCULOS_NAO_CLIENTE = new Set(['fornecedor', 'prestador'])

/**
 * Item 10: `vinculo_tipos` agora é uma lista (multi-vínculo). Um paciente aparece
 * na lista de Pacientes se tiver AO MENOS um vínculo que não seja fornecedor/
 * prestador — então um "cliente que também é fornecedor" continua aparecendo aqui
 * (e também na tela de Fornecedores). Só some quem é EXCLUSIVAMENTE fornecedor/
 * prestador. Legados sem vínculo (lista vazia) são tratados como cliente.
 */
export function isClientePaciente(vinculoTipos?: string[] | null): boolean {
  const tipos = (vinculoTipos ?? [])
    .map((tipo) => (typeof tipo === 'string' ? tipo.trim().toLowerCase() : ''))
    .filter(Boolean)
  if (tipos.length === 0) return true
  return tipos.some((tipo) => !VINCULOS_NAO_CLIENTE.has(tipo))
}

export type TomInadimplencia = 'vencido' | 'parcial' | 'pendente'

/**
 * Cor da linha da Inadimplência: pagamento parcial = amarelo (mesma cor da agenda);
 * senão vencido = vermelho; o restante (a vencer / sem vencimento) fica neutro.
 */
export function tomInadimplencia(row: { situacao?: string | null; status?: string | null }): TomInadimplencia {
  if (String(row.status ?? '').trim().toLowerCase().includes('parcial')) return 'parcial'
  return row.situacao === 'vencido' ? 'vencido' : 'pendente'
}

export const CLASSE_TOM_INADIMPLENCIA: Record<TomInadimplencia, string> = {
  vencido: 'font-medium text-[var(--app-danger-text)]',
  parcial: 'font-medium text-[var(--app-warning-text)]',
  pendente: 'text-app-text-secondary dark:text-app-text-muted',
}
