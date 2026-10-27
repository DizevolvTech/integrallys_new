import { type NextRequest, NextResponse } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { lerFiltrosContas } from '@/lib/financeiro-contas'
import {
  agruparPorForma,
  periodoEfetivo,
  resumirPeriodo,
  type SituacaoFinanceira,
} from '@/lib/financeiro-situacao'
import { hojeClinica } from '@/lib/recebimento-agendamento'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'
import { buscarContas } from './buscar-contas'

/**
 * GET /api/financeiro/contas?tipo=receita|despesa&de&ate&pessoa&formaId&situacao&categoriaId...
 * Lista as contas filtradas e os totais dos cards (liquidado / a vencer / atrasado).
 * Os cards seguem o período; sem período mostram o dia de hoje (atrasado: tudo o que venceu).
 * Com `detalhe=liquidado|a_vencer|atrasado` devolve os lançamentos do card, por forma de pagamento.
 */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'financeiro', 'read')
  if (denied) return denied

  const params = request.nextUrl.searchParams
  const filtros = lerFiltrosContas(params)
  if (!filtros) return serverErrorResponse('Tipo de conta inválido', 'INVALID_CONTAS_TIPO', 400)

  const scoped = await getScopedUnitId(session)
  if (scoped.error) return supabaseErrorResponse(scoped.error, 'Falha ao carregar contas')

  const hoje = hojeClinica()
  const ctx = { supabase: getAppSupabase(), unidadeId: scoped.unidadeId ?? null, hoje }
  const periodoInformado = Boolean(filtros.de || filtros.ate)
  const periodo = periodoEfetivo(filtros.de, filtros.ate, hoje)
  const semSituacao = { ...filtros, situacao: '' as const }

  // Linhas que compõem os cards: o período (ou hoje) e, sem período, também tudo o que já venceu.
  const linhasDosCards = async () => {
    const [noPeriodo, atrasadas] = await Promise.all([
      buscarContas(ctx, semSituacao, { de: periodo.de, ate: periodo.ate }),
      periodoInformado
        ? Promise.resolve(null)
        : buscarContas(ctx, semSituacao, { de: null, ate: null, soAtrasadas: true }),
    ])
    const erro = noPeriodo.error ?? atrasadas?.error ?? null
    const porId = new Map([...noPeriodo.itens, ...(atrasadas?.itens ?? [])].map((item) => [item.id, item]))
    return { erro, itens: [...porId.values()] }
  }

  const detalhe = params.get('detalhe')
  if (detalhe === 'liquidado' || detalhe === 'a_vencer' || detalhe === 'atrasado') {
    const { erro, itens } = await linhasDosCards()
    if (erro) return supabaseErrorResponse(erro, 'Falha ao carregar detalhamento')
    const doCard = itens.filter((item) => {
      if (item.situacao !== (detalhe as SituacaoFinanceira)) return false
      if (detalhe === 'atrasado') return periodoInformado ? item.dataReferencia <= periodo.ate : true
      return item.dataReferencia >= periodo.de && item.dataReferencia <= periodo.ate
    })
    return NextResponse.json({
      data: agruparPorForma(doCard),
      periodo: { ...periodo, informado: periodoInformado },
    })
  }

  const [lista, cards] = await Promise.all([
    buscarContas(ctx, filtros, { de: filtros.de, ate: filtros.ate }),
    linhasDosCards(),
  ])
  if (lista.error) return supabaseErrorResponse(lista.error, 'Falha ao carregar contas')
  if (cards.erro) return supabaseErrorResponse(cards.erro, 'Falha ao totalizar contas')

  return NextResponse.json({
    data: lista.itens,
    resumo: resumirPeriodo(cards.itens, periodo, hoje, periodoInformado),
    periodo: { ...periodo, informado: periodoInformado },
    hoje,
  })
}
