'use client'

import { useEffect, useState } from 'react'
import { Cake, CheckSquare, Search, Square } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { DateInput } from '@/components/shared/date-input'
import { Input } from '@/components/ui/input'
import { useAniversariantes } from '@/features/relatorios/hooks/use-aniversariantes'

interface AniversariantesModalProps {
  isOpen: boolean
  onClose: () => void
}

const hojeLocal = () => {
  const hoje = new Date()
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
}

const formatDateBR = (isoDate: string) => {
  const [year, month, day] = isoDate.slice(0, 10).split('-')
  if (!year || !month || !day) return isoDate
  return `${day}/${month}/${year}`
}

export function AniversariantesModal({ isOpen, onClose }: AniversariantesModalProps) {
  const [modo, setModo] = useState<'dia' | 'mes'>('dia')
  const [dataFiltro, setDataFiltro] = useState(hojeLocal)
  const [buscaNome, setBuscaNome] = useState('')
  const { linhas, isLoading, error, marcar } = useAniversariantes({
    modo,
    data: dataFiltro,
    q: buscaNome,
    enviado: 'todos',
    ativo: isOpen,
  })

  useEffect(() => {
    if (!isOpen) return
    setBuscaNome('')
    setDataFiltro(hojeLocal())
    setModo('dia')
  }, [isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="lg" className="bg-app-card dark:bg-app-card-dark rounded-integrallys-lg flex flex-col max-h-[90vh]">
        <DialogHeader className="shrink-0 p-6 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl app-status-info flex items-center justify-center border border-[var(--app-primary)]/20">
              <Cake className="h-6 w-6 text-[var(--app-primary)]" />
            </div>
            <div>
              <DialogTitle className="text-xl font-normal text-app-text-primary dark:text-white">
                Lista de Aniversariantes
              </DialogTitle>
              <DialogDescription className="text-xs text-app-text-muted mt-0.5">
                Controle de mensagens de aniversário por dia ou mês.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-4 flex flex-wrap gap-3">
          <div className="flex rounded-integrallys border border-app-border dark:border-app-border-dark overflow-hidden">
            <button
              type="button"
              onClick={() => setModo('dia')}
              className={`h-10 px-4 text-sm ${modo === 'dia' ? 'bg-app-primary text-white' : 'bg-app-card dark:bg-app-bg-dark text-app-text-secondary dark:text-white/80'}`}
            >
              Dia
            </button>
            <button
              type="button"
              onClick={() => setModo('mes')}
              className={`h-10 px-4 text-sm ${modo === 'mes' ? 'bg-app-primary text-white' : 'bg-app-card dark:bg-app-bg-dark text-app-text-secondary dark:text-white/80'}`}
            >
              Mês
            </button>
          </div>
          <DateInput value={dataFiltro} onChange={setDataFiltro} className="h-10 max-w-[220px]" />
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-app-text-muted" />
            <Input
              value={buscaNome}
              onChange={(event) => setBuscaNome(event.target.value)}
              placeholder="Buscar por nome..."
              className="h-10 pl-9 rounded-integrallys"
            />
          </div>
        </div>

        <div className="px-6 pb-6 overflow-x-auto overflow-y-auto min-h-0">
          <div className="sm:min-w-[520px] rounded-[12px] border border-app-border dark:border-app-border-dark overflow-hidden">
            <div className="grid grid-cols-12 bg-app-bg-secondary/60 dark:bg-app-bg-dark/60 border-b border-app-border dark:border-app-border-dark text-xs uppercase tracking-wider text-app-text-muted">
              <div className="col-span-8 px-2 py-3 sm:col-span-4 sm:px-4">Cliente</div>
              <div className="col-span-2 hidden px-2 py-3 sm:block sm:px-4">Nascimento</div>
              <div className="col-span-1 hidden px-2 py-3 sm:block sm:px-4">Idade</div>
              <div className="col-span-3 hidden px-2 py-3 sm:block sm:px-4">Telefone</div>
              <div className="col-span-4 px-2 py-3 text-center sm:col-span-2 sm:px-4">OK mensagem</div>
            </div>

            {error && <div className="px-4 py-3 text-sm text-[var(--app-danger-text)]">{error}</div>}

            {!isLoading && linhas.length === 0 && (
              <div className="px-4 py-6 text-sm text-app-text-muted">
                Nenhum aniversariante para o filtro selecionado.
              </div>
            )}

            {linhas.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-12 border-b last:border-b-0 border-app-border dark:border-app-border-dark items-center"
              >
                <div className="col-span-8 px-2 py-3 text-sm text-app-text-primary sm:col-span-4 sm:px-4 dark:text-white">
                  {item.nome}
                  <span className="block text-xs text-app-text-secondary sm:hidden dark:text-white/70">
                    {formatDateBR(item.nascimento)} · {item.idade} anos{item.telefone ? ` · ${item.telefone}` : ''}
                  </span>
                </div>
                <div className="col-span-2 hidden px-2 py-3 text-xs text-app-text-secondary sm:block sm:px-4 sm:text-sm dark:text-white/80">
                  {formatDateBR(item.nascimento)}
                </div>
                <div className="col-span-1 hidden px-2 py-3 text-xs text-app-text-secondary sm:block sm:px-4 sm:text-sm dark:text-white/80">
                  {item.idade}
                </div>
                <div className="col-span-3 hidden px-2 py-3 text-xs text-app-text-secondary sm:block sm:px-4 sm:text-sm dark:text-white/80">
                  {item.telefone}
                </div>
                <div className="col-span-4 flex justify-center px-2 py-3 sm:col-span-2 sm:px-4">
                  <button
                    type="button"
                    onClick={() => void marcar(item.id, !item.enviado)}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-[8px] hover:bg-app-bg-secondary dark:hover:bg-app-bg-dark transition-colors"
                    title={item.enviado ? 'Desmarcar envio' : 'Marcar mensagem enviada'}
                  >
                    {item.enviado ? (
                      <CheckSquare className="h-5 w-5 text-[var(--app-primary)]" />
                    ) : (
                      <Square className="h-5 w-5 text-app-text-muted" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 pb-6 flex justify-end shrink-0">
          <Button variant="outline" onClick={onClose} className="h-10 px-5 rounded-integrallys">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
