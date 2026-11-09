'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ComissaoItensDialog } from '@/features/relatorios/components/comissao-itens-dialog'
import { RelatorioDetalheDialog } from '@/features/relatorios/components/relatorio-detalhe-dialog'
import { RelatorioExportar } from '@/features/relatorios/components/relatorio-exportar'
import { RolagemHorizontalComBarraNoTopo } from '@/features/relatorios/components/rolagem-horizontal-com-barra-no-topo'
import { RelatorioCartoesMobile } from '@/features/relatorios/components/relatorio-cartoes-mobile'
import { RelatorioCartoes, RelatorioResumos } from '@/features/relatorios/components/relatorio-cartoes'
import { RelatorioCelula } from '@/features/relatorios/components/relatorio-celula'
import { RelatorioFiltros } from '@/features/relatorios/components/relatorio-filtros'
import { hojeIso, somarDiasIso } from '@/features/relatorios/format'
import { useOpcoesFiltro } from '@/features/relatorios/hooks/use-opcoes-filtro'
import { useRelatorioTabela, type LinhaRelatorio } from '@/features/relatorios/hooks/use-relatorio-tabela'
import { CONFIG_RELATORIOS, configSemCusto, type CartaoTotal, type ConfigRelatorio, type ResumoLista } from '@/features/relatorios/relatorio-config'
import { DETALHES_POR_TIPO } from '@/features/relatorios/relatorio-detalhes'
import { descreverFiltros } from '@/features/relatorios/exportacao/filtros-texto'
import { useExportarRelatorio } from '@/features/relatorios/hooks/use-exportar-relatorio'

function valoresIniciais(config: ConfigRelatorio): Record<string, string> {
  const hoje = hojeIso()
  const inicial: Record<string, string> = {}
  for (const f of config.filtros) {
    if (f.padrao === 'hoje') inicial[f.key] = hoje
    else if (f.padrao === 'ha30dias') inicial[f.key] = somarDiasIso(hoje, -30)
    else if (f.padrao) inicial[f.key] = f.padrao
  }
  return inicial
}

interface Props {
  tipo: string
  proprio?: boolean
  /** Título do relatório nos arquivos exportados (padrão: o da aba). */
  titulo?: string
  /** Resumos que a tela busca à parte (ex.: validade do estoque): aparecem embaixo e vão ao Excel e ao PDF. */
  resumosExtras?: ResumoLista[]
  /** Avisa os filtros atuais (para resumos buscados à parte usarem os mesmos). */
  onFiltrosChange?: (valores: Record<string, string>) => void
}

export function RelatorioTabela({ tipo, proprio = false, titulo, resumosExtras = [], onFiltrosChange }: Props) {
  const configBase = CONFIG_RELATORIOS[tipo]
  const opcoes = useOpcoesFiltro()
  const [valores, setValores] = useState<Record<string, string>>(() => valoresIniciais(configBase))
  const [pagina, setPagina] = useState(1)
  const [detalhe, setDetalhe] = useState<LinhaRelatorio | null>(null)
  const [cartaoAberto, setCartaoAberto] = useState<CartaoTotal | null>(null)
  const { exportar, exportando, erro: erroExportar } = useExportarRelatorio()
  const { linhas, meta, isLoading, error } = useRelatorioTabela(tipo, valores, pagina)
  const config = useMemo(() => (meta?.custoOculto ? configSemCusto(configBase) : configBase), [meta?.custoOculto, configBase])

  useEffect(() => {
    onFiltrosChange?.(valores)
  }, [valores, onFiltrosChange])

  const alterar = (key: string, valor: string) => {
    setValores((prev) => ({ ...prev, [key]: valor }))
    setPagina(1)
  }

  const cartoes = useMemo(() => (meta && config.cartoes ? config.cartoes(meta.totais, meta.total) : []), [meta, config])
  const resumos = useMemo(() => (meta && config.resumos ? config.resumos(meta.totais) : []), [meta, config])
  const resumosDaTela = useMemo(() => [...resumos, ...resumosExtras], [resumos, resumosExtras])
  const detalheCartao = DETALHES_POR_TIPO[tipo]
  const total = meta?.total ?? 0
  const porPagina = meta?.porPagina ?? 20
  const de = total === 0 ? 0 : (pagina - 1) * porPagina + 1
  const ate = Math.min(pagina * porPagina, total)
  const colSpan = config.colunas.length + (config.detalheItens ? 1 : 0)

  const exportarTudo = (formato: 'xlsx' | 'pdf') =>
    exportar(formato, valores, {
      tipo,
      titulo: titulo ?? config.descricao,
      colunas: config.colunas,
      filtrosAtivos: descreverFiltros(config.filtros, valores, opcoes, proprio),
      resumos: resumosDaTela,
    })

  return (
    <div className="space-y-5">
      <p className="text-sm text-app-text-secondary dark:text-white/60">{config.descricao}</p>
      <RelatorioFiltros filtros={config.filtros} valores={valores} onChange={alterar} opcoes={opcoes} proprio={proprio} />
      <RelatorioCartoes cartoes={cartoes} onAbrirDetalhe={detalheCartao ? setCartaoAberto : undefined} />
      {config.legenda && cartoes.length > 0 && <p className="text-xs text-app-text-muted">{config.legenda}</p>}
      {error && <p className="text-sm text-[var(--app-danger-text)]">{error}</p>}

      <div className="md:hidden">
        {isLoading && linhas.length === 0 && <p className="py-6 text-center text-sm text-app-text-secondary">Carregando relatório...</p>}
        {!isLoading && linhas.length === 0 && (
          <p className="py-6 text-center text-sm text-app-text-secondary">Nenhum registro encontrado para os filtros selecionados.</p>
        )}
        <RelatorioCartoesMobile
          config={config}
          linhas={linhas}
          acao={
            config.detalheItens
              ? (linha) => (
                  <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setDetalhe(linha)}>
                    <Eye className="mr-1 h-4 w-4" />
                    Ver produtos
                  </Button>
                )
              : undefined
          }
        />
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-app-border dark:border-app-border-dark md:block">
        <RolagemHorizontalComBarraNoTopo>
          <Table style={{ minWidth: Math.max(720, colSpan * 130) }}>
            <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-hover">
              <TableRow className="border-b border-app-border hover:bg-transparent dark:border-app-border-dark">
                {config.colunas.map((c) => (
                  <TableHead
                    key={c.key}
                    className={`whitespace-nowrap text-xs font-normal uppercase text-app-text-secondary ${c.direita ? 'text-right' : ''}`}
                  >
                    {c.label}
                  </TableHead>
                ))}
                {config.detalheItens && <TableHead className="text-right text-xs font-normal uppercase">Produtos</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && linhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={colSpan} className="h-24 text-center text-app-text-secondary">
                    Carregando relatório...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && linhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={colSpan} className="h-24 text-center text-app-text-secondary">
                    Nenhum registro encontrado para os filtros selecionados.
                  </TableCell>
                </TableRow>
              )}
              {linhas.map((linha) => (
                <TableRow key={linha.id} className="border-b border-app-border/50 transition-colors hover:bg-app-bg-secondary/30 dark:hover:bg-app-hover">
                  {config.colunas.map((c) => (
                    <TableCell
                      key={c.key}
                      className={`py-3 text-sm text-app-text-primary dark:text-white ${c.direita ? 'whitespace-nowrap text-right' : ''}`}
                    >
                      <RelatorioCelula coluna={c} valor={linha[c.key]} />
                    </TableCell>
                  ))}
                  {config.detalheItens && (
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setDetalhe(linha)}>
                        <Eye className="mr-1 h-4 w-4" />
                        Ver produtos
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </RolagemHorizontalComBarraNoTopo>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-app-text-secondary">
          {de}–{ate} de {total}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <RelatorioExportar desabilitado={total === 0} exportando={exportando} erro={erroExportar} onExportar={exportarTudo} />
          <Button variant="outline" size="sm" className="rounded-lg" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            {pagina} / {meta?.totalPaginas ?? 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            disabled={pagina >= (meta?.totalPaginas ?? 1)}
            onClick={() => setPagina((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <RelatorioResumos resumos={resumosDaTela} />
      {cartaoAberto && detalheCartao && (
        <RelatorioDetalheDialog
          detalhe={detalheCartao}
          cartao={cartaoAberto}
          config={config}
          filtros={valores}
          totais={meta?.totais ?? {}}
          onClose={() => setCartaoAberto(null)}
        />
      )}
      {config.detalheItens && <ComissaoItensDialog linha={detalhe} onClose={() => setDetalhe(null)} />}
    </div>
  )
}
