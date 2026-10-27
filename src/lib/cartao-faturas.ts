import { adicionarMeses, gerarParcelas } from './financeiro-parcelas'

export type MovimentoCartaoBase = {
  id: string
  descricao: string
  beneficiario: string | null
  valor: number
  parcelas: number
  dataCompra: string
}

export type ParcelaCartao = {
  movimentoId: string
  descricao: string
  beneficiario: string | null
  numero: number
  total: number
  valor: number
  vencimento: string
}

export type FaturaCartao = {
  /** AAAA-MM do vencimento. */
  mes: string
  vencimento: string
  total: number
  aberta: boolean
  itens: ParcelaCartao[]
}

/** Dia do vencimento no mês da data informada (limitado ao último dia do mês). */
function comDia(iso: string, dia: number): string {
  const primeiro = `${iso.slice(0, 7)}-01`
  const ultimo = adicionarMeses(primeiro, 1)
  const ultimoDia = new Date(`${ultimo}T00:00:00Z`)
  ultimoDia.setUTCDate(0)
  const limite = ultimoDia.getUTCDate()
  return `${iso.slice(0, 7)}-${String(Math.min(dia, limite)).padStart(2, '0')}`
}

/**
 * A compra parcelada cai nas faturas dos meses seguintes: a 1ª parcela vence no mês
 * seguinte à compra (no dia de vencimento do cartão) e cada parcela vai para o mês depois.
 */
export function parcelasDoMovimento(
  mov: MovimentoCartaoBase,
  diaVencimento: number | null,
): ParcelaCartao[] {
  const mesSeguinte = adicionarMeses(`${mov.dataCompra.slice(0, 7)}-01`, 1)
  const dia = diaVencimento ?? Number(mov.dataCompra.slice(8, 10))
  const primeiroVencimento = comDia(mesSeguinte, dia)
  return gerarParcelas({
    valorTotal: mov.valor,
    parcelas: mov.parcelas,
    primeiroVencimento: comDia(primeiroVencimento, dia),
  }).map((parcela, index) => ({
    movimentoId: mov.id,
    descricao: mov.descricao,
    beneficiario: mov.beneficiario,
    numero: parcela.numero,
    total: parcela.total,
    valor: parcela.valor,
    vencimento: index === 0 ? primeiroVencimento : comDia(parcela.vencimento, dia),
  }))
}

export function montarFaturas(parcelas: ParcelaCartao[], hoje: string): FaturaCartao[] {
  const porMes = new Map<string, FaturaCartao>()
  for (const parcela of parcelas) {
    const mes = parcela.vencimento.slice(0, 7)
    const fatura = porMes.get(mes) ?? {
      mes,
      vencimento: parcela.vencimento,
      total: 0,
      aberta: parcela.vencimento >= hoje,
      itens: [],
    }
    fatura.total = Math.round((fatura.total + parcela.valor) * 100) / 100
    fatura.itens.push(parcela)
    porMes.set(mes, fatura)
  }
  return [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes))
}

export function resumoLimite(limiteTotal: number, faturas: FaturaCartao[]) {
  const utilizado = Math.round(faturas.filter((f) => f.aberta).reduce((s, f) => s + f.total, 0) * 100) / 100
  return {
    utilizado,
    disponivel: Math.round((limiteTotal - utilizado) * 100) / 100,
    proximoVencimento: faturas.find((f) => f.aberta)?.vencimento ?? null,
  }
}
