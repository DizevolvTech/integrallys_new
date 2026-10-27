import { gerarParcelas, isIsoDate, type ParcelaGerada } from './financeiro-parcelas'

export type NovoLancamentoValidado = {
  emissao: string
  vencimento: string
  parcelas: ParcelaGerada[]
  numeroDocumento: string | null
  categoriaDreId: string | null
  vinculos: { pacienteId: string | null; profissionalId: string | null; procedimentoId: string | null }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function uuidOuNulo(valor: unknown): string | null {
  return typeof valor === 'string' && UUID.test(valor) ? valor : null
}

/**
 * Campos do "Novo recebimento" / "Nova despesa": emissão (hoje se vazia), vencimento
 * (igual à emissão se vazio), nº do documento, categoria de DRE, vínculos e parcelamento.
 * Quando há `numeroParcelas` > 1 o valor informado é o TOTAL e é dividido em parcelas mensais.
 */
export function validarNovoLancamento(
  body: Record<string, unknown>,
  hoje: string,
): { ok: true; data: NovoLancamentoValidado } | { ok: false; error: string; code: string } {
  const emissao = body.dataEmissao ? body.dataEmissao : hoje
  if (!isIsoDate(emissao)) return { ok: false, error: 'Data de emissão inválida', code: 'INVALID_EMISSAO' }
  const vencimento = body.vencimento ? body.vencimento : emissao
  if (!isIsoDate(vencimento)) return { ok: false, error: 'Data de vencimento inválida', code: 'INVALID_VENCIMENTO' }

  const solicitadas = body.numeroParcelas == null ? 1 : Number(body.numeroParcelas)
  if (!Number.isInteger(solicitadas) || solicitadas < 1 || solicitadas > 60) {
    return { ok: false, error: 'Número de parcelas inválido (1 a 60)', code: 'INVALID_PARCELAS' }
  }
  const valor = Number(body.valor)
  if (!Number.isFinite(valor) || valor <= 0) {
    return { ok: false, error: 'Valor inválido para lançamento', code: 'INVALID_FINANCEIRO_VALUE' }
  }

  const numeroDocumento =
    typeof body.numeroDocumento === 'string' && body.numeroDocumento.trim()
      ? body.numeroDocumento.trim().slice(0, 60)
      : null

  return {
    ok: true,
    data: {
      emissao,
      vencimento,
      parcelas: gerarParcelas({ valorTotal: valor, parcelas: solicitadas, primeiroVencimento: vencimento }),
      numeroDocumento,
      categoriaDreId: uuidOuNulo(body.categoriaDreId),
      vinculos: {
        pacienteId: uuidOuNulo(body.pacienteId),
        profissionalId: uuidOuNulo(body.profissionalId),
        procedimentoId: uuidOuNulo(body.procedimentoId),
      },
    },
  }
}
