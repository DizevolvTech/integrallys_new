'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { AniversariantesRelatorio } from '@/features/relatorios/components/aniversariantes-relatorio'
import { CaixaGestorTab } from '@/features/relatorios/components/caixa-gestor-tab'
import { ComparativoTab } from '@/features/relatorios/components/comparativo-tab'
import { EstoqueRelatorio } from '@/features/relatorios/components/estoque-relatorio'
import { PrescricoesTab } from '@/features/relatorios/components/prescricoes-tab'
import { RankingTab } from '@/features/relatorios/components/ranking-tab'
import { RelatorioTabela } from '@/features/relatorios/components/relatorio-tabela'
import { RetornosAtalho } from '@/features/relatorios/components/retornos-atalho'
import { useRelatorios } from '@/features/relatorios/hooks/use-relatorios'
import { CONFIG_RELATORIOS } from '@/features/relatorios/relatorio-config'

function ConteudoDaAba({ id, proprio }: { id: string; proprio: boolean }) {
  switch (id) {
    case 'aniversariantes':
      return <AniversariantesRelatorio />
    case 'estoque':
      return <EstoqueRelatorio />
    case 'prescricoes':
      return <PrescricoesTab />
    case 'ranking':
      return <RankingTab />
    case 'caixa-gestor':
      return <CaixaGestorTab />
    case 'comparativo':
      return <ComparativoTab />
    case 'retornos':
      return <RetornosAtalho />
    default:
      return id in CONFIG_RELATORIOS ? <RelatorioTabela key={id} tipo={id} proprio={proprio} /> : null
  }
}

export function RelatoriosView() {
  const { tabs, error, isLoading } = useRelatorios()
  const [activeTab, setActiveTab] = useState('')

  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((tab) => tab.id === activeTab)) setActiveTab(tabs[0].id)
  }, [activeTab, tabs])

  const abaAtual = tabs.find((tab) => tab.id === activeTab)

  return (
    <div className="app-page app-page-loose pb-10">
      <PageHeader
        title="Relatórios"
        description="Consulte, filtre e exporte os dados reais da clínica. As abas mudam conforme o seu perfil."
      />

      {error && <p className="text-sm text-[var(--app-danger-text)]">{error}</p>}
      {!isLoading && !error && tabs.length === 0 && (
        <p className="text-sm text-app-text-secondary">Nenhum relatório disponível para o seu perfil.</p>
      )}

      {tabs.length > 0 && (
        <div className="rounded-[24px] border border-app-border bg-app-card p-4 shadow-sm dark:border-app-border-dark dark:bg-app-card-dark md:p-6">
          <div role="tablist" className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={tab.id === activeTab}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-[12px] px-4 py-2 text-sm transition-colors ${
                  tab.id === activeTab
                    ? 'bg-app-primary text-white'
                    : 'bg-app-bg-secondary text-app-text-secondary hover:bg-app-hover dark:bg-app-hover dark:text-white/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {abaAtual && (
        <div className="overflow-hidden rounded-[24px] border border-app-border bg-app-card shadow-sm dark:border-app-border-dark dark:bg-app-card-dark">
          <div className="space-y-6 p-4 md:p-8">
            <h2 className="text-xl font-normal text-app-text-primary dark:text-white">{abaAtual.label}</h2>
            <ConteudoDaAba id={abaAtual.id} proprio={Boolean(abaAtual.proprio)} />
          </div>
        </div>
      )}
    </div>
  )
}
