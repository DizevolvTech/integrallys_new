import { Suspense } from 'react'
import { ReagendarView } from '@/features/portal-paciente'

export default function Page() {
  return (
    <Suspense fallback={<p className="app-page text-app-text-secondary">Carregando...</p>}>
      <ReagendarView />
    </Suspense>
  )
}
