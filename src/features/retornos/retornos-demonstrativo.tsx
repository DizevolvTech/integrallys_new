'use client'

import { useCallback, useState } from 'react'
import { RelatorioExportar } from '@/features/relatorios/components/relatorio-exportar'
import { exportarRelatorio, type FormatoExportacao } from '@/features/relatorios/exportar-relatorio'
import type { ColunaRelatorio, ResumoLista } from '@/features/relatorios/relatorio-config'
import { useApi } from '@/hooks/use-api'
import { ROTULO_SITUACAO_RETORNO } from '@/lib/retorno-prazo'
import type { RetornoItem } from '@/types/retorno'
import { buildRetornosQuery, type RetornosFiltros, type RetornosResumo } from './hooks/use-retornos'

/** O servidor entrega no máximo 50 retornos por chamada. */
const LOTE = 50

const COLUNAS: ColunaRelatorio[] = [
  { key: 'data', label: 'Data do atendimento' },
  { key: 'paciente', label: 'Cliente' },
  { key: 'ultimos', label: 'Últimos procedimentos' },
  { key: 'especialista', label: 'Especialista do retorno' },
  { key: 'procedimento', label: 'Procedimento do retorno' },
  { key: 'previsto', label: 'Retorno previsto' },
  { key: 'situacao', label: 'Situação' },
]

export function resumosDeRetornos(resumo: RetornosResumo | null): ResumoLista[] {
  if (!resumo) return []
  return [
    {
      titulo: 'Resumo dos retornos',
      itens: [
        { nome: 'Pendentes (ainda sem consulta de retorno marcada)', valor: String(resumo.pendentes) },
        { nome: 'Agendados (consulta de retorno marcada)', valor: String(resumo.agendados) },
        { nome: 'Concluídos (retorno efetivado)', valor: String(resumo.concluidos) },
      ],
    },
  ]
}

function filtrosAtivos(filtros: RetornosFiltros, nomes: { profissional?: string; procedimento?: string }): string[] {
  const frases: string[] = []
  if (filtros.q.trim()) frases.push(`Cliente: ${filtros.q.trim()}`)
  if (nomes.profissional) frases.push(`Profissional: ${nomes.profissional}`)
  if (nomes.procedimento) frases.push(`Especialidade: ${nomes.procedimento}`)
  if (filtros.situacao) frases.push(`Situação: ${ROTULO_SITUACAO_RETORNO[filtros.situacao as keyof typeof ROTULO_SITUACAO_RETORNO] ?? filtros.situacao}`)
  const br = (iso: string) => iso.split('-').reverse().join('/')
  if (filtros.de) frases.push(`Atendimento de: ${br(filtros.de)}`)
  if (filtros.ate) frases.push(`Atendimento até: ${br(filtros.ate)}`)
  return frases
}

interface Props {
  titulo: string
  filtros: RetornosFiltros
  nomes: { profissional?: string; procedimento?: string }
  resumo: RetornosResumo | null
  total: number
}

/** Demonstrativo dos retornos nos Relatórios: botões Excel/PDF (todas as linhas do filtro) e o resumo. */
export function RetornosDemonstrativo({ titulo, filtros, nomes, resumo, total }: Props) {
  const api = useApi()
  const [exportando, setExportando] = useState<FormatoExportacao | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const exportar = useCallback(
    async (formato: FormatoExportacao) => {
      setExportando(formato)
      setErro(null)
      try {
        const itens: RetornoItem[] = []
        let paginas = 1
        for (let page = 1; page <= paginas; page++) {
          const query = buildRetornosQuery({ ...filtros, page, pageSize: LOTE })
          const r = await api.get<{ data: RetornoItem[]; meta: { total: number } }>(`/api/retornos?${query}`)
          itens.push(...r.data)
          paginas = Math.ceil(r.meta.total / LOTE)
        }
        await exportarRelatorio(formato, {
          titulo,
          nomeArquivo: 'relatorio-retornos',
          filtros: filtrosAtivos(filtros, nomes),
          colunas: COLUNAS,
          linhas: itens.map((i) => ({
            data: i.data,
            paciente: i.paciente,
            ultimos: i.ultimosProcedimentos.map((p) => `${p.nome} (${p.data})`).join(', '),
            especialista: i.especialista,
            procedimento: i.procedimento,
            previsto: i.dataPrevista || i.prazo,
            situacao: ROTULO_SITUACAO_RETORNO[i.situacao],
          })),
          resumos: resumosDeRetornos(resumo),
        })
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Não foi possível exportar o relatório')
      } finally {
        setExportando(null)
      }
    },
    [api, filtros, nomes, resumo, titulo],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <RelatorioExportar desabilitado={total === 0} exportando={exportando} erro={erro} onExportar={exportar} />
      </div>
      {resumo && (
        <section aria-label="Resumo dos retornos" className="rounded-xl border border-app-border p-4 dark:border-app-border-dark">
          <p className="mb-3 text-sm text-app-text-primary dark:text-white">Resumo dos retornos</p>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ['Pendentes', resumo.pendentes, 'Ainda sem consulta de retorno marcada'],
              ['Agendados', resumo.agendados, 'Consulta de retorno marcada'],
              ['Concluídos', resumo.concluidos, 'Retorno efetivado'],
            ].map(([rotulo, valor, ajuda]) => (
              <div key={rotulo} className="rounded-xl border border-app-border bg-app-bg-secondary/30 p-4 dark:border-app-border-dark dark:bg-app-hover">
                <dt className="text-xs uppercase tracking-wider text-app-text-secondary">{rotulo}</dt>
                <dd className="mt-1 text-xl font-normal text-app-text-primary dark:text-white">{valor}</dd>
                <p className="mt-1 text-xs text-app-text-muted">{ajuda}</p>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  )
}
