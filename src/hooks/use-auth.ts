'use client'

import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'
import type { AuthUser, MeResponse, Permission, SidebarItem } from '@/types/auth'

interface AuthState {
  user: AuthUser | null
  sidebarItems: SidebarItem[]
  permissions: Permission[]
  capabilities: MeResponse['capabilities']
  isLoading: boolean
  isInitialized: boolean
  isAuthenticated: boolean
  initialize: (force?: boolean) => Promise<boolean>
  logout: () => Promise<void>
}

const emptyCapabilities: MeResponse['capabilities'] = {
  iniciarAtendimento: false,
  agendaClinica: false,
  perfilClinico: false,
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  sidebarItems: [],
  permissions: [],
  capabilities: emptyCapabilities,
  // Default true — evita race onde o layout redireciona pra /login antes do
  // initialize() terminar de validar o JWT via /api/auth/me. Sem isso, todo
  // refresh desloga o usuário mesmo com cookie válido.
  isLoading: true,
  isInitialized: false,
  isAuthenticated: false,
  initialize: async (force = false) => {
    if (get().isInitialized && !force) {
      return true
    }

    set({ isLoading: true })
    try {
      const response = await apiClient<MeResponse>('/api/auth/me')
      set({
        user: response.user,
        sidebarItems: response.sidebarItems,
        permissions: response.permissions,
        capabilities: response.capabilities ?? emptyCapabilities,
        isInitialized: true,
        isAuthenticated: true,
      })
      return true
    } catch {
      set({
        user: null,
        sidebarItems: [],
        permissions: [],
        capabilities: emptyCapabilities,
        isInitialized: false,
        isAuthenticated: false,
      })
      return false
    } finally {
      set({ isLoading: false })
    }
  },
  logout: async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    set({
      user: null,
      sidebarItems: [],
      permissions: [],
      capabilities: emptyCapabilities,
      isLoading: false,
      isInitialized: false,
      isAuthenticated: false,
    })
    window.location.href = '/login'
  },
}))
