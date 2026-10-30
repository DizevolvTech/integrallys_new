import type { PacienteInput } from '@/hooks/use-pacientes'
import type { Patient } from '@/types/patient'

/** Converte o paciente do formulário de cadastro no payload de criação da API. */
export function patientToCreateInput(patient: Patient): PacienteInput {
  return {
    nome: patient.name || patient.nome || '',
    telefone: patient.phone || patient.telefone || '',
    email: patient.email || '',
    cpf: patient.cpf || '',
    rg: patient.rg || '',
    inscricaoEstadual: patient.inscricaoEstadual || '',
    dataNascimento: patient.birthDate || patient.dataNascimento || '',
    sexo: patient.gender || patient.sexo || '',
    status: patient.activeStatus || 'Ativo',
    indicacao: patient.source || patient.indicacao || '',
    origemDetalhe: patient.origemDetalhe || '',
    convenio: patient.convenio || '',
    indicadoPorId: patient.indicadoPorId ?? null,
    vinculoTipos: patient.vinculoTipos && patient.vinculoTipos.length > 0 ? patient.vinculoTipos : ['cliente'],
    precisaNf: patient.precisaNf === true,
    financial: patient.financial as Record<string, unknown> | undefined,
    unidadeId: patient.unidadeId ? String(patient.unidadeId) : '',
    photoUrl: patient.photoUrl || undefined,
    addressDetails: patient.addressDetails,
    specialNeeds: patient.specialNeeds as Record<string, unknown> | undefined,
    responsible: patient.responsible as Record<string, unknown> | undefined,
    supplierData: patient.supplierData as Record<string, unknown> | undefined,
    criarAcessoPortal: patient.criarAcessoPortal === true,
  }
}
