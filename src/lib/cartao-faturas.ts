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
  fechamento: string
}

export type StatusFatura = 'paga' | 'fechada' | 'aberta'

export type FaturaCartao = {
  /** AAAA-MM do vencimento. */
  mes: string
  vencimento: string
  fechamento: string
  total: number
  status: StatusFatura
  itens: ParcelaCartao[]
}

type Ciclo = { fechamento: string; vencimento: string }

/** Dia do mês da data informada (limitado ao último dia do mês). */
function comDia(iso: string, dia: number): string {
  const primeiro = `${iso.slice(0, 7)}-01`
  const ultimo = adicionarMeses(primeiro, 1)
  const ultimoDia = new Date(`${ultimo}T00:00:00Z`)
  ultimoDia.setUTCDate(0)
  const limite = ultimoDia.getUTCDate()
  return `${iso.slice(0, 7)}-${String(Math.min(dia, limite)).padStart(2, '0')}`
}

const primeiroDoMes = (iso: string) => `${iso.slice(0, 7)}-01`

/** Sem dia de fechamento cadastrado, assume-se fechamento 7 dias antes do vencimento. */
export function diaFechamentoEfetivo(diaFechamento: number | null, diaVencimento: number): number {
  return diaFechamento ?? ((diaVencimento - 8 + 30) % 30) + 1
}

/**
 * Fatura em que a compra cai: compras até o dia de fechamento entram na fatura que fecha neste
 * mês; depois dele, na seguinte. O vencimento é o primeiro dia de vencimento depois do fechamento.
 * Cartão sem dia de vencimento: vence no mês seguinte, no dia da compra (e fecha nesse dia).
 */
export function cicloDaCompra(
  dataCompra: string,
  diaFechamento: number | null,
  diaVencimento: number | null,
): Ciclo {
  const mesCompra = primeiroDoMes(dataCompra)
  if (diaVencimento == null) {
    const vencimento = comDia(adicionarMeses(mesCompra, 1), Number(dataCompra.slice(8, 10)))
    return { fechamento: vencimento, vencimento }
  }
  const dia = diaFechamentoEfetivo(diaFechamento, diaVencimento)
  const mesFechamento = dataCompra <= comDia(mesCompra, dia) ? mesCompra : adicionarMeses(mesCompra, 1)
  return {
    fechamento: comDia(mesFechamento, dia),
    vencimento: comDia(diaVencimento > dia ? mesFechamento : adicionarMeses(mesFechamento, 1), diaVencimento),
  }
}

/** A compra parcelada cai uma parcela por fatura: a 1ª na fatura do ciclo da compra, as demais nos meses seguintes. */
export function parcelasDoMovimento(
  mov: MovimentoCartaoBase,
  diaVencimento: number | null,
  diaFechamento: number | null = null,
): ParcelaCartao[] {
  const ciclo = cicloDaCompra(mov.dataCompra, diaFechamento, diaVencimento)
  const diaFech = Number(ciclo.fechamento.slice(8, 10))
  const diaVenc = Number(ciclo.vencimento.slice(8, 10))
  return gerarParcelas({
    valorTotal: mov.valor,
    parcelas: mov.parcelas,
    primeiroVencimento: ciclo.vencimento,
  }).map((parcela, index) => ({
    movimentoId: mov.id,
    descricao: mov.descricao,
    beneficiario: mov.beneficiario,
    numero: parcela.numero,
    total: parcela.total,
    valor: parcela.valor,
    vencimento: index === 0 ? ciclo.vencimento : comDia(parcela.vencimento, diaVenc),
    fechamento: comDia(adicionarMeses(primeiroDoMes(ciclo.fechamento), index), diaFech),
  }))
}

export function montarFaturas(
  parcelas: ParcelaCartao[],
  hoje: string,
  mesesPagos: ReadonlySet<string> = new Set(),
): FaturaCartao[] {
  const porMes = new Map<string, FaturaCartao>()
  for (const parcela of parcelas) {
    const mes = parcela.vencimento.slice(0, 7)
    const fatura = porMes.get(mes) ?? {
      mes,
      vencimento: parcela.vencimento,
      fechamento: parcela.fechamento,
      total: 0,
      status: mesesPagos.has(mes) ? 'paga' : hoje > parcela.fechamento ? 'fechada' : 'aberta',
      itens: [],
    }
    fatura.total = Math.round((fatura.total + parcela.valor) * 100) / 100
    fatura.itens.push(parcela)
    porMes.set(mes, fatura)
  }
  return [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes))
}

const emAberto = (fatura: FaturaCartao) => fatura.status !== 'paga'

/** "Em aberto" = tudo que ainda não foi pago (fechado ou não); fatura atual = a próxima a vencer. */
export function resumoLimite(limiteTotal: number, faturas: FaturaCartao[]) {
  const pendentes = faturas.filter(emAberto)
  const utilizado = Math.round(pendentes.reduce((s, f) => s + f.total, 0) * 100) / 100
  const atual = pendentes[0] ?? null
  return {
    utilizado,
    disponivel: Math.round((limiteTotal - utilizado) * 100) / 100,
    proximoVencimento: atual?.vencimento ?? null,
    faturaAtual: atual,
  }
}

/** Todas as faturas de um cartão a partir das compras (cada compra vira uma parcela por fatura). */
export function faturasDoCartao(
  compras: MovimentoCartaoBase[],
  cartao: { diaVencimento: number | null; diaFechamento: number | null },
  hoje: string,
  mesesPagos: ReadonlySet<string> = new Set(),
): FaturaCartao[] {
  const parcelas = compras.flatMap((compra) =>
    parcelasDoMovimento(compra, cartao.diaVencimento, cartao.diaFechamento),
  )
  return montarFaturas(parcelas, hoje, mesesPagos)
}
