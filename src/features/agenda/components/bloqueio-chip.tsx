import { Lock } from 'lucide-react'
import { corDoTipoBloqueio, rotuloHorarioBloqueio } from '../bloqueios.utils'
import type { AgendaBloqueio } from '../hooks/use-agenda-bloqueios'

/** Bloqueio compacto (semana e mês): cor e etiqueta pelo tipo, profissional e horário. */
export function BloqueioChip({
  bloqueio,
  profissionalNome,
  compacto = false,
}: {
  bloqueio: AgendaBloqueio
  profissionalNome?: string | null
  compacto?: boolean
}) {
  const cor = corDoTipoBloqueio(bloqueio.tipo)
  const quem = profissionalNome ?? 'Todos profissionais'
  const detalhe = `${bloqueio.tipo} · ${quem} · ${rotuloHorarioBloqueio(bloqueio)}${bloqueio.justificativa ? ` · ${bloqueio.justificativa}` : ''}`

  if (compacto) {
    return (
      <div
        title={detalhe}
        className={`flex items-center gap-1 truncate rounded-full px-2 py-1 text-xs ${cor.chip}`}
      >
        <Lock className="h-3 w-3 shrink-0" />
        <span className="truncate">{bloqueio.tipo}</span>
      </div>
    )
  }

  return (
    <div title={detalhe} className={`space-y-1 rounded-[8px] border p-3 ${cor.card}`}>
      <div className="flex items-center gap-2">
        <Lock className={`h-3 w-3 shrink-0 ${cor.text}`} />
        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${cor.chip}`}>{bloqueio.tipo}</span>
      </div>
      <p className={`text-xs ${cor.text}`}>{rotuloHorarioBloqueio(bloqueio)}</p>
      <p className={`text-xs ${cor.text}`}>{quem}</p>
    </div>
  )
}
