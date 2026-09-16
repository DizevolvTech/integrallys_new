'use client'

import { useEffect, useMemo, useState } from 'react'
import { Calendar, CreditCard } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CobrarOnlineModal } from '@/features/financeiro/modals/cobrar-online-modal'
import { useContasBancarias } from '@/features/gestao-bancaria/hooks/use-contas-bancarias'

interface CobrancaInfo {
  paciente: string
  profissional: string
  horario: string
  procedimento?: string
  valorProcedimento?: number
  totalPago?: number
  dataPagamentoAnterior?: string
}

export interface EmitirCobrancaConfirmPayload {
  descricao: string
  valor: number
  metodo: string
  observacoes: string
  bandeira?: string
  parcelas?: number
  contaBancariaId?: string
}

interface EmitirCobrancaModalProps {
  isOpen: boolean
  onClose: () => void
  agenda?: CobrancaInfo | null
  /** Opcional: vincula a cobrança online ao agendamento (não-bloqueante). */
  agendamentoId?: string
  onConfirm: (payload: EmitirCobrancaConfirmPayload) => Promise<void> | void
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)

const formatDateBR = (value: string) => {
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

function isCartao(metodo: string) {
  const m = metodo.toLowerCase()
  return m.includes('cartão') || m.includes('cartao')
}

function isCredito(metodo: string) {
  const m = metodo.toLowerCase()
  return m.includes('crédito') || m.includes('credito')
}

function isPix(metodo: string) {
  return metodo.toLowerCase().includes('pix')
}

export function EmitirCobrancaModal({ isOpen, onClose, agenda, agendamentoId, onConfirm }: EmitirCobrancaModalProps) {
  const { data: contas } = useContasBancarias()
  const contasAtivas = useMemo(() => contas.filter((item) => item.ativo), [contas])

  const [metodo, setMetodo] = useState<string>('')
  const [valorRecebido, setValorRecebido] = useState<string>('')
  const [observacao, setObservacao] = useState<string>('')
  const [bandeira, setBandeira] = useState('')
  const [parcelas, setParcelas] = useState('1')
  const [contaBancariaId, setContaBancariaId] = useState('')
  const [error, setError] = useState<string>('')
  const [cobrarOnlineOpen, setCobrarOnlineOpen] = useState(false)

  const valorEfetivo = agenda?.valorProcedimento ?? 0
  const totalPago = agenda?.totalPago ?? 0
  const saldoRestante = Math.max(0, valorEfetivo - totalPago)
  const quitado = valorEfetivo > 0 && saldoRestante <= 0
  const temPagamentoParcial = totalPago > 0 && saldoRestante > 0

  const descricao = agenda
    ? `Cobrança de consulta - ${agenda.paciente}${agenda.procedimento ? ` (${agenda.procedimento})` : ''}`
    : 'Cobrança de consulta'

  useEffect(() => {
    if (!isOpen) {
      setMetodo('')
      setValorRecebido('')
      setObservacao('')
      setBandeira('')
      setParcelas('1')
      setContaBancariaId('')
      setError('')
      return
    }

    if (quitado) {
      setValorRecebido('')
      return
    }

    if (saldoRestante > 0) {
      setValorRecebido(String(Number(saldoRestante.toFixed(2))))
    } else {
      setValorRecebido('')
    }
  }, [isOpen, quitado, saldoRestante])

  useEffect(() => {
    if (!isCartao(metodo)) setBandeira('')
    if (!isCredito(metodo)) setParcelas('1')
    if (!isPix(metodo)) setContaBancariaId('')
  }, [metodo])

  const handleConfirm = async () => {
    const parsed = Number(String(valorRecebido).replace(',', '.'))

    if (!metodo) {
      setError('Selecione o método de pagamento.')
      return
    }

    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Informe um valor válido.')
      return
    }

    if (isCartao(metodo) && !bandeira) {
      setError('Informe a bandeira do cartão.')
      return
    }

    if (isPix(metodo) && !contaBancariaId) {
      setError('Selecione a conta bancária do PIX.')
      return
    }

    await onConfirm({
      descricao,
      valor: Number(parsed.toFixed(2)),
      metodo,
      observacoes: observacao.trim(),
      bandeira: isCartao(metodo) ? bandeira : undefined,
      parcelas: isCredito(metodo) ? Number(parcelas) || 1 : undefined,
      contaBancariaId: isPix(metodo) ? contaBancariaId : undefined,
    })
  }

  const valorOnline = quitado ? 0 : saldoRestante

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-app-card dark:bg-app-card-dark">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-normal">
            <CreditCard className="h-5 w-5 text-[var(--app-primary)]" />
            Emitir nova cobrança
          </DialogTitle>
          <DialogDescription>Preencha os dados para registrar o recebimento</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-6 pt-0">
          <div className="rounded-integrallys bg-app-bg-secondary p-3 dark:bg-app-bg-dark/50">
            <p className="mb-1 text-sm font-medium text-app-text-primary dark:text-white">
              Paciente: {agenda?.paciente ?? 'Paciente'}
            </p>
            <p className="text-xs text-[var(--app-text-secondary)] dark:text-app-text-muted">
              {agenda?.profissional ?? 'Profissional'} • {agenda?.horario ?? '--:--'}
              {agenda?.procedimento ? ` • ${agenda.procedimento}` : ''}
            </p>
          </div>

          <div className="app-status-info space-y-3 rounded-integrallys border border-transparent p-4">
            <h4 className="text-sm font-normal text-[var(--app-info-text)]">Resumo da cobrança</h4>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <p className="text-[var(--app-text-secondary)] dark:text-app-text-muted">Valor do procedimento:</p>
                <p className="font-normal text-app-text-primary dark:text-white">{formatCurrency(valorEfetivo)}</p>
              </div>

              <div className="flex items-center justify-between text-xs">
                <p className="text-[var(--app-text-secondary)] dark:text-app-text-muted">Total já pago:</p>
                <p className="font-normal text-[var(--app-success-text)] dark:text-[var(--app-success-text)]">
                  {formatCurrency(totalPago)}
                </p>
              </div>

              {temPagamentoParcial && agenda?.dataPagamentoAnterior && (
                <div className="flex items-center justify-between text-xs">
                  <p className="text-[var(--app-text-secondary)] dark:text-app-text-muted">Data do pagamento anterior:</p>
                  <p className="font-normal text-app-text-primary dark:text-white">
                    {formatDateBR(agenda.dataPagamentoAnterior)}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-[#bedbff] pt-2 text-xs dark:border-transparent">
                <p className="font-medium text-app-text-primary dark:text-white">Saldo a receber:</p>
                <p className="text-sm font-bold text-app-primary dark:text-[var(--app-info-text)]">
                  {formatCurrency(quitado ? 0 : saldoRestante)}
                </p>
              </div>
              {quitado && (
                <p className="text-xs text-[var(--app-success-text)]">Consulta já quitada.</p>
              )}
              {temPagamentoParcial && (
                <p className="text-xs text-[var(--app-warning-text)]">
                  Pagamento parcial em aberto — registre o restante ou deixe na inadimplência.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Método de pagamento *</Label>
            <Select
              value={metodo}
              onValueChange={(value) => {
                setMetodo(value)
                setError('')
              }}
            >
              <SelectTrigger>
                <SelectValue preferPlaceholder placeholder="Selecione o método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                <SelectItem value="PIX">PIX</SelectItem>
                <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                <SelectItem value="Transferência">Transferência</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isCartao(metodo) && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Bandeira *</Label>
                <Select
                  value={bandeira || '__none__'}
                  onValueChange={(value) => {
                    setBandeira(value === '__none__' ? '' : value)
                    setError('')
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a bandeira" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" disabled>
                      Selecione
                    </SelectItem>
                    <SelectItem value="Visa">Visa</SelectItem>
                    <SelectItem value="Mastercard">Mastercard</SelectItem>
                    <SelectItem value="Elo">Elo</SelectItem>
                    <SelectItem value="Amex">Amex</SelectItem>
                    <SelectItem value="Hipercard">Hipercard</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isCredito(metodo) && (
                <div className="space-y-2">
                  <Label>Parcelas</Label>
                  <Select value={parcelas} onValueChange={setParcelas}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, idx) => idx + 1).map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}x
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {isPix(metodo) && (
            <div className="space-y-2">
              <Label>Conta PIX *</Label>
              <Select
                value={contaBancariaId || '__none__'}
                onValueChange={(value) => {
                  setContaBancariaId(value === '__none__' ? '' : value)
                  setError('')
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" disabled>
                    Selecione a conta
                  </SelectItem>
                  {contasAtivas.length === 0 && (
                    <SelectItem value="__empty__" disabled>
                      Nenhuma conta bancária cadastrada
                    </SelectItem>
                  )}
                  {contasAtivas.map((conta) => (
                    <SelectItem key={conta.id} value={conta.id}>
                      {conta.nome}
                      {conta.banco ? ` · ${conta.banco}` : ''}
                      {conta.conta ? ` · ${conta.conta}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Valor a receber agora (R$) *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-app-text-secondary dark:text-app-text-muted">
                R$
              </span>
              <Input
                placeholder="0,00"
                type="number"
                step="0.01"
                className="h-11 pl-10"
                value={valorRecebido}
                onChange={(e) => {
                  setValorRecebido(e.target.value)
                  setError('')
                }}
              />
            </div>
            <p className="text-xs text-app-text-muted">
              Pode registrar valor parcial — o saldo permanece em aberto.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Observação</Label>
            <Textarea
              placeholder="Informações adicionais sobre o recebimento..."
              className="min-h-[80px] resize-none"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1 text-xs text-app-text-muted">
            <Calendar className="h-3 w-3" />
            {formatDateBR(new Date().toISOString().split('T')[0])}
          </div>

          {error && <p className="text-xs text-[var(--app-danger-text)]">{error}</p>}
        </div>

        <DialogFooter className="gap-3 p-6 pt-0 sm:gap-0">
          <Button variant="outline" onClick={onClose} className="h-11 w-full rounded-integrallys px-6 sm:w-auto">
            Cancelar
          </Button>
          <Button
            variant="outline"
            onClick={() => setCobrarOnlineOpen(true)}
            className="h-11 w-full rounded-integrallys px-6 sm:w-auto"
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Cobrar online
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={quitado}
            className="h-11 w-full rounded-integrallys bg-app-primary px-8 font-normal text-white shadow-sm transition-all active:scale-[0.98] hover:bg-app-primary-hover sm:w-auto disabled:opacity-50"
          >
            {quitado ? 'Já quitado' : 'Confirmar recebimento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <CobrarOnlineModal
      isOpen={cobrarOnlineOpen}
      onClose={(open) => setCobrarOnlineOpen(open)}
      agendamentoId={agendamentoId}
      valor={valorOnline}
      descricao={descricao}
    />
    </>
  )
}
