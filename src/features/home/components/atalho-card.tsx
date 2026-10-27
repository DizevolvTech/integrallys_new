import Link from 'next/link'
import type { ReactNode } from 'react'

/** Envolve um card do início para ele funcionar como atalho (pedido da cliente: "como se fosse um atalho"). */
export function AtalhoCard({ href, children, className = '' }: { href?: string | undefined; children: ReactNode; className?: string }) {
  if (!href) return <>{children}</>
  return (
    <Link
      href={href}
      className={`block rounded-integrallys-lg outline-none transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-app-primary ${className}`}
    >
      {children}
    </Link>
  )
}
