'use client'

import { useMemo } from 'react'
import { useProcedimentos } from '@/features/procedimentos/hooks/use-procedimentos'
import { useUnidades } from '@/hooks/use-unidades'
import { useUsuarios } from '@/hooks/use-usuarios'

export interface OpcaoFiltro {
  value: string
  label: string
}

export type FonteOpcoes = 'unidades' | 'profissionais' | 'usuarios' | 'procedimentos'

/** Listas dos filtros (unidade, profissional, usuário, procedimento) já no formato de Select. */
export function useOpcoesFiltro(): Record<FonteOpcoes, OpcaoFiltro[]> {
  const { data: unidades } = useUnidades()
  const { data: usuarios } = useUsuarios()
  const { data: procedimentos } = useProcedimentos()

  return useMemo(
    () => ({
      unidades: unidades.map((u) => ({ value: u.id, label: u.nome })),
      profissionais: usuarios
        .filter((u) => u.perfil === 'especialista')
        .map((u) => ({ value: u.id, label: u.nome })),
      usuarios: usuarios.filter((u) => u.perfil !== 'paciente').map((u) => ({ value: u.id, label: u.nome })),
      procedimentos: procedimentos.filter((p) => p.ativo).map((p) => ({ value: p.id, label: p.nome })),
    }),
    [unidades, usuarios, procedimentos],
  )
}
