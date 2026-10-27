/** Perfis que podem emitir recibo/NF. Fonte única: o servidor decide (API de recibos e meta da agenda). */
const PERFIS_RECIBO = new Set(['master', 'admin', 'gestor', 'recepcao'])

export function perfilPodeEmitirRecibo(role: string | null | undefined) {
  return !!role && PERFIS_RECIBO.has(role)
}
