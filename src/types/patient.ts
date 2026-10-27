export interface Patient {
  id?: string | number
  nome?: string
  name?: string
  cpf?: string
  rg?: string
  inscricaoEstadual?: string
  dataNascimento?: string
  birthDate?: string
  sexo?: string
  gender?: string
  telefone?: string
  phone?: string
  email?: string
  criarAcessoPortal?: boolean
  status?: string
  activeStatus?: string
  indicacao?: string
  source?: string
  address?: string
  photoUrl?: string
  unidade?: string
  unidadeId?: string
  idade?: number
  age?: string | number
  data?: string
  plano?: string
  ultimaConsulta?: string
  endereco?: string
  condicoesMedicas?: string
  historicoRecente?: string
  vinculoTipos?: string[]
  origemDetalhe?: string
  convenio?: string
  indicadoPorId?: string | null
  precisaNf?: boolean
  addressDetails?: {
    zipCode?: string
    street?: string
    number?: string
    complement?: string
    neighborhood?: string
    city?: string
    state?: string
  }
  specialNeeds?: {
    hasNeeds?: boolean | 'sim' | 'nao'
    categories?: string[]
    types?: string[]
    details?: string
  }
  responsible?: {
    name?: string
    cpf?: string
    phone?: string
    relationship?: string
    birthDate?: string
    age?: string
  }
  financial?: {
    requiresReceipt?: boolean | 'sim' | 'nao'
    receiptData?: {
      useProfileData?: boolean | 'mesmos' | 'adicionar'
      taxId?: string
      name?: string
      address?: string
    }
  }
  supplierData?: {
    razaoSocial?: string
    cnpj?: string
    inscricaoEstadual?: string
    contatoNome?: string
    contatoSetor?: string
    categoriaDre?: string
  }
  [key: string]: unknown
}
