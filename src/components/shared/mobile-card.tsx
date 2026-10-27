import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface CampoCartao {
  rotulo: string
  valor: ReactNode
}

interface CartaoMobileProps {
  /** Linha principal (descrição, cliente). */
  titulo: ReactNode
  subtitulo?: ReactNode
  /** Valor em destaque, à direita do título. */
  valor?: ReactNode
  /** Situação (badge) exibida abaixo do título. */
  selo?: ReactNode
  /** Menu de ações (três pontinhos). */
  acoes?: ReactNode
  /** Demais colunas da tabela, em duas colunas. */
  campos?: CampoCartao[]
  className?: string
}

/**
 * Linha de tabela no celular: as colunas essenciais (título, valor, situação) ficam à vista
 * e o resto em pares rótulo/valor, sem rolagem lateral. Use dentro de <ListaCartoesMobile>.
 */
export function CartaoMobile({ titulo, subtitulo, valor, selo, acoes, campos = [], className }: CartaoMobileProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-app-border bg-app-card p-4 dark:border-app-border-dark dark:bg-app-card-dark',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm text-app-text-primary dark:text-white">{titulo}</p>
          {subtitulo && <p className="mt-0.5 break-words text-xs text-app-text-muted">{subtitulo}</p>}
        </div>
        {valor !== undefined && (
          <p className="shrink-0 text-right text-base tabular-nums text-app-text-primary dark:text-white">{valor}</p>
        )}
      </div>
      {(selo || acoes) && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="min-w-0">{selo}</div>
          {acoes}
        </div>
      )}
      {campos.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-app-border pt-3 text-xs dark:border-app-border-dark">
          {campos.map((campo) => (
            <div key={campo.rotulo} className="min-w-0">
              <dt className="text-app-text-muted">{campo.rotulo}</dt>
              <dd className="break-words text-app-text-secondary dark:text-white/80">{campo.valor}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

/** Container das linhas em cartão: só aparece abaixo de md (a tabela cobre o resto). */
export function ListaCartoesMobile({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('space-y-3 p-3 md:hidden', className)}>{children}</div>
}
