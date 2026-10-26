// Aceite do vídeo de 26/10: a ficha mostra a origem do paciente e quem indicou.
const ROTULOS: Record<string, string> = {
  instagram: 'Instagram',
  google: 'Google',
  indicacao: 'Indicação',
  outros: 'Outros',
}

export function descreverOrigem(source?: string | null, detalhe?: string | null): string {
  const chave = (source ?? '').trim().toLowerCase()
  if (!chave || chave === 'nao informado' || chave === 'não informado') return '-'
  const rotulo = ROTULOS[chave] ?? source ?? '-'
  const extra = (detalhe ?? '').trim()
  if (!extra) return rotulo
  return chave === 'indicacao' ? `Indicação de ${extra}` : `${rotulo} — ${extra}`
}
