'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { NotaFiscalForm } from '../utils/nota-fiscal'
import { NotaFiscalFields } from './nota-fiscal-fields'
import { OPCOES_ORIGEM } from '../utils/origem'
import { ConvenioField } from './convenio-field'
import { QuemIndicouField } from './quem-indicou-field'

const LABEL = 'text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight'
const INPUT = 'h-11 rounded-xl border-app-border dark:border-app-border-dark'

export type OrigemNfValue = {
    indicacao: string
    convenio: string
    origemDetalhe: string
    indicadoPorId: string | null
    precisaNf: boolean
    notaFiscal: NotaFiscalForm
}

interface OrigemNfFieldsProps {
    value: OrigemNfValue
    onChange: (patch: Partial<OrigemNfValue>) => void
    /** Paciente em edição: não sugere ele mesmo como indicador. */
    excluirId?: string
    /** Falso no portal do paciente (sem busca de outros cadastros). */
    buscarIndicador?: boolean
}

/** Origem/mídia, quem indicou e "precisa de nota fiscal" — igual no cadastro da recepção e no portal do paciente. */
export function OrigemNfFields({ value, onChange, excluirId, buscarIndicador = true }: OrigemNfFieldsProps) {
    return (
        <>
            <ConvenioField value={value.convenio} onChange={(convenio) => onChange({ convenio })} sugerir={buscarIndicador} />
            <div className="md:col-span-2 space-y-2">
                <Label className={LABEL}>Origem *</Label>
                <Select value={value.indicacao} onValueChange={(v) => onChange({ indicacao: v })}>
                    <SelectTrigger className={INPUT}><SelectValue preferPlaceholder placeholder="Como nos achou?" /></SelectTrigger>
                    <SelectContent>{OPCOES_ORIGEM.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            {value.indicacao === 'indicacao' && (
                <QuemIndicouField
                    nome={value.origemDetalhe}
                    indicadoPorId={value.indicadoPorId}
                    excluirId={excluirId}
                    buscar={buscarIndicador}
                    onChange={({ nome, indicadoPorId }) => onChange({ origemDetalhe: nome, indicadoPorId })}
                />
            )}
            {value.indicacao === 'outros' && (
                <div className="md:col-span-2 space-y-2">
                    <Label className={LABEL}>Qual a origem?</Label>
                    <Input value={value.origemDetalhe} onChange={(e) => onChange({ origemDetalhe: e.target.value })} className={INPUT} placeholder="Detalhe da origem" />
                </div>
            )}
            <div className="md:col-span-2 space-y-2">
                <Label className={LABEL}>Precisa de Nota Fiscal?</Label>
                <label className="flex items-center gap-2 h-11 px-3 rounded-xl border border-app-border dark:border-app-border-dark cursor-pointer">
                    <input type="checkbox" checked={value.precisaNf} onChange={(e) => onChange({ precisaNf: e.target.checked })} className="h-4 w-4 accent-[var(--app-primary)]" />
                    <span className="text-xs font-bold uppercase tracking-tight text-app-text-secondary dark:text-white/60">{value.precisaNf ? 'Sim' : 'Não'}</span>
                </label>
            </div>
            {value.precisaNf && <NotaFiscalFields value={value.notaFiscal} onChange={(notaFiscal) => onChange({ notaFiscal })} />}
        </>
    )
}
