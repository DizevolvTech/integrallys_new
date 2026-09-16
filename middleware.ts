import { NextResponse, type NextRequest } from 'next/server'

import { getAuthUser } from '@/lib/auth'

const PUBLIC = [
  '/login',
  '/api/auth/login',
  // Webhooks/cron: autenticação própria na rota (token/HMAC/lookup gateway).
  '/api/pagamentos/webhook',
  '/api/whatsapp/webhook',
  '/api/whatsapp/cron',
]

// Rotas de API liberadas quando o usuário está com `mustDefinePassword=true`.
// O fluxo de troca de senha precisa destas: `/me` para hidratar a sessão,
// `/password` para gravar a nova senha, `/logout` para sair. `/api/auth/login`
// já está em PUBLIC e short-circuita antes desta checagem.
const MUST_DEFINE_PASSWORD_API_ALLOWLIST = [
  '/api/auth/me',
  '/api/auth/password',
  '/api/auth/logout',
]

const PORTAL_ROUTES = new Map<string, string>([
  ['/', '/portal'],
  ['/agenda', '/portal/agenda'],
  ['/configuracoes', '/portal/configuracoes'],
  ['/historico', '/portal/historico'],
  ['/cartoes', '/portal/cartoes'],
  ['/novo-agendamento', '/portal/novo-agendamento'],
  ['/pagamentos', '/portal/pagamentos'],
  ['/prescricoes', '/portal/prescricoes'],
])

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (PUBLIC.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const user = await getAuthUser(request)
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  const headers = new Headers(request.headers)
  headers.set('x-user-id', user.id)
  headers.set('x-user-role', user.role)

  // Bloqueio de API para usuários com senha temporária — espelha o redirect
  // de UI logo abaixo (TAREFA-CR-REV-H cobriu só a camada de tela). Resposta
  // estruturada em JSON 403 para o cliente saber que precisa redirecionar.
  if (
    user.mustDefinePassword &&
    pathname.startsWith('/api/') &&
    !MUST_DEFINE_PASSWORD_API_ALLOWLIST.some((route) => pathname.startsWith(route))
  ) {
    return NextResponse.json(
      { error: 'Defina sua senha antes de continuar', code: 'PASSWORD_SETUP_REQUIRED' },
      { status: 403 },
    )
  }

  if (!pathname.startsWith('/api/')) {
    if (user.mustDefinePassword && pathname !== '/primeiro-acesso') {
      const url = request.nextUrl.clone()
      url.pathname = '/primeiro-acesso'
      return NextResponse.redirect(url)
    }

    if (!user.mustDefinePassword && pathname === '/primeiro-acesso') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }

    const isPortalNamespace = pathname === '/portal' || pathname.startsWith('/portal/')
    if (user.role === 'paciente') {
      if (!isPortalNamespace) {
        const portalPath = PORTAL_ROUTES.get(pathname)
        if (portalPath) {
          const url = request.nextUrl.clone()
          url.pathname = portalPath
          return NextResponse.redirect(url)
        }
      }
    } else if (isPortalNamespace) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
