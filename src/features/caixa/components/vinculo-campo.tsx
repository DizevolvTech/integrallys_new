'use client'

import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useVinculoOpcoes, type VinculoTipoCampo } from './use-vinculo-opcoes'

export interface VinculoValor {
  tipo: VinculoTipoCampo | ''
  id: string
  nome: string
}

export const VINCULO_VAZIO: VinculoValor = { tipo: '', id: '', nome: '' }

const TIPOS: { value: VinculoTipoCampo; label: string }[] = [
  { value: 'paciente', label: 'Paciente' },
  { value: 'fornecedor', label: 'Fornecedor' },
  { value: 'prestador', label: 'Prestador de serviço' },
  { value: 'colaborador', label: 'Colaborador' },
  { value: 'outro', label: 'Outro' },
]

const ROTULO_PESSOA: Record<string, string> = {
  paciente: 'Paciente',
  fornecedor: 'Fornecedor',
  prestador: 'Prestador de serviço',
  colaborador: 'Colaborador',
}

/** Mensagem de erro quando o vínculo está incompleto; null quando está certo. */
export function erroVinculo(valor: VinculoValor, obrigatorio: boolean): string | null {
  if (!valor.tipo) return obrigatorio ? 'Escolha a quem o lançamento está vinculado.' : null
  if (valor.tipo === 'outro') return valor.nome.trim() ? null : 'Informe o nome em "Outro".'
  return valor.id ? null : `Escolha ${valor.tipo === 'colaborador' ? 'o colaborador' : valor.tipo === 'paciente' ? 'o paciente' : valor.tipo === 'fornecedor' ? 'o fornecedor' : 'o prestador'}.`
}

interface VinculoCampoProps {
  valor: VinculoValor
  onChange: (valor: VinculoValor) => void
}

export function VinculoCampo({ valor, onChange }: VinculoCampoProps) {
  const { opcoes, carregando, erro } = useVinculoOpcoes(valor.tipo)
  const tipoPessoa = valor.tipo && valor.tipo !== 'outro'

  return (
    <div className="space-y-2" data-testid="vinculo-campo">
      <Label>Vinculado a</Label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          value={valor.tipo || undefined}
          onValueChange={(tipo) => onChange({ tipo: tipo as VinculoTipoCampo, id: '', nome: '' })}
        >
          <SelectTrigger className="h-12 rounded-[12px]" aria-label="Tipo de vínculo">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            {TIPOS.map((tipo) => (
              <SelectItem key={tipo.value} value={tipo.value}>
                {tipo.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {tipoPessoa && (
          <Combobox
            value={valor.id}
            onChange={(id) => onChange({ ...valor, id, nome: opcoes.find((o) => o.value === id)?.label ?? '' })}
            options={opcoes}
            placeholder={carregando ? 'Carregando...' : `Selecione ${ROTULO_PESSOA[valor.tipo]?.toLowerCase() ?? 'a pessoa'}`}
            searchPlaceholder="Digite o nome para pesquisar..."
            emptyText={erro ?? 'Nenhum cadastro encontrado'}
            disabled={carregando}
          />
        )}
        {valor.tipo === 'outro' && (
          <Input
            className="h-12 rounded-[12px]"
            placeholder="Nome (ex.: motoboy, vizinho)"
            maxLength={120}
            value={valor.nome}
            onChange={(e) => onChange({ ...valor, nome: e.target.value })}
            aria-label="Nome em Outro"
          />
        )}
      </div>
      {erro && tipoPessoa && (
        <p className="text-xs text-[var(--app-danger-text)]" role="alert">
          {erro}
        </p>
      )}
    </div>
  )
}
