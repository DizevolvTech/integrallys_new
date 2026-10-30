/** O "OK mensagem" do aniversário vale por ano e só pode ser marcado até o ano corrente (fuso da clínica). */
export function anoMaximoParaMarcar(agora: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric' }).format(agora),
  )
}

export function anoValidoParaMarcar(ano: number, agora: Date = new Date()): boolean {
  return Number.isInteger(ano) && ano >= 2000 && ano <= anoMaximoParaMarcar(agora)
}
