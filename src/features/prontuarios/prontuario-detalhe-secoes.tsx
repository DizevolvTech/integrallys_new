import { ClipboardList, MessageSquare, Pill, Stethoscope } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ProntuarioDetalhe } from '@/lib/domain-mappers'

function Secao({
  titulo,
  icone,
  vazio,
  children,
}: {
  titulo: string
  icone: ReactNode
  vazio: string
  children?: ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-app-bg-secondary p-1.5 dark:bg-app-table-header-dark">
          {icone}
        </div>
        <h3 className="text-base font-normal text-app-text-primary dark:text-white">{titulo}</h3>
      </div>
      <div className="rounded-integrallys-lg border border-app-border/50 bg-app-bg-secondary/50 p-5 dark:border-app-border-dark dark:bg-app-table-header-dark">
        {children ?? <p className="text-sm font-normal italic text-app-text-muted">{vazio}</p>}
      </div>
    </div>
  )
}

function Texto({ valor }: { valor: string }) {
  return (
    <p className="whitespace-pre-line break-words text-sm font-normal text-app-text-primary dark:text-white">
      {valor}
    </p>
  )
}

const icone = 'h-4 w-4 text-app-primary dark:text-white'

/** Queixa, diagnóstico, observações e demais campos gravados no atendimento (ou aviso de vazio). */
export function ProntuarioDetalheSecoes({ detalhe }: { detalhe?: ProntuarioDetalhe }) {
  const d = detalhe
  return (
    <>
      <Secao
        titulo="Queixa principal"
        icone={<MessageSquare className={icone} />}
        vazio="Sem registro de queixa principal."
      >
        {d?.queixa ? <Texto valor={d.queixa} /> : undefined}
      </Secao>
      <Secao titulo="Diagnóstico" icone={<Stethoscope className={icone} />} vazio="Em avaliação.">
        {d?.diagnostico ? <Texto valor={d.diagnostico} /> : undefined}
      </Secao>
      <Secao
        titulo="Observações e conduta"
        icone={<ClipboardList className={icone} />}
        vazio="Sem observações registradas."
      >
        {d?.observacoes || d?.plano ? (
          <div className="space-y-3">
            {d.observacoes && <Texto valor={d.observacoes} />}
            {d.plano && (
              <div>
                <p className="text-xs uppercase tracking-wider text-app-text-muted">
                  Indicação de tratamento
                </p>
                <Texto valor={d.plano} />
              </div>
            )}
          </div>
        ) : undefined}
      </Secao>
      {d && (d.alergias || d.medicamentos || d.historicos.length > 0) && (
        <Secao titulo="Histórico de saúde informado" icone={<Pill className={icone} />} vazio="">
          <ul className="space-y-1 text-sm text-app-text-primary dark:text-white">
            {d.alergias && (
              <li>
                <span className="text-app-text-muted">Alergias: </span>
                {d.alergias}
              </li>
            )}
            {d.medicamentos && (
              <li>
                <span className="text-app-text-muted">Medicamentos em uso: </span>
                {d.medicamentos}
              </li>
            )}
            {d.historicos.map((h) => (
              <li key={h.label}>
                <span className="text-app-text-muted">{h.label}: </span>
                {h.value}
              </li>
            ))}
          </ul>
        </Secao>
      )}
    </>
  )
}
