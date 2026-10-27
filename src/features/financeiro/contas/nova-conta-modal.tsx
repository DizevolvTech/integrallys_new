'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { DateInput } from '@/components/shared/date-input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useApi } from '@/hooks/use-api'
import { ANEXO_TIPOS } from '@/lib/financeiro-anexos'
import { gerarParcelas } from '@/lib/financeiro-parcelas'
import { formatCurrency, parseCurrencyInput } from '../financeiro.utils'
import { enviarAnexo } from './anexos-modal'
import type { OpcoesContas } from './use-contas'

interface Props {
  open: boolean
  tipo: 'receita' | 'despesa'
  opcoes: OpcoesContas
  onClose: () => void
  onSaved: () => void
}

function hojeIso() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

const FORM_INICIAL = (): Record<string, string> => ({
  emissao: hojeIso(),
  pessoa: '',
  descricao: '',
  valor: '',
  formaId: '',
  parcelas: '1',
  vencimento: '',
  categoriaId: '',
  numeroDocumento: '',
  observacoes: '',
  tipoAnexo: 'Nota fiscal',
})

const formatarData = (iso: string) => iso.split('-').reverse().join('/')

/** "Novo recebimento" (devedor) e "Nova despesa" (credor): mesmos campos, textos de cada lado. */
export function NovaContaModal({ open, tipo, opcoes, onClose, onSaved }: Props) {
  const api = useApi()
  const receita = tipo === 'receita'
  const [form, setForm] = useState(FORM_INICIAL)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [salvando, setSalvando] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setForm(FORM_INICIAL())
      setArquivo(null)
    }
  }, [open])

  const set = (patch: Record<string, string>) => setForm((atual) => ({ ...atual, ...patch }))
  const categorias = opcoes.categorias.filter((categoria) => categoria.tipo === tipo)
  const valor = parseCurrencyInput(form.valor)
  const quantidade = Math.max(1, Math.min(60, Number(form.parcelas) || 1))
  const primeiroVencimento = form.vencimento || form.emissao

  const previa = useMemo(
    () => (valor > 0 && quantidade > 1 && primeiroVencimento ? gerarParcelas({ valorTotal: valor, parcelas: quantidade, primeiroVencimento }) : []),
    [valor, quantidade, primeiroVencimento],
  )

  const salvar = async () => {
    if (!form.descricao.trim() || valor <= 0 || !form.categoriaId) {
      toast.error('Preencha descrição, valor e categoria de DRE.')
      return
    }
    setSalvando(true)
    try {
      const response = await api.post<{ data: { ids: string[]; parcelas: number } }>('/api/financeiro', {
        contas: true,
        tipo,
        descricao: form.descricao.trim(),
        valor,
        beneficiario: form.pessoa.trim() || undefined,
        dataEmissao: form.emissao,
        vencimento: form.vencimento || undefined,
        formaPagamentoId: form.formaId || undefined,
        numeroParcelas: quantidade,
        categoriaDreId: form.categoriaId,
        numeroDocumento: form.numeroDocumento || undefined,
        observacoes: form.observacoes || undefined,
      })
      if (arquivo && !receita && response.data.ids[0]) {
        const erro = await enviarAnexo(response.data.ids[0], arquivo, form.tipoAnexo)
        if (erro) toast.error(`Despesa salva, mas o documento não foi anexado: ${erro}`)
      }
      toast.success(quantidade > 1 ? `${quantidade} parcelas criadas.` : receita ? 'Recebimento criado.' : 'Despesa criada.')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(proximo) => !proximo && onClose()}>
      <DialogContent className="max-h-[92vh] w-[95%] overflow-y-auto rounded-[24px] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{receita ? 'Novo recebimento' : 'Nova despesa'}</DialogTitle>
          <DialogDescription>
            {receita ? 'Valor a receber de um cliente, à vista ou parcelado.' : 'Conta a pagar a um fornecedor, à vista ou parcelada.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Data de emissão</Label>
            <DateInput value={form.emissao} onChange={(emissao) => set({ emissao })} />
          </div>
          <div className="space-y-2">
            <Label>{receita ? 'Devedor' : 'Credor (fornecedor)'}</Label>
            <Input
              value={form.pessoa}
              onChange={(event) => set({ pessoa: event.target.value })}
              list={receita ? undefined : 'fornecedores-nova-conta'}
              placeholder={receita ? 'Nome do cliente' : 'Nome do fornecedor'}
              className="h-11 rounded-xl"
            />
            {!receita && (
              <datalist id="fornecedores-nova-conta">
                {opcoes.fornecedores.map((item) => <option key={item.id} value={item.nome} />)}
              </datalist>
            )}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Descrição</Label>
            <Input value={form.descricao} onChange={(event) => set({ descricao: event.target.value })} className="h-11 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>{quantidade > 1 ? 'Valor total (R$)' : 'Valor (R$)'}</Label>
            <Input value={form.valor} onChange={(event) => set({ valor: event.target.value })} placeholder="0,00" inputMode="decimal" className="h-11 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>{receita ? 'Forma de recebimento' : 'Forma de pagamento'}</Label>
            <Select value={form.formaId || 'none'} onValueChange={(valor) => set({ formaId: valor === 'none' ? '' : valor })}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não informada</SelectItem>
                {opcoes.formas.map((forma) => <SelectItem key={forma.id} value={forma.id}>{forma.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Parcelamento (nº de parcelas)</Label>
            <Input type="number" min={1} max={60} value={form.parcelas} onChange={(event) => set({ parcelas: event.target.value })} className="h-11 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>{quantidade > 1 ? 'Vencimento da 1ª parcela' : 'Data de vencimento'}</Label>
            <DateInput value={form.vencimento} onChange={(vencimento) => set({ vencimento })} />
            <p className="text-xs text-app-text-muted">Sem data, vence na emissão.</p>
          </div>
          <div className="space-y-2">
            <Label>Categoria de DRE</Label>
            <Select value={form.categoriaId} onValueChange={(categoriaId) => set({ categoriaId })}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {categorias.map((categoria) => <SelectItem key={categoria.id} value={categoria.id}>{categoria.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-app-text-muted">Lista editável em Cadastros › Categorias de DRE.</p>
          </div>
          <div className="space-y-2">
            <Label>Nº do documento</Label>
            <Input value={form.numeroDocumento} onChange={(event) => set({ numeroDocumento: event.target.value })} placeholder="Nota, boleto, recibo..." className="h-11 rounded-xl" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={(event) => set({ observacoes: event.target.value })} className="min-h-[72px] rounded-xl" />
          </div>
          {!receita && (
            <div className="space-y-2 sm:col-span-2">
              <Label>Documento da despesa (opcional)</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select value={form.tipoAnexo} onValueChange={(tipoAnexo) => set({ tipoAnexo })}>
                  <SelectTrigger className="h-11 rounded-xl sm:w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>{ANEXO_TIPOS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                </Select>
                <input ref={entrada} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => setArquivo(event.target.files?.[0] ?? null)} />
                <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => entrada.current?.click()}>
                  {arquivo ? arquivo.name : 'Escolher arquivo (nota, cupom ou recibo)'}
                </Button>
              </div>
            </div>
          )}
          {previa.length > 0 && (
            <div className="rounded-2xl border border-app-border p-3 text-sm sm:col-span-2 dark:border-app-border-dark">
              <p className="mb-2 text-xs uppercase tracking-wider text-app-text-muted">Parcelas que serão criadas</p>
              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {previa.map((parcela) => (
                  <li key={parcela.numero} className="flex justify-between gap-2">
                    <span className="text-app-text-secondary">{parcela.numero}/{parcela.total} · {formatarData(parcela.vencimento)}</span>
                    <span className="tabular-nums">{formatCurrency(parcela.valor)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="h-11 rounded-xl">Cancelar</Button>
          <Button onClick={() => void salvar()} disabled={salvando} className="h-11 rounded-xl bg-app-primary px-6 text-white">
            {salvando ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
