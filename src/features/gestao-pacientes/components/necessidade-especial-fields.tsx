'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type NecessidadeEspecialForm = { hasNeeds: 'sim' | 'nao'; categories: string[]; details: string }
export const NECESSIDADE_ESPECIAL_VAZIA: NecessidadeEspecialForm = { hasNeeds: 'nao', categories: [], details: '' }
const CATEGORIAS = ['Física', 'Auditiva', 'Visual', 'Intelectual']

interface NecessidadeEspecialFieldsProps {
    value: NecessidadeEspecialForm
    onChange: (next: NecessidadeEspecialForm) => void
}

const botao = (ativo: boolean) =>
    `flex-1 h-10 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${ativo ? 'bg-white dark:bg-app-primary text-app-primary dark:text-white shadow-sm' : 'text-app-text-muted hover:text-app-text-primary'}`

/** Necessidade especial com categorias e descrição — igual no cadastro da recepção e no portal do paciente. */
export function NecessidadeEspecialFields({ value, onChange }: NecessidadeEspecialFieldsProps) {
    const alternar = (cat: string) =>
        onChange({ ...value, categories: value.categories.includes(cat) ? value.categories.filter((c) => c !== cat) : [...value.categories, cat] })
    return (
        <div className="space-y-6" data-testid="necessidade-especial-fields">
            <div className="space-y-3">
                <Label className="text-sm font-medium text-[var(--app-text-primary)] dark:text-white/70">Portador de necessidade especial?</Label>
                <div className="flex p-1 bg-app-bg-secondary dark:bg-app-hover rounded-2xl w-full max-w-[280px]">
                    <button type="button" onClick={() => onChange({ ...value, hasNeeds: 'sim' })} className={botao(value.hasNeeds === 'sim')}>Sim</button>
                    <button type="button" onClick={() => onChange({ ...value, hasNeeds: 'nao' })} className={botao(value.hasNeeds === 'nao')}>Não</button>
                </div>
            </div>
            {value.hasNeeds === 'sim' && (
                <div className="p-6 app-status-info rounded-2xl border border-transparent space-y-6">
                    <div className="space-y-3">
                        <Label className="text-xs font-black text-app-primary uppercase tracking-widest">CATEGORIAS</Label>
                        <div className="flex flex-wrap gap-3">
                            {CATEGORIAS.map((cat) => (
                                <label key={cat} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${value.categories.includes(cat) ? 'bg-app-primary border-app-primary text-white shadow-md' : 'bg-white dark:bg-app-hover border-app-border dark:border-app-border-dark text-app-text-secondary dark:text-white/60 hover:border-app-primary/50'}`}>
                                    <input type="checkbox" checked={value.categories.includes(cat)} onChange={() => alternar(cat)} className="hidden" />
                                    <span className="text-xs font-bold uppercase tracking-tight">{cat}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    {value.categories.length > 0 && (
                        <div className="space-y-2">
                            <Label htmlFor="needs-details" className="text-xs font-black text-app-primary uppercase tracking-widest">DESCRIÇÃO DETALHADA</Label>
                            <Input id="needs-details" value={value.details} onChange={(e) => onChange({ ...value, details: e.target.value })} placeholder="Ex: Baixa visão no olho esquerdo, necessita de fonte ampliada..." className="h-11 rounded-xl bg-white dark:bg-transparent border-app-border dark:border-app-border-dark" />
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
