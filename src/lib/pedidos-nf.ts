/** Pedidos de nota fiscal (tabela pedidos_nf): resumo do início do admin e rótulos da lista. */
export type StatusPedidoNf = 'pendente' | 'emitida' | 'cancelada'

export const ROTULO_STATUS_PEDIDO_NF: Record<StatusPedidoNf, string> = {
  pendente: 'Pendente',
  emitida: 'Emitida',
  cancelada: 'Cancelada',
}

export interface ResumoPedidosNf {
  pendentes: number
  emitidas: number
  valorPendente: number
  valorEmitido: number
}

const centavos = (valor: number) => Math.round(valor * 100) / 100

/** Conta pendentes e emitidas e soma os valores; cancelados não entram. */
export function resumirPedidosNf(linhas: Array<{ status: string; valor: number | string | null }>): ResumoPedidosNf {
  const resumo: ResumoPedidosNf = { pendentes: 0, emitidas: 0, valorPendente: 0, valorEmitido: 0 }
  for (const linha of linhas) {
    const valor = Number(linha.valor ?? 0) || 0
    if (linha.status === 'pendente') {
      resumo.pendentes += 1
      resumo.valorPendente += valor
    } else if (linha.status === 'emitida') {
      resumo.emitidas += 1
      resumo.valorEmitido += valor
    }
  }
  return { ...resumo, valorPendente: centavos(resumo.valorPendente), valorEmitido: centavos(resumo.valorEmitido) }
}

const BRL = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Texto do card do início: "2 pendentes · 1 emitida · R$ 360,00 em pedidos". */
export function descreverPedidosNf(resumo: ResumoPedidosNf): string {
  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
  return `${plural(resumo.pendentes, 'pendente', 'pendentes')} · ${plural(resumo.emitidas, 'emitida', 'emitidas')} · ${BRL(resumo.valorPendente + resumo.valorEmitido)} em pedidos`
}
