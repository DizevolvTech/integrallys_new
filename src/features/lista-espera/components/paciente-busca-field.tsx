'use client'

import { useMemo, useState } from 'react'
import { UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NovoPacienteModal } from '@/features/gestao-pacientes/modals'
import { patientToCreateInput } from '@/features/gestao-pacientes/patient-to-input'
import { usePacientes } from '@/hooks/use-pacientes'
import type { Patient } from '@/types/patient'
import { normalizeBusca } from '../lista-espera.utils'

export interface PacienteBuscaOption {
  id: string
  nome: string
}

interface PacienteBuscaFieldProps {
  patients: PacienteBuscaOption[]
  value: string
  onChange: (pacienteId: string) => void
  invalid?: boolean
  onCreated?: () => void
}

const MAX_SUGESTOES = 50

/** Campo de paciente: digita e filtra; sem resultado, abre o cadastro de paciente existente e volta selecionado. */
export function PacienteBuscaField({ patients, value, onChange, invalid, onCreated }: PacienteBuscaFieldProps) {
  const { units, createPaciente } = usePacientes()
  const [extras, setExtras] = useState<PacienteBuscaOption[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [cadastroOpen, setCadastroOpen] = useState(false)

  const todos = useMemo(() => {
    const ids = new Set(patients.map((item) => item.id))
    return [...patients, ...extras.filter((item) => !ids.has(item.id))]
  }, [patients, extras])
  const selecionado = todos.find((item) => item.id === value) ?? null
  const texto = selecionado ? selecionado.nome : query

  const sugestoes = useMemo(() => {
    const termo = normalizeBusca(query)
    if (!termo) return []
    return todos.filter((item) => normalizeBusca(item.nome).includes(termo)).slice(0, MAX_SUGESTOES)
  }, [todos, query])

  const semResultado = query.trim().length > 0 && sugestoes.length === 0

  const escolher = (item: PacienteBuscaOption) => {
    onChange(item.id)
    setQuery('')
    setOpen(false)
  }

  const limpar = () => {
    onChange('')
    setQuery('')
    setOpen(false)
  }

  const salvarNovo = async (patient: Patient) => {
    const response = await createPaciente(patientToCreateInput(patient))
    const createdId =
      response.createdId ??
      response.data.find((item) => item.nome === (patient.name || patient.nome))?.id
    if (!createdId) throw new Error('Paciente criado, mas o id não retornou da API')
    setExtras((prev) => [...prev, { id: createdId, nome: patient.name || patient.nome || '' }])
    onChange(createdId)
    setQuery('')
    setCadastroOpen(false)
    onCreated?.()
    toast.success('Paciente cadastrado e selecionado.')
    return { portalAccess: response.portalAccess ?? null }
  }

  return (
    <div className="relative space-y-2">
      <div className="relative">
        <Input
          role="combobox"
          aria-expanded={open}
          aria-controls="lista-espera-paciente-sugestoes"
          aria-label="Paciente"
          aria-invalid={invalid}
          autoComplete="off"
          value={texto}
          placeholder="Digite o nome do paciente"
          className="h-11 rounded-xl pr-10"
          onChange={(event) => {
            if (value) onChange('')
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
        />
        {(value || query) && (
          <button
            type="button"
            aria-label="Limpar paciente"
            onClick={limpar}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-app-text-muted hover:text-app-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {open && !value && query.trim().length > 0 && (
        <div
          id="lista-espera-paciente-sugestoes"
          role="listbox"
          className="absolute z-30 -mt-1 max-h-56 w-full overflow-auto rounded-xl border border-app-border bg-white shadow-md dark:border-app-border-dark dark:bg-app-card-dark"
        >
          {sugestoes.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={item.id === value}
              className="flex w-full px-3 py-2 text-left text-sm text-app-text-primary hover:bg-app-bg-secondary dark:text-white dark:hover:bg-app-hover"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => escolher(item)}
            >
              {item.nome}
            </button>
          ))}
          {semResultado && (
            <div className="space-y-2 p-3">
              <p className="text-sm font-medium text-app-text-primary dark:text-white">Paciente não cadastrado</p>
              <Button
                type="button"
                variant="outline"
                className="h-9 w-full gap-2 rounded-xl"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setOpen(false)
                  setCadastroOpen(true)
                }}
              >
                <UserPlus className="h-4 w-4" />
                Cadastrar novo paciente
              </Button>
            </div>
          )}
        </div>
      )}
      <NovoPacienteModal
        isOpen={cadastroOpen}
        onClose={() => setCadastroOpen(false)}
        unitOptions={units}
        initialNome={query.trim()}
        onSave={salvarNovo}
      />
    </div>
  )
}
