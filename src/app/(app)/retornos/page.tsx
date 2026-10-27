import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/shared/page-header'
import { RetornosRelatorio } from '@/features/retornos'
import { getServerAuthPayload } from '@/lib/server-auth'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ situacao?: string }>
}) {
  const payload = await getServerAuthPayload()
  if (!payload?.sidebarItems.some((item) => item.href === '/retornos')) {
    redirect('/')
  }
  const { situacao } = await searchParams

  return (
    <div className="app-page">
      <PageHeader
        title="Retornos"
        description="Clientes com retorno a agendar, pelo prazo definido no fim do atendimento."
      />
      <RetornosRelatorio situacaoInicial={situacao} />
    </div>
  )
}
