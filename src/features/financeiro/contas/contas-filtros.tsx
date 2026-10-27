'use client'

import { Search } from 'lucide-react'
import { DateInput } from '@/components/shared/date-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FILTROS_VAZIOS, type FiltrosContasUi, type OpcoesContas } from './use-contas'

interface Props {
  tipo: 'receita' | 'despesa'
  filtros: FiltrosContasUi
  opcoes: OpcoesContas
  onChange: (filtros: FiltrosContasUi) => void
}

const TODOS = 'todos'

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-app-text-muted">{rotulo}</Label>
      {children}
    </div>
  )
}

function Escolha({ valor, onChange, itens, vazio }: { valor: string; onChange: (valor: string) => void; itens: Array<{ id: string; nome: string }>; vazio: string }) {
  return (
    <Select value={valor || TODOS} onValueChange={(proximo) => onChange(proximo === TODOS ? '' : proximo)}>
      <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={TODOS}>{vazio}</SelectItem>
        {itens.map((item) => (
          <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function ContasFiltros({ tipo, filtros, opcoes, onChange }: Props) {
  const receita = tipo === 'receita'
  const set = (patch: Partial<FiltrosContasUi>) => onChange({ ...filtros, ...patch })

  return (
    <div className="rounded-[24px] border border-app-border bg-app-card p-5 shadow-sm dark:border-app-border-dark dark:bg-app-card-dark">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Campo rotulo="Período inicial">
          <DateInput value={filtros.de} onChange={(de) => set({ de })} />
        </Campo>
        <Campo rotulo="Período final">
          <DateInput value={filtros.ate} onChange={(ate) => set({ ate })} />
        </Campo>
        <Campo rotulo={receita ? 'Cliente' : 'Fornecedor'}>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-muted" />
            <Input
              value={filtros.pessoa}
              onChange={(event) => set({ pessoa: event.target.value })}
              placeholder={receita ? 'Nome do cliente' : 'Nome do fornecedor'}
              list={receita ? undefined : 'fornecedores-filtro'}
              className="h-11 rounded-xl pl-10"
            />
            {!receita && (
              <datalist id="fornecedores-filtro">
                {opcoes.fornecedores.map((item) => <option key={item.id} value={item.nome} />)}
              </datalist>
            )}
          </div>
        </Campo>
        <Campo rotulo={receita ? 'Forma de recebimento' : 'Forma de pagamento'}>
          <Escolha valor={filtros.formaId} onChange={(formaId) => set({ formaId })} itens={opcoes.formas} vazio="Todas as formas" />
        </Campo>
        <Campo rotulo="Situação">
          <Select value={filtros.situacao || TODOS} onValueChange={(valor) => set({ situacao: valor === TODOS ? '' : (valor as FiltrosContasUi['situacao']) })}>
            <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas</SelectItem>
              <SelectItem value="a_vencer">A vencer</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
              <SelectItem value="liquidado">Liquidado</SelectItem>
            </SelectContent>
          </Select>
        </Campo>
        <Campo rotulo="Categoria (DRE)">
          <Escolha
            valor={filtros.categoriaId}
            onChange={(categoriaId) => set({ categoriaId })}
            itens={opcoes.categorias.filter((categoria) => categoria.tipo === tipo)}
            vazio="Todas as categorias"
          />
        </Campo>
        {receita && (
          <>
            <Campo rotulo="Especialidade / procedimento">
              <Escolha valor={filtros.procedimentoId} onChange={(procedimentoId) => set({ procedimentoId })} itens={opcoes.procedimentos} vazio="Todas" />
            </Campo>
            <Campo rotulo="Profissional">
              <Escolha valor={filtros.profissionalId} onChange={(profissionalId) => set({ profissionalId })} itens={opcoes.profissionais} vazio="Todos" />
            </Campo>
            <Campo rotulo="Produto">
              <Input value={filtros.produto} onChange={(event) => set({ produto: event.target.value })} placeholder="Nome do produto" className="h-11 rounded-xl" />
            </Campo>
          </>
        )}
        <div className="flex items-end">
          <Button variant="outline" className="h-11 w-full rounded-xl font-normal" onClick={() => onChange(FILTROS_VAZIOS)}>
            Limpar filtros
          </Button>
        </div>
      </div>
    </div>
  )
}
