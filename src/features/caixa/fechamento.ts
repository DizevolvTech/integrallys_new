// Item 3 do feedback: fechamento de caixa com transferência de dinheiro ao cofre.
// Só o dinheiro físico vai ao cofre (PIX e cartão não passam pela gaveta).

export interface MovimentoCaixaLike {
  tipo: string
  valor: number
  forma?: string | null
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function isDinheiro(forma?: string | null): boolean {
  return !forma || forma === 'dinheiro'
}

export function calcularDinheiroNaGaveta(saldoInicial: number, movimentos: MovimentoCaixaLike[]): number {
  const delta = movimentos
    .filter((m) => isDinheiro(m.forma))
    .reduce((acc, m) => acc + (m.tipo === 'entrada' ? m.valor : m.tipo === 'saida' ? -m.valor : 0), 0)
  return round2(saldoInicial + delta)
}

// Ex.: abriu com 250, tem 550 em dinheiro -> sugere transferir 300 e deixar o troco de abertura.
export function sugerirTransferenciaCofre(saldoInicial: number, dinheiroNaGaveta: number): number {
  return round2(Math.max(0, dinheiroNaGaveta - saldoInicial))
}

export function validarTransferenciaCofre(valor: number, dinheiroNaGaveta: number): string | null {
  if (!Number.isFinite(valor) || valor < 0) return 'O valor transferido não pode ser negativo.'
  if (round2(valor) > round2(Math.max(0, dinheiroNaGaveta))) {
    return 'O valor transferido ao cofre não pode ser maior que o dinheiro em caixa.'
  }
  return null
}
