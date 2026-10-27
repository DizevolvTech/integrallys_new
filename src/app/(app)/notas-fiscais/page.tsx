import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/shared/page-header'
import { NotasFiscaisView } from '@/features/notas-fiscais/notas-fiscais-view'
import { getServerAuthPayload } from '@/lib/server-auth'

const PERFIS = ['master', 'admin', 'gestor']

export default async function Page() {
  const payload = await getServerAuthPayload()
  if (!payload || !PERFIS.includes(payload.user.role)) redirect('/')

  return (
    <div className="app-page">
      <PageHeader
        title="Notas fiscais (pedidos)"
        description="Pedidos de nota fiscal feitos a partir do recibo da venda ou da consulta. A emissão da nota é feita fora do sistema."
      />
      <NotasFiscaisView />
    </div>
  )
}
