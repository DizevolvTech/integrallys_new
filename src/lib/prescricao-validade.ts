import { addDaysIso } from './procedimento-retorno'

/** Prazo padrão de um orçamento (prescrição ativa sem pagamento): hoje + 7 dias. */
export const PRAZO_ORCAMENTO_DIAS = 7

export function validadePadraoOrcamento(hojeIso: string): string {
  return addDaysIso(hojeIso, PRAZO_ORCAMENTO_DIAS) ?? hojeIso
}

/** A validade do orçamento é uma data aaaa-mm-dd de hoje em diante. */
export function validadeOrcamentoValida(validade: string | null | undefined, hojeIso: string): boolean {
  return typeof validade === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(validade) && validade >= hojeIso
}
