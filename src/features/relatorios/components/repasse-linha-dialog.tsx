'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatData, formatMoeda, formatPct } from '@/features/relatorios/format'
import type { LinhaRelatorio } from '@/features/relatorios/hooks/use-relatorio-tabela'

const EXPLICACAO: Record<string, string> = {
  Pago: 'O repasse deste atendimento já foi pago ao profissional (módulo Repasse).',
  'Em aberto': 'O paciente já pagou o atendimento; o repasse ao profissional ainda não foi pago.',
  Pendente: 'O paciente ainda não pagou o atendimento por inteiro; o repasse só fica em aberto depois do pagamento.',
}

const texto = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))

/** Janela com a conta do repasse de um atendimento (clique na linha de Meus repasses). */
export function RepasseLinhaDialog({ linha, onClose }: { linha: LinhaRelatorio | null; onClose: () => void }) {
  if (!linha) return null
  const atendido = linha.situacao === 'Atendido'
  const semPercentual = Boolean(linha.semRegra)
  const situacao = String(linha.situacaoRepasse ?? '')
  const campos: Array<[string, string]> = [
    ['Cliente', texto(linha.paciente)],
    ['Data', formatData(linha.data)],
    ['Procedimento', texto(linha.procedimento)],
    ['Profissional', texto(linha.profissional)],
    ['Unidade', texto(linha.unidade)],
    ['Atendimento', texto(linha.situacao)],
    ['Valor do atendimento', formatMoeda(linha.valor)],
    ['Já pago pelo paciente', formatMoeda(linha.pago)],
    ['Percentual de repasse', semPercentual ? 'Percentual não cadastrado' : linha.percentual == null ? '—' : formatPct(linha.percentual)],
    ['Valor do repasse', !atendido ? '—' : semPercentual ? 'Percentual não cadastrado' : formatMoeda(linha.repasse)],
    ['Situação do repasse', situacao || '—'],
  ]
  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent size="md" className="rounded-[24px]">
        <DialogHeader>
          <DialogTitle>Repasse do atendimento</DialogTitle>
          <DialogDescription>{EXPLICACAO[situacao] ?? 'Atendimento cancelado: não gera repasse.'}</DialogDescription>
        </DialogHeader>
        {semPercentual && (
          <p className="rounded-xl border border-app-border bg-app-bg-secondary/30 p-3 text-sm dark:border-app-border-dark dark:bg-app-hover">
            Este profissional ainda não tem percentual de repasse cadastrado. Peça à gestão para cadastrar em Repasse &gt; Nova regra
            (para parceiros, também em Profissionais &gt; editar).
          </p>
        )}
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {campos.map(([rotulo, valor]) => (
            <div key={rotulo}>
              <dt className="text-xs uppercase tracking-wider text-app-text-secondary">{rotulo}</dt>
              <dd className="break-words text-app-text-primary dark:text-white">{valor}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
