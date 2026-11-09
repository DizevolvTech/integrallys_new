'use client'

import { useCallback, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import { exportarRelatorio, type FormatoExportacao } from '@/features/relatorios/exportar-relatorio'
import type { LinhaRelatorio, RelatorioMeta } from '@/features/relatorios/hooks/use-relatorio-tabela'
import type { ColunaRelatorio, ResumoLista } from '@/features/relatorios/relatorio-config'

/** O servidor entrega no máximo 100 linhas por chamada (filtros.ts). */
export const LINHAS_POR_LOTE = 100
const MAXIMO_DE_LOTES = 500

function montarQuery(filtros: Record<string, string>, pagina: number) {
  const params = new URLSearchParams()
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor && valor !== 'todos') params.set(chave, valor)
  }
  params.set('pagina', String(pagina))
  params.set('porPagina', String(LINHAS_POR_LOTE))
  return params.toString()
}

interface Entrada {
  tipo: string
  titulo: string
  colunas: ColunaRelatorio[]
  filtrosAtivos: string[]
  resumos: ResumoLista[]
}

/** Exporta TODAS as linhas do filtro (não só a página): busca em lotes de 100 e gera Excel ou PDF. */
export function useExportarRelatorio() {
  const api = useApi()
  const [exportando, setExportando] = useState<FormatoExportacao | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const exportar = useCallback(
    async (formato: FormatoExportacao, valores: Record<string, string>, entrada: Entrada) => {
      setExportando(formato)
      setErro(null)
      try {
        const linhas: LinhaRelatorio[] = []
        let totalPaginas = 1
        for (let pagina = 1; pagina <= totalPaginas && pagina <= MAXIMO_DE_LOTES; pagina++) {
          const resposta = await api.get<{ data: LinhaRelatorio[]; meta: RelatorioMeta }>(
            `/api/relatorios/${entrada.tipo}?${montarQuery(valores, pagina)}`,
          )
          linhas.push(...resposta.data)
          totalPaginas = Math.ceil(resposta.meta.total / LINHAS_POR_LOTE)
        }
        await exportarRelatorio(formato, {
          titulo: entrada.titulo,
          nomeArquivo: `relatorio-${entrada.tipo}`,
          filtros: entrada.filtrosAtivos,
          colunas: entrada.colunas,
          linhas,
          resumos: entrada.resumos,
        })
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Não foi possível exportar o relatório')
      } finally {
        setExportando(null)
      }
    },
    [api],
  )

  return { exportar, exportando, erro }
}
