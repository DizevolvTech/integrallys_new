/** Regras puras do estorno de recebimento do agendamento (a gravação atômica é a função SQL 160). */

export const MOTIVO_ESTORNO_MIN = 10

export type PagamentoEstornavel = {
  id: string
  valor: number
  status: string
  estornadoEm: string | null
}

export function validarMotivoEstorno(motivo: unknown): { ok: true; motivo: string } | { ok: false; message: string } {
  const texto = typeof motivo === 'string' ? motivo.trim() : ''
  if (texto.length < MOTIVO_ESTORNO_MIN) {
    return { ok: false, message: `Informe o motivo do estorno (mínimo de ${MOTIVO_ESTORNO_MIN} caracteres).` }
  }
  return { ok: true, motivo: texto.slice(0, 300) }
}

/** Só recebimento pago e ainda não estornado pode ser estornado. */
export function podeEstornarPagamento(p: PagamentoEstornavel): boolean {
  return p.status === 'Pago' && !p.estornadoEm && p.valor > 0
}

const MENSAGENS: Record<string, { status: number; message: string }> = {
  INVALID_ESTORNO_MOTIVO: { status: 400, message: 'Informe o motivo do estorno (mínimo de 10 caracteres).' },
  PAGAMENTO_NOT_FOUND: { status: 404, message: 'Recebimento não encontrado.' },
  PAGAMENTO_ALREADY_REVERSED: { status: 409, message: 'Este recebimento já foi estornado.' },
  PAGAMENTO_NOT_PAID: { status: 409, message: 'Só é possível estornar um recebimento pago.' },
  CAIXA_FECHADO: { status: 409, message: 'O caixa de hoje não está aberto. Abra o caixa para registrar a saída do estorno.' },
  CAIXA_SALDO_INSUFICIENTE: {
    status: 409,
    message: 'Não há dinheiro suficiente no caixa para devolver este valor (já foi transferido ao cofre ou retirado).',
  },
}

/** Traduz o código devolvido pela função SQL em status HTTP e mensagem em português. */
export function respostaErroEstorno(code: unknown, fallback?: unknown): { status: number; code: string; message: string } {
  const chave = typeof code === 'string' ? code : 'ESTORNO_FALHOU'
  const conhecido = MENSAGENS[chave]
  if (conhecido) return { ...conhecido, code: chave }
  return { status: 500, code: chave, message: typeof fallback === 'string' && fallback ? fallback : 'Não foi possível estornar o recebimento.' }
}

/** Resumo do estorno devolvido ao cliente: `saidaCaixa` diz se houve saída no caixa. */
export function resumirResultadoEstorno(resultado: Record<string, unknown>): { saidaCaixa: boolean; lancamentoEstornado: boolean } {
  return {
    saidaCaixa: typeof resultado.caixa_movimento_id === 'string' && resultado.caixa_movimento_id.length > 0,
    lancamentoEstornado: resultado.lancamento_estornado === true,
  }
}

/** Mensagem de sucesso fiel ao que aconteceu no caixa. */
export function mensagemEstornoConcluido(saidaCaixa: boolean): string {
  return saidaCaixa
    ? 'Recebimento estornado. O valor saiu do caixa e o saldo do agendamento voltou a ficar em aberto.'
    : 'Recebimento estornado. Ele não tinha entrado no caixa, então nada saiu do caixa. O saldo do agendamento voltou a ficar em aberto.'
}
