import { type NextRequest, NextResponse } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { can, requirePermission } from '@/lib/authz'
import { validarCadastro, type RecursoCadastro } from '@/lib/cadastros'
import { authErrorResponse, getRequestAuth } from '@/lib/request-auth'

type Config = { tabela: string; colunas: string; ordem: string[]; leitura: string[] }

const CONFIG: Record<RecursoCadastro, Config> = {
  bancos: {
    tabela: 'bancos',
    colunas: 'id,codigo,nome,ativo',
    ordem: ['nome'],
    leitura: ['cadastros', 'gestao-bancaria'],
  },
  'categorias-dre': {
    tabela: 'dre_categorias',
    colunas: 'id,nome,tipo,linha_dre,ordem,ativo,sistema',
    ordem: ['tipo', 'ordem', 'nome'],
    leitura: ['cadastros', 'financeiro'],
  },
  'tipos-documento': {
    tabela: 'documento_tipos',
    colunas: 'id,nome,base,ordem,ativo,sistema',
    ordem: ['ordem', 'nome'],
    leitura: ['cadastros', 'documentacao'],
  },
}

async function resolver(context: { params: Promise<{ recurso: string }> }) {
  const { recurso } = await context.params
  return recurso in CONFIG ? { recurso: recurso as RecursoCadastro, config: CONFIG[recurso as RecursoCadastro] } : null
}

async function listar(config: Config, recurso: RecursoCadastro) {
  let query = getAppSupabase().from(config.tabela).select(config.colunas)
  for (const coluna of config.ordem) query = query.order(coluna, { ascending: true })
  const { data, error } = await query
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar cadastro')
  const linhas = (data ?? []) as unknown as Record<string, unknown>[]
  return NextResponse.json({
    data: linhas.map((row) => ({
      ...row,
      ...(recurso === 'categorias-dre' ? { linhaDre: row.linha_dre } : {}),
    })),
  })
}

export async function GET(request: NextRequest, context: { params: Promise<{ recurso: string }> }) {
  const alvo = await resolver(context)
  if (!alvo) return serverErrorResponse('Cadastro não encontrado', 'NOT_FOUND', 404)
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const permissoes = await Promise.all(alvo.config.leitura.map((recurso) => can(session.userId, recurso, 'read')))
  if (!permissoes.some(Boolean)) return serverErrorResponse('Acesso negado', 'FORBIDDEN', 403)
  return listar(alvo.config, alvo.recurso)
}

async function gravar(request: NextRequest, context: { params: Promise<{ recurso: string }> }, edicao: boolean) {
  const alvo = await resolver(context)
  if (!alvo) return serverErrorResponse('Cadastro não encontrado', 'NOT_FOUND', 404)
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'cadastros', edicao ? 'update' : 'create')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return serverErrorResponse('Requisição inválida', 'INVALID_BODY', 400)
  const validado = validarCadastro(alvo.recurso, body, edicao)
  if (!validado.ok) return serverErrorResponse(validado.error, validado.code, 400)

  const supabase = getAppSupabase()
  const { tabela } = alvo.config
  if (edicao) {
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return serverErrorResponse('Registro inválido', 'INVALID_ID', 400)
    const { error } = await supabase
      .from(tabela)
      .update({ ...validado.data, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return gravarErro(error)
  } else {
    const { error } = await supabase.from(tabela).insert(validado.data)
    if (error) return gravarErro(error)
  }
  return listar(alvo.config, alvo.recurso)
}

function gravarErro(error: { code?: string; message: string }) {
  if (error.code === '23505') return serverErrorResponse('Já existe um cadastro com esse nome', 'DUPLICATE', 409)
  return supabaseErrorResponse(error as never, 'Falha ao salvar cadastro')
}

export async function POST(request: NextRequest, context: { params: Promise<{ recurso: string }> }) {
  return gravar(request, context, false)
}

/** Edição e inativação/reativação (`ativo`): nada é apagado, o histórico dos lançamentos fica. */
export async function PUT(request: NextRequest, context: { params: Promise<{ recurso: string }> }) {
  return gravar(request, context, true)
}
