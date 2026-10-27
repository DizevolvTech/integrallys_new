import type { CartaoTotal, ResumoLista } from '@/features/relatorios/relatorio-config'

const TOM: Record<NonNullable<CartaoTotal['tom']>, string> = {
  sucesso: 'text-[var(--app-success-text)]',
  alerta: 'text-[var(--app-warning-text)]',
  perigo: 'text-[var(--app-danger-text)]',
  neutro: 'text-app-text-primary dark:text-white',
}

export function RelatorioCartoes({ cartoes }: { cartoes: CartaoTotal[] }) {
  if (cartoes.length === 0) return null
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cartoes.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-app-border bg-app-bg-secondary/30 p-4 dark:border-app-border-dark dark:bg-app-hover"
        >
          <p className="text-xs uppercase tracking-wider text-app-text-secondary">{c.label}</p>
          <p className={`mt-1 text-xl font-normal ${TOM[c.tom ?? 'neutro']}`}>{c.valor}</p>
        </div>
      ))}
    </div>
  )
}

export function RelatorioResumos({ resumos }: { resumos: ResumoLista[] }) {
  const comDados = resumos.filter((r) => r.itens.length > 0)
  if (comDados.length === 0) return null
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {comDados.map((r) => (
        <div key={r.titulo} className="rounded-xl border border-app-border p-4 dark:border-app-border-dark">
          <p className="mb-2 text-sm text-app-text-primary dark:text-white">{r.titulo}</p>
          <ul className="space-y-1 text-sm text-app-text-secondary dark:text-white/70">
            {r.itens.map((i) => (
              <li key={i.nome} className="flex justify-between gap-3">
                <span className="truncate">{i.nome}</span>
                <span className="shrink-0">{i.valor}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
