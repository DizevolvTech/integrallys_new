import type { NextRequest } from 'next/server'
import { serverErrorResponse } from '@/lib/app-api'
import { executarRelatorio } from '@/lib/relatorios/executar'
import { isRelatorioTipo } from '@/lib/relatorios/registry'

export async function GET(request: NextRequest, context: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await context.params
  if (!isRelatorioTipo(tipo)) {
    return serverErrorResponse('Relatório não encontrado', 'REPORT_NOT_FOUND', 404)
  }
  return executarRelatorio(request, tipo)
}
