import { formatarCNPJ, formatarCPF, normalizarCNPJ, validarCNPJ, validarCPF } from '@/lib/validacao-br'

// Item 2 do feedback: dados para emissão de NF. "mesmos" = usa o cadastro do
// paciente; "adicionar" = nota sai com outro CPF/CNPJ e nome (ex.: produtor rural).
export type NotaFiscalForm = {
  modo: 'mesmos' | 'adicionar'
  documento: string
  nome: string
  endereco: string
}

export const NOTA_FISCAL_VAZIA: NotaFiscalForm = { modo: 'mesmos', documento: '', nome: '', endereco: '' }

type FinancialLike = {
  requiresReceipt?: boolean | 'sim' | 'nao'
  receiptData?: { useProfileData?: boolean | 'mesmos' | 'adicionar'; taxId?: string; name?: string; address?: string }
} | undefined

export function formatarDocumentoNf(valor: string): string {
  const digits = valor.replace(/\D/g, '')
  return digits.length > 11 ? formatarCNPJ(valor) : formatarCPF(valor)
}

export function notaFiscalFromFinancial(financial: FinancialLike): NotaFiscalForm {
  const data = financial?.receiptData
  if (!data || data.useProfileData === 'mesmos' || data.useProfileData === true) return { ...NOTA_FISCAL_VAZIA }
  return {
    modo: 'adicionar',
    documento: data.taxId ? formatarDocumentoNf(data.taxId) : '',
    nome: data.name ?? '',
    endereco: data.address ?? '',
  }
}

export function validarNotaFiscal(precisaNf: boolean, nf: NotaFiscalForm): string | null {
  if (!precisaNf || nf.modo !== 'adicionar') return null
  const digits = nf.documento.replace(/\D/g, '')
  if (!digits) return 'Informe o CPF ou CNPJ para a nota fiscal.'
  if (digits.length === 11 ? !validarCPF(nf.documento) : digits.length === 14 ? !validarCNPJ(nf.documento) : true) {
    return 'CPF/CNPJ da nota fiscal inválido — confira os dígitos.'
  }
  if (!nf.nome.trim()) return 'Informe o nome ou razão social para a nota fiscal.'
  return null
}

export function notaFiscalToFinancial(precisaNf: boolean, nf: NotaFiscalForm) {
  if (!precisaNf) return { requiresReceipt: 'nao' as const }
  if (nf.modo === 'mesmos') return { requiresReceipt: 'sim' as const, receiptData: { useProfileData: 'mesmos' as const } }
  const digits = nf.documento.replace(/\D/g, '')
  return {
    requiresReceipt: 'sim' as const,
    receiptData: {
      useProfileData: 'adicionar' as const,
      taxId: digits.length === 14 ? normalizarCNPJ(nf.documento) : digits,
      name: nf.nome.trim(),
      address: nf.endereco.trim(),
    },
  }
}
