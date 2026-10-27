import { Card } from '@/components/ui/card'
import { formatarMargem, totalizarMargem } from '@/lib/margem'
import type { EstoqueItem } from '../hooks/use-estoque'

const reais = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

function Total({ rotulo, valor, destaque }: { rotulo: string; valor: string | number; destaque?: boolean }) {
  return (
    <Card className="rounded-[16px] border-app-border p-4 dark:border-app-border-dark">
      <p className="text-xs uppercase tracking-wider text-app-text-muted">{rotulo}</p>
      <p className={`mt-1 text-xl font-normal ${destaque ? 'text-[var(--app-success-text)]' : 'text-app-text-primary dark:text-white'}`}>{valor}</p>
    </Card>
  )
}

/** Totais da posição de estoque. Custo e margem só aparecem se o servidor os enviou (gestão). */
export function EstoqueTotais({ itens }: { itens: EstoqueItem[] }) {
  const { quantidade, custo, venda, margem } = totalizarMargem(itens)
  const comCusto = itens.some((item) => item.precoCusto != null)
  return (
    <div className={`grid grid-cols-2 gap-3 ${comCusto ? 'md:grid-cols-4' : 'md:grid-cols-2'}`}>
      <Total rotulo="Qtd Total" valor={quantidade} />
      {comCusto && <Total rotulo="Custo Total" valor={reais(custo)} />}
      <Total rotulo="Venda Total" valor={reais(venda)} destaque />
      {comCusto && <Total rotulo="Margem Total (% sobre o custo)" valor={formatarMargem(margem)} destaque />}
    </div>
  )
}
