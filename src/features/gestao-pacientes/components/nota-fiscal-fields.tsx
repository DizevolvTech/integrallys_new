'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatarDocumentoNf, type NotaFiscalForm } from '../utils/nota-fiscal'

const LABEL = 'text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight'
const INPUT = 'h-11 rounded-xl border-app-border dark:border-app-border-dark'

interface NotaFiscalFieldsProps {
    value: NotaFiscalForm
    onChange: (next: NotaFiscalForm) => void
}

export function NotaFiscalFields({ value, onChange }: NotaFiscalFieldsProps) {
    const set = (patch: Partial<NotaFiscalForm>) => onChange({ ...value, ...patch })
    return (
        <div className="md:col-span-6 space-y-3 rounded-xl border border-app-border dark:border-app-border-dark p-4" data-testid="nota-fiscal-fields">
            <Label className={LABEL}>Dados para emissão da nota fiscal</Label>
            <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="radio" name="nf-modo" checked={value.modo === 'mesmos'} onChange={() => set({ modo: 'mesmos' })} className="h-4 w-4 accent-[var(--app-primary)]" />
                    Os mesmos dados do cadastro
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="radio" name="nf-modo" checked={value.modo === 'adicionar'} onChange={() => set({ modo: 'adicionar' })} className="h-4 w-4 accent-[var(--app-primary)]" />
                    Adicionar outros dados
                </label>
            </div>
            {value.modo === 'adicionar' && (
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                    <div className="md:col-span-2 space-y-2">
                        <Label htmlFor="nf-documento" className={LABEL}>CPF ou CNPJ <span className="text-[var(--app-danger-text)]" aria-hidden="true">*</span></Label>
                        <Input id="nf-documento" value={value.documento} onChange={(e) => set({ documento: formatarDocumentoNf(e.target.value) })} className={INPUT} inputMode="numeric" placeholder="CPF ou CNPJ" aria-required="true" />
                    </div>
                    <div className="md:col-span-4 space-y-2">
                        <Label htmlFor="nf-nome" className={LABEL}>Nome ou razão social <span className="text-[var(--app-danger-text)]" aria-hidden="true">*</span></Label>
                        <Input id="nf-nome" value={value.nome} onChange={(e) => set({ nome: e.target.value })} className={INPUT} placeholder="Em nome de quem sai a nota" aria-required="true" />
                    </div>
                    <div className="md:col-span-6 space-y-2">
                        <Label htmlFor="nf-endereco" className={LABEL}>Endereço (opcional)</Label>
                        <Input id="nf-endereco" value={value.endereco} onChange={(e) => set({ endereco: e.target.value })} className={INPUT} />
                    </div>
                </div>
            )}
        </div>
    )
}
