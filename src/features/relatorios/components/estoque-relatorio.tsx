'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { perfilVeCustoEstoque } from '@/lib/estoque-custo'
import { SegmentedControl } from '@/components/shared/segmented-control'
import { CurvaAbcSection } from '@/features/relatorios/components/curva-abc-section'
import { RelatorioTabela } from '@/features/relatorios/components/relatorio-tabela'
import { resumosDeValidade } from '@/features/relatorios/estoque-validade-resumo'
import { useCurvaAbc, useValidadeEstoque } from '@/features/relatorios/hooks/use-relatorio-estoque'

type SubAba = 'estoque-posicao' | 'estoque-movimentacao' | 'curva-abc'

/** Estoque: posição atual (custo/venda/margem), movimentação diária e Curva ABC. */
export function EstoqueRelatorio() {
  const [subAba, setSubAba] = useState<SubAba>('estoque-posicao')
  const [dias, setDias] = useState(90)
  const veCusto = useAuth((state) => perfilVeCustoEstoque(state.user?.role))
  const curvaAbc = useCurvaAbc(dias, veCusto)
  const [filtrosPosicao, setFiltrosPosicao] = useState<Record<string, string>>({})
  const validade = useValidadeEstoque({
    unidade_id: filtrosPosicao.unidade_id,
    q: filtrosPosicao.q,
    categoria: filtrosPosicao.categoria,
  })
  const resumosValidade = useMemo(() => resumosDeValidade(validade.data), [validade.data])

  return (
    <div className="space-y-6">
      <SegmentedControl
        options={[
          { value: 'estoque-posicao', label: 'Posição do estoque' },
          { value: 'estoque-movimentacao', label: 'Movimentação diária' },
          ...(veCusto ? [{ value: 'curva-abc', label: 'Curva ABC' }] : []),
        ]}
        value={subAba}
        onChange={(valor) => setSubAba(valor as SubAba)}
        fullWidth={false}
        size="sm"
      />
      {subAba === 'estoque-posicao' && (
        <>
          <RelatorioTabela
            key={subAba}
            tipo={subAba}
            titulo="Estoque — posição"
            resumosExtras={resumosValidade}
            onFiltrosChange={setFiltrosPosicao}
          />
          {validade.error && <p className="text-sm text-[var(--app-danger-text)]">{validade.error}</p>}
        </>
      )}
      {subAba === 'estoque-movimentacao' && <RelatorioTabela key={subAba} tipo={subAba} titulo="Estoque — movimentação diária" />}
      {subAba === 'curva-abc' && (
        <CurvaAbcSection
          dias={dias}
          onDiasChange={setDias}
          data={curvaAbc.data}
          isLoading={curvaAbc.isLoading}
          error={curvaAbc.error}
        />
      )}
    </div>
  )
}
