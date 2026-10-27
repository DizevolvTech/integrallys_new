import { calcularIdade } from '@/features/gestao-pacientes/utils/idade'
import { validarFinancialNotaFiscal } from '@/features/gestao-pacientes/utils/nota-fiscal'
import { VALORES_ORIGEM } from '@/features/gestao-pacientes/utils/origem'
import { validarCPF, validarTelefone } from '@/lib/validacao-br'

// Item 13: o paciente edita no portal os mesmos campos do cadastro da recepção.
// A validação roda no servidor (a tela pode ser contornada) e só devolve colunas do próprio paciente.

const CATEGORIAS_NECESSIDADE = ['Física', 'Auditiva', 'Visual', 'Intelectual']
const PARENTESCOS = ['Pai', 'Mãe', 'Irmão', 'Avô/Avó', 'Outro']

const texto = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export type CadastroPortalResultado =
  | { ok: true; colunas: Record<string, unknown> }
  | { ok: false; error: string; code: string }

export function montarCadastroPortal(body: Record<string, unknown>, dataNascimento: string): CadastroPortalResultado {
  const origem = texto(body.indicacao)
  if (origem && !VALORES_ORIGEM.has(origem)) return { ok: false, error: 'Origem inválida', code: 'PROFILE_INVALID_ORIGEM' }
  const precisaNf = body.precisaNf === true

  const financial = body.financial && typeof body.financial === 'object' ? (body.financial as Record<string, unknown>) : null
  if (precisaNf) {
    const nfError = validarFinancialNotaFiscal(financial)
    if (nfError) return { ok: false, error: nfError, code: 'PROFILE_INVALID_NF' }
  }

  const sn = (body.specialNeeds && typeof body.specialNeeds === 'object' ? body.specialNeeds : {}) as Record<string, unknown>
  const hasNeeds = sn.hasNeeds === true || sn.hasNeeds === 'sim'
  const categories = Array.isArray(sn.categories) ? sn.categories.filter((c): c is string => CATEGORIAS_NECESSIDADE.includes(String(c))) : []
  const necessidades = { hasNeeds, categories: hasNeeds ? categories : [], details: hasNeeds ? texto(sn.details, 500) : '' }

  const r = (body.responsible && typeof body.responsible === 'object' ? body.responsible : {}) as Record<string, unknown>
  const responsavel = {
    name: texto(r.name),
    cpf: texto(r.cpf, 20),
    phone: texto(r.phone, 20),
    relationship: PARENTESCOS.includes(texto(r.relationship)) ? texto(r.relationship) : '',
    birthDate: texto(r.birthDate, 10),
    age: texto(r.age, 3),
  }
  const idade = calcularIdade(dataNascimento)
  if (idade !== null && idade < 18) {
    if (!responsavel.name) return { ok: false, error: 'Informe o nome do responsável (paciente menor de 18 anos)', code: 'PROFILE_RESPONSAVEL_REQUIRED' }
    if (!responsavel.relationship) return { ok: false, error: 'Informe o parentesco do responsável', code: 'PROFILE_RESPONSAVEL_REQUIRED' }
  }
  if (responsavel.cpf && !validarCPF(responsavel.cpf)) return { ok: false, error: 'CPF do responsável inválido', code: 'PROFILE_INVALID_CPF' }
  if (responsavel.phone && !validarTelefone(responsavel.phone)) return { ok: false, error: 'Telefone do responsável inválido', code: 'PROFILE_INVALID_PHONE' }

  return {
    ok: true,
    colunas: {
      origem: origem || null,
      origem_detalhe: texto(body.origemDetalhe) || null,
      convenio: texto(body.convenio, 80) || null,
      precisa_nf: precisaNf,
      financeiro: precisaNf ? financial : { requiresReceipt: 'nao' },
      necessidades_especiais: necessidades,
      responsavel: responsavel.name ? responsavel : null,
    },
  }
}
