// Aceite do vídeo de 26/10: a ficha mostra a origem do paciente e quem indicou.
// Mesma lista dos filtros de mídia dos relatórios (relatorio-config.ts): os valores já gravados
// (instagram, google, indicacao, outros) não mudam; só entram opções novas.
export const OPCOES_ORIGEM = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'radio', label: 'Rádio' },
  { value: 'google', label: 'Google' },
  { value: 'site', label: 'Site' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'outros', label: 'Outros' },
] as const

export const VALORES_ORIGEM: ReadonlySet<string> = new Set(OPCOES_ORIGEM.map((o) => o.value))

const ROTULOS: Record<string, string> = Object.fromEntries(OPCOES_ORIGEM.map((o) => [o.value, o.label]))

export function descreverConvenio(convenio?: string | null): string {
  return (convenio ?? '').trim() || 'Particular'
}

export function descreverOrigem(source?: string | null, detalhe?: string | null): string {
  const chave = (source ?? '').trim().toLowerCase()
  if (!chave || chave === 'nao informado' || chave === 'não informado') return '-'
  const rotulo = ROTULOS[chave] ?? source ?? '-'
  const extra = (detalhe ?? '').trim()
  if (!extra) return rotulo
  return chave === 'indicacao' ? `Indicação de ${extra}` : `${rotulo} — ${extra}`
}
