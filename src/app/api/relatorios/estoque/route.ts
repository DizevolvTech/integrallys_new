import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { perfilPodeVerRelatorio } from '@/lib/relatorios/registry'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth } from '@/lib/request-auth'

export interface CurvaAbcItem {
  produtoId: string
  produtoNome: string
  categoria: string
  quantidadeSaida: number
  valorConsumido: number
  percentualAcumulado: number
  classe: 'A' | 'B' | 'C'
  taxaGiro: number
  estoqueAtual: number
  valorEstoque: number
}

async function listCurvaAbc(request: NextRequest) {
  const url = new URL(request.url)
  const diasParam = Number(url.searchParams.get('dias') ?? '90')
  const dias = Number.isFinite(diasParam) && diasParam > 0 && diasParam <= 730 ? Math.floor(diasParam) : 90

  const supabase = getAppSupabase()
  const hoje = new Date()
  const inicio = new Date(hoje)
  inicio.setDate(inicio.getDate() - dias)
  const inicioIso = inicio.toISOString()
  const hojeIso = hoje.toISOString()

  const { data: produtosRows, error: produtosError } = await supabase
    .from('produtos_estoque')
    .select('id,nome,categoria,quantidade,preco_custo')

  if (produtosError) return supabaseErrorResponse(produtosError, 'Falha ao carregar produtos')

  const produtosMap = new Map<
    string,
    { id: string; nome: string; categoria: string; quantidade: number; precoCusto: number }
  >()
  for (const row of produtosRows ?? []) {
    produtosMap.set(String(row.id), {
      id: String(row.id),
      nome: String(row.nome ?? ''),
      categoria: String(row.categoria ?? ''),
      quantidade: Number(row.quantidade ?? 0),
      precoCusto: Number(row.preco_custo ?? 0),
    })
  }

  const { data: saidasRows, error: saidasError } = await supabase
    .from('movimentacoes_estoque')
    .select('produto_id,quantidade,tipo,tipo_movimentacao,created_at')
    .in('tipo_movimentacao', ['saida', 'consumo_interno'])
    .gte('created_at', inicioIso)
    .lte('created_at', hojeIso)
    .limit(20000)

  if (saidasError) return supabaseErrorResponse(saidasError, 'Falha ao carregar movimentações para Curva ABC')

  const consumosPorProduto = new Map<string, number>()
  const ultimaSaidaPorProduto = new Map<string, string>()
  for (const row of saidasRows ?? []) {
    const produtoId = String(row.produto_id ?? '')
    if (!produtoId) continue
    const qty = Number(row.quantidade ?? 0)
    consumosPorProduto.set(produtoId, (consumosPorProduto.get(produtoId) ?? 0) + qty)
    const createdAt = row.created_at ? String(row.created_at) : ''
    const prev = ultimaSaidaPorProduto.get(produtoId)
    if (!prev || createdAt > prev) ultimaSaidaPorProduto.set(produtoId, createdAt)
  }

  const computed = Array.from(produtosMap.values()).map((produto) => {
    const quantidadeSaida = consumosPorProduto.get(produto.id) ?? 0
    const valorConsumido = quantidadeSaida * produto.precoCusto
    const estoqueAtual = produto.quantidade
    const valorEstoque = estoqueAtual * produto.precoCusto
    const estoqueMedio = (estoqueAtual + quantidadeSaida + estoqueAtual) / 2
    const taxaGiro = estoqueMedio > 0 ? quantidadeSaida / estoqueMedio : 0
    return {
      produto,
      quantidadeSaida,
      valorConsumido,
      estoqueAtual,
      valorEstoque,
      taxaGiro,
    }
  })

  const comConsumo = computed
    .filter((row) => row.valorConsumido > 0)
    .sort((a, b) => b.valorConsumido - a.valorConsumido)

  const totalConsumo = comConsumo.reduce((acc, row) => acc + row.valorConsumido, 0)
  let acumulado = 0
  const curvaAbc: CurvaAbcItem[] = comConsumo.map((row) => {
    acumulado += row.valorConsumido
    const percentualAcumulado = totalConsumo > 0 ? (acumulado / totalConsumo) * 100 : 0
    const classe: 'A' | 'B' | 'C' = percentualAcumulado <= 80 ? 'A' : percentualAcumulado <= 95 ? 'B' : 'C'
    return {
      produtoId: row.produto.id,
      produtoNome: row.produto.nome,
      categoria: row.produto.categoria,
      quantidadeSaida: row.quantidadeSaida,
      valorConsumido: Number(row.valorConsumido.toFixed(2)),
      percentualAcumulado: Number(percentualAcumulado.toFixed(2)),
      classe,
      taxaGiro: Number(row.taxaGiro.toFixed(2)),
      estoqueAtual: row.estoqueAtual,
      valorEstoque: Number(row.valorEstoque.toFixed(2)),
    }
  })

  const semMovimentacao = computed
    .filter((row) => row.quantidadeSaida === 0)
    .map((row) => {
      const ultima = ultimaSaidaPorProduto.get(row.produto.id)
      const diasSemMovimento = ultima
        ? Math.max(dias, Math.floor((hoje.getTime() - new Date(ultima).getTime()) / (1000 * 60 * 60 * 24)))
        : dias
      return {
        produtoId: row.produto.id,
        produtoNome: row.produto.nome,
        diasSemMovimento,
      }
    })
    .sort((a, b) => b.diasSemMovimento - a.diasSemMovimento)
    .slice(0, 50)

  const valorTotalEstoque = computed.reduce((acc, row) => acc + row.valorEstoque, 0)

  return NextResponse.json({
    curvaAbc,
    semMovimentacao,
    valorTotalEstoque: Number(valorTotalEstoque.toFixed(2)),
    diasAnalisados: dias,
  })
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'relatorios', 'read')
  if (denied) return denied

  if (!perfilPodeVerRelatorio(session.role, 'estoque-posicao')) {
    return serverErrorResponse('Acesso negado', 'FORBIDDEN', 403)
  }
  return listCurvaAbc(request)
}
