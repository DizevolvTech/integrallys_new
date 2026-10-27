'use client'

import { useId } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'

const LABEL = 'text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight'

interface ConvenioFieldProps {
    value: string
    onChange: (convenio: string) => void
    /** Falso no portal do paciente: sem listar convênios de outros cadastros. */
    sugerir?: boolean
}

/** Convênio/plano do paciente: texto livre, vazio = Particular; sugere Particular e os convênios já usados. */
export function ConvenioField({ value, onChange, sugerir = true }: ConvenioFieldProps) {
    const listId = useId()
    const api = useApi()
    const { data } = useQuery({
        queryKey: ['pacientes-convenios'],
        queryFn: () => api.get<{ data: string[] }>('/api/pacientes/convenios'),
        enabled: sugerir,
        staleTime: 60_000,
    })
    const opcoes = ['Particular', ...(sugerir ? (data?.data ?? []) : [])]
    return (
        <div className="md:col-span-2 space-y-2">
            <Label className={LABEL}>Convênio / plano</Label>
            <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                list={listId}
                maxLength={80}
                placeholder="Particular"
                className="h-11 rounded-xl border-app-border dark:border-app-border-dark"
            />
            <datalist id={listId}>
                {opcoes.map((o) => <option key={o} value={o} />)}
            </datalist>
        </div>
    )
}
