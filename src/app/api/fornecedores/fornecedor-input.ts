import type { FornecedorItem } from '@/types/fornecedor'

// Lógica pura (testável) do cadastro de Fornecedores. Fornecedor = linha de
// `pacientes` cujo `vinculo_tipos` contém 'fornecedor' + `fornecedor_dados` (JSONB). Sem
// tabela nova — espelha o padrão de Profissionais (079).

function pick(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function str(value: unknown): string | null {
  return value ? String(value) : null
}

export interface FornecedorDados {
  razaoSocial: string | null
  cnpj: string | null
  inscricaoEstadual: string | null
  contatoNome: string | null
  contatoSetor: string | null
  categoriaDre: string | null
}

export interface FornecedorPayload {
  nome: string
  telefone: string | null
  email: string | null
  status: string
  fornecedorDados: FornecedorDados
}

export type FornecedorValidation =
  | { ok: true; value: FornecedorPayload }
  | { ok: false; error: string; code: string }

export function validateFornecedorInput(body: Record<string, unknown>): FornecedorValidation {
  const nome = pick(body.nome)
  if (!nome) {
    return { ok: false, error: 'Nome do fornecedor é obrigatório', code: 'NOME_REQUIRED' }
  }

  return {
    ok: true,
    value: {
      nome,
      telefone: pick(body.telefone) || null,
      email: pick(body.email).toLowerCase() || null,
      status: pick(body.status) || 'Ativo',
      fornecedorDados: {
        razaoSocial: pick(body.razaoSocial) || null,
        cnpj: pick(body.cnpj) || null,
        inscricaoEstadual: pick(body.inscricaoEstadual) || null,
        contatoNome: pick(body.contatoNome) || null,
        contatoSetor: pick(body.contatoSetor) || null,
        categoriaDre: pick(body.categoriaDre) || null,
      },
    },
  }
}

export function mapFornecedorRow(row: Record<string, unknown>): FornecedorItem {
  const dados = (
    row.fornecedor_dados && typeof row.fornecedor_dados === 'object' ? row.fornecedor_dados : {}
  ) as Record<string, unknown>

  return {
    id: String(row.id),
    nome: String(row.nome ?? ''),
    telefone: str(row.telefone),
    email: str(row.email),
    status: String(row.status ?? 'Ativo'),
    unidadeId: str(row.unidade_id),
    razaoSocial: str(dados.razaoSocial),
    cnpj: str(dados.cnpj),
    inscricaoEstadual: str(dados.inscricaoEstadual),
    contatoNome: str(dados.contatoNome),
    contatoSetor: str(dados.contatoSetor),
    categoriaDre: str(dados.categoriaDre),
  }
}

/** Linha de `pacientes` para um fornecedor novo (clínica-wide, sem unidade). Compartilhada pelos dois cadastros. */
export function fornecedorInsertRow(f: FornecedorPayload) {
  return {
    nome: f.nome,
    telefone: f.telefone,
    email: f.email,
    status: f.status,
    vinculo_tipos: ['fornecedor'],
    fornecedor_dados: f.fornecedorDados,
    unidade_id: null,
  }
}
