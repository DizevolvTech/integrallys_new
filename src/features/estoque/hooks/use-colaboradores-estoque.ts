'use client'

import { useMemo } from 'react'
import { useUsuarios } from '@/hooks/use-usuarios'
import type { OpcaoBusca } from '@/lib/busca-opcoes'

const PERFIL: Record<string, string> = {
  admin: 'Administrador',
  master: 'Administrador',
  gestor: 'Gestor',
  recepcao: 'Recepção',
  especialista: 'Especialista',
}

/** Usuários do sistema (equipe) ativos, prontos para a seleção pesquisável; pacientes ficam de fora. */
export function useColaboradoresEstoque(): OpcaoBusca[] {
  const { data: usuarios } = useUsuarios()
  return useMemo(
    () =>
      usuarios
        .filter((u) => u.perfil !== 'paciente' && (u.status ?? 'Ativo') !== 'Inativo')
        .map((u) => ({ value: u.id, label: u.nome, hint: PERFIL[u.perfil ?? ''] ?? u.perfil })),
    [usuarios],
  )
}
