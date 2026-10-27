import { formatarCPF, formatarTelefone } from '@/lib/validacao-br'

export interface PacienteResumo {
  id: string
  nome: string
  /** DD/MM/AAAA ou vazio. */
  dataNascimento: string
  idade: number | null
  cpf: string
  telefone: string
  email: string
  endereco: string
  fotoUrl: string | null
}

type Row = Record<string, unknown>

const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export function calcularIdade(nascimentoIso: string, hojeIso: string): number | null {
  const n = /^(\d{4})-(\d{2})-(\d{2})/.exec(nascimentoIso)
  const h = /^(\d{4})-(\d{2})-(\d{2})/.exec(hojeIso)
  if (!n || !h) return null
  let idade = Number(h[1]) - Number(n[1])
  if (Number(h[2]) < Number(n[2]) || (Number(h[2]) === Number(n[2]) && Number(h[3]) < Number(n[3]))) idade -= 1
  return idade >= 0 ? idade : null
}

/** "Rua, 10 - compl - Bairro - Cidade/UF - CEP" a partir das colunas do cadastro. */
export function montarEnderecoPaciente(row: Row): string {
  const rua = [txt(row.logradouro), txt(row.numero)].filter(Boolean).join(', ')
  const cidadeUf = [txt(row.cidade), txt(row.estado)].filter(Boolean).join('/')
  return [rua, txt(row.complemento), txt(row.bairro), cidadeUf, txt(row.cep)]
    .filter(Boolean)
    .join(' - ')
}

export function montarPacienteResumo(row: Row, hojeIso: string): PacienteResumo {
  const nascimento = txt(row.data_nascimento).slice(0, 10)
  const cpf = txt(row.cpf)
  const telefone = txt(row.telefone)
  const foto = txt(row.photo_url)
  return {
    id: String(row.id ?? ''),
    nome: txt(row.nome),
    dataNascimento: nascimento ? nascimento.split('-').reverse().join('/') : '',
    idade: nascimento ? calcularIdade(nascimento, hojeIso) : null,
    cpf: cpf ? formatarCPF(cpf) : '',
    telefone: telefone ? formatarTelefone(telefone) : '',
    email: txt(row.email),
    endereco: montarEnderecoPaciente(row),
    fotoUrl: foto || null,
  }
}
