'use client'

import { Pill } from 'lucide-react'
import { useAtendimentoHistorico } from '@/hooks/use-atendimento-historico'
import type { HistoricoItem } from '@/contexts/atendimento-context'

type Prescricao = HistoricoItem['prescricoes'][number]

/** Produtos e posologia de uma consulta anterior (uma linha por produto). */
export function ProdutosPosologiaLista({ prescricoes }: { prescricoes: Prescricao[] }) {
  if (prescricoes.length === 0) {
    return <p className="text-sm text-app-text-muted">Nenhum produto prescrito.</p>
  }
  return (
    <ul className="space-y-1.5">
      {prescricoes.map((item, idx) => (
        <li key={`${item.produto}-${idx}`} className="flex items-start gap-2 text-sm">
          <Pill className="mt-0.5 h-3.5 w-3.5 shrink-0 text-app-text-muted" />
          <span className="text-app-text-primary dark:text-white">
            {item.quantidade > 1 ? `${item.quantidade}× ` : ''}
            {item.produto}
            <span className="text-app-text-muted">
              {' — '}
              {item.posologia ? `Posologia: ${item.posologia}` : 'posologia não informada'}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Histórico de consultas do paciente com produtos e posologia dos meses anteriores (Prontuário). */
export function HistoricoConsultas({ pacienteId }: { pacienteId: string }) {
  const { data, isLoading, error } = useAtendimentoHistorico(pacienteId)

  return (
    <section className="space-y-3" aria-label="Histórico de consultas">
      <h3 className="text-base font-normal text-app-text-primary dark:text-white">
        Histórico de consultas ({data.length})
      </h3>
      {isLoading && <p className="text-sm text-app-text-muted">Carregando histórico…</p>}
      {error && <p className="text-sm text-[var(--app-danger-text)]">{error}</p>}
      {!isLoading && !error && data.length === 0 && (
        <p className="rounded-integrallys-lg border border-dashed border-app-border p-4 text-center text-sm text-app-text-muted dark:border-app-border-dark">
          Nenhuma consulta anterior registrada.
        </p>
      )}
      <div className="space-y-3">
        {data.map((consulta) => (
          <article
            key={consulta.date}
            className="space-y-3 rounded-integrallys-lg border border-app-border p-4 dark:border-app-border-dark"
          >
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-normal text-app-text-primary dark:text-white">
                {consulta.anamneseType === 'reconsulta' ? 'Reconsulta' : 'Consulta'} — {consulta.date}
              </p>
              <p className="text-sm text-app-text-muted">{consulta.doctor}</p>
            </header>
            {consulta.anamnese.queixa && (
              <p className="text-sm text-app-text-secondary dark:text-white/70">
                <span className="text-app-text-muted">Queixa: </span>
                {consulta.anamnese.queixa}
              </p>
            )}
            <div>
              <p className="mb-1 text-xs uppercase tracking-wider text-app-text-muted">
                Produtos e posologia
              </p>
              <ProdutosPosologiaLista prescricoes={consulta.prescricoes} />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
