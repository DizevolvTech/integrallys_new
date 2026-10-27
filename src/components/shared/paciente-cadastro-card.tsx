'use client'

import { CreditCard, Mail, MapPin, Phone } from 'lucide-react'
import { useState } from 'react'
import { usePacienteResumo } from '@/hooks/use-paciente-resumo'
import { cn } from '@/lib/utils'

function iniciais(nome: string) {
  return (
    nome
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || 'P'
  )
}

const vazio = (v?: string | null) => (v && v.trim() ? v : '—')

/** Foto + dados de cadastro do paciente (topo do atendimento e do prontuário). */
export function PacienteCadastroCard({
  pacienteId,
  nomeFallback = '',
  className,
}: {
  pacienteId?: string | null
  nomeFallback?: string
  className?: string
}) {
  const { data, isLoading } = usePacienteResumo(pacienteId)
  const [fotoFalhou, setFotoFalhou] = useState(false)
  const nome = data?.nome || nomeFallback
  const campos = [
    { icon: CreditCard, label: 'CPF', valor: data?.cpf },
    { icon: Phone, label: 'Telefone', valor: data?.telefone },
    { icon: Mail, label: 'E-mail', valor: data?.email },
    { icon: MapPin, label: 'Endereço', valor: data?.endereco },
  ]

  return (
    <div className={cn('flex flex-col gap-6 lg:flex-row', className)} aria-busy={isLoading}>
      <div className="flex items-center gap-4">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl app-status-info text-xl text-[var(--app-primary)] dark:bg-app-primary/30 dark:text-white">
          {data?.fotoUrl && !fotoFalhou ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL pública do storage, sem otimização
            <img
              src={data.fotoUrl}
              alt={`Foto de ${nome}`}
              className="h-full w-full object-cover"
              onError={() => setFotoFalhou(true)}
            />
          ) : (
            iniciais(nome)
          )}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-app-text-muted">Paciente</p>
          <p className="text-lg font-normal text-app-text-primary dark:text-white">{nome}</p>
          <p className="text-xs text-app-text-muted">
            Nascimento: {vazio(data?.dataNascimento)} • Idade:{' '}
            {data?.idade != null ? `${data.idade} anos` : '—'}
          </p>
        </div>
      </div>
      <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
        {campos.map(({ icon: Icon, label, valor }) => (
          <div key={label} className="flex items-center gap-3">
            <Icon className="h-4 w-4 shrink-0 text-app-text-muted" />
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-app-text-muted">{label}</p>
              <p className="break-words text-sm text-app-text-primary dark:text-white">{vazio(valor)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
