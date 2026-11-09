'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { ModalHeader } from '@/components/shared/modal-header'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { CaixaItem, EstornoPayload, EstornoPrevia, EstornoResultado } from '@/hooks/use-caixa'
import { MOTIVO_ESTORNO_MIN } from '@/lib/estorno-caixa'
import { cn } from '@/lib/utils'

interface EstornarMovimentoModalProps {
  item: CaixaItem | null
  onClose: () => void
  carregarPrevia: (id: string) => Promise<EstornoPrevia>
  onConfirm: (payload: EstornoPayload) => Promise<EstornoResultado>
}

const brl = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

function Opcoes<T extends string>({ rotulo, valor, opcoes, onChange }: { rotulo: string; valor: T; opcoes: { valor: T; texto: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="m-0 min-w-0 space-y-2 border-0 p-0">
      <legend className="text-sm font-medium leading-none text-app-text-primary dark:text-white">{rotulo}</legend>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((opcao) => (
          <button
            key={opcao.valor}
            type="button"
            aria-pressed={valor === opcao.valor}
            onClick={() => onChange(opcao.valor)}
            className={cn(
              'h-11 rounded-xl border px-4 text-sm transition-colors',
              valor === opcao.valor
                ? 'border-[var(--app-primary)] bg-[var(--app-primary)]/10 text-app-text-primary dark:text-white'
                : 'border-app-border text-app-text-secondary hover:bg-app-bg-secondary dark:border-app-border-dark dark:text-white/70 dark:hover:bg-app-hover',
            )}
          >
            {opcao.texto}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function EstornarMovimentoModal({ item, onClose, carregarPrevia, onConfirm }: EstornarMovimentoModalProps) {
  const [previa, setPrevia] = useState<EstornoPrevia | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [devolver, setDevolver] = useState<'sim' | 'nao'>('sim')
  const [acao, setAcao] = useState<'cancelar' | 'reabrir'>('cancelar')
  const [enviando, setEnviando] = useState(false)
  const id = item?.id ?? null
  const carregarRef = useRef(carregarPrevia)
  carregarRef.current = carregarPrevia

  useEffect(() => {
    setPrevia(null)
    setErro(null)
    setMotivo('')
    setDevolver('sim')
    setAcao('cancelar')
    if (!id) return
    let ativo = true
    setCarregando(true)
    carregarRef.current(id)
      .then((dados) => ativo && setPrevia(dados))
      .catch((err) => ativo && setErro(err instanceof Error ? err.message : 'Não foi possível carregar a movimentação.'))
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [id])

  const motivoOk = motivo.trim().length >= MOTIVO_ESTORNO_MIN
  const podeConfirmar = Boolean(previa?.estornavel) && motivoOk && !enviando
  const mostraAcaoPrescricao = previa?.prescricao?.status === 'Convertida'

  const confirmar = async () => {
    if (!item || !previa) return
    if (!motivoOk) {
      toast.error(`Informe o motivo do estorno (mínimo de ${MOTIVO_ESTORNO_MIN} caracteres).`)
      return
    }
    setEnviando(true)
    try {
      const resultado = await onConfirm({
        id: item.id,
        motivo: motivo.trim(),
        ...(previa.prescricao ? { devolverEstoque: previa.temProdutoEstoque ? devolver === 'sim' : false } : {}),
        ...(mostraAcaoPrescricao ? { prescricaoAcao: acao } : {}),
      })
      toast.success(resultado.mensagem)
      onClose()
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Não foi possível estornar a movimentação.'
      setErro(mensagem)
      toast.error(mensagem)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={item !== null} onOpenChange={(aberto) => !aberto && !enviando && onClose()}>
      <DialogContent size="md" className="gap-0 rounded-[24px] border border-app-border p-0 dark:border-app-border-dark">
        <div className="flex max-h-[90vh] flex-col bg-app-card dark:bg-app-card-dark">
          <ModalHeader
            className="px-6 pb-4 pt-8 sm:px-8"
            icon={Undo2}
            title="Estornar movimentação"
            description="A movimentação original continua na lista, marcada como Estornada, e o caixa recebe o lançamento de estorno."
          />
          <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto px-6 pb-6 pt-2 sm:px-8">
            {item && (
              <div className="rounded-[16px] border border-app-border bg-app-bg-secondary/40 p-4 dark:border-app-border-dark dark:bg-app-hover/30">
                <p className="text-xs uppercase tracking-wider text-app-text-muted">Valor</p>
                <p className="mt-0.5 text-lg tabular-nums text-app-text-primary dark:text-white" data-testid="estorno-valor">{brl(item.valor)}</p>
                <p className="mt-2 break-words text-sm text-app-text-secondary dark:text-white/70">{item.descricao}</p>
              </div>
            )}

            {carregando && <p className="text-sm text-app-text-secondary">Carregando dados da movimentação...</p>}
            {previa && !previa.estornavel && (
              <p role="alert" className="text-sm text-[var(--app-danger-text)]">{previa.motivoRecusa ?? 'Esta movimentação não pode ser estornada.'}</p>
            )}

            {previa?.estornavel && (
              <>
                {previa.prescricao && previa.temProdutoEstoque && (
                  <div className="space-y-2">
                    <Opcoes
                      rotulo="Devolver os produtos ao estoque"
                      valor={devolver}
                      onChange={setDevolver}
                      opcoes={[{ valor: 'sim', texto: 'Sim' }, { valor: 'nao', texto: 'Não' }]}
                    />
                    <p className="text-xs text-app-text-muted">
                      {previa.produtosEstoque.map((p) => `${p.quantidade}× ${p.nome}`).join(', ')}
                    </p>
                  </div>
                )}
                {mostraAcaoPrescricao && (
                  <Opcoes
                    rotulo="O que fazer com a prescrição/orçamento"
                    valor={acao}
                    onChange={setAcao}
                    opcoes={[{ valor: 'cancelar', texto: 'Cancelar' }, { valor: 'reabrir', texto: 'Reabrir (volta para Ativa)' }]}
                  />
                )}
                <div className="space-y-2">
                  <Label htmlFor="caixa-estorno-motivo">Motivo do estorno *</Label>
                  <Textarea
                    id="caixa-estorno-motivo"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder={`Descreva o motivo (mínimo ${MOTIVO_ESTORNO_MIN} caracteres)`}
                    className="min-h-[96px] rounded-xl"
                  />
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    {previa.tipo === 'entrada'
                      ? 'Uma saída de estorno será lançada no caixa aberto de hoje. Esta ação não pode ser desfeita.'
                      : 'Uma entrada de estorno será lançada no caixa aberto de hoje. Esta ação não pode ser desfeita.'}
                  </p>
                </div>
              </>
            )}
            {erro && <p role="alert" className="text-sm text-[var(--app-danger-text)]">{erro}</p>}
          </div>
          <DialogFooter className="flex-col-reverse gap-2 border-t border-app-border bg-app-bg-secondary/35 px-6 py-5 dark:border-app-border-dark dark:bg-app-hover/30 sm:flex-row sm:px-8">
            <Button type="button" variant="outline" onClick={onClose} disabled={enviando} className="h-11 rounded-xl px-6">
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void confirmar()}
              disabled={!podeConfirmar}
              className="h-11 rounded-xl bg-[var(--app-danger-text)] px-6 text-white hover:opacity-90"
            >
              {enviando ? 'Estornando...' : 'Confirmar estorno'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
