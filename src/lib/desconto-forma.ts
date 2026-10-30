/**
 * Desconto automático por forma de pagamento (cadastro do gestor em Cadastros).
 * Regra única, usada pelo servidor (recalcula e valida a venda) e pela tela (só exibe).
 */
export const FORMAS_COM_DESCONTO = ['pix', 'dinheiro', 'cartao_debito', 'cartao_credito'] as const
export type FormaComDesconto = (typeof FORMAS_COM_DESCONTO)[number]
export type DescontosPorForma = Record<FormaComDesconto, number>

export const CONFIG_DESCONTOS_CATEGORIA = 'pagamento'
export const CONFIG_DESCONTOS_CHAVE = 'pagamento.payment_discount_config'

export const DESCONTOS_PADRAO: DescontosPorForma = {
  pix: 0,
  dinheiro: 0,
  cartao_debito: 0,
  cartao_credito: 0,
}

export const ROTULO_FORMA_COM_DESCONTO: Record<FormaComDesconto, string> = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  cartao_debito: 'Cartão de Débito',
  cartao_credito: 'Cartão de Crédito',
}

export function ehFormaComDesconto(forma: unknown): forma is FormaComDesconto {
  return typeof forma === 'string' && (FORMAS_COM_DESCONTO as readonly string[]).includes(forma)
}

/** Aceita só percentuais entre 0 e 100; o que vier fora disso volta para 0. */
export function normalizarDescontos(raw: unknown): DescontosPorForma {
  const base = { ...DESCONTOS_PADRAO }
  if (!raw || typeof raw !== 'object') return base
  const origem = raw as Record<string, unknown>
  for (const forma of FORMAS_COM_DESCONTO) {
    const valor = Number(origem[forma])
    if (Number.isFinite(valor) && valor >= 0 && valor <= 100) base[forma] = valor
  }
  return base
}

/** Valida o corpo de uma gravação: devolve null se algum percentual estiver ausente ou fora de 0–100. */
export function validarDescontos(raw: unknown): DescontosPorForma | null {
  if (!raw || typeof raw !== 'object') return null
  const origem = raw as Record<string, unknown>
  const resultado = { ...DESCONTOS_PADRAO }
  for (const forma of FORMAS_COM_DESCONTO) {
    const valor = Number(origem[forma])
    if (origem[forma] === '' || origem[forma] == null || !Number.isFinite(valor) || valor < 0 || valor > 100) return null
    resultado[forma] = valor
  }
  return resultado
}

const arredondar = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100

export interface ItemParaTotal {
  quantidade: number
  valorUnitario?: number | null
}

export interface VendaCalculada {
  subtotal: number
  percentual: number
  desconto: number
  total: number
}

/** Subtotal dos itens, desconto da forma escolhida e total a pagar (2 casas). */
export function calcularVenda(
  itens: readonly ItemParaTotal[],
  forma: string | null | undefined,
  descontos: DescontosPorForma,
): VendaCalculada {
  const subtotal = arredondar(
    itens.reduce((soma, item) => soma + Number(item.valorUnitario ?? 0) * Number(item.quantidade), 0),
  )
  const percentual = ehFormaComDesconto(forma) ? descontos[forma] : 0
  const desconto = arredondar(subtotal * (percentual / 100))
  return { subtotal, percentual, desconto, total: arredondar(subtotal - desconto) }
}
