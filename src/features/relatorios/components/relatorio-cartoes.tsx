import type { CartaoTotal, ResumoLista } from '@/features/relatorios/relatorio-config'

const TOM: Record<NonNullable<CartaoTotal['tom']>, string> = {
  sucesso: 'text-[var(--app-success-text)]',
  alerta: 'text-[var(--app-warning-text)]',
  perigo: 'text-[var(--app-danger-text)]',
  neutro: 'text-app-text-primary dark:text-white',
}

const CAIXA = 'rounded-xl border border-app-border bg-app-bg-secondary/30 p-4 dark:border-app-border-dark dark:bg-app-hover'

interface CartoesProps {
  cartoes: CartaoTotal[]
  /** Quando informado, os cartões com `detalhe` viram botões que chamam esta função. */
  onAbrirDetalhe?: (cartao: CartaoTotal) => void
}

export function RelatorioCartoes({ cartoes, onAbrirDetalhe }: CartoesProps) {
  if (cartoes.length === 0) return null
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cartoes.map((c) => {
        const conteudo = (
          <>
            <p className="text-xs uppercase tracking-wider text-app-text-secondary">{c.label}</p>
            <p className={`mt-1 text-xl font-normal ${TOM[c.tom ?? 'neutro']}`}>{c.valor}</p>
            {c.detalhe && onAbrirDetalhe && <p className="mt-1 text-xs text-app-text-muted">Ver registros</p>}
          </>
        )
        if (c.detalhe && onAbrirDetalhe) {
          return (
            <button
              key={c.label}
              type="button"
              onClick={() => onAbrirDetalhe(c)}
              aria-label={`${c.label}: ${c.valor}. Ver registros`}
              className={`${CAIXA} text-left transition-colors hover:border-app-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-primary`}
            >
              {conteudo}
            </button>
          )
        }
        return (
          <div key={c.label} className={CAIXA}>
            {conteudo}
          </div>
        )
      })}
    </div>
  )
}

interface ResumosProps {
  resumos: ResumoLista[]
  /** Linhas com `chave` viram botões que chamam esta função. */
  onSelecionar?: (chave: string) => void
  /** Chave da linha em uso (destacada). */
  selecionada?: string | null
}

export function RelatorioResumos({ resumos, onSelecionar, selecionada }: ResumosProps) {
  const comDados = resumos.filter((r) => r.itens.length > 0 || r.vazio)
  if (comDados.length === 0) return null
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {comDados.map((r) => (
        <div key={r.titulo} className={`rounded-xl border border-app-border p-4 dark:border-app-border-dark${r.larga ? ' md:col-span-3' : ''}`}>
          <p className="mb-2 text-sm text-app-text-primary dark:text-white">{r.titulo}</p>
          {r.itens.length === 0 && <p className="text-sm text-app-text-muted">{r.vazio}</p>}
          <ul className="max-h-72 space-y-1 overflow-y-auto text-sm text-app-text-secondary dark:text-white/70">
            {r.itens.map((i, indice) => (
              <li key={`${i.nome}-${indice}`}>
                {i.chave && onSelecionar ? (
                  <button
                    type="button"
                    onClick={() => onSelecionar(i.chave as string)}
                    title="Clique para filtrar a lista por esta situação"
                    className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-lg px-2 py-1 text-left transition-colors hover:bg-app-bg-secondary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-primary dark:hover:bg-app-hover ${selecionada === i.chave ? 'bg-app-bg-secondary/60 ring-1 ring-app-primary/50 dark:bg-app-hover' : ''}`}
                  >
                    <span className="min-w-0 break-words">{i.nome}</span>
                    <span className="shrink-0 text-right">{i.valor}</span>
                  </button>
                ) : (
                  <div className="flex justify-between gap-3">
                    <span className="min-w-0 break-words">{i.nome}</span>
                    <span className="shrink-0 text-right">{i.valor}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
