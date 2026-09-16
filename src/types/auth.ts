export type UserRole = 'master' | 'admin' | 'gestor' | 'recepcao' | 'especialista' | 'paciente'

export interface SidebarItem {
  id: string
  label: string
  icon: string
  type?: 'category' | 'group'
  href?: string
  children?: SidebarItem[]
}

export interface Permission {
  resource: string
  actions: string[]
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  /**
   * CR-AUTH-01 · TS-04: unidade do usuário, embarcada no JWT para evitar
   * N+1 nas APIs. `null` quando o usuário não tem unidade associada (perfis
   * master/admin sem vínculo). `undefined` em tokens antigos (pré-064);
   * downstream deve fazer fallback à query legada quando undefined.
   */
  unidadeId?: string | null
  /**
   * UI-15: nome da unidade vinculada — exibido no Header para gestor /
   * recepção / especialista. Resolvido via JOIN em `buildAuthPayloadFromUserId`
   * (não vem do JWT — derivado a cada `/api/auth/me`).
   */
  unidadeNome?: string | null
  avatarUrl?: string
  mustDefinePassword?: boolean
}

export interface MeResponse {
  user: AuthUser
  sidebarItems: SidebarItem[]
  permissions: Permission[]
  /** Capabilities derivadas no servidor (evitar `role ===` nas views). */
  capabilities: {
    iniciarAtendimento: boolean
    /** Layout de agenda clínica (aba pessoal, filtro pelo próprio profissional). */
    agendaClinica: boolean
    /** Campos CRM / assinatura / método de atendimento em Configurações. */
    perfilClinico: boolean
  }
}
