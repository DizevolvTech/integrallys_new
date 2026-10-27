'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDownRight, ArrowUpRight, MoreVertical, Package, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/page-header'
import { SegmentedControl } from '@/components/shared/segmented-control'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { MovimentoSuprimentoModal, type TipoMovimentoSuprimento } from './components/movimento-suprimento-modal'
import { SuprimentoFormModal } from './components/suprimento-form-modal'
import { SuprimentosControle } from './components/suprimentos-controle'
import { useSuprimentos, type SuprimentoItem } from './hooks/use-suprimentos'

type Aba = 'cadastro' | 'controle'
const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBr = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : '')

/** Suprimentos: cadastro separado dos produtos de venda, com saldo, movimentações e relatório de controle. */
export function SuprimentosView() {
  const router = useRouter()
  const { data, isLoading, error, salvar, movimentar, excluir } = useSuprimentos()
  const [aba, setAba] = useState<Aba>('cadastro')
  const [busca, setBusca] = useState('')
  const [form, setForm] = useState<{ aberto: boolean; item: SuprimentoItem | null }>({ aberto: false, item: null })
  const [mov, setMov] = useState<{ tipo: TipoMovimentoSuprimento; item: SuprimentoItem } | null>(null)

  const filtrados = useMemo(() => data.filter((s) => s.nome.toLowerCase().includes(busca.toLowerCase())), [data, busca])
  const hoje = new Date().toISOString().slice(0, 10)

  return (
    <div className="app-page app-page-loose pb-10">
      <PageHeader
        title="Suprimentos"
        description="Insumos dos procedimentos: saldo, entradas, saídas e controle."
        actions={
          <Button onClick={() => setForm({ aberto: true, item: null })} className="h-11 md:h-12 px-6 bg-app-primary hover:bg-app-primary-hover text-white rounded-xl gap-2">
            <Plus size={18} />Novo suprimento
          </Button>
        }
      />

      <div className="space-y-4 rounded-[24px] border border-app-border bg-app-card p-5 shadow-sm dark:border-app-border-dark dark:bg-app-card-dark">
        <SegmentedControl
          options={[
            { value: 'estoque', label: 'Estoque' },
            { value: 'movimentacoes', label: 'Entradas e saídas' },
            { value: 'suprimentos', label: 'Suprimentos' },
          ]}
          value="suprimentos"
          onChange={(v) => v !== 'suprimentos' && router.push('/estoque')}
          size="lg"
        />
        <SegmentedControl
          options={[
            { value: 'cadastro', label: 'Cadastro e saldo' },
            { value: 'controle', label: 'Relatório de controle' },
          ]}
          value={aba}
          onChange={(v) => setAba(v as Aba)}
          variant="pill"
        />
      </div>

      {error && <p className="text-sm text-[var(--app-danger-text)]">{error}</p>}

      {aba === 'controle' ? (
        <SuprimentosControle suprimentos={data} />
      ) : (
        <div className="space-y-4">
          <div className="relative w-full lg:w-[400px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-app-text-muted" />
            <Input placeholder="Buscar suprimento..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-11 h-12 rounded-integrallys-lg" />
          </div>
          {isLoading && <p className="text-sm text-app-text-muted">Carregando suprimentos...</p>}
          {!isLoading && filtrados.length === 0 && (
            <div className="rounded-[24px] border-2 border-dashed border-app-border p-10 text-center text-app-text-secondary">Nenhum suprimento cadastrado.</div>
          )}
          {filtrados.map((s) => {
            const baixo = s.estoqueMinimo > 0 && s.quantidade <= s.estoqueMinimo
            const vencido = !!s.validade && s.validade < hoje
            return (
              <Card key={s.id} className="rounded-[24px] border-none bg-app-card dark:bg-app-card-dark shadow-sm" data-testid="suprimento-card">
                <CardContent className="p-4 md:p-6 flex flex-wrap md:flex-nowrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="h-12 w-12 rounded-2xl bg-app-bg-secondary dark:bg-app-hover flex items-center justify-center text-app-text-muted"><Package size={24} /></div>
                    <div className="min-w-0">
                      <h4 className="text-md md:text-lg text-app-text-primary dark:text-white truncate">{s.nome}</h4>
                      <p className="text-xs text-app-text-secondary">{s.unidadeMedida ?? 'un'}</p>
                    </div>
                  </div>
                  <div className="order-last md:order-none grid w-full md:w-auto grid-cols-2 md:flex gap-x-4 gap-y-1 text-xs text-app-text-secondary dark:text-white/60">
                    {s.lote && <span>Lote: {s.lote}</span>}
                    {s.validade && <span className={vencido ? 'text-[var(--app-danger-text)]' : ''}>Val: {dataBr(s.validade)}{vencido ? ' (vencido)' : ''}</span>}
                    {s.precoCusto != null && <span>Custo: {reais(s.precoCusto)}</span>}
                  </div>
                  <p className="text-sm text-app-text-primary dark:text-white whitespace-nowrap">
                    Qtd: {s.quantidade} {s.estoqueMinimo > 0 && <span className="text-xs text-app-text-muted">(mín: {s.estoqueMinimo})</span>}
                  </p>
                  <span className={`px-4 py-1.5 rounded-full text-xs text-white whitespace-nowrap ${s.quantidade <= 0 ? 'bg-[var(--app-danger-text)]' : baixo ? 'bg-amber-500' : 'bg-[var(--app-success-text)]'}`}>
                    {s.quantidade <= 0 ? 'Indisponível' : baixo ? 'Estoque baixo' : 'Disponível'}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" aria-label="Ações" className="h-10 w-10 rounded-xl flex items-center justify-center text-app-text-muted hover:bg-app-bg-secondary dark:hover:bg-app-hover"><MoreVertical size={20} /></button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-xl">
                      <DropdownMenuItem onClick={() => setMov({ tipo: 'entrada', item: s })}><ArrowUpRight size={16} className="mr-2" />Entrada</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setMov({ tipo: 'saida', item: s })}><ArrowDownRight size={16} className="mr-2" />Saída</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setMov({ tipo: 'ajuste', item: s })}>Ajustar saldo</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setForm({ aberto: true, item: s })}>Editar cadastro</DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-[var(--app-danger-text)]"
                        onClick={() => {
                          if (!confirm(`Excluir o suprimento "${s.nome}"? O histórico continua no relatório.`)) return
                          excluir(s.id).then(() => toast.success('Suprimento excluído.')).catch((err) => toast.error(err instanceof Error ? err.message : 'Falha ao excluir.'))
                        }}
                      >
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <SuprimentoFormModal isOpen={form.aberto} onClose={() => setForm({ aberto: false, item: null })} suprimento={form.item} onSave={salvar} />
      <MovimentoSuprimentoModal isOpen={mov !== null} onClose={() => setMov(null)} tipo={mov?.tipo ?? 'entrada'} suprimento={mov?.item ?? null} onConfirm={movimentar} />
    </div>
  )
}
