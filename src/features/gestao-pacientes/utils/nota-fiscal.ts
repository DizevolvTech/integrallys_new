import { formatarCEP, formatarCNPJ, formatarCPF, normalizarCNPJ, validarCNPJ, validarCPF } from '@/lib/validacao-br'

// Item 2 do feedback: dados para emissão de NF. "mesmos" = usa o cadastro do
// paciente; "adicionar" = nota sai com outro CPF/CNPJ e nome (ex.: produtor rural).
// Vídeo de 26/10: no "adicionar", o endereço é obrigatório e tem os mesmos campos
// do endereço do cadastro (CEP, logradouro, número, bairro, cidade, UF, complemento).
export type EnderecoNf = {
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
}

export type NotaFiscalForm = {
  modo: 'mesmos' | 'adicionar'
  documento: string
  nome: string
  endereco: EnderecoNf
}

export const ENDERECO_NF_VAZIO: EnderecoNf = {
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
}

export const NOTA_FISCAL_VAZIA: NotaFiscalForm = { modo: 'mesmos', documento: '', nome: '', endereco: { ...ENDERECO_NF_VAZIO } }

type AddressDetailsJson = {
  zipCode?: string
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
}

type ReceiptDataJson = {
  useProfileData?: boolean | 'mesmos' | 'adicionar'
  taxId?: string
  name?: string
  address?: string
  addressDetails?: AddressDetailsJson
}

type FinancialLike = {
  requiresReceipt?: boolean | 'sim' | 'nao'
  receiptData?: ReceiptDataJson
} | undefined

const texto = (valor: unknown) => (typeof valor === 'string' ? valor.trim() : '')

export function formatarDocumentoNf(valor: string): string {
  const digits = valor.replace(/\D/g, '')
  return digits.length > 11 ? formatarCNPJ(valor) : formatarCPF(valor)
}

export function descreverEnderecoNf(e: EnderecoNf): string {
  const linha1 = [e.logradouro, e.numero].filter(Boolean).join(', ')
  const partes = [linha1, e.complemento, e.bairro, [e.cidade, e.uf].filter(Boolean).join('/'), e.cep ? `CEP ${e.cep}` : '']
  return partes.filter(Boolean).join(' — ')
}

export function notaFiscalFromFinancial(financial: FinancialLike): NotaFiscalForm {
  const data = financial?.receiptData
  if (!data || data.useProfileData === 'mesmos' || data.useProfileData === true) {
    return { ...NOTA_FISCAL_VAZIA, endereco: { ...ENDERECO_NF_VAZIO } }
  }
  const det = data.addressDetails
  const endereco: EnderecoNf = det
    ? {
        cep: det.zipCode ? formatarCEP(det.zipCode) : '',
        logradouro: texto(det.street),
        numero: texto(det.number),
        complemento: texto(det.complement),
        bairro: texto(det.neighborhood),
        cidade: texto(det.city),
        uf: texto(det.state).toUpperCase(),
      }
    : { ...ENDERECO_NF_VAZIO, logradouro: texto(data.address) } // cadastro antigo: endereço em texto livre
  return {
    modo: 'adicionar',
    documento: data.taxId ? formatarDocumentoNf(data.taxId) : '',
    nome: data.name ?? '',
    endereco,
  }
}

/** Campos da NF ("adicionar outros dados") que faltam, em linguagem de tela. Vazio = completo. */
export function camposFaltandoNotaFiscal(precisaNf: boolean, nf: NotaFiscalForm): string[] {
  if (!precisaNf || nf.modo !== 'adicionar') return []
  const faltam: string[] = []
  const digits = nf.documento.replace(/\D/g, '')
  const docOk = digits.length === 11 ? validarCPF(nf.documento) : digits.length === 14 ? validarCNPJ(nf.documento) : false
  if (!docOk) faltam.push(digits ? 'CPF/CNPJ da nota (inválido)' : 'CPF/CNPJ da nota')
  if (!nf.nome.trim()) faltam.push('nome ou razão social da nota')
  const e = nf.endereco
  if (e.cep.replace(/\D/g, '').length !== 8) faltam.push('CEP da nota')
  if (!e.logradouro.trim()) faltam.push('logradouro da nota')
  if (!e.numero.trim()) faltam.push('número da nota')
  if (!e.bairro.trim()) faltam.push('bairro da nota')
  if (!e.cidade.trim()) faltam.push('cidade da nota')
  if (!/^[A-Za-z]{2}$/.test(e.uf.trim())) faltam.push('UF da nota')
  return faltam
}

/** Primeiro campo obrigatório do endereço da NF que está vazio ou inválido. */
function faltaNoEndereco(e: EnderecoNf): string | null {
  if (e.cep.replace(/\D/g, '').length !== 8) return 'Informe um CEP válido no endereço da nota fiscal.'
  if (!e.logradouro.trim()) return 'Informe o logradouro (rua) no endereço da nota fiscal.'
  if (!e.numero.trim()) return 'Informe o número no endereço da nota fiscal.'
  if (!e.bairro.trim()) return 'Informe o bairro no endereço da nota fiscal.'
  if (!e.cidade.trim()) return 'Informe a cidade no endereço da nota fiscal.'
  if (!/^[A-Za-z]{2}$/.test(e.uf.trim())) return 'Informe a UF (2 letras) no endereço da nota fiscal.'
  return null
}

export function validarNotaFiscal(precisaNf: boolean, nf: NotaFiscalForm): string | null {
  if (!precisaNf || nf.modo !== 'adicionar') return null
  const digits = nf.documento.replace(/\D/g, '')
  if (!digits) return 'Informe o CPF ou CNPJ para a nota fiscal.'
  if (digits.length === 11 ? !validarCPF(nf.documento) : digits.length === 14 ? !validarCNPJ(nf.documento) : true) {
    return 'CPF/CNPJ da nota fiscal inválido — confira os dígitos.'
  }
  if (!nf.nome.trim()) return 'Informe o nome ou razão social para a nota fiscal.'
  return faltaNoEndereco(nf.endereco)
}

export function notaFiscalToFinancial(precisaNf: boolean, nf: NotaFiscalForm) {
  if (!precisaNf) return { requiresReceipt: 'nao' as const }
  if (nf.modo === 'mesmos') return { requiresReceipt: 'sim' as const, receiptData: { useProfileData: 'mesmos' as const } }
  const digits = nf.documento.replace(/\D/g, '')
  const e = nf.endereco
  return {
    requiresReceipt: 'sim' as const,
    receiptData: {
      useProfileData: 'adicionar' as const,
      taxId: digits.length === 14 ? normalizarCNPJ(nf.documento) : digits,
      name: nf.nome.trim(),
      address: descreverEnderecoNf(e),
      addressDetails: {
        zipCode: e.cep.replace(/\D/g, ''),
        street: e.logradouro.trim(),
        number: e.numero.trim(),
        complement: e.complemento.trim(),
        neighborhood: e.bairro.trim(),
        city: e.cidade.trim(),
        state: e.uf.trim().toUpperCase(),
      },
    },
  }
}

/**
 * Validação no servidor do JSON `financial` recebido (a tela pode ser contornada).
 * Só cobra quando a nota sai com "outros dados".
 */
export function validarFinancialNotaFiscal(financial: unknown): string | null {
  if (!financial || typeof financial !== 'object') return null
  const f = financial as NonNullable<FinancialLike>
  const precisa = f.requiresReceipt === 'sim' || f.requiresReceipt === true
  if (!precisa || f.receiptData?.useProfileData !== 'adicionar') return null
  return validarNotaFiscal(true, notaFiscalFromFinancial(f))
}

export function descreverNotaFiscal(precisaNf: boolean, nf: NotaFiscalForm): string {
  if (!precisaNf) return 'Não precisa'
  if (nf.modo === 'mesmos') return 'Sim — com os dados do cadastro'
  const endereco = descreverEnderecoNf(nf.endereco)
  return `Sim — ${nf.nome || 'outro titular'}${nf.documento ? ` (${nf.documento})` : ''}${endereco ? ` · ${endereco}` : ''}`
}
