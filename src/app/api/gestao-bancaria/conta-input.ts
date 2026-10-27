// Validação/normalização da criação de conta/caixa (lógica pura, testável).
// 'dinheiro' = caixa/cofre sem dados bancários (migration 080). Os demais tipos
// continuam exigindo banco — não afrouxa contas bancárias.

export type ContaTipo = 'corrente' | 'poupanca' | 'investimento' | 'dinheiro'

export function normalizeContaTipo(raw: unknown): ContaTipo {
  return raw === 'poupanca' || raw === 'investimento' || raw === 'dinheiro' ? raw : 'corrente'
}

export interface ContaInputValue {
  nome: string
  tipo: ContaTipo
  banco: string | null
  bancoId?: string
  agencia: string | null
  conta: string | null
  saldoInicial: number
  ativo: boolean
}

export type ContaInputResult =
  | { ok: true; value: ContaInputValue }
  | { ok: false; error: string; code: string }

export function validateContaInput(body: Record<string, unknown>): ContaInputResult {
  const nome = String(body.nome ?? '').trim()
  if (!nome) {
    return { ok: false, error: 'Nome da conta é obrigatório', code: 'NOME_REQUIRED' }
  }

  const tipo = normalizeContaTipo(body.tipo)
  const isDinheiro = tipo === 'dinheiro'

  // Backend leniente (comportamento original): só `nome` é obrigatório. Dados
  // bancários são opcionais para todos os tipos. O único gate é o de 'dinheiro',
  // que nunca persiste banco/agência/conta (abaixo).
  const banco = body.banco ? String(body.banco).trim() : ''
  const agencia = body.agencia ? String(body.agencia).trim() : ''
  const conta = body.conta ? String(body.conta).trim() : ''

  const saldoRaw = Number(body.saldoInicial ?? 0)
  const saldoInicial = Number.isFinite(saldoRaw) ? saldoRaw : 0

  return {
    ok: true,
    value: {
      nome,
      tipo,
      // 'dinheiro' nunca persiste dados bancários, mesmo se vierem no body.
      banco: isDinheiro ? null : banco || null,
      // Banco escolhido no cadastro de bancos (o nome é resolvido no servidor).
      ...(!isDinheiro && typeof body.bancoId === 'string' && /^[0-9a-f-]{36}$/i.test(body.bancoId)
        ? { bancoId: body.bancoId }
        : {}),
      agencia: isDinheiro ? null : agencia || null,
      conta: isDinheiro ? null : conta || null,
      saldoInicial,
      ativo: body.ativo !== false,
    },
  }
}
