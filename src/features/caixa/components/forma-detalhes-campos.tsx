'use client'

import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useContasPix } from '@/features/gestao-bancaria/hooks/use-contas-pix'
import { BANDEIRAS_CARTAO } from '../caixa-format'

export interface FormaDetalhesValor {
  forma: string
  bandeira: string
  parcelas: string
  contaBancariaId: string
}

interface FormaDetalhesCamposProps {
  valor: FormaDetalhesValor
  valorTotal: number
  onChange: (parcial: Partial<FormaDetalhesValor>) => void
}

/** Mensagem de erro quando falta bandeira (cartão) ou conta (PIX); null quando está certo. */
export function erroFormaDetalhes(valor: FormaDetalhesValor): string | null {
  if ((valor.forma === 'cartao_credito' || valor.forma === 'cartao_debito') && !valor.bandeira) return 'Informe a bandeira do cartão.'
  if (valor.forma === 'pix' && !valor.contaBancariaId) return 'Escolha a conta do PIX.'
  return null
}

/** Campos que dependem da forma: conta do PIX; bandeira e parcelas do cartão. */
export function FormaDetalhesCampos({ valor, valorTotal, onChange }: FormaDetalhesCamposProps) {
  const { data: contas } = useContasPix()
  const cartao = valor.forma === 'cartao_credito' || valor.forma === 'cartao_debito'
  const credito = valor.forma === 'cartao_credito'
  const parcelas = Number(valor.parcelas) || 1

  return (
    <>
      {valor.forma === 'pix' && (
        <div className="space-y-2">
          <Label>Conta do PIX</Label>
          <Select value={valor.contaBancariaId || undefined} onValueChange={(contaBancariaId) => onChange({ contaBancariaId })}>
            <SelectTrigger className="h-12 rounded-[12px]" aria-label="Conta do PIX">
              <SelectValue placeholder={contas.length === 0 ? 'Nenhuma conta cadastrada' : 'Selecione a conta'} />
            </SelectTrigger>
            <SelectContent>
              {contas.map((conta) => (
                <SelectItem key={conta.id} value={conta.id}>
                  {conta.nome}
                  {conta.banco && !conta.nome.toLowerCase().includes(conta.banco.toLowerCase()) ? ` · ${conta.banco}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {contas.length === 0 && (
            <p className="text-xs text-app-text-secondary dark:text-white/60">
              Peça ao gestor para cadastrar as contas em Gestão bancária.
            </p>
          )}
        </div>
      )}

      {cartao && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Bandeira</Label>
            <Select value={valor.bandeira || undefined} onValueChange={(bandeira) => onChange({ bandeira })}>
              <SelectTrigger className="h-12 rounded-[12px]" aria-label="Bandeira">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {BANDEIRAS_CARTAO.map((bandeira) => (
                  <SelectItem key={bandeira} value={bandeira}>
                    {bandeira}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {credito && (
            <div className="space-y-2">
              <Label>Parcelas</Label>
              <Select value={valor.parcelas} onValueChange={(p) => onChange({ parcelas: p })}>
                <SelectTrigger className="h-12 rounded-[12px]" aria-label="Parcelas">
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

      {credito && parcelas > 1 && valorTotal > 0 && (
        <p className="text-xs text-app-text-secondary dark:text-white/60">
          {parcelas}× de{' '}
          <span className="font-medium text-app-text-primary dark:text-white">
            R$ {(valorTotal / parcelas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </p>
      )}
    </>
  )
}
