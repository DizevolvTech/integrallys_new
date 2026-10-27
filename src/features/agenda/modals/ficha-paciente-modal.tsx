'use client'

import { useEffect, useState } from 'react'
import { User, Phone, Mail, MapPin, FileText, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useApi } from '@/hooks/use-api'
import type { PacienteItem } from '@/hooks/use-pacientes'
import { formatarCPF } from '@/lib/validacao-br'

interface FichaPacienteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pacienteId: string | null
}

export function FichaPacienteModal({ open, onOpenChange, pacienteId }: FichaPacienteModalProps) {
  const api = useApi()
  const [paciente, setPaciente] = useState<PacienteItem | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !pacienteId) {
      setPaciente(null)
      return
    }

    let mounted = true
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await api.get<{ data: PacienteItem[] }>(`/api/pacientes?id=${pacienteId}`)
        if (!mounted) return
        const found = Array.isArray(res.data) ? res.data.find((p) => p.id === pacienteId) ?? res.data[0] : null
        setPaciente(found ?? null)
      } catch {
        if (mounted) setError('Erro ao carregar dados do paciente')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    void load()
    return () => { mounted = false }
  }, [open, pacienteId, api])

  const statusBadge = paciente?.status === 'ativo'
    ? 'app-status-success'
    : 'app-status-warning'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="bg-app-card dark:bg-app-card-dark">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-normal text-app-text-primary dark:text-white">
            <User className="h-5 w-5 text-[var(--app-primary)]" />
            Ficha do paciente
          </DialogTitle>
          <DialogDescription>
            Visualize as informações completas do paciente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 p-6 pt-0">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-app-primary" />
            </div>
          )}

          {error && (
            <div className="app-status-warning rounded-integrallys p-4 text-xs">{error}</div>
          )}

          {!isLoading && !error && !paciente && (
            <p className="py-8 text-center text-sm text-app-text-muted">Paciente não encontrado.</p>
          )}

          {paciente && (
            <>
              <div className="flex items-center gap-4 rounded-[12px] border border-app-border bg-app-bg-secondary/35 p-4 dark:border-app-border-dark dark:bg-app-bg-dark/50">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-app-border bg-app-card shadow-sm dark:border-app-border-dark dark:bg-app-bg-dark">
                  <User className="h-6 w-6 text-app-text-muted" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <h3 className="truncate text-lg font-normal text-app-text-primary dark:text-white">{paciente.nome}</h3>
                  <p className="text-xs font-normal text-app-text-muted">
                    {paciente.cpf ? `CPF: ${formatarCPF(paciente.cpf)}` : 'CPF não informado'}
                    {paciente.birthDate ? ` - Nasc: ${paciente.birthDate}` : ''}
                  </p>
                </div>
                <Badge className={`ml-auto shrink-0 border-none px-2.5 py-1 text-xs font-normal uppercase tracking-wider ${statusBadge}`}>
                  {paciente.status ?? 'Ativo'}
                </Badge>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-normal text-app-text-primary dark:text-white">Dados pessoais</h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {paciente.rg && (
                    <InfoField icon={<FileText className="h-4 w-4" />} label="RG" value={paciente.rg} />
                  )}
                  {paciente.gender && (
                    <InfoField icon={<User className="h-4 w-4" />} label="Sexo" value={paciente.gender} />
                  )}
                  {paciente.source && (
                    <InfoField icon={<FileText className="h-4 w-4" />} label="Indicação" value={paciente.source} className="sm:col-span-2" />
                  )}
                </div>
              </div>

              <div className="h-px bg-app-bg-secondary dark:bg-app-bg-dark" />

              <div className="space-y-4">
                <h4 className="text-sm font-normal text-app-text-primary dark:text-white">Contato</h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <InfoField icon={<Phone className="h-4 w-4" />} label="Telefone" value={paciente.telefone || '--'} />
                  <InfoField icon={<Mail className="h-4 w-4" />} label="E-mail" value={paciente.email || '--'} />
                  {paciente.addressDetails?.street && (
                    <InfoField
                      icon={<MapPin className="h-4 w-4" />}
                      label="Endereço"
                      value={formatAddress(paciente.addressDetails)}
                      className="sm:col-span-2"
                    />
                  )}
                </div>
              </div>

              {(paciente.specialNeeds || paciente.responsible) && (
                <>
                  <div className="h-px bg-app-bg-secondary dark:bg-app-bg-dark" />
                  <div className="space-y-4">
                    <h4 className="text-sm font-normal text-app-text-primary dark:text-white">Observações</h4>
                    <p className="text-xs leading-relaxed text-app-text-secondary dark:text-app-text-muted">
                      {paciente.specialNeeds ? JSON.stringify(paciente.specialNeeds) : 'Sem observações registradas.'}
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            className="h-11 w-full rounded-integrallys bg-app-primary px-8 font-normal text-white shadow-sm transition-all hover:bg-app-primary-hover active:scale-[0.98]"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function InfoField({ icon, label, value, className }: { icon: React.ReactNode; label: string; value: string; className?: string }) {
  return (
    <div className={`flex items-start gap-3 rounded-[12px] border border-app-border/70 p-3 dark:border-app-border-dark/70 ${className ?? ''}`}>
      <span className="mt-0.5 text-app-primary">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wider text-app-text-muted">{label}</p>
        <p className="truncate text-sm font-normal text-app-text-primary dark:text-white">{value}</p>
      </div>
    </div>
  )
}

function formatAddress(addr: NonNullable<PacienteItem['addressDetails']>): string {
  const parts = [addr.street]
  if (addr.number) parts.push(addr.number)
  if (addr.complement) parts.push(addr.complement)
  const line1 = parts.filter(Boolean).join(', ')
  const line2Parts = [addr.neighborhood, addr.city ? `${addr.city}/${addr.state ?? ''}` : null]
  const line2 = line2Parts.filter(Boolean).join(' - ')
  const cep = addr.zipCode ? `CEP: ${addr.zipCode}` : ''
  return [line1, line2, cep].filter(Boolean).join(' - ')
}
