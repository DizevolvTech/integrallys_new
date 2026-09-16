import { redirect } from 'next/navigation'
import { CartoesEmpresariaisView } from '@/features/cartoes-empresariais'
import { CartoesView } from '@/features/portal-paciente'
import { getServerAuthPayload } from '@/lib/server-auth'

export default async function Page() {
  const payload = await getServerAuthPayload()

  // Sidebar vem do backend — porta vs staff sem checar role string.
  if (payload?.sidebarItems.some((item) => item.href === '/portal/cartoes')) {
    return <CartoesView />
  }

  const hasAccess = payload?.sidebarItems.some((item) => item.href === '/cartoes')
  if (!hasAccess) {
    redirect('/')
  }

  return <CartoesEmpresariaisView />
}
