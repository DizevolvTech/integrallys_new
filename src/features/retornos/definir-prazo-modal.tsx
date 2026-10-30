'use client'

import { useState } from 'react'
import { DateInput } from '@/components/shared/date-input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { UNIDADES_PRAZO_RETORNO, type DefinicaoPrazo, type UnidadePrazoRetorno } from '@/lib/retorno-prazo'
import type { RetornoItem } from '@/types/retorno'

interface DefinirPrazoModalProps {
  item: RetornoItem
  onClose: () => void
  /** Grava no servidor; lança erro com mensagem amigável se falhar (o modal permanece aberto). */
  onSalvar: (item: RetornoItem, definicao: DefinicaoPrazo) => Promise<void>
}

const ROTULO_UNIDADE: Record<UnidadePrazoRetorno, string> = {
  dias: 'dias',
  semanas: 'semanas',
  meses: 'meses',
}

const CHIP = 'rounded-full border px-3 py-1.5 text-xs font-normal transition-all'
const CHIP_ATIVO = 'border-[var(--app-primary)] bg-app-primary text-white'
const CHIP_INATIVO = 'border-app-border text-app-text-secondary hover:border-[var(--app-primary)]/40'

/** Define ou edita o prazo de um retorno em aberto: data prevista ou "em N dias/semanas/meses". */
export function DefinirPrazoModal({ item, onClose, onSalvar }: DefinirPrazoModalProps) {
  const [modo, setModo] = useState<'em' | 'data'>('em')
  const [data, setData] = useState('')
  const [quantidade, setQuantidade] = useState('30')
  const [unidade, setUnidade] = useState<UnidadePrazoRetorno>('dias')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const salvar = async () => {
    const definicao: DefinicaoPrazo =
      modo === 'data' ? { modo: 'data', data } : { modo: 'em', quantidade: Number(quantidade), unidade }
    if (modo === 'data' && !data) return setErro('Informe a data prevista do retorno.')
    if (modo === 'em' && !(Number(quantidade) > 0)) return setErro('Informe a quantidade.')
    setSalvando(true)
    setErro('')
    try {
      await onSalvar(item, definicao)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar o prazo.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent size="sm" className="p-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-normal text-app-text-primary dark:text-white">
              {item.dataPrevista ? 'Editar prazo do retorno' : 'Definir prazo do retorno'}
            </h2>
            <p className="text-sm text-app-text-muted">{item.paciente}</p>
          </div>
          <fieldset className="flex flex-wrap gap-2"><legend className="sr-only">Forma de informar o prazo</legend>
            <button type="button" aria-pressed={modo === 'em'} onClick={() => setModo('em')} className={`${CHIP} ${modo === 'em' ? CHIP_ATIVO : CHIP_INATIVO}`}>
              Em quanto tempo
            </button>
            <button type="button" aria-pressed={modo === 'data'} onClick={() => setModo('data')} className={`${CHIP} ${modo === 'data' ? CHIP_ATIVO : CHIP_INATIVO}`}>
              Data prevista
            </button>
          </fieldset>
          {modo === 'data' ? (
            <DateInput value={data} onChange={(v) => { setData(v); setErro('') }} aria-label="Data prevista do retorno" />
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-app-text-muted">Em</span>
                <Input
                  aria-label="Quantidade"
                  inputMode="numeric"
                  className="h-11 w-24"
                  value={quantidade}
                  onChange={(e) => { setQuantidade(e.target.value.replace(/\D/g, '')); setErro('') }}
                />
              </div>
              <fieldset className="flex gap-2"><legend className="sr-only">Unidade do prazo</legend>
                {UNIDADES_PRAZO_RETORNO.map((u) => (
                  <button key={u} type="button" aria-pressed={unidade === u} onClick={() => setUnidade(u)} className={`${CHIP} ${unidade === u ? CHIP_ATIVO : CHIP_INATIVO}`}>
                    {ROTULO_UNIDADE[u]}
                  </button>
                ))}
              </fieldset>
              <p className="text-xs text-app-text-muted">A contagem começa hoje.</p>
            </div>
          )}
          {erro && <p role="alert" className="text-xs text-[var(--app-danger-text)]">{erro}</p>}
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1 font-normal" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1 bg-app-primary font-normal" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar prazo'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
