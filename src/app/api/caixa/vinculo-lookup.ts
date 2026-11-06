// Consultas do "Vinculado a": opções para a tela e resolução do nome no servidor (o nome nunca vem do navegador).
import { getAppSupabase } from '@/lib/app-api'
import type { VinculoTipo } from './movimento-input'

export interface OpcaoVinculo {
  id: string
  nome: string
  hint?: string
}

const LIMITE_OPCOES = 1000

const PERFIL: Record<string, string> = {
  admin: 'Administrador',
  master: 'Administrador',
  gestor: 'Gestor',
  recepcao: 'Recepção',
  especialista: 'Especialista',
}

export async function listarOpcoesVinculo(tipo: Exclude<VinculoTipo, 'outro'>, unidadeId: string | null) {
  const supabase = getAppSupabase()
  if (tipo === 'colaborador') {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id,nome,perfil,status')
      .neq('perfil', 'paciente')
      .neq('status', 'Inativo')
      .order('nome', { ascending: true })
      .limit(LIMITE_OPCOES)
    return {
      error,
      data: (data ?? []).map((u) => ({ id: String(u.id), nome: String(u.nome ?? ''), hint: PERFIL[String(u.perfil ?? '')] ?? undefined })),
    }
  }
  if (tipo === 'paciente') {
    let query = supabase.from('pacientes').select('id,nome').neq('status', 'Inativo').order('nome', { ascending: true }).limit(LIMITE_OPCOES)
    if (unidadeId) query = query.eq('unidade_id', unidadeId)
    const { data, error } = await query
    return { error, data: (data ?? []).map((p) => ({ id: String(p.id), nome: String(p.nome ?? '') })) }
  }
  // Fornecedor e prestador de serviço usam o mesmo cadastro de fornecedores (ele não tem campo de tipo).
  const { data, error } = await supabase
    .from('pacientes')
    .select('id,nome')
    .contains('vinculo_tipos', ['fornecedor'])
    .neq('status', 'Inativo')
    .order('nome', { ascending: true })
    .limit(LIMITE_OPCOES)
  return { error, data: (data ?? []).map((f) => ({ id: String(f.id), nome: String(f.nome ?? '') })) }
}

/** Nome da pessoa no cadastro, ou null quando o id não existe para aquele tipo. */
export async function nomeDoVinculo(tipo: Exclude<VinculoTipo, 'outro'>, id: string): Promise<{ nome: string | null; error: boolean }> {
  const supabase = getAppSupabase()
  if (tipo === 'colaborador') {
    const { data, error } = await supabase.from('usuarios').select('nome').eq('id', id).neq('perfil', 'paciente').maybeSingle()
    return { nome: data?.nome ? String(data.nome) : null, error: Boolean(error) }
  }
  let query = supabase.from('pacientes').select('nome').eq('id', id)
  if (tipo !== 'paciente') query = query.contains('vinculo_tipos', ['fornecedor'])
  const { data, error } = await query.maybeSingle()
  return { nome: data?.nome ? String(data.nome) : null, error: Boolean(error) }
}
