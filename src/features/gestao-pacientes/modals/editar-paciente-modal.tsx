'use client'

import React, { useCallback, useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Phone, User, MapPin, Heart, Upload, Camera } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/shared/date-input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Patient } from '@/types/patient'
import { NotaFiscalFields } from '../components/nota-fiscal-fields'
import { QuemIndicouField } from '../components/quem-indicou-field'
import { camposFaltandoCadastro, mensagemCamposFaltando } from '../utils/cadastro-validacao'
import { NOTA_FISCAL_VAZIA, notaFiscalFromFinancial, notaFiscalToFinancial, validarNotaFiscal, type NotaFiscalForm } from '../utils/nota-fiscal'
import { DocumentoCadastro } from '../components/documento-cadastro'
import { gerarCadastroPdf, abrirWhatsAppCadastro } from '../utils/documento-pdf'
import { FeedbackConsulta, SpinnerCampo } from '@/components/shared/feedback-consulta'
import { useConsultaCep } from '@/hooks/use-consulta-cep'
import { useConsultaCnpj } from '@/hooks/use-consulta-cnpj'
import {
    formatarCEP,
    formatarCNPJ,
    formatarCPF,
    formatarTelefone,
    normalizarCNPJ,
    validarCNPJ,
    validarCPF,
    validarTelefone,
} from '@/lib/validacao-br'
import type { EnderecoCep } from '@/services/cep.service'
import type { EmpresaCnpj } from '@/services/cnpj.service'
import { toast } from 'sonner'
import { PhotoSourceModal } from '@/features/media/components/photo-source-modal'
import { CameraCaptureModal } from '@/features/media/components/camera-capture-modal'
import type { MediaSelectionResult } from '@/features/media/types'
import { isTransientPhotoUrl, uploadPacienteFoto } from '@/lib/paciente-foto'

const MANUAL_SERVICOS_TEXTO_PADRAO = 'Sem descricao de servicos registrada.'

const VINCULO_OPCOES: Array<{ value: string; label: string }> = [
    { value: 'cliente', label: 'Cliente' },
    { value: 'fornecedor', label: 'Fornecedor' },
    { value: 'prestador', label: 'Prestador' },
    { value: 'profissional', label: 'Profissional' },
    { value: 'usuario', label: 'Usuário' },
    { value: 'outro', label: 'Outro' },
]

interface EditarPacienteModalProps {
    isOpen: boolean
    onClose: () => void
    paciente: Patient | null
    unitOptions: Array<{ id: string; nome: string }>
    lockUnitSelection?: boolean
    onSave?: (patient: Patient) => Promise<void> | void
}

export function EditarPacienteModal({ isOpen, onClose, paciente, unitOptions, lockUnitSelection = false, onSave }: EditarPacienteModalProps) {
    const [formData, setFormData] = useState({
        nome: '',
        cpf: '',
        rg: '',
        inscricaoEstadual: '',
        dataNascimento: '',
        sexo: '',
        telefone: '',
        email: '',
        indicacao: '',
        indicadoPorId: null as string | null,
        status: 'Ativo',
        vinculoTipos: ['cliente'] as string[],
        origemDetalhe: '',
        precisaNf: false,
        notaFiscal: { ...NOTA_FISCAL_VAZIA } as NotaFiscalForm,
        photoUrl: '',
        photoFile: null as File | null,
        addressDetails: {
            zipCode: '',
            street: '',
            number: '',
            complement: '',
            neighborhood: '',
            city: '',
            state: ''
        },
        specialNeeds: { hasNeeds: 'nao', categories: [] as string[], details: '' },
        responsible: { name: '', cpf: '', phone: '', relationship: '', birthDate: '', age: '' },
        supplierData: {
            razaoSocial: '',
            cnpj: '',
            inscricaoEstadual: '',
            contatoNome: '',
            contatoSetor: '',
            categoriaDre: '',
        },
        unidadeId: '',
    })

    const [patientAge, setPatientAge] = useState<number | null>(null);
    const [isSaved, setIsSaved] = useState(false);
    const documentoRef = useRef<HTMLDivElement | null>(null);
    const uploadInputRef = useRef<HTMLInputElement | null>(null)
    const avatarInputRef = useRef<HTMLInputElement | null>(null)
    const [isPhotoSourceOpen, setIsPhotoSourceOpen] = useState(false)
    const [isPhotoCameraOpen, setIsPhotoCameraOpen] = useState(false)

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.type)) return;

        const previewUrl = URL.createObjectURL(file);
        setFormData((prev) => ({ ...prev, photoFile: file, photoUrl: previewUrl }));
    }

    const handlePhotoSelected = (result: MediaSelectionResult) => {
        setFormData((prev) => ({ ...prev, photoFile: result.file, photoUrl: result.previewUrl }))
    }

    const handleSaveOnly = () => {
        setIsSaved(false);
        onClose();
    };

    const handleSaveAndGeneratePdf = async () => {
        if (!documentoRef.current) return;
        await gerarCadastroPdf(documentoRef.current, formData.nome);
        setIsSaved(false);
        onClose();
    };

    const handleSaveAndWhatsapp = async () => {
        if (documentoRef.current) {
            await gerarCadastroPdf(documentoRef.current, formData.nome);
        }
        abrirWhatsAppCadastro(formData.telefone, formData.nome);
        setIsSaved(false);
        onClose();
    };

    useEffect(() => {
        if (paciente) {
            const specialNeedsLegacy = paciente.specialNeeds as { categories?: string[]; types?: string[] } | undefined
            const responsibleLegacy = paciente.responsible as { birthDate?: string; age?: string } | undefined
            const inscricaoEstadualLegacy = paciente as { inscricaoEstadual?: string }
            const birthDate = paciente.birthDate ? new Date(paciente.birthDate) : null;
            let age: number | null = null;
            if (birthDate) {
                const today = new Date();
                age = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
            }
            setPatientAge(age);

            setFormData({
                nome: paciente.name || '',
                cpf: formatarCPF(paciente.cpf || ''),
                rg: paciente.rg || '',
                inscricaoEstadual: inscricaoEstadualLegacy.inscricaoEstadual || '',
                dataNascimento: paciente.birthDate || '',
                sexo: paciente.gender || '',
                telefone: formatarTelefone(paciente.phone || ''),
                email: paciente.email || '',
                indicacao: paciente.source || '',
                status: paciente.activeStatus || 'Ativo',
                vinculoTipos: paciente.vinculoTipos && paciente.vinculoTipos.length > 0 ? paciente.vinculoTipos : ['cliente'],
                origemDetalhe: paciente.origemDetalhe || '',
                indicadoPorId: paciente.indicadoPorId ?? null,
                precisaNf: paciente.precisaNf === true,
                notaFiscal: notaFiscalFromFinancial(paciente.financial),
                photoUrl: paciente.photoUrl || '',
                photoFile: null,
                addressDetails: {
                    zipCode: formatarCEP(paciente.addressDetails?.zipCode || ''),
                    street: paciente.addressDetails?.street || '',
                    number: paciente.addressDetails?.number || '',
                    complement: paciente.addressDetails?.complement || '',
                    neighborhood: paciente.addressDetails?.neighborhood || '',
                    city: paciente.addressDetails?.city || '',
                    state: paciente.addressDetails?.state || ''
                },
                specialNeeds: {
                    hasNeeds: (paciente.specialNeeds?.hasNeeds === true || paciente.specialNeeds?.hasNeeds === 'sim') ? 'sim' : 'nao',
                    categories: specialNeedsLegacy?.categories || specialNeedsLegacy?.types || [],
                    details: paciente.specialNeeds?.details || ''
                },
                responsible: {
                    name: paciente.responsible?.name || '',
                    cpf: formatarCPF(paciente.responsible?.cpf || ''),
                    phone: formatarTelefone(paciente.responsible?.phone || ''),
                    relationship: paciente.responsible?.relationship || '',
                    birthDate: responsibleLegacy?.birthDate || '',
                    age: responsibleLegacy?.age || ''
                },
                supplierData: {
                    razaoSocial: paciente.supplierData?.razaoSocial || '',
                    cnpj: formatarCNPJ(paciente.supplierData?.cnpj || ''),
                    inscricaoEstadual: paciente.supplierData?.inscricaoEstadual || '',
                    contatoNome: paciente.supplierData?.contatoNome || '',
                    contatoSetor: paciente.supplierData?.contatoSetor || '',
                    categoriaDre: paciente.supplierData?.categoriaDre || '',
                },
                unidadeId: paciente.unidadeId || unitOptions[0]?.id || '',
            });
        }
    }, [paciente, unitOptions]);

    const handleDateChange = (date: string) => {
        setFormData((prev) => ({ ...prev, dataNascimento: date }));

        if (date) {
            const birthDate = new Date(`${date}T12:00:00`);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            setPatientAge(age);
        }
    }

    const handleRespDateChange = (date: string) => {
        let age = '';
        if (date) {
            const birthDate = new Date(date);
            const today = new Date();
            let calcAge = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                calcAge--;
            }
            age = calcAge.toString();
        }
        setFormData(prev => ({ ...prev, responsible: { ...prev.responsible, birthDate: date, age } }));
    }

    const needsMandatoryResponsible = patientAge !== null && patientAge < 18;
    const showOptionalResponsible = patientAge !== null && patientAge > 70;

    const aoEncontrarCep = useCallback((endereco: EnderecoCep) => {
        setFormData(prev => ({
            ...prev,
            addressDetails: {
                ...prev.addressDetails,
                street: prev.addressDetails.street || endereco.logradouro,
                neighborhood: prev.addressDetails.neighborhood || endereco.bairro,
                city: prev.addressDetails.city || endereco.cidade,
                state: prev.addressDetails.state || endereco.estado,
            }
        }));
    }, []);

    const aoEncontrarCnpj = useCallback((empresa: EmpresaCnpj) => {
        setFormData((prev) => ({
            ...prev,
            email: prev.email || empresa.email,
            telefone: prev.telefone || formatarTelefone(empresa.telefone),
            addressDetails: {
                ...prev.addressDetails,
                zipCode: prev.addressDetails.zipCode || formatarCEP(empresa.endereco.cep),
                street: prev.addressDetails.street || empresa.endereco.logradouro,
                number: prev.addressDetails.number || empresa.endereco.numero,
                neighborhood: prev.addressDetails.neighborhood || empresa.endereco.bairro,
                city: prev.addressDetails.city || empresa.endereco.cidade,
                state: prev.addressDetails.state || empresa.endereco.estado,
            },
            supplierData: {
                ...prev.supplierData,
                razaoSocial: prev.supplierData.razaoSocial || empresa.razaoSocial,
            },
        }))
    }, []);

    const consultaCep = useConsultaCep(aoEncontrarCep);
    const consultaCnpj = useConsultaCnpj(aoEncontrarCnpj);

    const updateAddress = (field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            addressDetails: { ...prev.addressDetails, [field]: value }
        }));
    }

    const handleCepChange = (valor: string) => {
        const mascarado = formatarCEP(valor);
        updateAddress('zipCode', mascarado);
        void consultaCep.consultar(mascarado);
    }

    const handleCnpjChange = (valor: string) => {
        const mascarado = formatarCNPJ(valor);
        setFormData(prev => ({ ...prev, supplierData: { ...prev.supplierData, cnpj: mascarado } }));
        void consultaCnpj.consultar(mascarado);
    }

    // Só acusa erro depois de o documento estar completo — não enquanto digita.
    const cpfCompletoInvalido = formData.cpf.replace(/\D/g, '').length === 11 && !validarCPF(formData.cpf);
    const telefoneCompletoInvalido = formData.telefone.replace(/\D/g, '').length >= 10 && !validarTelefone(formData.telefone);
    const respCpfCompletoInvalido = formData.responsible.cpf.replace(/\D/g, '').length === 11 && !validarCPF(formData.responsible.cpf);

    const toggleSpecialNeed = (category: string) => {
        const current = formData.specialNeeds.categories;
        const updated = current.includes(category)
            ? current.filter(t => t !== category)
            : [...current, category];
        setFormData(prev => ({ ...prev, specialNeeds: { ...prev.specialNeeds, categories: updated } }));
    }

    const toggleVinculo = (tipo: string) => {
        setFormData(prev => {
            const next = prev.vinculoTipos.includes(tipo)
                ? prev.vinculoTipos.filter(t => t !== tipo)
                : [...prev.vinculoTipos, tipo]
            return { ...prev, vinculoTipos: next.length > 0 ? next : ['cliente'] }
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const faltando = mensagemCamposFaltando(
            camposFaltandoCadastro({
                nome: formData.nome,
                cpf: formData.cpf,
                dataNascimento: formData.dataNascimento,
                cep: formData.addressDetails.zipCode,
                telefone: formData.telefone,
                precisaNf: formData.precisaNf,
                notaFiscal: formData.notaFiscal,
                menorDeIdade: needsMandatoryResponsible,
                responsavelNome: formData.responsible.name,
                responsavelParentesco: formData.responsible.relationship,
            }),
        )
        if (faltando) {
            toast.error(faltando)
            return
        }

        const nfError = validarNotaFiscal(formData.precisaNf, formData.notaFiscal)
        if (nfError) {
            toast.error(nfError)
            return
        }

        const selectedUnit = unitOptions.find((unit) => unit.id === formData.unidadeId)
        if (!selectedUnit) {
            toast.error('Selecione uma unidade válida para o paciente.')
            return
        }

        if (formData.cpf.trim() && !validarCPF(formData.cpf)) {
            toast.error('CPF inválido — confira os dígitos verificadores.')
            return
        }

        if (formData.telefone.trim() && !validarTelefone(formData.telefone)) {
            toast.error('Telefone inválido — confira o DDD e a quantidade de dígitos.')
            return
        }

        if (formData.responsible.cpf.trim() && !validarCPF(formData.responsible.cpf)) {
            toast.error('CPF do responsável inválido — confira os dígitos verificadores.')
            return
        }

        if (formData.responsible.phone.trim() && !validarTelefone(formData.responsible.phone)) {
            toast.error('Telefone do responsável inválido — confira o DDD e a quantidade de dígitos.')
            return
        }

        if (formData.supplierData.cnpj.trim() && !validarCNPJ(formData.supplierData.cnpj)) {
            toast.error('CNPJ inválido — confira os dígitos verificadores.')
            return
        }

        if (paciente) {
            const updatedPatient: Patient = {
                ...paciente,
                unidadeId: selectedUnit.id,
                unidadeName: selectedUnit.nome,
                name: formData.nome.trim(),
                cpf: formData.cpf,
                rg: formData.rg || undefined,
                inscricaoEstadual: formData.inscricaoEstadual || undefined,
                phone: formData.telefone,
                email: formData.email,
                birthDate: formData.dataNascimento || undefined,
                gender: (formData.sexo as Patient['gender']) || undefined,
                source: formData.indicacao || 'Nao informado',
                activeStatus: formData.status as Patient['activeStatus'],
                photoUrl: formData.photoUrl || undefined,
                vinculoTipos: formData.vinculoTipos,
                origemDetalhe: formData.origemDetalhe || undefined,
                indicadoPorId: formData.indicacao === 'indicacao' ? formData.indicadoPorId : null,
                precisaNf: formData.precisaNf,
                financial: notaFiscalToFinancial(formData.precisaNf, formData.notaFiscal),
                age: patientAge != null ? `${patientAge} anos` : undefined,
                address: [
                    formData.addressDetails.street,
                    formData.addressDetails.number,
                    formData.addressDetails.city,
                    formData.addressDetails.state,
                ].filter(Boolean).join(', '),
                addressDetails: {
                    zipCode: formData.addressDetails.zipCode,
                    street: formData.addressDetails.street,
                    number: formData.addressDetails.number,
                    complement: formData.addressDetails.complement,
                    neighborhood: formData.addressDetails.neighborhood,
                    city: formData.addressDetails.city,
                    state: formData.addressDetails.state,
                },
                specialNeeds: {
                    hasNeeds: formData.specialNeeds.hasNeeds === 'sim',
                    categories: formData.specialNeeds.categories,
                    details: formData.specialNeeds.details,
                },
                responsible: formData.responsible.name ? {
                    name: formData.responsible.name,
                    cpf: formData.responsible.cpf,
                    phone: formData.responsible.phone,
                    relationship: formData.responsible.relationship,
                    birthDate: formData.responsible.birthDate,
                    age: formData.responsible.age,
                } : undefined,
                supplierData: formData.vinculoTipos.includes('fornecedor') || formData.vinculoTipos.includes('prestador')
                    ? {
                        razaoSocial: formData.supplierData.razaoSocial,
                        cnpj: normalizarCNPJ(formData.supplierData.cnpj),
                        inscricaoEstadual: formData.supplierData.inscricaoEstadual,
                        contatoNome: formData.supplierData.contatoNome,
                        contatoSetor: formData.supplierData.contatoSetor,
                        categoriaDre: formData.supplierData.categoriaDre,
                    }
                    : undefined,
            }

            try {
                let photoUrl = formData.photoUrl || undefined
                if (formData.photoFile) {
                    photoUrl = await uploadPacienteFoto(
                        formData.photoFile,
                        paciente.id ? String(paciente.id) : undefined,
                    )
                } else if (isTransientPhotoUrl(photoUrl)) {
                    photoUrl = paciente.photoUrl && !isTransientPhotoUrl(paciente.photoUrl)
                        ? paciente.photoUrl
                        : undefined
                }

                await onSave?.({
                    ...updatedPatient,
                    photoUrl,
                })
                toast.success('Cadastro atualizado com sucesso.')
                setIsSaved(true)
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o paciente.')
            }
        }
    }

    const FormSectionHeader = ({ icon: Icon, title, subtitle }: { icon: LucideIcon, title: string, subtitle?: string }) => (
        <div className="flex items-center gap-3 mb-6 mt-2">
            <div className="h-10 w-10 rounded-xl app-status-info flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-app-primary" />
            </div>
            <div>
                <h3 className="text-lg font-semibold text-[var(--app-text-primary)] dark:text-white leading-tight">{title}</h3>
                {subtitle && <p className="text-xs text-[var(--app-text-secondary)] dark:text-white/60 font-normal mt-0.5">{subtitle}</p>}
            </div>
        </div>
    )

    return (
        <>
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent size="xl" className="bg-app-card dark:bg-app-card-dark p-0 border-none rounded-[28px] print:hidden flex flex-col max-h-[90vh] overflow-hidden gap-0">
                <DialogHeader className="p-6 md:p-8 pb-4 border-b border-app-border dark:border-app-border-dark shrink-0">
                    <div className="flex justify-between items-start">
                        <div>
                            <DialogTitle className="text-2xl font-bold text-app-text-primary dark:text-white">Editar paciente</DialogTitle>
                            <DialogDescription className="text-app-text-secondary dark:text-white/60">Atualize as informações do cadastro de {formData.nome || 'paciente'}.</DialogDescription>
                        </div>
                        <div />
                    </div>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar px-6 md:px-8 py-6 bg-app-bg-secondary dark:bg-transparent">
                    {!isSaved ? (
                        <form id="editar-paciente-form" noValidate onSubmit={handleSubmit} className="space-y-12">

                            {/* 1. Informações Básicas */}
                            <div className="bg-white dark:bg-app-hover p-6 rounded-2xl border border-app-border dark:border-app-border-dark shadow-sm animate-in fade-in slide-in-from-top-2">
                                <FormSectionHeader icon={User} title="Dados pessoais" subtitle="Informações de identificação do paciente" />
                                <div className="grid grid-cols-1 md:grid-cols-6 gap-x-5 gap-y-5">
                                    <div className="md:col-span-4 space-y-2">
                                        <Label htmlFor="nome" className="text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight">Nome completo *</Label>
                                        <Input id="nome" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} className="h-11 rounded-xl focus:ring-2 focus:ring-[var(--app-primary)]/20 transition-all border-app-border dark:border-app-border-dark" required />
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <Label htmlFor="cpf" className="text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight">CPF *</Label>
                                        <Input id="cpf" value={formData.cpf} onChange={(e) => setFormData({ ...formData, cpf: formatarCPF(e.target.value) })} className="h-11 rounded-xl border-app-border dark:border-app-border-dark" placeholder="000.000.000-00" inputMode="numeric" required />
                                        {cpfCompletoInvalido && <p className="mt-1 text-xs leading-snug text-[var(--app-danger-text)]">CPF inválido — confira os dígitos verificadores.</p>}
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <Label htmlFor="rg" className="text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight">RG</Label>
                                        <Input id="rg" value={formData.rg} onChange={(e) => setFormData({ ...formData, rg: e.target.value })} className="h-11 rounded-xl border-app-border dark:border-app-border-dark" />
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <Label htmlFor="ie" className="text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight">Inscrição Estadual</Label>
                                        <Input id="ie" value={formData.inscricaoEstadual} onChange={(e) => setFormData({ ...formData, inscricaoEstadual: e.target.value })} className="h-11 rounded-xl border-app-border dark:border-app-border-dark" />
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <Label htmlFor="dataNascimento" className="text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight">Data de nascimento *</Label>
                                        <div className="relative">
                                            <DateInput id="dataNascimento" value={formData.dataNascimento} onChange={handleDateChange} className="h-11 rounded-xl border-app-border dark:border-app-border-dark" required />
                                            {patientAge !== null && (
                                                <div className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none">
                                                    <span className="px-2 py-0.5 rounded-full bg-app-primary text-white text-xs font-bold uppercase tracking-wider">{patientAge} anos</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <Label className="text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight">Sexo *</Label>
                                        <Select value={formData.sexo} onValueChange={(v) => setFormData({ ...formData, sexo: v })}>
                                            <SelectTrigger className="h-11 rounded-xl border-app-border dark:border-app-border-dark"><SelectValue preferPlaceholder placeholder="Selecione" /></SelectTrigger>
                                            <SelectContent><SelectItem value="masculino">Masculino</SelectItem><SelectItem value="feminino">Feminino</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent>
                                        </Select>
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <Label className="text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight">Status</Label>
                                        <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                                            <SelectTrigger className="h-11 rounded-xl border-app-border dark:border-app-border-dark"><SelectValue preferPlaceholder placeholder="Selecione" /></SelectTrigger>
                                            <SelectContent><SelectItem value="Ativo">Ativo</SelectItem><SelectItem value="Inativo">Inativo</SelectItem><SelectItem value="Óbito">Óbito</SelectItem></SelectContent>
                                        </Select>
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <Label className="text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight">Origem *</Label>
                                        <Select value={formData.indicacao} onValueChange={(v) => setFormData({ ...formData, indicacao: v })}>
                                            <SelectTrigger className="h-11 rounded-xl border-app-border dark:border-app-border-dark"><SelectValue preferPlaceholder placeholder="Como nos achou?" /></SelectTrigger>
                                            <SelectContent><SelectItem value="instagram">Instagram</SelectItem><SelectItem value="google">Google</SelectItem><SelectItem value="indicacao">Indicação</SelectItem><SelectItem value="outros">Outros</SelectItem></SelectContent>
                                        </Select>
                                    </div>
                                    {formData.indicacao === 'indicacao' && (
                                        <QuemIndicouField
                                            nome={formData.origemDetalhe}
                                            indicadoPorId={formData.indicadoPorId}
                                            excluirId={paciente?.id ? String(paciente.id) : undefined}
                                            onChange={({ nome, indicadoPorId }) => setFormData((prev) => ({ ...prev, origemDetalhe: nome, indicadoPorId }))}
                                        />
                                    )}
                                    {formData.indicacao === 'outros' && (
                                        <div className="md:col-span-2 space-y-2">
                                            <Label className="text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight">Qual a origem?</Label>
                                            <Input value={formData.origemDetalhe} onChange={(e) => setFormData({ ...formData, origemDetalhe: e.target.value })} className="h-11 rounded-xl border-app-border dark:border-app-border-dark" placeholder="Detalhe da origem" />
                                        </div>
                                    )}
                                    <div className="md:col-span-2 space-y-2">
                                        <Label className="text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight">Precisa de Nota Fiscal?</Label>
                                        <label className="flex items-center gap-2 h-11 px-3 rounded-xl border border-app-border dark:border-app-border-dark cursor-pointer">
                                            <input type="checkbox" checked={formData.precisaNf} onChange={(e) => setFormData({ ...formData, precisaNf: e.target.checked })} className="h-4 w-4 accent-[var(--app-primary)]" />
                                            <span className="text-xs font-bold uppercase tracking-tight text-app-text-secondary dark:text-white/60">{formData.precisaNf ? 'Sim' : 'Não'}</span>
                                        </label>
                                    </div>
                                    {formData.precisaNf && (
                                        <NotaFiscalFields value={formData.notaFiscal} onChange={(notaFiscal) => setFormData((prev) => ({ ...prev, notaFiscal }))} />
                                    )}
                                    <div className="md:col-span-6 space-y-2">
                                        <Label className="text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight">Tipo de vínculo <span className="normal-case font-normal text-app-text-muted">(pode marcar mais de um)</span></Label>
                                        <div className="flex flex-wrap gap-2">
                                            {VINCULO_OPCOES.map((opt) => {
                                                const selected = formData.vinculoTipos.includes(opt.value)
                                                return (
                                                    <label key={opt.value} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${selected ? 'bg-app-primary border-app-primary text-white shadow-md' : 'bg-white dark:bg-app-hover border-app-border dark:border-app-border-dark text-app-text-secondary dark:text-white/60 hover:border-app-primary/50'}`}>
                                                        <input type="checkbox" checked={selected} onChange={() => toggleVinculo(opt.value)} className="hidden" />
                                                        <span className="text-xs font-bold uppercase tracking-tight">{opt.label}</span>
                                                    </label>
                                                )
                                            })}
                                        </div>
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <Label className="text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight">Unidade *</Label>
                                        <Select value={formData.unidadeId} onValueChange={(v) => setFormData({ ...formData, unidadeId: v })} disabled={lockUnitSelection && unitOptions.length === 1}>
                                            <SelectTrigger className="h-11 rounded-xl border-app-border dark:border-app-border-dark"><SelectValue preferPlaceholder placeholder="Selecione a unidade" /></SelectTrigger>
                                            <SelectContent>
                                                {unitOptions.map((unit) => (
                                                    <SelectItem key={unit.id} value={unit.id}>{unit.nome}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <Label className="text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight">Foto do paciente</Label>
                                        <div className="flex items-center gap-3 rounded-xl border border-app-border dark:border-app-border-dark p-3">
                                            <button type="button" onClick={() => setIsPhotoSourceOpen(true)} className="h-14 w-14 rounded-full overflow-hidden border border-app-border dark:border-app-border-dark bg-app-bg-secondary dark:bg-app-hover shrink-0 cursor-pointer relative block">
                                                {formData.photoUrl ? (
                                                    <Image
                                                        src={formData.photoUrl}
                                                        alt="Foto do paciente"
                                                        fill
                                                        sizes="56px"
                                                        unoptimized
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="h-full w-full flex items-center justify-center text-app-text-muted text-xs">
                                                        <Camera className="h-4 w-4" />
                                                    </div>
                                                )}
                                                <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoUpload} />
                                            </button>
                                            <button type="button" onClick={() => setIsPhotoSourceOpen(true)} className="inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-app-border dark:border-app-border-dark cursor-pointer hover:bg-app-bg-secondary dark:hover:bg-app-hover text-xs font-bold uppercase tracking-wide">
                                                <Upload className="h-4 w-4" />
                                                Alterar
                                                <input ref={uploadInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoUpload} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {(formData.vinculoTipos.includes('fornecedor') || formData.vinculoTipos.includes('prestador')) && (
                                <div className="mt-6 p-4 rounded-xl border border-app-border dark:border-app-border-dark bg-app-bg-secondary/40 dark:bg-app-hover">
                                    <h4 className="text-sm font-bold text-[var(--app-text-primary)] dark:text-white uppercase tracking-widest mb-4">
                                        Dados de fornecedor/prestador
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-6 gap-x-5 gap-y-4">
                                        <div className="md:col-span-3 space-y-2">
                                            <Label className="text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight">Razão social</Label>
                                            <Input value={formData.supplierData.razaoSocial} onChange={(e) => setFormData({ ...formData, supplierData: { ...formData.supplierData, razaoSocial: e.target.value } })} className="h-11 rounded-xl border-app-border dark:border-app-border-dark" />
                                        </div>
                                        <div className="md:col-span-3 space-y-2">
                                            <Label className="text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight">CNPJ</Label>
                                            <div className="relative">
                                                <Input value={formData.supplierData.cnpj} onChange={(e) => handleCnpjChange(e.target.value)} className="h-11 rounded-xl pr-10 border-app-border dark:border-app-border-dark" placeholder="00.000.000/0000-00" autoComplete="off" inputMode="text" />
                                                {consultaCnpj.status === 'buscando' && <SpinnerCampo />}
                                            </div>
                                            <FeedbackConsulta
                                                status={consultaCnpj.status}
                                                buscando="Consultando na Receita Federal..."
                                                encontrado={formData.supplierData.razaoSocial}
                                                invalido="CNPJ inválido — confira os dígitos verificadores."
                                                naoEncontrado="CNPJ não encontrado na Receita — você pode seguir e preencher manualmente."
                                            />
                                        </div>
                                        <div className="md:col-span-2 space-y-2">
                                            <Label className="text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight">Inscrição estadual</Label>
                                            <Input value={formData.supplierData.inscricaoEstadual} onChange={(e) => setFormData({ ...formData, supplierData: { ...formData.supplierData, inscricaoEstadual: e.target.value } })} className="h-11 rounded-xl border-app-border dark:border-app-border-dark" />
                                        </div>
                                        <div className="md:col-span-2 space-y-2">
                                            <Label className="text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight">Contato</Label>
                                            <Input value={formData.supplierData.contatoNome} onChange={(e) => setFormData({ ...formData, supplierData: { ...formData.supplierData, contatoNome: e.target.value } })} className="h-11 rounded-xl border-app-border dark:border-app-border-dark" />
                                        </div>
                                        <div className="md:col-span-1 space-y-2">
                                            <Label className="text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight">Setor</Label>
                                            <Input value={formData.supplierData.contatoSetor} onChange={(e) => setFormData({ ...formData, supplierData: { ...formData.supplierData, contatoSetor: e.target.value } })} className="h-11 rounded-xl border-app-border dark:border-app-border-dark" placeholder="Compras" />
                                        </div>
                                        <div className="md:col-span-1 space-y-2">
                                            <Label className="text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight">Categoria DRE</Label>
                                            <Input value={formData.supplierData.categoriaDre} onChange={(e) => setFormData({ ...formData, supplierData: { ...formData.supplierData, categoriaDre: e.target.value } })} className="h-11 rounded-xl border-app-border dark:border-app-border-dark" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 2. Localização */}
                            <div className="bg-white dark:bg-app-hover p-6 rounded-2xl border border-app-border dark:border-app-border-dark shadow-sm animate-in fade-in slide-in-from-top-2">
                                <FormSectionHeader icon={MapPin} title="Endereço" subtitle="Localização para visitas e faturamento" />
                                <div className="grid grid-cols-1 md:grid-cols-6 gap-x-5 gap-y-5">
                                    <div className="md:col-span-2 space-y-2">
                                        <Label htmlFor="cep" className="text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight">CEP *</Label>
                                        <div className="relative">
                                            <Input id="cep" value={formData.addressDetails.zipCode} onChange={(e) => handleCepChange(e.target.value)} className="h-11 rounded-xl pr-10 border-app-border dark:border-app-border-dark" placeholder="00000-000" inputMode="numeric" required />
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
                                        <Label htmlFor="logradouro" className="text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight">Logradouro</Label>
                                        <Input id="logradouro" value={formData.addressDetails.street} onChange={(e) => updateAddress('street', e.target.value)} className="h-11 rounded-xl border-app-border dark:border-app-border-dark" />
                                    </div>
                                    <div className="md:col-span-1 space-y-2">
                                        <Label htmlFor="numero" className="text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight">Nº</Label>
                                        <Input id="numero" value={formData.addressDetails.number} onChange={(e) => updateAddress('number', e.target.value)} className="h-11 rounded-xl border-app-border dark:border-app-border-dark" />
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <Label htmlFor="bairro" className="text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight">Bairro</Label>
                                        <Input id="bairro" value={formData.addressDetails.neighborhood} onChange={(e) => updateAddress('neighborhood', e.target.value)} className="h-11 rounded-xl border-app-border dark:border-app-border-dark" />
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <Label htmlFor="cidade" className="text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight">Cidade</Label>
                                        <Input id="cidade" value={formData.addressDetails.city} onChange={(e) => updateAddress('city', e.target.value)} className="h-11 rounded-xl border-app-border dark:border-app-border-dark" />
                                    </div>
                                    <div className="md:col-span-1 space-y-2">
                                        <Label htmlFor="uf" className="text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight">UF</Label>
                                        <Input id="uf" value={formData.addressDetails.state} onChange={(e) => updateAddress('state', e.target.value)} className="h-11 rounded-xl border-app-border dark:border-app-border-dark" />
                                    </div>
                                    <div className="md:col-span-1 space-y-2">
                                        <Label htmlFor="complemento" className="text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight">Comp.</Label>
                                        <Input id="complemento" value={formData.addressDetails.complement} onChange={(e) => updateAddress('complement', e.target.value)} className="h-11 rounded-xl border-app-border dark:border-app-border-dark" />
                                    </div>
                                </div>
                            </div>

                            {/* 3. Contato e Responsável */}
                            <div className="bg-white dark:bg-app-hover p-6 rounded-2xl border border-app-border dark:border-app-border-dark shadow-sm animate-in fade-in slide-in-from-top-2">
                                <FormSectionHeader icon={Phone} title="Contato" subtitle="Canais de comunicação e responsáveis" />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-5">
                                    <div className="space-y-2">
                                        <Label htmlFor="telefone" className="text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight">Telefone / WhatsApp *</Label>
                                        <Input id="telefone" value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: formatarTelefone(e.target.value) })} className="h-11 rounded-xl border-app-border dark:border-app-border-dark" placeholder="(00) 00000-0000" inputMode="tel" required />
                                        {telefoneCompletoInvalido && <p className="mt-1 text-xs leading-snug text-[var(--app-danger-text)]">Telefone inválido — confira o DDD e a quantidade de dígitos.</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email" className="text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight">E-mail</Label>
                                        <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="h-11 rounded-xl border-app-border dark:border-app-border-dark" placeholder="exemplo@email.com" />
                                    </div>
                                </div>

                                {(needsMandatoryResponsible || showOptionalResponsible || formData.responsible.name) && (
                                    <div className="mt-8 p-6 bg-[var(--app-bg-secondary)] dark:bg-app-hover rounded-2xl border border-app-border dark:border-app-border-dark space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="h-2.5 w-2.5 rounded-full bg-app-primary" />
                                                <h4 className="text-sm font-bold text-[var(--app-text-primary)] dark:text-white uppercase tracking-widest">Responsável Legal</h4>
                                                {needsMandatoryResponsible && <span className="text-xs app-status-danger text-[var(--app-danger-text)] px-2 py-0.5 rounded-md font-bold uppercase tracking-tight">Obrigatório</span>}
                                            </div>
                                            {showOptionalResponsible && !needsMandatoryResponsible && (
                                                <button type="button" onClick={() => setFormData(prev => ({ ...prev, responsible: { name: '', cpf: '', phone: '', relationship: '', birthDate: '', age: '' } }))} className="text-xs font-bold text-[var(--app-danger-text)] hover:text-[var(--app-danger-text)] uppercase tracking-tight">Remover dados</button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="md:col-span-2 space-y-2">
                                                <Label htmlFor="resp-nome" className="text-xs font-bold text-[var(--app-text-secondary)] dark:text-white/60 uppercase">Nome completo {needsMandatoryResponsible && '*'}</Label>
                                                <Input id="resp-nome" value={formData.responsible.name} onChange={(e) => setFormData(prev => ({ ...prev, responsible: { ...prev.responsible, name: e.target.value } }))} required={needsMandatoryResponsible} className="h-11 rounded-xl bg-white dark:bg-transparent border-app-border dark:border-app-border-dark" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="resp-cpf" className="text-xs font-bold text-[var(--app-text-secondary)] dark:text-white/60 uppercase">CPF do Responsável</Label>
                                                <Input id="resp-cpf" value={formData.responsible.cpf} onChange={(e) => setFormData(prev => ({ ...prev, responsible: { ...prev.responsible, cpf: formatarCPF(e.target.value) } }))} className="h-11 rounded-xl bg-white dark:bg-transparent border-app-border dark:border-app-border-dark" placeholder="000.000.000-00" inputMode="numeric" />
                                                {respCpfCompletoInvalido && <p className="mt-1 text-xs leading-snug text-[var(--app-danger-text)]">CPF inválido — confira os dígitos verificadores.</p>}
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="resp-tel" className="text-xs font-bold text-[var(--app-text-secondary)] dark:text-white/60 uppercase">Telefone do Responsável</Label>
                                                <Input id="resp-tel" value={formData.responsible.phone} onChange={(e) => setFormData(prev => ({ ...prev, responsible: { ...prev.responsible, phone: formatarTelefone(e.target.value) } }))} className="h-11 rounded-xl bg-white dark:bg-transparent border-app-border dark:border-app-border-dark" placeholder="(00) 00000-0000" inputMode="tel" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="resp-nasc" className="text-xs font-bold text-[var(--app-text-secondary)] dark:text-white/60 uppercase">Data de Nascimento</Label>
                                                <DateInput id="resp-nasc" value={formData.responsible.birthDate} onChange={handleRespDateChange} className="h-11 rounded-xl bg-white dark:bg-transparent border-app-border dark:border-app-border-dark" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold text-[var(--app-text-secondary)] dark:text-white/60 uppercase">Parentesco / Vínculo</Label>
                                                <Select value={formData.responsible.relationship} onValueChange={(v) => setFormData(prev => ({ ...prev, responsible: { ...prev.responsible, relationship: v } }))}>
                                                    <SelectTrigger className="h-11 rounded-xl bg-white dark:bg-transparent border-app-border dark:border-app-border-dark"><SelectValue preferPlaceholder placeholder="Selecione" /></SelectTrigger>
                                                    <SelectContent><SelectItem value="Pai">Pai</SelectItem><SelectItem value="Mãe">Mãe</SelectItem><SelectItem value="Irmão">Irmão</SelectItem><SelectItem value="Avô/Avó">Avô/Avó</SelectItem><SelectItem value="Outro">Outro</SelectItem></SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 4. Necessidades Especiais */}
                            <div className="bg-white dark:bg-app-hover p-6 rounded-2xl border border-app-border dark:border-app-border-dark shadow-sm animate-in fade-in slide-in-from-top-2">
                                <FormSectionHeader icon={Heart} title="Necessidades Especiais" subtitle="Orientações e suporte assistencial" />
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <Label className="text-sm font-medium text-[var(--app-text-primary)] dark:text-white/70">Portador de necessidade especial?</Label>
                                        <div className="flex p-1 bg-app-bg-secondary dark:bg-app-hover rounded-2xl w-full max-w-[280px]">
                                            <button type="button" onClick={() => setFormData(prev => ({ ...prev, specialNeeds: { ...prev.specialNeeds, hasNeeds: 'sim' } }))} className={`flex-1 h-10 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${formData.specialNeeds.hasNeeds === 'sim' ? 'bg-white dark:bg-app-primary text-app-primary dark:text-white shadow-sm' : 'text-app-text-muted hover:text-app-text-primary'}`}>Sim</button>
                                            <button type="button" onClick={() => setFormData(prev => ({ ...prev, specialNeeds: { ...prev.specialNeeds, hasNeeds: 'nao' } }))} className={`flex-1 h-10 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${formData.specialNeeds.hasNeeds === 'nao' ? 'bg-white dark:bg-app-primary text-app-primary dark:text-white shadow-sm' : 'text-app-text-muted hover:text-app-text-primary'}`}>Não</button>
                                        </div>
                                    </div>
                                    {formData.specialNeeds.hasNeeds === 'sim' && (
                                        <div className="p-6 app-status-info rounded-2xl border border-transparent space-y-6 animate-in fade-in slide-in-from-top-1">
                                            <div className="space-y-3">
                                                <Label className="text-xs font-black text-app-primary uppercase tracking-widest">CATEGORIAS</Label>
                                                <div className="flex flex-wrap gap-3">
                                                    {['Física', 'Auditiva', 'Visual', 'Intelectual'].map(cat => (
                                                        <label key={cat} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${formData.specialNeeds.categories.includes(cat) ? 'bg-app-primary border-app-primary text-white shadow-md' : 'bg-white dark:bg-app-hover border-app-border dark:border-app-border-dark text-app-text-secondary dark:text-white/60 hover:border-app-primary/50'}`}>
                                                            <input type="checkbox" checked={formData.specialNeeds.categories.includes(cat)} onChange={() => toggleSpecialNeed(cat)} className="hidden" />
                                                            <span className="text-xs font-bold uppercase tracking-tight">{cat}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                            {formData.specialNeeds.categories.length > 0 && (
                                                <div className="space-y-2 animate-in fade-in zoom-in-95">
                                                    <Label htmlFor="needs-details" className="text-xs font-black text-app-primary uppercase tracking-widest">DESCRIÇÃO DETALHADA</Label>
                                                    <Input id="needs-details" value={formData.specialNeeds.details} onChange={(e) => setFormData(prev => ({ ...prev, specialNeeds: { ...prev.specialNeeds, details: e.target.value } }))} placeholder="Ex: Baixa visão no olho esquerdo, necessita de fonte ampliada..." className="h-11 rounded-xl bg-white dark:bg-transparent border-app-border dark:border-app-border-dark" />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                        </form>
                    ) : (
                        <div className="py-12 flex flex-col items-center text-center space-y-8 animate-in zoom-in-95 duration-500">
                            <div className="h-24 w-24 app-status-success dark:bg-app-hover rounded-full flex items-center justify-center relative">
                                <div className="h-16 w-16 bg-app-primary rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
                                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <div className="absolute -bottom-1 -right-1 h-8 w-8 bg-app-card dark:bg-app-card-dark rounded-full flex items-center justify-center shadow-md">
                                    <Heart className="h-4 w-4 text-[var(--app-danger-text)] fill-rose-500" />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <h3 className="text-3xl font-black text-[var(--app-text-primary)] dark:text-white uppercase tracking-tighter">Alterações Salvas!</h3>
                                <p className="text-[var(--app-text-secondary)] dark:text-white/60 text-base max-w-sm mx-auto">O cadastro de <strong>{formData.nome}</strong> foi atualizado com sucesso.</p>
                            </div>

                            <div className="w-full max-w-lg pt-6 grid grid-cols-1 gap-3">
                                <Button variant="outline" className="h-12 rounded-xl" onClick={handleSaveOnly}>
                                    Salvar
                                </Button>
                                <Button variant="outline" className="h-12 rounded-xl border-app-primary text-app-primary" onClick={() => void handleSaveAndGeneratePdf()}>
                                    Salvar e Gerar PDF
                                </Button>
                                <Button className="h-12 rounded-xl bg-app-primary hover:bg-app-primary-hover text-white" onClick={() => void handleSaveAndWhatsapp()}>
                                    Salvar e Enviar WhatsApp
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="sticky bottom-0 z-20 p-6 md:p-8 pt-6 border-t border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark flex justify-between items-center shrink-0">
                    {!isSaved ? (
                        <div className="flex flex-col-reverse sm:flex-row gap-3 w-full">
                            <Button type="button" variant="outline" onClick={onClose} className="sm:w-32 h-12 rounded-xl font-bold text-[var(--app-text-secondary)] dark:text-white/70 border-app-border dark:border-app-border-dark hover:bg-app-hover dark:hover:bg-app-hover transition-all text-xs uppercase tracking-widest">
                                Cancelar
                            </Button>
                            <Button form="editar-paciente-form" type="submit" className="w-full shrink-0 sm:w-auto sm:flex-1 h-12 bg-app-primary hover:bg-app-primary-hover text-white font-black rounded-xl shadow-sm transition-all active:scale-[0.98] text-xs uppercase tracking-[0.1em]">
                                Salvar Alterações
                            </Button>
                        </div>
                    ) : (
                        <Button onClick={() => { setIsSaved(false); onClose(); }} className="w-full h-12 bg-[var(--app-text-primary)] dark:bg-white text-white dark:text-[var(--app-text-primary)] font-black rounded-xl transition-all uppercase tracking-[0.2em] shadow-lg">
                            FECHAR E CONCLUIR
                        </Button>
                    )}
                </DialogFooter>

                <div className="fixed -left-[9999px] -top-[9999px] pointer-events-none opacity-0">
                    <DocumentoCadastro
                        ref={documentoRef}
                        data={{
                            name: formData.nome,
                            cpf: formData.cpf,
                            rg: formData.rg,
                            birthDate: formData.dataNascimento,
                            age: patientAge != null ? `${patientAge}` : undefined,
                            phone: formData.telefone,
                            email: formData.email,
                            address: `${formData.addressDetails.street}, ${formData.addressDetails.number}`,
                            addressDetails: formData.addressDetails,
                            responsible: formData.responsible.name ? formData.responsible : undefined,
                            source: formData.indicacao,
                            origemDetalhe: formData.origemDetalhe,
                        }}
                        manualText={MANUAL_SERVICOS_TEXTO_PADRAO}
                    />
                </div>
            </DialogContent>
        </Dialog>
        <PhotoSourceModal
            open={isPhotoSourceOpen}
            onOpenChange={setIsPhotoSourceOpen}
            onSelectCamera={() => {
                setIsPhotoSourceOpen(false)
                setIsPhotoCameraOpen(true)
            }}
            onSelectUpload={() => {
                setIsPhotoSourceOpen(false)
                uploadInputRef.current?.click()
            }}
        />
        <CameraCaptureModal
            open={isPhotoCameraOpen}
            onOpenChange={setIsPhotoCameraOpen}
            onCapture={handlePhotoSelected}
        />
        </>
    )
}
