'use client'

import { DollarSign, Edit, Eye, FileText, MoreVertical, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { CaixaItem } from '@/hooks/use-caixa'
import type { FinanceiroItem } from '@/hooks/use-financeiro'
import { isLiquidado } from '../financeiro.utils'

const BOTAO = 'mx-auto h-9 w-9 rounded-xl border-app-border dark:border-app-border-dark'
const ICONE = 'mr-2 h-4 w-4 text-app-text-secondary'

function Gatilho() {
  return (
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="icon" aria-label="Ações" className={BOTAO}>
        <MoreVertical className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
  )
}

interface AcoesLancamentoProps {
  item: FinanceiroItem
  onView: (item: FinanceiroItem) => void
  onEdit: (item: FinanceiroItem) => void
  onRecebimento: (item: FinanceiroItem) => void
  onComprovante: (item: FinanceiroItem) => void
  onDelete: (item: FinanceiroItem) => void
}

/** Menu de ações de um lançamento (tabela e cartão do celular). */
export function AcoesLancamento({ item, onView, onEdit, onRecebimento, onComprovante, onDelete }: AcoesLancamentoProps) {
  return (
    <DropdownMenu>
      <Gatilho />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onView(item)}>
          <Eye className={ICONE} />
          <span>Visualizar</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit(item)}>
          <Edit className={ICONE} />
          <span>Editar</span>
        </DropdownMenuItem>
        {item.tipo === 'receita' && !isLiquidado(item.status || 'Pendente') && (
          <DropdownMenuItem onClick={() => onRecebimento(item)}>
            <DollarSign className={ICONE} />
            <span>Registrar recebimento</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onComprovante(item)}>
          <FileText className={ICONE} />
          <span>Comprovante</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="text-[var(--app-danger-text)]" onClick={() => onDelete(item)}>
          <RotateCcw className="mr-2 h-4 w-4" />
          <span>Excluir</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface AcoesCaixaProps {
  move: CaixaItem
  onView: (item: CaixaItem) => void
  onEdit: (item: CaixaItem) => void
  onDelete: (item: CaixaItem) => void
}

/** Menu de ações de uma movimentação do caixa (tabela e cartão do celular). */
export function AcoesCaixa({ move, onView, onEdit, onDelete }: AcoesCaixaProps) {
  return (
    <DropdownMenu>
      <Gatilho />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onView(move)}>
          <Eye className={ICONE} />
          <span>Visualizar</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit(move)}>
          <Edit className={ICONE} />
          <span>Editar</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onView(move)}>
          <FileText className={ICONE} />
          <span>Comprovante</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="text-[var(--app-danger-text)]" onClick={() => onDelete(move)}>
          <RotateCcw className="mr-2 h-4 w-4" />
          <span>Estornar</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
