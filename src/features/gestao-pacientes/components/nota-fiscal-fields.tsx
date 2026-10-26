'use client'

import { useCallback } from 'react'
import { FeedbackConsulta, SpinnerCampo } from '@/components/shared/feedback-consulta'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useConsultaCep } from '@/hooks/use-consulta-cep'
import { formatarCEP } from '@/lib/validacao-br'
import type { EnderecoCep } from '@/services/cep.service'
import { type EnderecoNf, formatarDocumentoNf, type NotaFiscalForm } from '../utils/nota-fiscal'

const LABEL = 'text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight'
const INPUT = 'h-11 rounded-xl border-app-border dark:border-app-border-dark'

interface NotaFiscalFieldsProps {
    value: NotaFiscalForm
    onChange: (next: NotaFiscalForm) => void
}

function Obrigatorio() {
    return <span className="text-[var(--app-danger-text)]" aria-hidden="true">*</span>
}

export function NotaFiscalFields({ value, onChange }: NotaFiscalFieldsProps) {
    const set = (patch: Partial<NotaFiscalForm>) => onChange({ ...value, ...patch })
    const setEndereco = (patch: Partial<EnderecoNf>) => onChange({ ...value, endereco: { ...value.endereco, ...patch } })

    // Mesmo comportamento do endereço do cadastro: o CEP preenche rua, bairro, cidade e UF
    // sem sobrescrever o que já foi digitado.
    const aoEncontrarCep = useCallback(
        (end: EnderecoCep) => {
            onChange({
                ...value,
                endereco: {
                    ...value.endereco,
                    logradouro: value.endereco.logradouro || end.logradouro,
                    bairro: value.endereco.bairro || end.bairro,
                    cidade: value.endereco.cidade || end.cidade,
                    uf: value.endereco.uf || end.estado,
                },
            })
        },
        [onChange, value],
    )
    const consultaCep = useConsultaCep(aoEncontrarCep)

    const handleCep = (valor: string) => {
        const mascarado = formatarCEP(valor)
        setEndereco({ cep: mascarado })
        void consultaCep.consultar(mascarado)
    }

    const e = value.endereco
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
                        <Label htmlFor="nf-documento" className={LABEL}>CPF ou CNPJ <Obrigatorio /></Label>
                        <Input id="nf-documento" value={value.documento} onChange={(ev) => set({ documento: formatarDocumentoNf(ev.target.value) })} className={INPUT} inputMode="numeric" placeholder="CPF ou CNPJ" aria-required="true" />
                    </div>
                    <div className="md:col-span-4 space-y-2">
                        <Label htmlFor="nf-nome" className={LABEL}>Nome ou razão social <Obrigatorio /></Label>
                        <Input id="nf-nome" value={value.nome} onChange={(ev) => set({ nome: ev.target.value })} className={INPUT} placeholder="Em nome de quem sai a nota" aria-required="true" />
                    </div>

                    <p className={`md:col-span-6 pt-2 ${LABEL}`}>Endereço da nota fiscal</p>
                    <div className="md:col-span-2 space-y-2">
                        <Label htmlFor="nf-cep" className={LABEL}>CEP <Obrigatorio /></Label>
                        <div className="relative">
                            <Input id="nf-cep" value={e.cep} onChange={(ev) => handleCep(ev.target.value)} className={`${INPUT} pr-10`} placeholder="00000-000" inputMode="numeric" aria-required="true" />
                            {consultaCep.status === 'buscando' && <SpinnerCampo />}
                        </div>
                        <FeedbackConsulta
                            status={consultaCep.status}
                            buscando="Buscando endereço..."
                            encontrado="Endereço preenchido pelo CEP — confira e ajuste se precisar."
                            naoEncontrado="CEP não encontrado — preencha o endereço manualmente."
                        />
                    </div>
                    <div className="md:col-span-3 space-y-2">
                        <Label htmlFor="nf-logradouro" className={LABEL}>Logradouro <Obrigatorio /></Label>
                        <Input id="nf-logradouro" value={e.logradouro} onChange={(ev) => setEndereco({ logradouro: ev.target.value })} className={INPUT} aria-required="true" />
                    </div>
                    <div className="md:col-span-1 space-y-2">
                        <Label htmlFor="nf-numero" className={LABEL}>Nº <Obrigatorio /></Label>
                        <Input id="nf-numero" value={e.numero} onChange={(ev) => setEndereco({ numero: ev.target.value })} className={INPUT} aria-required="true" />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                        <Label htmlFor="nf-bairro" className={LABEL}>Bairro <Obrigatorio /></Label>
                        <Input id="nf-bairro" value={e.bairro} onChange={(ev) => setEndereco({ bairro: ev.target.value })} className={INPUT} aria-required="true" />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                        <Label htmlFor="nf-cidade" className={LABEL}>Cidade <Obrigatorio /></Label>
                        <Input id="nf-cidade" value={e.cidade} onChange={(ev) => setEndereco({ cidade: ev.target.value })} className={INPUT} aria-required="true" />
                    </div>
                    <div className="md:col-span-1 space-y-2">
                        <Label htmlFor="nf-uf" className={LABEL}>UF <Obrigatorio /></Label>
                        <Input id="nf-uf" value={e.uf} maxLength={2} onChange={(ev) => setEndereco({ uf: ev.target.value.toUpperCase() })} className={INPUT} aria-required="true" />
                    </div>
                    <div className="md:col-span-1 space-y-2">
                        <Label htmlFor="nf-complemento" className={LABEL}>Comp.</Label>
                        <Input id="nf-complemento" value={e.complemento} onChange={(ev) => setEndereco({ complemento: ev.target.value })} className={INPUT} />
                    </div>
                </div>
            )}
        </div>
    )
}
