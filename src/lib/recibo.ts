// Itens 6 e 28: recibo (imprimível/PDF) de venda convertida ou de consulta paga por completo.

export type ReciboTipo = 'prescricao' | 'agendamento'

export interface ReciboDados {
  numero: string
  tipo: ReciboTipo
  origemId: string
  emitidoEm: string
  clinica: { nome: string; endereco: string; cidadeUf: string; telefone: string }
  paciente: { nome: string; cpf: string }
  nf: { precisa: boolean; titular: string | null; pedidoStatus: 'pendente' | 'emitida' | null }
  itens: Array<{ descricao: string; quantidade: number; valorUnitario: number; total: number }>
  subtotal: number
  desconto: number
  total: number
  pagamentos: Array<{ forma: string; valor: number; data: string | null; detalhe: string }>
  totalPago: number
}

const FORMAS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_credito: 'Cartão de crédito',
  cartao_debito: 'Cartão de débito',
  transferencia: 'Transferência',
  consumo: 'Consumo interno',
}

export function rotuloFormaPagamento(forma?: string | null): string {
  const chave = (forma ?? '').trim()
  if (!chave) return 'Não informada'
  return FORMAS[chave] ?? chave
}

/** Consulta só emite recibo após o recebimento TOTAL (valor > 0 e pago >= valor). */
export function consultaQuitada(valorProcedimento?: number | null, totalPago?: number | null): boolean {
  const valor = Number(valorProcedimento ?? 0)
  const pago = Number(totalPago ?? 0)
  return valor > 0 && pago + 0.005 >= valor
}

/** Só venda convertida (concluída) emite recibo. */
export function vendaEmitiveis(status?: string | null): boolean {
  return /^(convert|conclu|finaliz)/i.test((status ?? '').trim())
}

export function numeroRecibo(tipo: ReciboTipo, ref: string): string {
  const base = ref.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase()
  return tipo === 'prescricao' ? `REC-${base}` : `REC-AG-${base}`
}
