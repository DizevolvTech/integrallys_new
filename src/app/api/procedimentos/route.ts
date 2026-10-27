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
import { gravarSuprimentosProcedimento, lerSuprimentosProcedimento } from "./suprimentos-input";

async function listProcedimentos(
  session: Awaited<ReturnType<typeof getRequestAuth>>,
) {
  const supabase = getAppSupabase();
  const [{ data, error }, vinculos] = await Promise.all([
    supabase
      .from("procedimentos")
      .select(
        "id,nome,codigo,descricao,valor,duracao_min,tem_retorno,prazo_retorno_dias,valor_retorno,tem_pacote,intervalo_recorrencia_dias,quantidade_sugerida_pacote,ativo,baixa_suprimentos",
      )
      .order("nome", { ascending: true }),
    supabase
      .from("procedimento_suprimentos")
      .select("procedimento_id,suprimento_id,quantidade,suprimentos(nome)"),
  ]);

  if (error) {
    return supabaseErrorResponse(error, "Falha ao carregar procedimentos");
  }
  if (vinculos.error) {
    return supabaseErrorResponse(vinculos.error, "Falha ao carregar procedimentos");
  }

  const suprimentosPorProcedimento = new Map<string, Array<{ suprimentoId: string; nome: string; quantidade: number }>>();
  for (const v of vinculos.data ?? []) {
    const ref = v.suprimentos as { nome?: string } | Array<{ nome?: string }> | null;
    const nome = String((Array.isArray(ref) ? ref[0]?.nome : ref?.nome) ?? "");
    const lista = suprimentosPorProcedimento.get(String(v.procedimento_id)) ?? [];
    lista.push({ suprimentoId: String(v.suprimento_id), nome, quantidade: Number(v.quantidade) });
    suprimentosPorProcedimento.set(String(v.procedimento_id), lista);
  }

  return NextResponse.json({
    data: (data ?? []).map((row) => ({
      ...mapProcedimentoItem(row),
      baixaSuprimentos: row.baixa_suprimentos === true,
      suprimentos: suprimentosPorProcedimento.get(String(row.id)) ?? [],
    })),
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

  const suprimentos = lerSuprimentosProcedimento(body);
  if (!suprimentos.ok) {
    return serverErrorResponse(suprimentos.error, "INVALID_SUPRIMENTOS", 400);
  }

  const supabase = getAppSupabase();
  const { data: criado, error } = await supabase
    .from("procedimentos")
    .insert({
      ...buildProcedimentoPayload(body, { autoCodigo: true }),
      ...(suprimentos.baixa !== undefined ? { baixa_suprimentos: suprimentos.baixa } : {}),
    })
    .select("id")
    .single();

  if (error || !criado) {
    return supabaseErrorResponse(error ?? { message: "Falha" }, "Falha ao criar procedimento");
  }
  if (suprimentos.itens) {
    const erroVinculo = await gravarSuprimentosProcedimento(supabase, String(criado.id), suprimentos.itens);
    if (erroVinculo) return supabaseErrorResponse(erroVinculo, "Procedimento criado, mas falhou ao salvar os suprimentos");
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

  const suprimentos = lerSuprimentosProcedimento(body);
  if (!suprimentos.ok) {
    return serverErrorResponse(suprimentos.error, "INVALID_SUPRIMENTOS", 400);
  }

  const supabase = getAppSupabase();
  const { error } = await supabase
    .from("procedimentos")
    .update({
      ...buildProcedimentoPayload(body, { autoCodigo: false }),
      ...(suprimentos.baixa !== undefined ? { baixa_suprimentos: suprimentos.baixa } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", String(body.id));

  if (error) {
    return supabaseErrorResponse(error, "Falha ao atualizar procedimento");
  }
  if (suprimentos.itens) {
    const erroVinculo = await gravarSuprimentosProcedimento(supabase, String(body.id), suprimentos.itens);
    if (erroVinculo) return supabaseErrorResponse(erroVinculo, "Falha ao salvar os suprimentos do procedimento");
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
