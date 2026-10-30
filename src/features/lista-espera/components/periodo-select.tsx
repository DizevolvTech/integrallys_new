import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { normalizePeriodo, periodoOptions } from '../lista-espera.utils'

interface PeriodoSelectProps {
  value: string
  onChange: (value: string) => void
}

/** Lista de escolha da preferência de período; texto livre antigo continua disponível como opção. */
export function PeriodoSelect({ value, onChange }: PeriodoSelectProps) {
  const atual = normalizePeriodo(value)
  return (
    <Select value={atual || undefined} onValueChange={onChange}>
      <SelectTrigger className="h-11 rounded-xl" aria-label="Preferência de período">
        <SelectValue placeholder="Selecione o período" />
      </SelectTrigger>
      <SelectContent>
        {periodoOptions(atual).map((periodo) => (
          <SelectItem key={periodo} value={periodo}>
            {periodo}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
