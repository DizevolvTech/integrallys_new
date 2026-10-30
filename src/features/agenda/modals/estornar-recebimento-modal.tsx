'use client'

import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

import { ModalHeader } from '@/components/shared/modal-header'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useApi } from '@/hooks/use-api'
import { MOTIVO_ESTORNO_MIN } from '@/lib/estorno-recebimento'

interface RecebimentoEstornavel {
  id: string
  valor: number
  metodo: string
  bandeira: string | null
  parcelas: number | null
  pagoEm: string | null
}

interface EstornarRecebimentoModalProps {
  isOpen: boolean
  onClose: () => void
  agendamentoId?: string
  pacienteNome?: string
  /** Chamado depois do estorno gravado (recarrega a agenda e oferece nova cobrança). */
  onEstornado: (resultado: { saidaCaixa: boolean }) => void
}

const moeda = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)

function dataHora(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
}

export function EstornarRecebimentoModal({
  isOpen,
  onClose,
  agendamentoId,
  pacienteNome,
  onEstornado,
}: EstornarRecebimentoModalProps) {
  const api = useApi()
  const [recebimentos, setRecebimentos] = useState<RecebimentoEstornavel[]>([])
  const [selecionado, setSelecionado] = useState('')
  const [motivo, setMotivo] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    setSelecionado('')
    setMotivo('')
    setErro('')
    setRecebimentos([])
    if (!isOpen || !agendamentoId) return
    let ativo = true
    setCarregando(true)
    api
      .get<{ data: RecebimentoEstornavel[] }>(`/api/agenda/pagamentos/estornar?agendamentoId=${agendamentoId}`)
      .then((res) => {
        if (!ativo) return
        setRecebimentos(res.data)
        if (res.data.length === 1) setSelecionado(res.data[0].id)
      })
      .catch((err) => ativo && setErro(err instanceof Error ? err.message : 'Não foi possível carregar os recebimentos.'))
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [api, isOpen, agendamentoId])

  const escolhido = recebimentos.find((item) => item.id === selecionado)

  const confirmar = async () => {
    if (!escolhido) {
      setErro('Escolha o recebimento que será estornado.')
      return
    }
    if (motivo.trim().length < MOTIVO_ESTORNO_MIN) {
      setErro(`Informe o motivo do estorno (mínimo de ${MOTIVO_ESTORNO_MIN} caracteres).`)
      return
    }
    setSalvando(true)
    setErro('')
    try {
      const res = await api.post<{ data?: { saidaCaixa?: boolean } }>('/api/agenda/pagamentos/estornar', {
        pagamentoId: escolhido.id,
        motivo: motivo.trim(),
      })
      onEstornado({ saidaCaixa: res?.data?.saidaCaixa === true })
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Não foi possível estornar o recebimento.'
      setErro(mensagem)
      toast.error(mensagem)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-app-card dark:bg-app-card-dark max-h-[90vh] overflow-y-auto">
        <ModalHeader
          title="Estornar recebimento"
          description={
            pacienteNome
              ? `Retira o valor do financeiro de ${pacienteNome} (e do caixa, se ele entrou no caixa); o saldo do agendamento volta a ficar em aberto.`
              : 'Retira o valor do financeiro (e do caixa, se ele entrou no caixa); o saldo do agendamento volta a ficar em aberto.'
          }
        />

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Recebimento a estornar *</Label>
            {carregando && <p className="text-sm text-app-text-muted">Carregando recebimentos...</p>}
            {!carregando && recebimentos.length === 0 && !erro && (
              <p className="text-sm text-app-text-muted">Este agendamento não tem recebimento para estornar.</p>
            )}
            <div className="space-y-2">
              {recebimentos.map((item) => (
                <label
                  key={item.id}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-integrallys border p-3 text-sm ${
                    selecionado === item.id
                      ? 'border-app-primary bg-app-primary/5'
                      : 'border-app-border dark:border-app-border-dark'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="recebimento-estorno"
                      checked={selecionado === item.id}
                      onChange={() => setSelecionado(item.id)}
                      className="h-4 w-4 accent-[var(--app-primary)]"
                    />
                    <span>
                      <span className="block text-app-text-primary dark:text-white">{moeda(item.valor)}</span>
                      <span className="block text-xs text-app-text-muted">
                        {[item.metodo, item.bandeira, item.parcelas && item.parcelas > 1 ? `${item.parcelas}x` : '']
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  </span>
                  <span className="text-xs text-app-text-muted">{dataHora(item.pagoEm)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivo-estorno">Motivo do estorno *</Label>
            <Textarea
              id="motivo-estorno"
              rows={3}
              placeholder="Ex: Valor lançado errado (R$ 240 em vez de R$ 120)"
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
            />
          </div>

          {escolhido && (
            <p className="rounded-integrallys border border-app-border p-3 text-xs text-app-text-secondary dark:border-app-border-dark dark:text-white/70">
              Se este recebimento entrou no caixa, será lançada uma saída de {moeda(escolhido.valor)}{' '}
              no caixa de hoje; se não entrou
              (ex.: lançado antes de o caixa abrir), nada sai do caixa. O lançamento original fica registrado como estornado, com
              seu nome e a data. Depois é só usar &quot;Emitir nova cobrança&quot; com o valor certo.
            </p>
          )}

          {erro && <p className="text-sm text-[var(--app-danger-text)]">{erro}</p>}
        </div>

        <DialogFooter className="gap-3 pt-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose} className="h-11 w-full rounded-integrallys px-6 sm:w-auto">
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void confirmar()}
            disabled={salvando || carregando || recebimentos.length === 0}
            className="h-11 w-full rounded-integrallys bg-[var(--app-danger-text)] px-6 font-normal text-white hover:opacity-90 sm:w-auto"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {salvando ? 'Estornando...' : 'Estornar recebimento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
