import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildSidebarForRole } from "@/lib/sidebar-builder";
import type { MeResponse, Permission, UserRole } from "@/types/auth";
import { urlParaNavegador } from "@/lib/storage-urls";

interface UsuarioBaseRow {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  status: string;
  avatar_url?: string | null;
  unidade_id?: string | null;
  // UI-15: nome da unidade resolvido via JOIN no `buildAuthPayloadFromUserId`.
  // Callers que constroem a row manualmente podem omitir — fica `null`.
  unidade_nome?: string | null;
}

interface PermissionRow {
  resource?: unknown;
  actions?: unknown;
}

export function getPasswordSetupRequiredKey(userId: string) {
  return `password_setup_required_${userId}`;
}

function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_CONFIG_MISSING");
  }

  return { supabaseUrl, serviceRoleKey };
}

export function getServiceSupabase(): SupabaseClient {
  const { supabaseUrl, serviceRoleKey } = getSupabaseEnv();
  return createClient(supabaseUrl, serviceRoleKey);
}

export function parseRole(perfil: string): UserRole | null {
  const normalized = perfil.trim().toLowerCase();
  if (
    normalized === "master" ||
    normalized === "admin" ||
    normalized === "gestor" ||
    normalized === "recepcao" ||
    normalized === "especialista" ||
    normalized === "paciente"
  ) {
    return normalized;
  }

  return null;
}

async function fetchPermissions(
  supabase: SupabaseClient,
  userId: string,
): Promise<Permission[]> {
  const { data, error } = await supabase.rpc("get_user_permissions", {
    p_usuario_id: userId,
  });

  // Allow the auth flow to keep working while the SQL migration is being applied.
  if (error || !Array.isArray(data)) {
    return [];
  }

  return data.reduce<Permission[]>((acc, row) => {
    const permissionRow = row as PermissionRow;
    if (
      typeof permissionRow.resource !== "string" ||
      !Array.isArray(permissionRow.actions) ||
      permissionRow.actions.some((action) => typeof action !== "string")
    ) {
      return acc;
    }

    acc.push({
      resource: permissionRow.resource,
      actions: permissionRow.actions as string[],
    });
    return acc;
  }, []);
}

async function fetchMustDefinePassword(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("categoria", "auth_user")
    .eq("chave", getPasswordSetupRequiredKey(userId))
    .maybeSingle();

  if (error) {
    return false;
  }

  return data?.valor === "true";
}

export async function touchLastLogin(userId: string) {
  const supabase = getServiceSupabase();
  await supabase.rpc("touch_ultimo_login", { p_usuario_id: userId });
}

export async function buildAuthPayloadFromUserRecord(
  userRow: UsuarioBaseRow,
): Promise<MeResponse | null> {
  if (userRow.status !== "Ativo") {
    return null;
  }

  const role = parseRole(userRow.perfil);
  if (!role) {
    return null;
  }

  const supabase = getServiceSupabase();
  const permissions = await fetchPermissions(supabase, userRow.id);
  const mustDefinePassword = await fetchMustDefinePassword(supabase, userRow.id);

  return {
    user: {
      id: userRow.id,
      name: userRow.nome,
      email: userRow.email.trim().toLowerCase(),
      role,
      // CR-AUTH-01 · TS-04: embarca `unidade_id` no payload p/ o JWT (evita
      // SELECT extra em toda rota que precisa do escopo de unidade).
      unidadeId:
        typeof userRow.unidade_id === "string" ? userRow.unidade_id : null,
      // UI-15: nome da unidade pra exibição no Header. Vem do JOIN em
      // `buildAuthPayloadFromUserId`. Callers sem JOIN passam undefined →
      // `null` aqui → Header não renderiza o badge (degradação segura).
      unidadeNome:
        typeof userRow.unidade_nome === "string" ? userRow.unidade_nome : null,
      avatarUrl:
        typeof userRow.avatar_url === "string" ? urlParaNavegador(userRow.avatar_url) : undefined,
      mustDefinePassword,
    },
    sidebarItems: buildSidebarForRole(role, permissions),
    permissions,
    capabilities: {
      // Fluxo clínico: especialista e master. Recepção/gestor só mudam status.
      iniciarAtendimento: role === "especialista" || role === "master",
      agendaClinica: role === "especialista",
      perfilClinico: role === "especialista" || role === "master",
    },
  };
}

export async function buildAuthPayloadFromUserId(
  userId: string,
): Promise<MeResponse | null> {
  const supabase = getServiceSupabase();
  // CR-AUTH-01 · TS-04: incluir `unidade_id` p/ embarcar no JWT. Aproveita
  // para incluir `avatar_url` também — o `UsuarioBaseRow` já o tipava como
  // opcional mas o select original o omitia, deixando `avatarUrl` sempre
  // undefined por esta via. Side-effect benigno do fix literal da spec.
  const { data, error } = await supabase
    .from("usuarios")
    .select(
      // UI-15: embarca `unidades(nome)` via PostgREST embedding pra evitar
      // SELECT extra no Header. Retorno aliasado como `unidade`.
      //
      // HOTFIX SEV1 (login): o embedding é desambiguado explicitamente pela FK
      // direta `usuarios.unidade_id` via o hint `!unidade_id`. A migration 085
      // (profissional_unidades) criou uma tabela de junção usuarios↔unidades,
      // o que tornou `unidades(nome)` AMBÍGUO — PostgREST passou a enxergar
      // dois relacionamentos (a FK direta e o N:N via junção) e responde com
      // erro PGRST201 ("more than one relationship was found"). Sem o hint,
      // esta query volta com `error` → payload null → /api/auth/me 401 →
      // "sessão não pôde ser carregada" para TODOS os perfis.
      // NÃO remover o `!unidade_id`.
      "id,nome,email,perfil,status,avatar_url,unidade_id,unidade:unidades!unidade_id(nome)",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    // Antes o erro era engolido silenciosamente (o `if (error || !data)`
    // devolvia null sem log), por isso a causa raiz não aparecia nos logs do
    // servidor. Logamos o erro real do PostgREST para diagnóstico.
    console.error("AUTH_ME_PAYLOAD_QUERY_ERROR", {
      userId,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return null;
  }

  if (!data) {
    return null;
  }

  // Normaliza o embedding (PostgREST pode devolver objeto OU array dependendo
  // do cardinality que ele inferir do schema). Defensive sobre ambos.
  const raw = data as Record<string, unknown>;
  const unidadeRel = raw.unidade;
  const unidadeRow = Array.isArray(unidadeRel) ? unidadeRel[0] : unidadeRel;
  const unidadeNome = (unidadeRow as { nome?: string } | null | undefined)?.nome ?? null;

  const userRow: UsuarioBaseRow = {
    id: String(raw.id ?? ""),
    nome: String(raw.nome ?? ""),
    email: String(raw.email ?? ""),
    perfil: String(raw.perfil ?? ""),
    status: String(raw.status ?? ""),
    avatar_url: typeof raw.avatar_url === "string" ? urlParaNavegador(raw.avatar_url) : null,
    unidade_id: typeof raw.unidade_id === "string" ? raw.unidade_id : null,
    unidade_nome: unidadeNome,
  };

  return buildAuthPayloadFromUserRecord(userRow);
}
