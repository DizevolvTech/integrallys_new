import React from 'react';
import type { Patient } from '@/types/patient'
import { descreverOrigem } from '../utils/origem'
import { formatarCPF } from '@/lib/validacao-br'

interface DocumentoCadastroProps {
    data: Partial<Patient>;
    manualText?: string;
    clinicaNome?: string;
    clinicaSubtitulo?: string;
    clinicaLogoUrl?: string | null;
}

export const DocumentoCadastro = React.forwardRef<HTMLDivElement, DocumentoCadastroProps>(({ data, manualText, clinicaNome, clinicaSubtitulo, clinicaLogoUrl }, ref) => {
    const nomeClinica = clinicaNome ?? 'Clínica';
    return (
        <div ref={ref} className="p-8 bg-white text-black max-w-[210mm] mx-auto text-sm font-sans">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between mb-8 border-b pb-4">
                <div className="flex items-center gap-3">
                    {clinicaLogoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={clinicaLogoUrl}
                            alt={nomeClinica}
                            className="h-12 w-auto object-contain"
                        />
                    )}
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--app-primary)]">{nomeClinica}</h1>
                        {clinicaSubtitulo && (
                            <p className="text-app-text-muted text-xs text-[var(--app-primary)]">{clinicaSubtitulo}</p>
                        )}
                    </div>
                </div>
                <div className="text-right text-xs text-app-text-muted">
                    <p>Ficha Cadastral & Manual de Serviços</p>
                    <p>{new Date().toLocaleDateString()}</p>
                </div>
            </div>

            {/* Dados do Paciente */}
            <section className="mb-6">
                <h2 className="text-lg font-bold mb-3 uppercase border-b border-app-border pb-1">1. Dados do Paciente</h2>
                <div className="grid grid-cols-2 gap-4">
                    <div><span className="font-bold">Nome:</span> {data.name}</div>
                    <div><span className="font-bold">CPF:</span> {formatarCPF(data.cpf ?? "")}</div>
                    <div><span className="font-bold">RG:</span> {data.rg || '-'}</div>
                    <div><span className="font-bold">Data de Nasc.:</span> {data.birthDate || '-'}</div>
                    <div><span className="font-bold">Idade:</span> {data.age || (data.birthDate ? (() => {
                        const birth = new Date(data.birthDate);
                        const today = new Date();
                        let a = today.getFullYear() - birth.getFullYear();
                        const m = today.getMonth() - birth.getMonth();
                        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--;
                        return a;
                    })() : '-')}</div>
                    <div><span className="font-bold">Telefone:</span> {data.phone}</div>
                    <div><span className="font-bold">E-mail:</span> {data.email}</div>
                    <div className="col-span-2"><span className="font-bold">Origem:</span> {descreverOrigem(data.source, data.origemDetalhe)}</div>
                    <div className="col-span-2"><span className="font-bold">Endereço:</span> {data.address} - {data.addressDetails?.city}/{data.addressDetails?.state} - CEP: {data.addressDetails?.zipCode}</div>
                </div>
            </section>

            {/* Responsável (Se houver) */}
            {data.responsible && (
                <section className="mb-6">
                    <h2 className="text-lg font-bold mb-3 uppercase border-b border-app-border pb-1">2. Dados do Responsável</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div><span className="font-bold">Nome:</span> {data.responsible.name}</div>
                        <div><span className="font-bold">CPF:</span> {formatarCPF(data.responsible.cpf ?? "")}</div>
                        <div><span className="font-bold">Data de Nasc.:</span> {data.responsible.birthDate || '-'}</div>
                        <div><span className="font-bold">Idade:</span> {data.responsible.age || (data.responsible.birthDate ? (() => {
                            const birth = new Date(data.responsible.birthDate!);
                            const today = new Date();
                            let a = today.getFullYear() - birth.getFullYear();
                            const m = today.getMonth() - birth.getMonth();
                            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--;
                            return a;
                        })() : '-')}</div>
                        <div><span className="font-bold">Telefone:</span> {data.responsible.phone}</div>
                        <div><span className="font-bold">Vínculo:</span> {data.responsible.relationship || '-'}</div>
                    </div>
                </section>
            )}

            {/* Manual de Serviços (Texto Legal/Contratual) */}
            <section className="mb-8 text-justify leading-relaxed text-xs">
                <h2 className="text-lg font-bold mb-3 uppercase border-b border-app-border pb-1">3. Manual de Serviços e Termos</h2>
                {manualText ? (
                    <div className="whitespace-pre-wrap">{manualText}</div>
                ) : (
                    <>
                        <p className="mb-2">
                            <strong>1. DO AGENDAMENTO:</strong> As consultas devem ser agendadas previamente. Em caso de atraso superior a 15 minutos, o atendimento poderá ser reduzido ou remarcado, sujeitando-se à disponibilidade.
                        </p>
                        <p className="mb-2">
                            <strong>2. DO CANCELAMENTO:</strong> Cancelamentos devem ser informados com antecedência mínima de 24 horas. O não comparecimento sem aviso prévio poderá acarretar cobrança ou perda do horário fixo.
                        </p>
                        <p className="mb-2">
                            <strong>3. DOS PAGAMENTOS:</strong> Os pagamentos deverão ser realizados conforme modalidade acordada (particular/convênio) nas datas estipuladas.
                        </p>
                        <p>
                            Declaro estar ciente e de acordo com as normas estabelecidas neste manual de serviços.
                        </p>
                    </>
                )}
            </section>

            {/* Assinaturas */}
            <div className="mt-16 grid grid-cols-2 gap-12 text-center">
                <div className="border-t border-black pt-2">
                    <p className="font-bold">{data.name}</p>
                    <p className="text-xs">Paciente / Responsável</p>
                </div>
                <div className="border-t border-black pt-2">
                    <p className="font-bold">{nomeClinica}</p>
                    <p className="text-xs">Administração</p>
                </div>
            </div>
        </div>
    );
});

DocumentoCadastro.displayName = 'DocumentoCadastro';
