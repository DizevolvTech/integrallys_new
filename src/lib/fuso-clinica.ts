/** Fuso da clínica: todo horário exibido sai em Brasília, independente do fuso do navegador ou do servidor (UTC). */
export const FUSO_CLINICA = 'America/Sao_Paulo'

const OPCOES_DATA_HORA: Intl.DateTimeFormatOptions = {
  timeZone: FUSO_CLINICA,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}

/** 'DD/MM/AAAA HH:MM' no horário de Brasília; devolve o texto original se não for uma data válida. */
export function formatarDataHoraClinica(valor: string | number | Date | null | undefined, vazio = '—'): string {
  if (valor === null || valor === undefined || valor === '') return vazio
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return String(valor)
  return data.toLocaleString('pt-BR', OPCOES_DATA_HORA)
}

/** 'HH:MM' no horário de Brasília. */
export function formatarHoraClinica(valor: string | number | Date | null | undefined, vazio = ''): string {
  if (valor === null || valor === undefined || valor === '') return vazio
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return vazio
  return data.toLocaleTimeString('pt-BR', { timeZone: FUSO_CLINICA, hour: '2-digit', minute: '2-digit' })
}
