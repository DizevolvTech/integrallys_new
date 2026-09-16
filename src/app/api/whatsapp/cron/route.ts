import { NextResponse, type NextRequest } from 'next/server'
import {
  processarCampanhas,
  processarPendentes,
} from '@/app/api/whatsapp/disparar/route'
import { serverErrorResponse } from '@/lib/app-api'

/**
 * Endpoint de cron para processar a fila de disparos de WhatsApp.
 * Sem autenticação de sessão — protegido pelo header `x-cron-secret`,
 * que deve bater com a env `CRON_SECRET`.
 *
 * Configurar para chamar a cada ~15 min (Vercel Cron ou cron externo).
 * Ver README.md → "Cron de disparos WhatsApp".
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return serverErrorResponse('CRON_SECRET não configurado', 'CRON_SECRET_MISSING', 500)
  }

  const provided = request.headers.get('x-cron-secret')
  if (provided !== secret) {
    return serverErrorResponse('Não autorizado', 'CRON_UNAUTHORIZED', 401)
  }

  const pendentes = await processarPendentes()
  // CR-WPP-03 · item 6.3: dispara campanhas agendadas (Natal, Páscoa etc.)
  // após drenar a fila de pendentes. Falhas internas não bloqueiam o cron.
  const campanhas = await processarCampanhas()
  return NextResponse.json({ pendentes, campanhas })
}
