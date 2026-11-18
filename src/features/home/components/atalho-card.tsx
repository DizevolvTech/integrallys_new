import Link from 'next/link'
import type { ReactNode } from 'react'

/** Envolve um card do início para ele funcionar como atalho (link ou, no especialista, abrir a janela de resumo) (pedido da cliente: "como se fosse um atalho"). */
export function AtalhoCard({ href, onClick, children, className = '' }: { href?: string | undefined; onClick?: (() => void) | undefined; children: ReactNode; className?: string }) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`block w-full rounded-integrallys-lg text-left outline-none transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-app-primary ${className}`}
      >
        {children}
      </button>
    )
  }
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
