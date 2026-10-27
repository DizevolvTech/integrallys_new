import { CartaoMobile, ListaCartoesMobile } from '@/components/shared/mobile-card'
import { RelatorioCelula } from '@/features/relatorios/components/relatorio-celula'
import type { ColunaRelatorio, ConfigRelatorio } from '@/features/relatorios/relatorio-config'
import type { LinhaRelatorio } from '@/features/relatorios/hooks/use-relatorio-tabela'

/** Escolhe as colunas em destaque: as da config ou, na falta, a 1ª de texto, a 1ª de dinheiro e a 1ª badge. */
export function colunasDestaque(config: ConfigRelatorio) {
  const porChave = (key?: string) => config.colunas.find((c) => c.key === key)
  const titulo =
    porChave(config.mobile?.titulo) ?? config.colunas.find((c) => !c.tipo && c.key !== 'hora') ?? config.colunas[0]
  const valor = porChave(config.mobile?.valor) ?? config.colunas.find((c) => c.tipo === 'dinheiro')
  const selo = porChave(config.mobile?.selo) ?? config.colunas.find((c) => c.tipo === 'badge')
  return { titulo, valor, selo }
}

interface Props {
  config: ConfigRelatorio
  linhas: LinhaRelatorio[]
  /** Botão extra por linha (ex.: "Ver produtos"). */
  acao?: (linha: LinhaRelatorio) => React.ReactNode
}

/** No celular cada linha do relatório vira um cartão: título, valor e situação à vista, o resto em rótulo/valor. */
export function RelatorioCartoesMobile({ config, linhas, acao }: Props) {
  const { titulo, valor, selo } = colunasDestaque(config)
  const usadas = new Set([titulo?.key, valor?.key, selo?.key])
  const resto: ColunaRelatorio[] = config.colunas.filter((c) => !usadas.has(c.key))
  const celula = (c: ColunaRelatorio | undefined, linha: LinhaRelatorio) =>
    c ? <RelatorioCelula coluna={c} valor={linha[c.key]} /> : undefined
  return (
    <ListaCartoesMobile>
      {linhas.map((linha) => (
        <CartaoMobile
          key={linha.id}
          titulo={celula(titulo, linha)}
          valor={valor ? celula(valor, linha) : undefined}
          selo={selo ? celula(selo, linha) : undefined}
          acoes={acao?.(linha)}
          campos={resto.map((c) => ({ rotulo: c.label, valor: celula(c, linha) }))}
        />
      ))}
    </ListaCartoesMobile>
  )
}
