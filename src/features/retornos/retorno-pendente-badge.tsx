/** Etiqueta persistente exibida enquanto o paciente tem retorno pendente. */
export function RetornoPendenteBadge() {
  return (
    <span
      data-testid="etiqueta-retorno-pendente"
      className="inline-flex w-fit items-center rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1 text-xs font-medium text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300"
    >
      Retorno pendente
    </span>
  )
}
