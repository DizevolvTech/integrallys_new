import Link from 'next/link'
import { Button } from '@/components/ui/button'

/** O relatório de Retornos tem página própria (/retornos), com filtros por prazo. */
export function RetornosAtalho() {
  return (
    <div className="space-y-3 rounded-xl border border-app-border p-6 dark:border-app-border-dark">
      <p className="text-sm text-app-text-secondary dark:text-white/70">
        O controle de retornos (no prazo, limite de prazo e prazo vencido) fica em uma página própria.
      </p>
      <Button asChild className="rounded-xl bg-app-primary text-white hover:bg-app-primary-hover">
        <Link href="/retornos">Abrir relatório de retornos</Link>
      </Button>
    </div>
  )
}
