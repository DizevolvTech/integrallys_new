import { Undo2 } from 'lucide-react'
import { CartaoMobile, ListaCartoesMobile } from '@/components/shared/mobile-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatarDataHoraClinica } from '@/lib/fuso-clinica'
import type { MovimentacaoItem } from '../hooks/use-estoque'

const CABECALHO = 'text-xs font-medium uppercase tracking-wider text-app-text-secondary'

function descreverTipo(mov: MovimentacaoItem) {
  if (mov.tipo === 'entrada') return 'Entrada'
  return mov.tipoMovimentacao === 'consumo_interno' ? 'Consumo interno' : 'Saída'
}

function classeTipo(mov: MovimentacaoItem) {
  if (mov.estornada) return 'rounded-full border-app-border bg-app-bg-secondary/60 text-app-text-muted dark:bg-app-hover'
  if (mov.tipo === 'entrada') return 'rounded-full app-status-success border-transparent text-[var(--app-success-text)] dark:bg-transparent'
  if (mov.tipoMovimentacao === 'consumo_interno') return 'rounded-full app-status-warning border-transparent text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
  return 'rounded-full app-status-danger border-transparent text-[var(--app-danger-text)] dark:bg-transparent'
}

function SeloTipo({ mov, className = 'px-3 py-1 text-xs font-medium' }: { mov: MovimentacaoItem; className?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className={`${className} ${classeTipo(mov)}`}>
        {descreverTipo(mov)}
      </Badge>
      {mov.estornada && (
        <Badge variant="outline" className="rounded-full border-app-border bg-app-bg-secondary/40 px-2 py-0.5 text-[10px] font-medium text-app-text-muted">
          Estornada
        </Badge>
      )}
    </div>
  )
}

function Vinculo({ mov }: { mov: MovimentacaoItem }) {
  if (!mov.vinculoNome) return <>—</>
  return (
    <span>
      {mov.vinculoNome}
      {mov.vinculoTipo && <span className="ml-1 text-[10px] uppercase tracking-wider text-app-text-muted">({mov.vinculoTipo === 'outro' ? 'outros' : mov.vinculoTipo})</span>}
    </span>
  )
}

function BotaoEstornar({ onClick, className }: { onClick: () => void; className: string }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} className={className}>
      <Undo2 className="mr-1 h-3.5 w-3.5" />
      Estornar
    </Button>
  )
}

interface MovimentacoesListaProps {
  movimentacoes: MovimentacaoItem[]
  onEstornar: (mov: MovimentacaoItem) => void
}

/** Movimentos do estoque: tabela no desktop e cartões com tudo visível (e Estornar) no celular. */
export function MovimentacoesLista({ movimentacoes, onEstornar }: MovimentacoesListaProps) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-[16px] border border-app-border dark:border-app-border-dark md:block">
        <Table>
          <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-hover">
            <TableRow>
              <TableHead className={CABECALHO}>Data/Hora</TableHead>
              <TableHead className={CABECALHO}>Produto</TableHead>
              <TableHead className={CABECALHO}>Tipo</TableHead>
              <TableHead className={CABECALHO}>Quantidade</TableHead>
              <TableHead className={CABECALHO}>Operador</TableHead>
              <TableHead className={CABECALHO}>Vínculo</TableHead>
              <TableHead className={CABECALHO}>Observação</TableHead>
              <TableHead className={`text-right ${CABECALHO}`}>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movimentacoes.map((mov) => (
              <TableRow key={mov.id} className={mov.estornada ? 'opacity-50' : ''}>
                <TableCell className="whitespace-nowrap text-sm text-app-text-secondary dark:text-white/70">{formatarDataHoraClinica(mov.criadoEm)}</TableCell>
                <TableCell className="font-normal text-app-text-primary dark:text-white">{mov.produtoNome || '—'}</TableCell>
                <TableCell><SeloTipo mov={mov} /></TableCell>
                <TableCell className="tabular-nums text-app-text-primary dark:text-white">{sinal(mov)}{mov.quantidade}</TableCell>
                <TableCell className="text-app-text-secondary dark:text-white/70">{mov.operadorNome || '—'}</TableCell>
                <TableCell className="text-app-text-secondary dark:text-white/70"><Vinculo mov={mov} /></TableCell>
                <TableCell className="max-w-xs truncate text-xs text-app-text-muted">{mov.observacoes ?? '—'}</TableCell>
                <TableCell className="text-right">
                  {!mov.estornada && (
                    <BotaoEstornar
                      onClick={() => onEstornar(mov)}
                      className="h-9 rounded-lg px-3 text-xs font-medium text-app-text-secondary hover:bg-app-bg-secondary dark:hover:bg-app-hover"
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ListaCartoesMobile className="p-0">
        {movimentacoes.map((mov) => (
          <CartaoMobile
            key={mov.id}
            className={mov.estornada ? 'opacity-60' : undefined}
            titulo={mov.produtoNome || '—'}
            subtitulo={formatarDataHoraClinica(mov.criadoEm)}
            valor={`${sinal(mov)}${mov.quantidade}`}
            selo={<SeloTipo mov={mov} className="px-2.5 py-0.5 text-xs font-medium" />}
            acoes={
              !mov.estornada && (
                <BotaoEstornar onClick={() => onEstornar(mov)} className="h-10 rounded-lg border border-app-border px-3 text-xs font-medium" />
              )
            }
            campos={[
              { rotulo: 'Operador', valor: mov.operadorNome || '—' },
              { rotulo: 'Vínculo', valor: <Vinculo mov={mov} /> },
              { rotulo: 'Observação', valor: mov.observacoes ?? '—' },
            ]}
          />
        ))}
      </ListaCartoesMobile>
    </>
  )
}

const sinal = (mov: MovimentacaoItem) => (mov.tipo === 'entrada' ? '+' : '-')
