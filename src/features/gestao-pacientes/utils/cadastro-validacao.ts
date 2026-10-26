import { camposFaltandoNotaFiscal, type NotaFiscalForm } from './nota-fiscal'

// Vídeo de 26/10 + aceite: ao salvar, o cadastro diz de uma vez tudo o que falta,
// em português (antes vinha um aviso por vez e, em alguns campos, o aviso do navegador em inglês).
export type CadastroObrigatorios = {
  nome: string
  cpf: string
  dataNascimento: string
  cep: string
  telefone: string
  precisaNf: boolean
  notaFiscal: NotaFiscalForm
  menorDeIdade: boolean
  responsavelNome: string
  responsavelParentesco: string
}

export function camposFaltandoCadastro(c: CadastroObrigatorios): string[] {
  const faltam: string[] = []
  if (!c.nome.trim()) faltam.push('nome')
  if (!c.cpf.trim()) faltam.push('CPF')
  if (!c.dataNascimento.trim()) faltam.push('data de nascimento')
  if (!c.telefone.trim()) faltam.push('telefone')
  if (c.cep.replace(/\D/g, '').length !== 8) faltam.push('CEP do endereço')
  if (c.menorDeIdade) {
    if (!c.responsavelNome.trim()) faltam.push('nome do responsável (paciente menor de 18 anos)')
    if (!c.responsavelParentesco) faltam.push('parentesco do responsável')
  }
  faltam.push(...camposFaltandoNotaFiscal(c.precisaNf, c.notaFiscal))
  return faltam
}

export function mensagemCamposFaltando(faltam: string[]): string | null {
  if (faltam.length === 0) return null
  return `Para salvar, preencha: ${faltam.join(', ')}.`
}
