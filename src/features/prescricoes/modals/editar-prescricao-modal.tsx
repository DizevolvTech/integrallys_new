'use client'

import { useEffect, useState } from 'react'
import { ShoppingCart, CheckCircle2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import type { PrescricaoInput, PrescricaoItem } from '@/hooks/use-prescricoes'

interface EditarPrescricaoModalProps {
  isOpen: boolean
  onClose: (open: boolean) => void
  prescricao: PrescricaoItem | null
  patients: Array<{ id: string; nome: string }>
  onSave?: (prescricao: PrescricaoInput) => void | Promise<void>
}

export function EditarPrescricaoModal({ isOpen, onClose, prescricao, patients, onSave }: EditarPrescricaoModalProps) {
  const [patientId, setPatientId] = useState('')
  const [status, setStatus] = useState<'Ativa' | 'Vencida' | 'Convertida'>('Ativa')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [tipo, setTipo] = useState('Prescrição')
  const [valorTotal, setValorTotal] = useState('')
  const [validade, setValidade] = useState('')
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    if (!prescricao) return
    setPatientId(prescricao.pacienteId ?? '')
    const normalized = prescricao.status.toLowerCase()
    setStatus(normalized.includes('venc') ? 'Vencida' : normalized.includes('convert') ? 'Convertida' : 'Ativa')
    setPaymentMethod('')
    setTipo(prescricao.tipo || 'Prescrição')
    setValorTotal(String(prescricao.valorTotal || ''))
    setValidade(prescricao.validade ? new Date(prescricao.validade.split('/').reverse().join('-')).toISOString().slice(0, 10) : '')
    setObservacoes(prescricao.observacoes || '')
  }, [prescricao])

  if (!prescricao) return null

  return (
    <Dialog open={isOpen} onOpenChange={(v) => onClose(v)}>
      <DialogContent size="xl" className="bg-app-card dark:bg-app-card-dark rounded-[24px] border-none p-0 flex flex-col shadow-2xl">
        <div className="px-8 py-6 bg-app-card dark:bg-app-card-dark border-b border-app-border dark:border-app-border-dark flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4"><div className="h-12 w-12 app-status-info rounded-2xl flex items-center justify-center text-app-primary dark:text-[var(--app-info-text)]"><ShoppingCart className="h-6 w-6" /></div><div><DialogTitle className="text-2xl font-bold text-app-text-primary dark:text-white">Editar Prescrição/Vendas</DialogTitle><p className="text-base text-app-text-secondary dark:text-white/60 font-normal">Editando: {prescricao.numero}</p></div></div>
          <div className="hidden md:block"><p className="text-xs text-app-text-muted uppercase font-bold tracking-wider mb-1">Total Atual</p><p className="text-3xl font-bold text-app-primary dark:text-[var(--app-info-text)] leading-none">R$ {prescricao.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
        </div>
        <div className="flex-1 overflow-hidden grid grid-cols-12 relative">
          <div className="col-span-12 lg:col-span-8 p-8 overflow-y-auto bg-app-bg-secondary/50 dark:bg-app-surface-muted border-r border-app-border dark:border-app-border-dark flex flex-col gap-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-white dark:bg-app-hover rounded-2xl border border-app-border dark:border-app-border-dark shadow-sm">
              <div className="space-y-3"><Label className="text-sm font-bold text-app-text-primary dark:text-white/70 uppercase tracking-wide">Paciente</Label><Select value={patientId} onValueChange={setPatientId}><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Selecione o paciente" /></SelectTrigger><SelectContent>{patients.map((patient) => <SelectItem key={patient.id} value={patient.id}>{patient.nome}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-3"><Label className="text-sm font-bold text-app-text-primary dark:text-white/70 uppercase tracking-wide">Numero</Label><Input value={prescricao.numero} disabled className="h-12 rounded-xl opacity-70" /></div>
              <div className="space-y-3"><Label className="text-sm font-bold text-app-text-primary dark:text-white/70 uppercase tracking-wide">Tipo</Label><Input value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-12 rounded-xl" /></div>
              <div className="space-y-3"><Label className="text-sm font-bold text-app-text-primary dark:text-white/70 uppercase tracking-wide">Validade</Label><Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} className="h-12 rounded-xl" /></div>
              <div className="space-y-3 md:col-span-2"><Label className="text-sm font-bold text-app-text-primary dark:text-white/70 uppercase tracking-wide">Observações</Label><Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className="min-h-[110px] rounded-xl" /></div>
            </div>
            <div className="rounded-2xl border border-app-border dark:border-app-border-dark overflow-hidden bg-white dark:bg-app-hover">
              <div className="px-6 py-5 border-b border-app-border dark:border-app-border-dark"><h3 className="text-xl font-bold text-app-text-primary dark:text-white flex items-center gap-2"><CheckCircle2 size={20} className="text-[var(--app-success-text)]" />Itens da venda</h3><p className="text-sm text-app-text-secondary dark:text-white/60 mt-1">Os itens detalhados aparecerão aqui assim que a API retornar a composição completa da venda.</p></div>
              <Table><TableHeader><TableRow className="hover:bg-transparent border-b border-app-border dark:border-app-border-dark"><TableHead className="pl-6">Produto</TableHead><TableHead className="text-center">Qtd</TableHead><TableHead>Posologia</TableHead><TableHead className="text-right">Valor Unit.</TableHead><TableHead className="text-right pr-6">Total</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell colSpan={5} className="py-12 text-center text-app-text-secondary dark:text-white/60">Nenhum item detalhado retornado pela API.</TableCell></TableRow></TableBody></Table>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-4 bg-app-card dark:bg-app-card-dark flex flex-col h-full border-l border-app-border dark:border-app-border-dark shadow-2xl z-10 relative overflow-hidden">
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar"><h3 className="text-xl font-bold text-app-text-primary dark:text-white flex items-center gap-2 mb-8">Status e Pagamento</h3><div className="space-y-8"><div className="space-y-3"><Label className="text-sm font-bold text-app-text-primary dark:text-white/70">Status da Prescrição/Vendas</Label><Select value={status} onValueChange={(v) => setStatus(v as 'Ativa' | 'Vencida' | 'Convertida')}><SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Ativa">Ativa</SelectItem><SelectItem value="Convertida">Convertida</SelectItem><SelectItem value="Vencida">Vencida</SelectItem></SelectContent></Select></div><div className="space-y-3"><Label className="text-sm font-bold text-app-text-primary dark:text-white/70">Forma de Pagamento</Label><Select value={paymentMethod} onValueChange={setPaymentMethod}><SelectTrigger className="h-12 rounded-xl"><SelectValue preferPlaceholder placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="dinheiro">Dinheiro</SelectItem><SelectItem value="pix">PIX</SelectItem><SelectItem value="cartao_credito">Cartão de Crédito</SelectItem><SelectItem value="cartao_debito">Cartão de Débito</SelectItem><SelectItem value="consumo">Consumo</SelectItem></SelectContent></Select></div><div className="space-y-3"><Label className="text-sm font-bold text-app-text-primary dark:text-white/70">Valor total</Label><Input value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} className="h-12 rounded-xl" inputMode="decimal" /></div><div className="mt-8 p-6 bg-app-bg-secondary dark:bg-app-hover rounded-2xl border border-app-border dark:border-app-border-dark space-y-4"><div className="flex justify-between items-end"><span className="text-lg font-bold text-app-text-primary dark:text-white mb-1">Total Final</span><div className="text-right"><span className="text-3xl font-extrabold text-app-primary dark:text-[var(--app-info-text)] leading-none">R$ {Number(valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div></div></div></div></div>
            <div className="border-t border-app-border/80 bg-app-card px-6 pb-6 pt-5 shrink-0 dark:border-app-border-dark dark:bg-app-card-dark sm:px-8 sm:pb-8 sm:pt-6"><div className="space-y-3 rounded-2xl bg-app-bg-secondary/35 p-4 dark:bg-app-surface-muted/60 sm:p-5"><Button onClick={() => { if (onSave && patientId) { void onSave({ id: prescricao.id, pacienteId: patientId, numero: prescricao.numero, valorTotal: Number(valorTotal || 0), status, tipo, data: prescricao.data ? prescricao.data.split('/').reverse().join('-') : undefined, validade: validade || undefined, observacoes: observacoes || undefined }); } onClose(false) }} className="w-full h-14 rounded-xl bg-app-primary hover:bg-app-primary-hover text-white font-bold shadow-xl shadow-sm text-lg transition-all hover:scale-[1.02] active:scale-98 uppercase tracking-wide">{onSave ? 'Salvar Alterações' : 'Fechar painel'}</Button><Button variant="ghost" onClick={() => onClose(false)} className="w-full h-12 rounded-xl border border-transparent font-semibold text-app-text-secondary hover:border-app-border hover:text-app-text-primary hover:bg-app-hover dark:hover:border-app-border-dark dark:hover:bg-app-hover">{onSave ? 'Cancelar' : 'Fechar'}</Button></div></div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
