'use client'

import { DateInput } from '@/components/shared/date-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatarCPF, formatarTelefone, validarCPF } from '@/lib/validacao-br'
import { calcularIdade } from '../utils/idade'

export type ResponsavelForm = { name: string; cpf: string; phone: string; relationship: string; birthDate: string; age: string }
export const RESPONSAVEL_VAZIO: ResponsavelForm = { name: '', cpf: '', phone: '', relationship: '', birthDate: '', age: '' }

const LABEL = 'text-xs font-bold text-[var(--app-text-secondary)] dark:text-white/60 uppercase'
const INPUT = 'h-11 rounded-xl bg-white dark:bg-transparent border-app-border dark:border-app-border-dark'

interface ResponsavelFieldsProps {
    value: ResponsavelForm
    onChange: (next: ResponsavelForm) => void
    /** Paciente menor de 18 anos: nome e parentesco obrigatórios. */
    obrigatorio: boolean
    /** Paciente acima de 70 anos: responsável opcional, com botão para remover. */
    opcional: boolean
}

/** Bloco "Responsável Legal" — igual no cadastro da recepção e no portal do paciente. */
export function ResponsavelFields({ value, onChange, obrigatorio, opcional }: ResponsavelFieldsProps) {
    if (!obrigatorio && !opcional && !value.name) return null
    const set = (patch: Partial<ResponsavelForm>) => onChange({ ...value, ...patch })
    const cpfInvalido = value.cpf.replace(/\D/g, '').length === 11 && !validarCPF(value.cpf)
    return (
        <div className="mt-8 p-6 bg-[var(--app-bg-secondary)] dark:bg-app-hover rounded-2xl border border-app-border dark:border-app-border-dark space-y-6" data-testid="responsavel-fields">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-app-primary" />
                    <h4 className="text-sm font-bold text-[var(--app-text-primary)] dark:text-white uppercase tracking-widest">Responsável Legal</h4>
                    {obrigatorio && <span className="text-xs app-status-danger text-[var(--app-danger-text)] px-2 py-0.5 rounded-md font-bold uppercase tracking-tight">Obrigatório</span>}
                </div>
                {opcional && !obrigatorio && (
                    <button type="button" onClick={() => onChange({ ...RESPONSAVEL_VAZIO })} className="text-xs font-bold text-[var(--app-danger-text)] uppercase tracking-tight">Remover dados</button>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="resp-nome" className={LABEL}>Nome completo {obrigatorio && '*'}</Label>
                    <Input id="resp-nome" value={value.name} onChange={(e) => set({ name: e.target.value })} className={INPUT} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="resp-cpf" className={LABEL}>CPF do Responsável</Label>
                    <Input id="resp-cpf" value={value.cpf} onChange={(e) => set({ cpf: formatarCPF(e.target.value) })} className={INPUT} placeholder="000.000.000-00" inputMode="numeric" />
                    {cpfInvalido && <p className="mt-1 text-xs leading-snug text-[var(--app-danger-text)]">CPF inválido — confira os dígitos verificadores.</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="resp-tel" className={LABEL}>Telefone do Responsável</Label>
                    <Input id="resp-tel" value={value.phone} onChange={(e) => set({ phone: formatarTelefone(e.target.value) })} className={INPUT} placeholder="(00) 00000-0000" inputMode="tel" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="resp-nasc" className={LABEL}>Data de Nascimento</Label>
                    <DateInput id="resp-nasc" value={value.birthDate} onChange={(date) => set({ birthDate: date, age: calcularIdade(date)?.toString() ?? '' })} className={INPUT} />
                </div>
                <div className="space-y-2">
                    <Label className={LABEL}>Parentesco / Vínculo {obrigatorio && '*'}</Label>
                    <Select value={value.relationship} onValueChange={(v) => set({ relationship: v })}>
                        <SelectTrigger className={INPUT}><SelectValue preferPlaceholder placeholder="Selecione" /></SelectTrigger>
                        <SelectContent><SelectItem value="Pai">Pai</SelectItem><SelectItem value="Mãe">Mãe</SelectItem><SelectItem value="Irmão">Irmão</SelectItem><SelectItem value="Avô/Avó">Avô/Avó</SelectItem><SelectItem value="Outro">Outro</SelectItem></SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    )
}
