import { NextResponse, type NextRequest } from "next/server";
import {
  getAppSupabase,
  serverErrorResponse,
  supabaseErrorResponse,
} from "@/lib/app-api";
import { requirePermission } from "@/lib/authz";
import { mapProcedimentoItem } from "@/lib/domain-mappers";
import { authErrorResponse, getRequestAuth } from "@/lib/request-auth";
import { buildProcedimentoPayload } from "./procedimento-input";

async function listProcedimentos(
  session: Awaited<ReturnType<typeof getRequestAuth>>,
) {
  const supabase = getAppSupabase();
  const { data, error } = await supabase
    .from("procedimentos")
    .select(
      "id,nome,codigo,descricao,valor,duracao_min,tem_retorno,prazo_retorno_dias,valor_retorno,tem_pacote,intervalo_recorrencia_dias,quantidade_sugerida_pacote,ativo",
    )
    .order("nome", { ascending: true });

  if (error) {
    return supabaseErrorResponse(error, "Falha ao carregar procedimentos");
  }

  return NextResponse.json({
    data: (data ?? []).map((row) => mapProcedimentoItem(row)),
    meta: session,
  });
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request);
  if (!session) return authErrorResponse();

  const denied = await requirePermission(
    session.userId,
    "procedimentos",
    "read",
  );
  if (denied) return denied;

  return listProcedimentos(session);
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request);
  if (!session) return authErrorResponse();

  const denied = await requirePermission(
    session.userId,
    "procedimentos",
    "create",
  );
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body?.nome) {
    return serverErrorResponse(
      "Procedimento inválido",
      "INVALID_PROCEDIMENTO",
      400,
    );
  }

  const supabase = getAppSupabase();
  const { error } = await supabase
    .from("procedimentos")
    .insert(buildProcedimentoPayload(body, { autoCodigo: true }));

  if (error) {
    return supabaseErrorResponse(error, "Falha ao criar procedimento");
  }

  return listProcedimentos(session);
}

export async function PUT(request: NextRequest) {
  const session = await getRequestAuth(request);
  if (!session) return authErrorResponse();

  const denied = await requirePermission(
    session.userId,
    "procedimentos",
    "update",
  );
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body?.id || !body?.nome) {
    return serverErrorResponse(
      "Procedimento inválido",
      "INVALID_PROCEDIMENTO",
      400,
    );
  }

  const supabase = getAppSupabase();
  const { error } = await supabase
    .from("procedimentos")
    .update({
      ...buildProcedimentoPayload(body, { autoCodigo: false }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", String(body.id));

  if (error) {
    return supabaseErrorResponse(error, "Falha ao atualizar procedimento");
  }

  return listProcedimentos(session);
}

export async function DELETE(request: NextRequest) {
  const session = await getRequestAuth(request);
  if (!session) return authErrorResponse();

  const denied = await requirePermission(
    session.userId,
    "procedimentos",
    "delete",
  );
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body?.id) {
    return serverErrorResponse(
      "Procedimento inválido",
      "INVALID_PROCEDIMENTO",
      400,
    );
  }

  const supabase = getAppSupabase();
  const { error } = await supabase
    .from("procedimentos")
    .delete()
    .eq("id", String(body.id));

  if (error) {
    return supabaseErrorResponse(error, "Falha ao excluir procedimento");
  }

  return listProcedimentos(session);
}
